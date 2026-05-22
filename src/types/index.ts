import { Document, Types, Model } from 'mongoose';

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

export type UserRoleType = 'customer' | 'super_admin' | 'admin' | 'staff' | 'rider' | 'vendor' | 'vendor_admin' | 'branch_admin';

export interface IPackaging extends Document {
  name: string;
  price: number;
  isActive: boolean;
  isDefault: boolean;
  vendor: Types.ObjectId;
  branch: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddress extends Document {
  userId: Types.ObjectId;
  name: string;
  coordinates: { lat: number; lng: number };
  regions: {
    country: string;
    locality?: string;
    sublocality?: string;
    sublocality_level_1?: string;
    administrative_area_level_1?: string;
    plus_code?: string;
    political?: string;
  };
  address: string;
  details?: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  vendor?: Types.ObjectId;
  branch?: Types.ObjectId;
  services?: Types.ObjectId[];
  workingHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
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
  service: Types.ObjectId | IService;
  name: string;
  details?: string;
  order: number;
  slug: string;
  icon?: string | null;
  iconPublicId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBreak extends Document {
  staff: Types.ObjectId | IUser;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  reason?: string;
  createdAt: Date;
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
  _id?: Types.ObjectId;
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
  options: IOption[];
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

export interface ISelectedModifierOption {
  modifierId: Types.ObjectId;
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
  modifiers: Types.ObjectId[] | IProductModifier[];
  selectedModifierOptions: ISelectedModifierOption[];
  skus: Types.DocumentArray<ISKU & Types.Subdocument>;
  status: boolean;
  trackInventory: boolean;
  duration?: string;
  buffertime?: string;
  // Event fields
  venue?: string;
  location?: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    place_id?: string;
  };
  startDate?: Date;
  endDate?: Date;
  openAt?: string;
  ageLimit?: number;
  dresscode?: string;
  maxTicket?: number;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  generateSKUs(): Promise<IProduct>;
  generateCombinations(variants: any[]): any[][];
  generateSKUCode(attributes: ISKUAttribute[]): string;
  updateSKU(skuId: string | Types.ObjectId, updateData: Partial<ISKU>): Promise<IProduct>;
  deleteSKU(skuId: string | Types.ObjectId): Promise<IProduct>;
}

export interface ICartItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId | IProduct;
  skuId: Types.ObjectId;
  quantity: number;
  priceAtAddition: number;
  variants?: Array<{ variantId: Types.ObjectId; optionId: Types.ObjectId }>;
  modifiers?: Array<{ modifierId: Types.ObjectId; optionId: Types.ObjectId }>;
}

export interface ICartGroup {
  vendorId: Types.ObjectId | IVendor;
  branchId: Types.ObjectId | IBranch;
  items: ICartItem[];
  groupSubtotal: number;
}


export interface ICart extends Document {
  userId: Types.ObjectId | IUser;
  cartGroups: ICartGroup[];
  totalCartValue: number;
  totalItems: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  sku: Types.ObjectId;
  product: Types.ObjectId | IProduct;
  title: string;
  quantity: number;
  unitPrice: number;
  variants?: Array<{ variantId: Types.ObjectId; optionId: Types.ObjectId }>;
  modifiers?: Array<{ modifierId: Types.ObjectId; optionId: Types.ObjectId }>;
  packagingChoice?: {
    id: string;
    name: string;
    fee: number;
  };
}

export interface IPricing {
  subtotal: number;
  discounts: number;
  packagingFee: number;
  schedulingFee: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

export interface ITiming {
  isScheduled: boolean;
  scheduledAt?: Date | null;
}

export interface IInvoiceLineItem {
  label: string;
  amount: number;
}

export interface IReceipt extends Document {
  order?: Types.ObjectId | IOrder;
  appointment?: Types.ObjectId;
  ticket?: Types.ObjectId | ITicket;
  laundry?: Types.ObjectId;
  invoice: Types.ObjectId | IInvoice;
  customer: Types.ObjectId | IUser;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: "mpesa" | "paystack" | "cash";
  issuedAt: Date;
  pdfUrl?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment extends Document {
  paymentNumber: string;
  invoice: (Types.ObjectId | IInvoice)[];
  customer: Types.ObjectId | IUser;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  method: "mpesa" | "paystack" | "cash" | "post_to_bill" | "cod";
  amount: number;
  currency: string;
  processorRefs?: {
    daraja?: {
      merchantRequestId?: string;
      checkoutRequestId?: string;
    };
    paystack?: {
      reference?: string;
    };
  };
  status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  type?: "BOOKING_FEE" | "FULLPAYMENT";
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoice extends Document {
  order?: Types.ObjectId | IOrder;
  appointment?: Types.ObjectId;
  ticket?: Types.ObjectId | ITicket;
  laundry?: Types.ObjectId;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  invoiceNumber: string;
  lineItems?: IInvoiceLineItem[];
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED";
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICouponUsage {
  user: Types.ObjectId | IUser;
  usedAt: Date;
}

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number;
  isActive: boolean;
  hasExpiry: boolean;
  expiryDate?: Date;
  hasUsageLimit: boolean;
  usageLimit?: number;
  usedCount: number;
  isFirstTimeOnly: boolean;
  applicableProducts: Types.ObjectId[] | IProduct[];
  applicableCategories: Types.ObjectId[] | IProductCategory[];
  excludedProducts: Types.ObjectId[] | IProduct[];
  excludedCategories: Types.ObjectId[] | IProductCategory[];
  vendor?: Types.ObjectId | IVendor;
  branch?: Types.ObjectId | IBranch;
  createdBy: Types.ObjectId | IUser;
  lastUsedBy: ICouponUsage[];
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isExpired: boolean;
  isUsageLimitReached: boolean;
  isValid: boolean;
  remainingUsage: number | null;

  // Methods
  validateCoupon(userId: string, orderAmount?: number): { isValid: boolean; message: string };
  calculateDiscount(orderAmount: number): number;
  incrementUsage(userId: string): Promise<ICoupon>;
}

export interface ICouponModel extends Model<ICoupon> {
  generateUniqueCode(length?: number): Promise<string>;
}

export interface IOrder extends Document {
  customer: Types.ObjectId | IUser;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  createdBy: Types.ObjectId | IUser;
  location: "in_shop" | "away";
  type: "pickup" | "delivery";
  items: IOrderItem[];
  pricing: IPricing;
  timing: ITiming;
  address?: Types.ObjectId | null;
  paymentPreference: {
    mode: "post_to_bill" | "pay_now" | "cash" | "cod";
    method?: "mpesa_stk" | "paystack_card" | null;
  };
  status: "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
  invoice?: Types.ObjectId | null;
  receipt?: Types.ObjectId | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicket extends Document {
  ticketNumber: string;
  event: Types.ObjectId | IProduct;
  skuId: Types.ObjectId;
  details: {
    name: string;
    email: string;
    phone: string;
    [key: string]: any; // for extra details
  };
  type: string;
  qrCodeData?: string;
  pdfUrl?: string;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  status: 'PENDING' | 'BOOKED' | 'CANCELLED' | 'USED' | 'EXPIRED';
  createdAt: Date;
  updatedAt: Date;
}

export interface IAppointmentItem {
  service: Types.ObjectId | IProduct;
  staff: Types.ObjectId | IUser;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  amount: number;
}

export interface IAppointment extends Document {
  appointmentNumber: string;
  customer: Types.ObjectId | IUser;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  staff: Array<Types.ObjectId | IUser>;
  items: IAppointmentItem[];
  overallStartTime: Date;
  overallEndTime: Date;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  bookingFeeAmount: number;
  remainingAmount: number;
  checkedInAt?: Date;
  actualEndTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}



