import { Module } from '@nestjs/common';
import { BookingsModule } from '../modules/bookings/bookings.module';
import { AppConfigModule } from '../platform/config/config.module';
import { DatabaseModule } from '../platform/database/database.module';
import { GraphqlModule } from '../platform/graphql/graphql.module';

@Module({
  imports: [AppConfigModule, GraphqlModule, DatabaseModule, BookingsModule],
})
export class AppModule {}
