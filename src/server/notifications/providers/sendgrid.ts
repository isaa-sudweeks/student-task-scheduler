import { ReminderDeliveryStatus } from '@prisma/client';
import { env } from '@/env';
import type {
  ReminderDeliveryContext,
  ReminderDeliveryResult,
  ReminderDeliveryService,
} from '../types';

export class SendgridEmailProvider implements ReminderDeliveryService {
  async send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult> {
    if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'SendGrid credentials are not configured.',
      };
    }

    if (!context.user.email) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'User email address is missing.',
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [
                {
                  email: context.user.email,
                  name: context.user.name ?? undefined,
                },
              ],
            },
          ],
          from: {
            email: env.SENDGRID_FROM_EMAIL,
            name: 'Student Task Scheduler',
          },
          subject: context.message.subject,
          content: [
            {
              type: 'text/plain',
              value: context.message.body,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: ReminderDeliveryStatus.FAILED,
          error: `SendGrid error: ${response.status} ${errorText}`,
        };
      }

      return { status: ReminderDeliveryStatus.SENT };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown SendGrid error';
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: message,
      };
    }
  }
}
