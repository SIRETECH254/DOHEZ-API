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

export interface IProductType extends Document {
  name: string;
  details?: string;
  order: number;
  slug: string;
  icon?: string | null;
  iconPublicId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductCategory extends Document {
  name: string;
  details?: string;
  icon?: string | null;
  iconPublicId?: string | null;
  sort: number;
  slug: string;
  productType: Types.ObjectId | IProductType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOption {
  value: string;
  isActive: boolean;
  sortOrder: number;
}

export interface IVariant extends Document {
  name: string;
  options: IOption[];
  branchId: Types.ObjectId | IBranch;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductModifier extends Document {
  name: string;
  description?: string;
  price: number;
  min_selection: number;
  max_selection: number;
  is_required: boolean;
  branchId: Types.ObjectId | IBranch;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISKUAttribute {
  variantId: Types.ObjectId;
  optionId: Types.ObjectId;
}

export interface ISKU {
  _id?: Types.ObjectId;
  attributes: ISKUAttribute[];
  price: number;
  comparePrice?: number;
  stock: number;
  skuCode: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  allowPreOrder: boolean;
  preOrderStock: number;
  lowStockThreshold: number;
}

export interface ISelectedVariantOption {
  variantId: Types.ObjectId;
  optionIds: Types.ObjectId[];
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  details?: string;
  price: number;
  offerPrice?: number;
  images: Array<{ url: string; publicId: string }>;
  category: Types.ObjectId | IProductCategory;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  service: Types.ObjectId | IService;
  variants: Types.ObjectId[] | IVariant[];
  selectedVariantOptions: ISelectedVariantOption[];
  skus: Types.DocumentArray<ISKU & Types.Subdocument>;
  status: boolean;
  trackInventory: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  generateSKUs(): Promise<IProduct>;
  generateCombinations(variants: any[]): any[][];
  generateSKUCode(attributes: ISKUAttribute[]): string;
  updateSKU(skuId: string | Types.ObjectId, updateData: Partial<ISKU>): Promise<IProduct>;
  deleteSKU(skuId: string | Types.ObjectId): Promise<IProduct>;
}
