import type { ReminderChannel } from '@prisma/client';
import type { ReminderDeliveryService } from '../types';
import { SendgridEmailProvider } from './sendgrid';
import { TwilioSmsProvider } from './twilio';
import { WebPushProvider } from './webPush';

export function createDefaultReminderProviders(): Record<
  ReminderChannel,
  ReminderDeliveryService
> {
  return {
    EMAIL: new SendgridEmailProvider(),
    SMS: new TwilioSmsProvider(),
    PUSH: new WebPushProvider(),
  };
}
