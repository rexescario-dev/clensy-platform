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
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'clensy'),
        password: config.get('DB_PASSWORD', 'clensy_dev'),
        database: config.get('DB_NAME', 'clensy'),
        autoLoadEntities: true,
        // Schema comes from migrations now (pnpm migration:run), not runtime sync.
        synchronize: false,
        logging: isAppDebugEnabled(config.get('APP_DEBUG'))
          ? ['query']
          : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
