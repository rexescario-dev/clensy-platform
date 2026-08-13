export interface CreateBookingCommand {
  customerName: string;
  serviceType: string;
  scheduledAt: Date;
}
