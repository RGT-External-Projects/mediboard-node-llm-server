import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DiscordNotificationService } from "./discord-notification.service";


@Module({
  imports:[ConfigModule],
  controllers: [],
  providers: [DiscordNotificationService],
  exports: [DiscordNotificationService],
})
export class NotificationModule {}