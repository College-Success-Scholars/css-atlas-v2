import type { RenderedNotification } from "../notification.types.js";

export interface ChannelDeliveryResult {
  ok: boolean;
  attempts: number;
  error: string | null;
}

export interface NotificationChannel {
  readonly name: string;
  send(target: string, message: RenderedNotification): Promise<ChannelDeliveryResult>;
}
