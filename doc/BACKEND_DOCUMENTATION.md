# E-Commerce API - Backend Documentation

## Table of Contents
- [Technology Stack](#technology-stack)
- [Required Packages](#required-packages)
- [Database Models](#database-models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Architecture Overview](#architecture-overview)

---

## Technology Stack

- Runtime: Node.js
- Framework: Express.js
- Language: TypeScript
- Database: MongoDB (Mongoose ODM)
- Realtime: Socket.io (order tracking and live updates)
- API Docs: Swagger (swagger-jsdoc, swagger-ui-express)

---

## Required Packages

### Core Dependencies (from package.json)
```json
{
  "africastalking": "^0.7.7",
  "axios": "^1.13.3",
  "bcryptjs": "^3.0.2",
  "cloudinary": "^1.41.3",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.18.3",
  "multer": "^2.0.2",
  "multer-storage-cloudinary": "^4.0.0",
  "@sendgrid/mail": "^8.1.4",
  "socket.io": "^4.8.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "validator": "^13.15.0"
}
```

### Dev Dependencies
```json
{
  "ts-node": "^10.9.2",
  "typescript": "^5.9.2",
  "nodemon": "^3.1.10"
}
```
(Type definitions such as @types/express, @types/node, etc. are listed in dependencies in the current package.json.)

---

## Database Models

### 1. User Model
```typescript
interface IUser {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // hashed
  roles: ObjectId[]; // Role references
  phone: string;
  savedLocations?: Array<{
    name: string; // hostel, home, campus spot
    address: string;
    latitude?: number;
    longitude?: number;
    isDefault: boolean;
  }>;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  businessProfile?: {
    vendorName: string;
    description?: string;
    logo?: string;
    category?: ObjectId;
  };
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Role Model
```typescript
interface IRole {
  _id: ObjectId;
  name: string; // customer | vendor | rider | admin | super-admin
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3. Vendor Model
```typescript
interface IVendor {
  _id: ObjectId;
  ownerId: ObjectId; // User ID with role vendor
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  categoryId: ObjectId;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Branch Model
```typescript
interface IBranch {
  _id: ObjectId;
  vendorId: ObjectId;
  name: string;
  description?: string;
  location: {
    address: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  contact: {
    phone: string;
    email: string;
  };
  operatingHours: {
    monday: Array<{ start: string; end: string }>;
    tuesday: Array<{ start: string; end: string }>;
    wednesday: Array<{ start: string; end: string }>;
    thursday: Array<{ start: string; end: string }>;
    friday: Array<{ start: string; end: string }>;
    saturday: Array<{ start: string; end: string }>;
    sunday: Array<{ start: string; end: string }>;
  };
  isMainBranch: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 5. Category Model
```typescript
interface ICategory {
  _id: ObjectId;
  name: string;
  slug: string; // URL-friendly name
  description?: string;
  image?: string;
  parentCategory?: ObjectId; // For sub-categories
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 6. Product Model
```typescript
interface IProduct {
  _id: ObjectId;
  vendorId: ObjectId;
  branchId: ObjectId;
  categoryId: ObjectId;
  name: string;
  description?: string;
  price: number;
  stockLevel: number;
  images: string[];
  attributes?: Record<string, any>;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 7. Task Model
```typescript
interface ITask {
  _id: ObjectId;
  vendorId: ObjectId;
  name: string; // e.g., "Laundry", "Cleaning", "Event", "Appointment"
  description?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 8. Service Model
```typescript
interface IService {
  _id: ObjectId;
  task: ObjectId; // Parent Task relationship
  vendorId: ObjectId;
  branchId?: ObjectId;
  name: string; // e.g., "Shirt Wash", "VIP Ticket", "Consultation"
  description?: string;
  price: number;
  durationMinutes?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
### 9. Order Model
```typescript
interface IOrder {
  _id: ObjectId;
  customer: ObjectId;
  vendor: ObjectId;
  branch: ObjectId;
  riderId?: ObjectId;
  items: Array<{
    product?: ObjectId;
    serviceId?: ObjectId;
    quantity: number;
    price: number;
    name: string;
    serviceDetails?: {
      appointmentTime?: Date;
      laundryPickUpTime?: Date;
      ticketHolderName?: string;
    };
  }>;
```

---

### 10. Invoice Model
```typescript
interface IInvoice {
  _id: ObjectId;
  order: ObjectId;
  number: string;
  lineItems: Array<{
    label: string;
    amount: number;
  }>;
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 11. Receipt Model
```typescript
interface IReceipt {
  _id: string;
  orderId: string; // Order ObjectId
  invoiceId: string; // Invoice ObjectId
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: "mpesa_stk" | "paystack_card" | "cash";
  issuedAt: Date;
  pdfUrl?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### 12. Payment Model
```typescript
interface IPayment {
  _id: string;
  invoiceId: string; // Invoice ObjectId
  method: "mpesa_stk" | "paystack_card" | "cash" | "post_to_bill" | "cod";
  amount: number;
  currency: string; // Default: "KES"
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
  rawPayload?: any; // Raw webhook payload for debugging
  createdAt: Date;
  updatedAt: Date;
}
```


### 12. Coupon Model
```typescript
interface ICoupon {
  _id: ObjectId;
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
  applicableProducts: ObjectId[];
  applicableCategories: ObjectId[];
  excludedProducts: ObjectId[];
  excludedCategories: ObjectId[];
  createdBy: ObjectId;
  lastUsedBy: Array<{
    user: ObjectId;
    usedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 13. Audit Log Model
  orderType: "IMMEDIATE" | "SCHEDULED" | "IN_SHOP";
  scheduledTime?: Date;
  status: "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "PICKED_UP";
  deliveryAddress: string;
  deliveryCoordinates?: [number, number];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Index:
```typescript
db.orders.createIndex({ vendorId: 1, status: 1, createdAt: -1 })
```

---

### 7. Payment Model
```typescript
interface IPayment {
  _id: ObjectId;
  orderId?: ObjectId;
  paymentNumber: string;
  amount: number;
  currency: "KES";
  type: "ORDER_PAYMENT" | "SERVICE_BOOKING";
  method: "MPESA" | "CARD" | "CASH";
  status: "PENDING" | "SUCCESS" | "FAILED";
  transactionRef?: string;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 8. Rider Availability Model
```typescript
interface IRiderAvailability {
  _id: ObjectId;
  riderId: ObjectId;
  status: "ONLINE" | "BUSY" | "OFFLINE";
  currentLocation?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  lastUpdated: Date;
}
```

---

### 9. Contact Model
```typescript
interface IContact {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  userId?: ObjectId | null;  // set when submitter is authenticated
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 10. Notification Model
```typescript
interface INotification {
  _id: ObjectId;
  userId: ObjectId;
  orderId?: ObjectId;
  type: "SMS" | "EMAIL" | "PUSH" | "IN_APP";
  title?: string;
  message: string;
  status: "PENDING" | "SENT" | "FAILED";
  scheduledFor?: Date;
  createdAt: Date;
}
```

---

### 11. Newsletter Model
```typescript
interface INewsletter {
  _id: ObjectId;
  email: string;
  userId?: ObjectId | null;
  status: "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
  subscribedAt: Date;
  unsubscribedAt?: Date;
  source: "WEBSITE" | "ADMIN" | "API";
  tags: string[];
  createdAt: Date;
}
```

---

### 12. Review Model
```typescript
interface IReview {
  _id: ObjectId;
  userId: ObjectId;
  orderId: ObjectId;
  vendorId: ObjectId;
  productId?: ObjectId; // Optional if reviewing a specific product
  rating: number; // 1-5
  comment?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 13. StoreConfiguration Model
```typescript
interface IStoreConfiguration {
  _id: ObjectId;
  platformCommissionRate: number; // Percentage
  baseDeliveryFee: number;
  currency: "KES";
  minOrderValue: number;
  operatingStatus: "OPEN" | "CLOSED" | "MAINTENANCE";
  notificationSettings: {
    sendSMS: boolean;
    sendEmail: boolean;
    sendPush: boolean;
  };
  businessTimezone: "Africa/Nairobi";
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Controllers

### 1. Auth Controllers

#### `authController.ts`
- `register()` - Create user account (admin, vendor, rider, or customer)
- `verifyOTP()` - Verify OTP and activate account
- `resendOTP()` - Resend OTP for verification
- `login()` - Authenticate with phone/email and password
- `forgotPassword()` - Request password reset
- `resetPassword()` - Reset password with token
- `refreshToken()` - Renew JWT access token
- `logout()` - Invalidate session
- `getMe()` - Get current user profile

---

### 2. Role Controllers

#### `roleController.ts`
- `getAllRoles()` - List roles (admin)
- `getRole()` - Get role by ID (admin)
- `createRole()` - Create role (admin)
- `updateRole()` - Update role (admin)
- `deleteRole()` - Delete role (admin)

---

### 3. User Controllers

#### `userController.ts`
- `getUserProfile()` - Get authenticated user's profile
- `updateUserProfile()` - Update own profile details
- `changePassword()` - Change password
- `getSavedLocations()` - Get user's saved delivery locations
- `addSavedLocation()` - Add a new delivery location
- `getAllUsers()` - Admin list of users
- `getUserById()` - Get user by ID (admin)
- `updateUserStatus()` - Activate/deactivate user (admin)

---

### 4. Vendor & Branch Controllers

#### `vendorController.ts`
- `registerVendor()` - Create vendor profile
- `getVendors()` - List all vendors (public)
- `getVendorById()` - Get vendor details
- `updateVendorProfile()` - Update business details
- `deleteVendor()` - Remove vendor (admin)

#### `branchController.ts`
- `createBranch()` - Add a new branch for a vendor
- `getBranches()` - List branches for a vendor
- `getBranchById()` - Get specific branch details
- `updateBranch()` - Update branch details
- `deleteBranch()` - Remove a branch

---

### 5. Category Controllers

#### `categoryController.ts`
- `createCategory()` - Create a new category (admin)
- `getCategories()` - List all categories
- `getCategory()` - Get category details
- `updateCategory()` - Update category (admin)
- `deleteCategory()` - Delete category (admin)

---

### 6. Product Controllers

#### `productController.ts`
- `createProduct()` - Add a new product
- `getProducts()` - List products with filters
- `getProductById()` - Get product details
- `updateProduct()` - Update product details
- `deleteProduct()` - Delete product
- `updateStock()` - Update stock levels

---

### 7. Task & Service Controllers

#### `taskController.ts`
- `createTask()` - Define a new task category (e.g., Laundry)
- `getTasks()` - List tasks offered by a vendor
- `updateTask()` - Update task description/image
- `deleteTask()` - Remove task and its services

#### `serviceController.ts`
- `createService()` - Add a service to a task (e.g., Shirt Wash under Laundry)
- `getServices()` - List services for a specific task
- `getServiceById()` - Get service details
- `updateService()` - Update service price/duration
- `deleteService()` - Remove service

---

### 8. Order Controllers

#### `orderController.ts`
- `createOrder()` - Place a new order (products or task-services)
- `confirmOrder()` - Confirm order after payment
- `updateOrderStatus()` - Update status
- `assignRider()` - Assign a rider
- `cancelOrder()` - Cancel order
- `getOrders()` - List orders
- `getMyOrders()` - Customer's order history
- `getOrderById()` - Get single order details

---

### 8. Payment Controllers

#### `paymentController.ts`
- `payInvoice()` - Initiate payment for an invoice
- `mpesaWebhook()` - Handle M-Pesa callbacks
- `queryMpesaByCheckoutId()` - Query payment status by checkout ID
- `getPayments()` - List all payments (admin)
- `getPaymentById()` - Get specific payment details by ID


---

### 9. Rider Controllers

#### `riderController.ts`
- `updateAvailability()` - Set status (ONLINE, BUSY, OFFLINE)
- `updateLocation()` - Update rider's current coordinates
- `getAvailableRiders()` - List riders for assignment (admin/vendor)
- `getRiderDeliveries()` - Get current deliveries assigned to rider

---
j
### 10. Notification Controllers

#### `notificationController.ts`
- `sendNotification()` - Send notification to user
- `getUserNotifications()` - List current user's notifications
- `markAsRead()` - Mark notification as read
- `sendBulkNotification()` - Send to all or specific roles (admin)

---

### 11. Store Configuration Controllers

#### `storeConfigurationController.ts`
- `getStoreConfiguration()` - Get platform settings
- `updateStoreConfiguration()` - Update platform settings (admin)

---

### 12. Support & Marketing Controllers

#### `contactController.ts`
- `submitContact()` - Submit contact message
- `getContacts()` - List submissions (admin)

#### `newsletterController.ts`
- `subscribeNewsletter()` - Subscribe to newsletter
- `unsubscribeNewsletter()` - Unsubscribe from newsletter
- `sendNewsletter()` - Send newsletter (admin)

---

### 13. Review Controllers

#### `reviewController.ts`
- `createReview()` - Create review for a product or vendor
- `getReviews()` - List reviews (public)
- `updateReviewStatus()` - Approve/Reject review (admin)

---



## Routes

### Auth Routes
Base: `/api/auth`

```typescript
POST   /register                  // Register user
POST   /verify-otp                // Verify OTP
POST   /resend-otp                // Resend OTP
POST   /login                     // Login
POST   /forgot-password           // Request password reset
POST   /reset-password/:token     // Reset password
POST   /refresh-token             // Refresh JWT
POST   /logout                    // Logout
GET    /me                        // Current user profile
```

---

### Role Routes
Base: `/api/roles`

```typescript
GET    /                          // Get all roles (admin)
GET    /:roleId                   // Get single role (admin)
POST   /                          // Create role (admin)
PUT    /:roleId                   // Update role (admin)
DELETE /:roleId                   // Delete role (admin)
```

---

### User Routes
Base: `/api/users`

```typescript
GET    /profile                   // My profile
PUT    /profile                   // Update my profile
PUT    /change-password           // Change password
GET    /locations                 // Get saved locations
POST   /locations                 // Add saved location
GET    /                          // List users (admin)
PUT    /:userId/status            // Update user status (admin)
```

---

### Vendor & Branch Routes
Base: `/api/vendors`

```typescript
POST   /register                  // Register as vendor
GET    /                          // List all vendors
GET    /:vendorId                 // Get vendor details
PUT    /profile                   // Update vendor profile
DELETE /:vendorId                 // Delete vendor (admin)

// Branches (Nested or separate)
POST   /:vendorId/branches        // Add a branch to vendor
GET    /:vendorId/branches        // List vendor branches
GET    /branches/:branchId        // Get specific branch info
PUT    /branches/:branchId        // Update branch details
DELETE /branches/:branchId        // Delete branch
```

---

### Category Routes
Base: `/api/categories`

```typescript
GET    /                          // List categories
GET    /:categoryId               // Get category info
POST   /                          // Create (admin)
PUT    /:categoryId               // Update (admin)
DELETE /:categoryId               // Delete (admin)
```

---

### Product Routes
Base: `/api/products`

```typescript
GET    /                          // List products (with filters)
GET    /:productId                // Get product details
POST   /                          // Create product (vendor)
PUT    /:productId                // Update product (vendor)
DELETE /:productId                // Delete product (vendor)
PATCH  /:productId/stock          // Update stock level
```

---

### Task & Service Routes
Base: `/api/tasks`

```typescript
GET    /                          // List vendor tasks
POST   /                          // Create a new task (e.g. Laundry)
PUT    /:taskId                   // Update task
DELETE /:taskId                   // Delete task and its services

// Services (Nested under tasks)
POST   /:taskId/services          // Add a service (e.g. Wash)
GET    /:taskId/services          // List services for a task
GET    /services/:serviceId       // Get specific service details
PUT    /services/:serviceId       // Update service (price, etc)
DELETE /services/:serviceId       // Delete service
```

---

### Order Routes
Base: `/api/orders`

```typescript
POST   /                          // Place a new order
GET    /my                        // My order history
GET    /                          // List orders (admin/vendor/rider)
GET    /:orderId                  // Get order details
PATCH  /:orderId/status           // Update order status
PATCH  /:orderId/assign-rider     // Assign rider (admin/vendor)
PATCH  /:orderId/cancel           // Cancel order
```

---

### Payment Routes
Base: `/api/payments`

```typescript
POST   /initiate                  // Initiate M-Pesa/Card payment
POST   /webhooks/mpesa            // M-Pesa webhook
POST   /webhooks/paystack         // Paystack webhook
GET    /my                        // My payment history
GET    /                          // List payments (admin)
```

---

### Rider Routes
Base: `/api/riders`

```typescript
PATCH  /status                    // Update online/offline status
PATCH  /location                  // Update current location
GET    /available                 // List available riders
GET    /deliveries                // My active deliveries
```

---

### Notification Routes
Base: `/api/notifications`

```typescript
GET    /                          // My notifications
PATCH  /:notificationId/read      // Mark as read
POST   /bulk                      // Send bulk notification (admin)
```

---

### Store Configuration Routes
Base: `/api/store-configuration`

```typescript
GET    /                          // Get configuration
PUT    /                          // Update configuration (admin)
```

---

### Support & Marketing Routes
Base: `/api/support`

```typescript
POST   /contact                   // Submit contact message
GET    /contacts                  // List contacts (admin)
POST   /newsletter/subscribe      // Subscribe
POST   /newsletter/unsubscribe    // Unsubscribe
POST   /newsletter/send           // Send newsletter (admin)
```

---

### Review Routes
Base: `/api/reviews`

```typescript
POST   /                          // Create review
GET    /product/:productId        // Get reviews for a product
GET    /vendor/:vendorId          // Get reviews for a vendor
PATCH  /:reviewId/status          // Update status (admin)
```

---

### Utility Routes
```typescript
GET    /api                        // API root info
GET    /api/health                 // Health check
GET    /api/docs                   // Swagger UI
```

## Architecture Overview

### Folder Structure
```
ecommerce-api/
├── src/
│   ├── models/
│   │   ├── Role.ts
│   │   ├── User.ts
│   │   ├── Vendor.ts
│   │   ├── Branch.ts
│   │   ├── Category.ts
│   │   ├── Product.ts
│   │   ├── Task.ts
│   │   ├── Service.ts
│   │   ├── Order.ts
│   │   ├── Payment.ts
│   │   ├── RiderAvailability.ts
│   │   └── StoreConfiguration.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── vendorController.ts
│   │   ├── branchController.ts
│   │   ├── categoryController.ts
│   │   ├── productController.ts
│   │   ├── taskController.ts
│   │   ├── serviceController.ts
│   │   ├── orderController.ts
│   │   ├── paymentController.ts
│   │   └── riderController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── vendorRoutes.ts
│   │   ├── categoryRoutes.ts
│   │   ├── productRoutes.ts
│   │   ├── taskRoutes.ts
│   │   ├── orderRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   └── riderRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts                # JWT auth, authorizeRoles
│   │   └── errorHandler.ts        # Global error handling
│   ├── services/
│   │   ├── external/
│   │   │   ├── darajaService.ts   # M-Pesa integration
│   │   │   ├── emailService.ts    # SendGrid email
│   │   │   ├── paystackService.ts # Paystack integration
│   │   │   └── smsService.ts      # Africa's Talking SMS
│   │   └── internal/
│   │       ├── notificationService.ts
│   │       ├── paymentService.ts
│   │       └── orderTrackingService.ts
│   ├── types/
│   │   └── index.ts               # Shared interfaces
│   ├── utils/
│   │   ├── authHelpers.ts         # JWT + OTP helpers
│   │   └── orderHelpers.ts        # Status calculation helpers
│   └── index.ts                   # App entry point
├── doc/                           # Documentation
├── .env                           # Environment variables
├── package.json
└── tsconfig.json
```

---

### Middleware

#### Authentication Middleware (auth.ts)
- `authenticateToken` - Verify JWT and load user
- `authorizeRoles(allowedRoles)` - Role-based access control (Admin, Vendor, Rider, Customer)
- `requireOwnershipOrAdmin` - Check if user owns the resource (e.g., Order, Profile)

#### Error Handling
- `errorHandler` - Centralized error formatter

---

### Order & Inventory Logic

The platform manages orders through specialized real-time lifecycles based on the service type:

1. **Regular Products**:
   - **Inventory Check**: System verifies `stockLevel`.
   - **Flow**: PLACED → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED.

2. **Appointments**:
   - **Scheduling**: Customer selects `appointmentTime` based on vendor `operatingHours`.
   - **Flow**: PLACED → ACCEPTED → COMPLETED (at venue).

3. **Event Tickets**:
   - **Stock Management**: `stockLevel` represents total tickets available.
   - **Flow**: PLACED → CONFIRMED (Ticket generated) → USED (at event).

4. **Laundry Services**:
   - **Logistics**: Includes `laundryPickUpTime`. Rider picks up items before preparation.
   - **Flow**: PLACED → ACCEPTED → PICKUP_IN_PROGRESS → PREPARING (Washing) → READY → OUT_FOR_DELIVERY → DELIVERED.

For all types, Socket.io provides live status updates to the customer and vendor.

---

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=4500
API_BASE_URL=https://api.dohez.com
CORS_ORIGIN=http://localhost:8081

# Database
MONGO_URI=mongodb://localhost:27017/ecommerce

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Payments
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
PAYSTACK_SECRET_KEY=your_paystack_key

# Notifications
SENDGRID_API_KEY=your_sendgrid_key
AFRICAS_TALKING_API_KEY=your_at_key
```

---

### Security Features

1. Authentication
   - JWT-based authentication
   - Password hashing with bcryptjs
2. Authorization
   - Role-based access control (admin, staff, customer)
3. API Security
   - CORS allowlist
   - Rate limiting for auth and payments
   - Error responses omit stack traces in production

---

### Integration Points

1. Payment Gateways
   - M-Pesa for mobile money
   - Card payments via provider
2. Communication
   - Email via SendGrid
   - SMS via Africa's Talking
   - Push via mobile provider (if enabled)
3. Background Jobs
   - Cron-based reminders
4. Real-time
   - Socket.io for live appointment status updates

---

### PDF Generation

- Optional receipt or booking summary PDF using PDFKit
- Store receipts with appointment or payment records if enabled

---

## Getting Started

### Installation
```bash
cd appointment-api
npm install
```

### Database Setup
```bash
# Ensure MongoDB is running
mongod
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

---

### 14. Packaging Model
```typescript
interface IPackaging {
  _id: ObjectId;
  name: string;
  price: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### ObjectId Population
All GET endpoints automatically populate ObjectId references with their related documents. This ensures complete data is returned in API responses:

- **User references** (`userId`, `customer`, `riderId`, `vendorId`) are populated with `firstName`, `lastName`, `email`, and `phone`
- **Order references** (`orderId`) are populated with order details including nested `customer`, `vendor`, `branch`, and `items`
- **Product/Service references** (`product`, `categoryId`) are populated with product and category details
- **Branch references** (`branchId`) are populated with branch location and contact info
- **Role references** (`roles`) are populated with role information

This means when you fetch an order, payment, or review, all related ObjectId fields will contain the full document data instead of just the ID.

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## Status Codes

- 200 - OK
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 500 - Internal Server Error

---

Last Updated: April 2026
Version: 1.0.0

Note: This documentation reflects the proposed architecture for the e-commerce platform.
