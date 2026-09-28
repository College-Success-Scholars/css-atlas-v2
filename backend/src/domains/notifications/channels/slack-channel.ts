import { retryWithBackoff } from "../../../utils/retry-with-backoff.js";
import type { NotificationChannel, ChannelDeliveryResult } from "./channel.interface.js";
import type { RenderedNotification } from "../notification.types.js";

const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

class SlackRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Slack rate limit exceeded");
  }
}

export class SlackChannel implements NotificationChannel {
  readonly name = "slack";

  constructor(
    private readonly token = process.env.SLACK_BOT_TOKEN,
    private readonly maxAttempts = Number(process.env.SLACK_NOTIFICATION_MAX_ATTEMPTS ?? 3),
    private readonly fetcher: typeof fetch = fetch
  ) {}

  private async post(target: string, message: RenderedNotification, withBlocks: boolean): Promise<string | null> {
    const response = await this.fetcher(SLACK_POST_MESSAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: target, text: message.text, ...(withBlocks && message.blocks ? { blocks: message.blocks } : {}) }),
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After") ?? 0);
      throw new SlackRateLimitError(Math.max(0, seconds) * 1000);
    }
    const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    return response.ok && body.ok ? null : body.error ?? `Slack returned HTTP ${response.status}`;
  }

  async send(target: string, message: RenderedNotification): Promise<ChannelDeliveryResult> {
    if (!this.token) return { ok: false, attempts: 0, error: "SLACK_BOT_TOKEN is not configured" };
    try {
      const { attempts } = await retryWithBackoff(
        async () => {
          let error = await this.post(target, message, true);
          if (error === "invalid_blocks" && message.blocks) error = await this.post(target, message, false);
          if (error) throw new Error(error);
        },
        {
          maxAttempts: Math.max(1, this.maxAttempts),
          retryDelayMs: (error) => error instanceof SlackRateLimitError ? error.retryAfterMs : null,
        }
      );
      return { ok: true, attempts, error: null };
    } catch (error) {
      return {
        ok: false,
        attempts: Math.max(1, this.maxAttempts),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
