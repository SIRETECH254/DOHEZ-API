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
