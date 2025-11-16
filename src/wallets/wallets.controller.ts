import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { CreatePayoutAccountDto } from './dto/payout-account.dto';
import type { CreatePayoutRequestDto } from './dto/payout-request.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard) // Lindungi semua endpoint wallet
export class WalletsController {
  constructor(private readonly walletService: WalletsService) {}

  @Get('balance')
  async getMyWallet(@GetUser('id') userId: string) {
    const wallet = await this.walletService.getWalletByUserId(userId);
    return {
      success: true,
      data: {
        balance: wallet.balance,
      },
    };
  }

  @Get('history')
  async getMyWalletHistory(@GetUser('id') userId: string) {
    const history = await this.walletService.getWalletHistory(userId);
    return {
      success: true,
      data: history,
    };
  }

  // --- Payout Accounts ---
  @Post('payout-accounts')
  @HttpCode(HttpStatus.CREATED)
  async addPayoutAccount(
    @GetUser('id') userId: string,
    @Body() dto: CreatePayoutAccountDto,
  ) {
    const account = await this.walletService.addPayoutAccount(userId, dto);
    return {
      success: true,
      message: 'Rekening bank berhasil ditambahkan',
      data: account,
    };
  }

  @Get('payout-accounts')
  async listPayoutAccounts(@GetUser('id') userId: string) {
    const accounts = await this.walletService.listPayoutAccounts(userId);
    return {
      success: true,
      data: accounts,
    };
  }

  @Delete('payout-accounts/:id')
  async removePayoutAccount(
    @GetUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    await this.walletService.removePayoutAccount(userId, accountId);
    return {
      success: true,
      message: 'Rekening bank berhasil dihapus',
    };
  }

  // --- Payout Requests ---
  @Post('payout-request')
  @HttpCode(HttpStatus.OK)
  async createPayoutRequest(
    @GetUser('id') userId: string,
    @Body() dto: CreatePayoutRequestDto,
  ) {
    const request = await this.walletService.createPayoutRequest(userId, dto);
    return {
      success: true,
      message: 'Permintaan penarikan dana berhasil dibuat',
      data: request,
    };
  }

  @Get('payout-requests')
  async listPayoutRequests(@GetUser('id') userId: string) {
    const requests = await this.walletService.listPayoutRequests(userId);
    return {
      success: true,
      data: requests,
    };
  }
}