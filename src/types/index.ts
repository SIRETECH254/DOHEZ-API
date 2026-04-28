import { Document, Types } from 'mongoose';

/**
 * Base response interface for notification services.
 */
export interface NotificationResponse {
  success: boolean;
  messageId?: string;
  cost?: number | string;
  error?: string;
}

/**
 * Combined response for multi-channel notifications.
 */
export interface MultiChannelNotificationResponse {
  email?: NotificationResponse | null;
  sms?: NotificationResponse | null;
  success?: boolean;
  error?: string;
}

export type UserRoleType = 'customer' | 'super_admin' | 'admin' | 'staff' | 'rider';

export interface IRole extends Document {
  name: UserRoleType | string;
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: Types.ObjectId[] | IRole[];
  phone: string;
  isActive: boolean;
  isVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask extends Document {
  name: string;
  description?: string;
  image?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IService extends Document {
  task: Types.ObjectId | ITask;
  name: string;
  description?: string;
  image?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorCategory extends Document {
  vendorType?: Types.ObjectId | IVendorType;
  name: string;
  description?: string;
  slug: string;
  image?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendor extends Document {
  userId: Types.ObjectId | IUser;
  service?: Types.ObjectId | IService | null;
  name: string;
  phone: string;
  email: string;
  isActive: boolean;
  isFeatured: boolean;
  logo?: string | null;
  logoPublicId?: string | null;
  cover?: string | null;
  coverPublicId?: string | null;
  location: {
    name?: string;
    address: string;
    regions: {
      administrative_area_level_3?: string | null;
      administrative_area_level_1?: string | null;
      country: string;
    };
    coordinates: {
      lat: number;
      lng: number;
    };
    place_id: string;
  };
  branches: Types.ObjectId[] | IBranch[];
  slug: string;
  details?: string;
  kraPin?: string | null;
  regNo?: string | null;
  vendorCategory: Types.ObjectId | IVendorCategory;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranch extends Document {
  vendorId: Types.ObjectId | IVendor;
  name: string;
  email: string;
  phone: string;
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    place_id?: string;
  };
  cover?: string | null;
  coverPublicId?: string | null;
  fulfillmentConfig: Record<string, any>;
  workingHours: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  gallery: Array<{ url: string; publicId: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorType extends Document {
  name: string;
  description?: string;
  slug: string;
  image?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
