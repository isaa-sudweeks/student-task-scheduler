import { ReminderDeliveryStatus } from '@prisma/client';
import { env } from '@/env';
import type {
  ReminderDeliveryContext,
  ReminderDeliveryResult,
  ReminderDeliveryService,
} from '../types';

export class TwilioSmsProvider implements ReminderDeliveryService {
  async send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult> {
    if (
      !env.TWILIO_ACCOUNT_SID ||
      !env.TWILIO_AUTH_TOKEN ||
      !env.TWILIO_FROM_NUMBER
    ) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'Twilio credentials are not configured.',
      };
    }

    if (!context.user.smsNumber) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'User phone number is missing.',
      };
    }

    try {
      const params = new URLSearchParams({
        To: context.user.smsNumber,
        From: env.TWILIO_FROM_NUMBER,
        Body: context.message.body,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: ReminderDeliveryStatus.FAILED,
          error: `Twilio error: ${response.status} ${errorText}`,
        };
      }

      return { status: ReminderDeliveryStatus.SENT };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Twilio error';
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: message,
      };
    }
  }
}
