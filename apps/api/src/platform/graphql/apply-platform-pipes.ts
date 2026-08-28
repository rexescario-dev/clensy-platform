import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ClampPagingLimitPipe } from './clamp-paging-limit.pipe';

/**
 * Clamp must run before ValidationPipe so 9.5.0 PropertyMax sees limit ≤ 100.
 * Registering ClampPagingLimitPipe only on ReadResolver pipes is too late:
 * global ValidationPipe already rejected limit > max.
 */
export function applyPlatformPipes(app: INestApplication): void {
  app.useGlobalPipes(
    new ClampPagingLimitPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
