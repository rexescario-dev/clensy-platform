import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../domain/booking';
import { BookingStatus } from '../../domain/booking-status';
import { BookingEntity } from '../../infrastructure/persistence/booking.entity';
import { CreateBookingCommand } from '../commands/create-booking.command';
import { UpdateBookingCommand } from '../commands/update-booking.command';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly bookingRepository: Repository<BookingEntity>,
  ) {}

  create(command: CreateBookingCommand): Promise<Booking> {
    const booking = this.bookingRepository.create({
      customerName: command.customerName,
      serviceType: command.serviceType,
      scheduledAt: command.scheduledAt,
      status: BookingStatus.PENDING,
    });
    return this.bookingRepository.save(booking);
  }

  findAll(): Promise<Booking[]> {
    return this.bookingRepository.find();
  }

  private async findEntity(id: string): Promise<BookingEntity> {
    const booking = await this.bookingRepository.findOneBy({ id });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return booking;
  }

  async findOne(id: string): Promise<Booking> {
    return this.findEntity(id);
  }

  async update(id: string, command: UpdateBookingCommand): Promise<Booking> {
    const booking = await this.findEntity(id);
    Object.assign(booking, command);
    return this.bookingRepository.save(booking);
  }

  async remove(id: string): Promise<Booking> {
    const booking = await this.findEntity(id);
    // .remove() strips the id from the passed entity — snapshot it first so
    // the caller still gets back what was deleted.
    const removed: Booking = { ...booking };
    await this.bookingRepository.remove(booking);
    return removed;
  }
}
