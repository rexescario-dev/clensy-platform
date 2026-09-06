import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';

export interface ReceiveLaundryOrderCommand {
  actorId: string;
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}
