import { env } from '../../config/env.js';
import { randomToken } from '../../utils/crypto.js';
import { PaymentMethod } from '../../constants/index.js';
import { logger } from '../../lib/logger.js';

export interface ChargeRequest {
  amount: number;
  currency: string;
  method: string;
  reference: string;
  phoneNumber?: string; // M-Pesa
  metadata?: Record<string, unknown>;
}

export interface ChargeResult {
  success: boolean;
  providerRef?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  message: string;
}

// Uniform interface every payment provider implements. In production, swap the
// sandbox bodies for real Daraja (M-Pesa) / card-processor / bank-rails calls.
export interface PaymentGateway {
  readonly method: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

// ─── M-Pesa (Safaricom Daraja STK Push) ──────────────────────────────────────
class MpesaGateway implements PaymentGateway {
  readonly method = PaymentMethod.MPESA;
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    if (env.payments.sandbox) {
      logger.info('M-Pesa sandbox STK push', { amount: req.amount, phone: req.phoneNumber });
      return { success: true, status: 'PENDING', providerRef: `ws_CO_${randomToken(8)}`, message: 'STK push sent. Enter your M-Pesa PIN to complete.' };
    }
    // TODO(prod): OAuth token → STK push against env.payments.mpesa.* then await callback.
    throw new Error('M-Pesa production credentials not configured');
  }
}

// ─── Card (Visa / MasterCard via processor) ──────────────────────────────────
class CardGateway implements PaymentGateway {
  constructor(public readonly method: string) {}
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    if (env.payments.sandbox) {
      logger.info('Card sandbox charge', { amount: req.amount, method: this.method });
      return { success: true, status: 'SUCCESS', providerRef: `ch_${randomToken(10)}`, message: `${this.method} payment authorised (sandbox).` };
    }
    throw new Error('Card gateway production credentials not configured');
  }
}

// ─── Bank transfer (manual reconciliation / RTGS) ────────────────────────────
class BankTransferGateway implements PaymentGateway {
  readonly method = PaymentMethod.BANK_TRANSFER;
  async charge(req: ChargeRequest): Promise<ChargeResult> {
    return {
      success: true,
      status: 'PENDING',
      providerRef: `BNK-${req.reference.slice(0, 8).toUpperCase()}`,
      message: 'Bank transfer initiated. Payment confirmed on reconciliation.',
    };
  }
}

const registry: Record<string, PaymentGateway> = {
  [PaymentMethod.MPESA]: new MpesaGateway(),
  [PaymentMethod.VISA]: new CardGateway(PaymentMethod.VISA),
  [PaymentMethod.MASTERCARD]: new CardGateway(PaymentMethod.MASTERCARD),
  [PaymentMethod.BANK_TRANSFER]: new BankTransferGateway(),
};

export function getGateway(method: string): PaymentGateway {
  const gw = registry[method];
  if (!gw) throw new Error(`Unsupported payment method: ${method}`);
  return gw;
}
