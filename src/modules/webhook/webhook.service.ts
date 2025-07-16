import { Injectable, Logger } from "@nestjs/common";

export interface WebhookPayload {
  jobId: string;
  status: "success" | "failure";
  userId: string;
  fileName: string;
  timestamp: string;
  data?: any;
  error?: string;
}

export interface WebhookStats {
  totalAttempts: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  lastDeliveryAt?: string;
  urlStats: Record<
    string,
    {
      attempts: number;
      successes: number;
      failures: number;
      lastAttempt?: string;
      lastSuccess?: string;
    }
  >;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  // In-memory arrays for webhook URLs
  private webhookUrls: string[] = [
    // Default webhook URLs - can be modified at runtime
    "http://localhost:3001/webhooks/job-status",
    "https://api-dev.mediboard.ai/api/webhook/ocr2",
  ];

  // Internal stats tracking
  private stats: WebhookStats = {
    totalAttempts: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    successRate: 0,
    urlStats: {},
  };

  constructor() {
    this.logger.log(
      `Webhook service initialized with ${this.webhookUrls.length} URLs`
    );
    this.initializeUrlStats();
  }

  private initializeUrlStats(): void {
    this.webhookUrls.forEach((url) => {
      if (!this.stats.urlStats[url]) {
        this.stats.urlStats[url] = {
          attempts: 0,
          successes: 0,
          failures: 0,
        };
      }
    });
  }

  async fireWebhooks(payload: WebhookPayload): Promise<void> {
    if (this.webhookUrls.length === 0) {
      this.logger.debug(
        "No webhook URLs configured, skipping webhook notifications"
      );
      return;
    }

    this.logger.log(
      `Firing webhooks for job ${payload.jobId} with status: ${payload.status}`
    );

    // Fire all webhooks concurrently
    const webhookPromises = this.webhookUrls.map((url) =>
      this.sendWebhook(url, payload)
    );

    try {
      const results = await Promise.allSettled(webhookPromises);
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      // Update global stats
      this.stats.totalAttempts += this.webhookUrls.length;
      this.stats.successfulDeliveries += successful;
      this.stats.failedDeliveries += failed;
      this.stats.successRate =
        (this.stats.successfulDeliveries / this.stats.totalAttempts) * 100;
      this.stats.lastDeliveryAt = new Date().toISOString();

      this.logger.log(
        `Webhook delivery summary for job ${payload.jobId}: ${successful} successful, ${failed} failed`
      );
    } catch (error) {
      this.logger.error(
        `Error in webhook delivery for job ${payload.jobId}:`,
        error
      );
    }
  }

  private async sendWebhook(
    url: string,
    payload: WebhookPayload
  ): Promise<void> {
    const now = new Date().toISOString();

    // Initialize URL stats if not exists
    if (!this.stats.urlStats[url]) {
      this.stats.urlStats[url] = {
        attempts: 0,
        successes: 0,
        failures: 0,
      };
    }

    this.stats.urlStats[url].attempts++;
    this.stats.urlStats[url].lastAttempt = now;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Medical-Processing-Service/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        this.stats.urlStats[url].successes++;
        this.stats.urlStats[url].lastSuccess = now;
        this.logger.log(
          `✅ Webhook delivered to ${url} for job ${payload.jobId} (${response.status})`
        );
      } else {
        this.stats.urlStats[url].failures++;
        this.logger.error(
          `❌ Webhook failed to ${url} for job ${payload.jobId}: HTTP ${response.status}`
        );
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.stats.urlStats[url].failures++;
      this.logger.error(
        `❌ Failed to deliver webhook to ${url} for job ${payload.jobId}:`,
        error.message
      );
      throw error;
    }
  }

  // Methods to manage webhook URLs at runtime
  addWebhookUrl(url: string): void {
    if (!this.webhookUrls.includes(url)) {
      this.webhookUrls.push(url);
      this.stats.urlStats[url] = {
        attempts: 0,
        successes: 0,
        failures: 0,
      };
      this.logger.log(`Added webhook URL: ${url}`);
    }
  }

  removeWebhookUrl(url: string): void {
    const index = this.webhookUrls.indexOf(url);
    if (index > -1) {
      this.webhookUrls.splice(index, 1);
      delete this.stats.urlStats[url];
      this.logger.log(`Removed webhook URL: ${url}`);
    }
  }

  getWebhookUrls(): string[] {
    return [...this.webhookUrls];
  }

  clearWebhookUrls(): void {
    this.webhookUrls = [];
    this.stats.urlStats = {};
    this.logger.log("Cleared all webhook URLs");
  }

  setWebhookUrls(urls: string[]): void {
    this.webhookUrls = [...urls];
    // Reset URL stats for new URLs
    this.stats.urlStats = {};
    this.initializeUrlStats();
    this.logger.log(`Set webhook URLs: ${urls.length} URLs configured`);
  }

  // Get webhook statistics
  getStats(): WebhookStats {
    return {
      ...this.stats,
      urlStats: { ...this.stats.urlStats },
    };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      successRate: 0,
      urlStats: {},
    };
    this.initializeUrlStats();
    this.logger.log("Webhook statistics reset");
  }

  // Get health status
  getHealthStatus(): {
    healthy: boolean;
    configuredUrls: number;
    recentSuccessRate: number;
    lastDelivery?: string;
  } {
    return {
      healthy: this.stats.successRate >= 50 || this.stats.totalAttempts === 0,
      configuredUrls: this.webhookUrls.length,
      recentSuccessRate: this.stats.successRate,
      lastDelivery: this.stats.lastDeliveryAt,
    };
  }
}
