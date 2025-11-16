import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as midtransClient from 'midtrans-client';
import type { Order, User } from '@prisma/client';
import { createHmac } from 'crypto';

@Injectable()
export class PaymentsService {
  private snap: midtransClient.Snap;
  private midtransServerKey: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.midtransServerKey = this.configService.get<string>('MIDTRANS_SERVER_KEY')!;
    
    this.snap = new midtransClient.Snap({
      isProduction: false, // Ganti ke true di production
      serverKey: this.midtransServerKey,
      clientKey: this.configService.get<string>('MIDTRANS_CLIENT_KEY'),
    });
  }

  /**
   * Membuat sesi pembayaran Midtrans Snap
   */
  async createPayment(order: Order, user: User) {
    // Cek jika sudah ada payment pending
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId: order.id },
    });

    if (existingPayment && existingPayment.status === 'pending') {
      return {
        token: existingPayment.gatewayToken,
        redirectUrl: existingPayment.gatewayRedirectUrl,
      };
    }

    const parameter = {
      transaction_details: {
        order_id: order.id,
        gross_amount: order.price.toNumber(),
      },
      customer_details: {
        first_name: user.fullName,
        email: user.email,
        phone: user.phoneNumber,
      },
      item_details: [
        {
          id: order.serviceId,
          price: order.price.toNumber(),
          quantity: 1,
          name: order.title,
        },
      ],
      // Tambahkan callback URL jika perlu
    };

    try {
      const transaction = await this.snap.createTransaction(parameter);
      const { token, redirect_url } = transaction;

      // Simpan/Update payment record di DB
      const payment = await this.prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          amount: order.price,
          status: 'pending',
          gatewayToken: token,
          gatewayRedirectUrl: redirect_url,
        },
        create: {
          orderId: order.id,
          amount: order.price,
          status: 'pending',
          gatewayToken: token,
          gatewayRedirectUrl: redirect_url,
        },
      });

      return { token, redirectUrl: redirect_url };
    } catch (error) {
      console.error('Midtrans Error:', error);
      throw new InternalServerErrorException('Gagal membuat sesi pembayaran');
    }
  }

  /**
   * Memproses Webhook dari Midtrans
   * PENTING: Idempotency & Signature Validation
   */
  async handlePaymentWebhook(payload: any) {
    const { order_id, transaction_status, transaction_id, status_code, gross_amount, signature_key } = payload;

    // 1. Verifikasi Signature Key (KEAMANAN KRITIS)
    const expectedSignature = this.verifySignature(order_id, status_code, gross_amount, this.midtransServerKey);
    
    if (signature_key !== expectedSignature) {
      throw new BadRequestException('Invalid signature');
    }

    // 2. Dapatkan order dan payment
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    // 3. Idempotency Check: Jika status sudah "settlement", jangan proses lagi
    if (payment.status === 'settlement' && transaction_status === 'settlement') {
      return { message: 'Payment already processed' };
    }
    
    // 4. Update status payment
    let updatedStatus = payment.status;

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Pembayaran sukses
      updatedStatus = 'settlement';
      // Panggil OrdersService untuk mengubah status order
      // Kita return orderId agar bisa dipanggil dari controller
    } else if (transaction_status === 'pending') {
      updatedStatus = 'pending';
    } else if (transaction_status === 'expire') {
      updatedStatus = 'expire';
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      updatedStatus = 'cancelled';
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: updatedStatus,
        transactionId: transaction_id,
        paymentType: payload.payment_type,
      },
    });

    // Jika sukses, kembalikan orderId agar OrdersService bisa dipanggil
    if (updatedStatus === 'settlement') {
      return {
        orderId: order_id,
        transactionData: payload,
      };
    }

    return { message: `Payment status updated to ${updatedStatus}` };
  }

  /**
   * Helper untuk verifikasi signature Midtrans
   */
  private verifySignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
    const hash = createHmac('sha512', serverKey);
    hash.update(`${orderId}${statusCode}${grossAmount}${serverKey}`);
    return hash.digest('hex');
  }
}