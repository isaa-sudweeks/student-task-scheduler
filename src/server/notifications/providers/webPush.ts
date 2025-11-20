import { ReminderDeliveryStatus } from '@prisma/client';
import webpush from 'web-push';
import { env } from '@/env';
import type {
  ReminderDeliveryContext,
  ReminderDeliveryResult,
  ReminderDeliveryService,
} from '../types';

const CONTACT_EMAIL = env.SENDGRID_FROM_EMAIL ?? 'notifications@example.com';

if (env.WEB_PUSH_VAPID_PUBLIC_KEY && env.WEB_PUSH_VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${CONTACT_EMAIL}`,
    env.WEB_PUSH_VAPID_PUBLIC_KEY,
    env.WEB_PUSH_VAPID_PRIVATE_KEY,
  );
}

export class WebPushProvider implements ReminderDeliveryService {
  async send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult> {
    if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'Web Push VAPID keys are not configured.',
      };
    }

    const subscription = context.user.pushSubscription;
    if (!subscription?.endpoint) {
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: 'User push subscription is missing.',
      };
    }

    try {
      await webpush.sendNotification(
        subscription as unknown as webpush.PushSubscription,
        JSON.stringify({
          title: context.message.subject,
          body: context.message.body,
          data: {
            taskId: context.task.id,
            reminderId: context.reminderId,
          },
        }),
      );

      return { status: ReminderDeliveryStatus.SENT };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown web push error';
      return {
        status: ReminderDeliveryStatus.FAILED,
        error: message,
      };
    }
  }
}
