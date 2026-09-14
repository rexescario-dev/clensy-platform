import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isAppDebugEnabled } from '../config/app-debug';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoLoadEntities: true,
        database: config.get('DB_NAME', 'clensy'),
        host: config.get('DB_HOST', 'localhost'),
        logging: isAppDebugEnabled(config.get('APP_DEBUG')) ? ['query'] : false,
        password: config.get('DB_PASSWORD', 'clensy_dev'),
        port: config.get<number>('DB_PORT', 5432),
        // Schema comes from migrations now (pnpm migration:run), not runtime sync.
        synchronize: false,
        type: 'postgres',
        username: config.get('DB_USERNAME', 'clensy'),
      }),
    }),
  ],
})
export class DatabaseModule {}
