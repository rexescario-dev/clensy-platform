import { BookingStatus } from './booking-status';

export interface Booking {
  id: string;
  customerName: string;
  serviceType: string;
  scheduledAt: Date;
  status: BookingStatus;
  createdAt: Date;
}
