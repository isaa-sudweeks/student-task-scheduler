import type {
  ReminderChannel,
  ReminderDeliveryStatus,
} from '@prisma/client';

export interface StoredPushSubscription {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface ReminderDeliveryContext {
  reminderId: string;
  channel: ReminderChannel;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    timezone: string;
    smsNumber: string | null;
    pushSubscription: StoredPushSubscription | null;
  };
  task: {
    id: string;
    title: string;
    notes: string | null;
    dueAt: Date | null;
  };
  message: {
    subject: string;
    body: string;
  };
}

export interface ReminderDeliveryResult {
  status: ReminderDeliveryStatus;
  error?: string | null;
}

export interface ReminderDeliveryService {
  send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult>;
}
