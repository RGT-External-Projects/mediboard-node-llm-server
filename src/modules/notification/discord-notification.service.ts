import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebhookPayload } from "../webhook/webhook.service";
import { Logger } from "@nestjs/common";

@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);
  private readonly webhookUrl: string | undefined;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
  }

  async notifyFailure(payload:WebhookPayload):Promise<void>{
    if (!this.webhookUrl || this.webhookUrl.trim() === ''){
      this.logger.warn('DISCORD_WEBHOOK_URL is not configured');
      return;
    }

    const discordbody = {
      "embeds":[
        {"title": "OCR / document processing failure",
          "color": 15158332,
          "fields": [
              {
                "name": "Job ID",
                "value": payload.jobId,
              },
              {
                "name":'File',
                "value":payload.fileName,
              },
              {
                "name":"User ID",
                "value":payload.userId,
              },
              {
                "name":"Error",
                "value":payload.error || "Unknown error",
              },
              {
                "name":"Timestamp",
                "value":payload.timestamp,
              }
            ]
        }
      ]
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordbody),
      })

      if (!response.ok){
        this.logger.error(`Failed to send Discord notification: ${response.statusText}`);
      }
    } catch(e){
      this.logger.error(`Failed to send Discord notification: ${e.message}`);
    }
  }
}
