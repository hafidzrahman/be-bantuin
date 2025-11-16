import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService, // Inject OrdersService
  ) {}

  /**
   * Webhook payment callback dari Midtrans
   * Endpoint ini HARUS public
   */
  @Public() // Tandai sebagai public
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async paymentWebhook(@Body() payload: any) {
    
    // 1. Biarkan PaymentsService memvalidasi & memproses webhook
    const result = await this.paymentsService.handlePaymentWebhook(payload);

    // 2. Jika pembayaran sukses, panggil OrdersService
    if (result && result.orderId && result.transactionData) {
      try {
        await this.ordersService.handlePaymentSuccess(
          result.orderId,
          result.transactionData,
        );
      } catch (error) {
        // Handle error jika update order gagal, mungkin perlu di-retry
        console.error(`Failed to update order ${result.orderId} after payment`, error);
        // Penting: Midtrans akan menganggap 200 OK sebagai sukses
        // Jika gagal, kita harus return non-200 agar Midtrans retry
        // Tapi untuk idempotency, kita log saja
      }
    }

    return { success: true, message: result.message || 'Webhook processed' };
  }
}