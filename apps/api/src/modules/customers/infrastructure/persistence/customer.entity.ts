import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyEntity } from './property.entity';
import { Customer } from '../../domain/customer';

// `properties` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object; application writes MUST NOT read or
// assign it. Non-eager, no cascade, no lazy: true.
@Entity()
export class CustomerEntity implements Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column()
  email!: string;

  @Column()
  phone!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => PropertyEntity, (property) => property.customer)
  properties!: PropertyEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
