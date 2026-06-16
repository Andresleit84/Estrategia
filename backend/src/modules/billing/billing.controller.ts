import {
  Controller, Get, Post, Body, Headers, Req, RawBodyRequest, HttpCode, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserSession } from '../auth/types/auth.types';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @Public()
  getPlans() {
    return this.billing.getPlans();
  }

  @Get('status')
  getStatus(@CurrentUser() user: UserSession) {
    return this.billing.getOrgBillingStatus(user.organization_id);
  }

  @Post('stripe/checkout')
  @HttpCode(200)
  createStripeCheckout(
    @CurrentUser() user: UserSession,
    @Body() body: { interval?: 'monthly' | 'annual' },
  ) {
    return this.billing.createStripeCheckout(
      user.organization_id,
      user.user_id,
      user.email,
      body.interval ?? 'monthly',
    );
  }

  @Post('stripe/portal')
  @HttpCode(200)
  stripePortal(@CurrentUser() user: UserSession) {
    return this.billing.createStripePortal(user.organization_id);
  }

  @Public()
  @Post('stripe/webhook')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('No raw body');
    await this.billing.handleStripeWebhook(req.rawBody, sig);
    return { received: true };
  }

  @Post('mercadopago/checkout')
  @HttpCode(200)
  createMpCheckout(
    @CurrentUser() user: UserSession,
    @Body() body: { interval?: 'monthly' | 'annual' },
  ) {
    return this.billing.createMercadoPagoCheckout(
      user.organization_id,
      user.user_id,
      user.email,
      body.interval ?? 'monthly',
    );
  }

  @Public()
  @Post('mercadopago/webhook')
  @HttpCode(200)
  async mpWebhook(@Body() body: Record<string, unknown>) {
    await this.billing.handleMercadoPagoWebhook(body);
    return { received: true };
  }
}
