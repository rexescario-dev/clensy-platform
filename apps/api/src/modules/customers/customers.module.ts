import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './application/services/customers.service';
import { CustomerEntity } from './infrastructure/persistence/customer.entity';

// Task 2 extends this with `PropertyEntity`/`PropertiesService`. Does not
// import `AuditModule` itself — per plan §8/Task 4, `AppModule` (the
// composition root) imports `AuditModule` alongside `CustomersModule`
// (plan line 228).
@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity])],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
