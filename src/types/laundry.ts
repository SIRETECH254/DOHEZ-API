import { Document, Types } from 'mongoose';
import { IProduct, IUser, IVendor, IBranch } from './index';

export interface ILaundry extends Document {
  laundryNumber: string;
  pickUpDate: {
    day: Date;
    hour: string;
  };
  dropDate: Date;
  services: Types.ObjectId[] | IProduct[];
  customer: Types.ObjectId | IUser;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    place_id?: string;
  };
  status: 'PENDING' | 'CONFIRMED' | 'PICKED_UP' | 'IN_PROGRESS' | 'COMPLETED' | 'DELIVERED';
  bookingFee: number;
  remainingAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
