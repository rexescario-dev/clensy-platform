import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AppConfigModule } from './platform/config/config.module';
import { DatabaseModule } from './platform/database/database.module';
import { GraphqlModule } from './platform/graphql/graphql.module';

@Module({
  imports: [AppConfigModule, GraphqlModule, DatabaseModule, BookingsModule],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}
