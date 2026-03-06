import { offlineDb } from "@/db/offline-db";
import { sleep } from "@/lib/utils";

const retryBackoffMs = (attempts: number): number => {
  const step = Math.max(1, attempts);
  return Math.min(2 ** step * 1000, 5 * 60 * 1000);
};

export type RetryHandler = (payload: unknown) => Promise<void>;

class RetryQueueService {
  private processing = false;
  private handlers: Record<string, RetryHandler> = {};

  register(type: string, handler: RetryHandler): void {
    this.handlers[type] = handler;
  }

  async process(): Promise<void> {
    if (this.processing) return;
    if (!navigator.onLine) return;

    this.processing = true;
    try {
      while (true) {
        const now = Date.now();
        const item = await offlineDb.retryQueue
          .where("nextRetryAt")
          .belowOrEqual(now)
          .first();

        if (!item || !item.id) break;

        const handler = this.handlers[item.type];
        if (!handler) {
          await offlineDb.retryQueue.delete(item.id);
          continue;
        }

        try {
          await handler(item.payload);
          await offlineDb.retryQueue.delete(item.id);
        } catch (error) {
          const attempts = item.attempts + 1;
          const message = error instanceof Error ? error.message : "Unknown retry error";
          await offlineDb.retryQueue.update(item.id, {
            attempts,
            lastError: message,
            nextRetryAt: Date.now() + retryBackoffMs(attempts)
          });
          await sleep(100);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  start(): void {
    window.addEventListener("online", () => {
      void this.process();
    });

    // Slow interval to ensure stale retries eventually flush.
    window.setInterval(() => {
      void this.process();
    }, 30_000);

    void this.process();
  }
}

export const retryQueueService = new RetryQueueService();
