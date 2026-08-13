import { BookingStatus } from '../../domain/booking-status';

export interface UpdateBookingCommand {
  customerName?: string;
  serviceType?: string;
  scheduledAt?: Date;
  status?: BookingStatus;
}
