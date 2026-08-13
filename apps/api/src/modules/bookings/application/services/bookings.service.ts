import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Booking } from '../../domain/booking';
import { BookingStatus } from '../../domain/booking-status';
import { CreateBookingCommand } from '../inputs/create-booking.command';
import { UpdateBookingCommand } from '../inputs/update-booking.command';

@Injectable()
export class BookingsService {
  // In-memory fake data — not persisted via TypeORM yet.
  private bookings: Booking[] = [
    {
      id: randomUUID(),
      customerName: 'Amara Chidi',
      serviceType: 'Standard Cleaning',
      scheduledAt: new Date('2026-08-18T09:00:00Z'),
      status: BookingStatus.CONFIRMED,
      createdAt: new Date('2026-08-10T14:32:00Z'),
    },
    {
      id: randomUUID(),
      customerName: 'Liam Novak',
      serviceType: 'Deep Cleaning',
      scheduledAt: new Date('2026-08-20T13:30:00Z'),
      status: BookingStatus.PENDING,
      createdAt: new Date('2026-08-12T09:05:00Z'),
    },
    {
      id: randomUUID(),
      customerName: 'Priya Raman',
      serviceType: 'Move-Out Cleaning',
      scheduledAt: new Date('2026-08-15T11:00:00Z'),
      status: BookingStatus.COMPLETED,
      createdAt: new Date('2026-08-05T16:20:00Z'),
    },
  ];

  create(command: CreateBookingCommand): Booking {
    const booking: Booking = {
      id: randomUUID(),
      customerName: command.customerName,
      serviceType: command.serviceType,
      scheduledAt: command.scheduledAt,
      status: BookingStatus.PENDING,
      createdAt: new Date(),
    };
    this.bookings.push(booking);
    return booking;
  }

  findAll(): Booking[] {
    return this.bookings;
  }

  findOne(id: string): Booking {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }

  update(id: string, command: UpdateBookingCommand): Booking {
    const booking = this.findOne(id);
    Object.assign(booking, command);
    return booking;
  }

  remove(id: string): Booking {
    const index = this.bookings.findIndex((b) => b.id === id);
    if (index === -1) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    const [removed] = this.bookings.splice(index, 1);
    return removed;
  }
}
