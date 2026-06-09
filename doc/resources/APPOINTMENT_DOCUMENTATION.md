# 📅 DOHEZ-API - Appointment Management Documentation

## 📋 Table of Contents
- [Appointment Management Overview](#appointment-management-overview)
- [Appointment Model](#-appointment-model)
- [Appointment Controller](#-appointment-controller)
- [Appointment Routes](#-appointment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Appointment Management Overview

The Appointment module handles all bookings, scheduling, and the lifecycle of services provided by staff to customers. It processes branch availability, staff working hours, and provides sequential multi-service booking options.

---

## 🗓️ Appointment Model

### Schema Definition
```typescript
interface IAppointment extends Document {
  appointmentNumber: string;
  customer: Types.ObjectId | IUser;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  staff: Types.ObjectId[];
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

interface IAppointmentItem {
  service: Types.ObjectId | IProduct;
  staff: Types.ObjectId | IUser;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  amount: number;
}
```

### Model Implementation

**File: `src/models/Appointment.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IAppointment, IAppointmentItem } from "../types/index";

const appointmentItemSchema = new Schema<IAppointmentItem>(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    staff: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const appointmentSchema = new Schema<IAppointment>(
  {
    appointmentNumber: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    staff: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    items: [appointmentItemSchema],
    overallStartTime: {
      type: Date,
      required: true,
    },
    overallEndTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "PENDING",
      required: true,
    },
    bookingFeeAmount: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    remainingAmount: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    checkedInAt: {
      type: Date,
    },
    actualEndTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Validate that overallEndTime > overallStartTime
appointmentSchema.pre<IAppointment>("save", async function () {
  if (this.overallStartTime && this.overallEndTime) {
    if (this.overallEndTime <= this.overallStartTime) {
      throw new Error("overallEndTime must be later than overallStartTime");
    }
  }
});

const Appointment = mongoose.model<IAppointment>("Appointment", appointmentSchema);

export default Appointment;
```

### Validation Rules
```typescript
appointmentNumber: { required: true, unique: true }
customer:          { required: true, ref: 'User' }
branch:            { required: true, ref: 'Branch' }
vendor:            { required: true, ref: 'Vendor' }
staff:             { type: Array, ref: 'User', minlength: 1 }
items:             { type: Array, required: true }
overallStartTime:  { required: true, type: Date }
overallEndTime:    { required: true, type: Date, greaterThan: overallStartTime }
status:            { enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"], default: "PENDING" }
bookingFeeAmount:  { required: true, min: 0 }
remainingAmount:   { required: true, min: 0 }
```

---

## 🎮 Appointment Controller

**File:** `src/controllers/appointmentController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Appointment from '../models/Appointment';
import Branch from '../models/Branch';
import User from '../models/User';
import Product from '../models/Product';
import { errorHandler } from '../middleware/errorHandler';
import { validateOptionAvailability, OptionItem } from '../utils/availability';
import { generateAppointmentNumber } from '../utils/appointment';
import mongoose from 'mongoose';
```

### Functions Overview

#### `createAppointment()`
**Purpose:** Create a new appointment in PENDING status  
**Access:** Authenticated Customer  
**Validation:**
- Customer is derived from the authenticated user.
- Branch and Vendor must exist and be correctly related (Branch must belong to Vendor).
- Staff and products (services) must exist and belong to the specified branch.
- `startTime`/`endTime` must be valid and available.
**Process:**
- Resolve Product/Service IDs and verify they belong to the branch.
- Validate Staff and their relationship to the branch.
- Check slot availability using `validateOptionAvailability` (working hours, breaks, existing appointments).
- Overlapping appointments only block the slot if status is `CONFIRMED` or `COMPLETED`.
- Load services and compute total service amount.
- Fetch store configuration and calculate booking fee (default: 50).
- Compute `remainingAmount` server-side (Total - Booking Fee).
- Generate a unique `appointmentNumber`.
- Save appointment with status `PENDING`.
- Send in-app notification to customer with action to confirm appointment (Placeholder).

**Controller Implementation:**
```typescript
export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch: branchId, vendor: vendorId, items, bookingFeeAmount = 50 } = req.body;
    const customerId = req.user?._id;

    if (!branchId || !vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields: branch, vendor, and items." });
    }

    // 0. Validate Branch and Vendor
    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    
    // Check if branch belongs to vendor (Branch model uses vendorId)
    if (branch.vendorId.toString() !== vendorId) {
      return next(errorHandler(400, "Branch does not belong to the specified vendor"));
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    const processedItems = [];
    const validationItems: OptionItem[] = [];

    for (const item of items) {
      const { serviceId, staffId, startTime, endTime } = item;
      
      // Resolve Product and verify it belongs to the branch
      const product = await Product.findById(serviceId);

      if (!product) {
        return next(errorHandler(404, `Product/Service not found: ${serviceId}`));
      }

      if (product.branch.toString() !== branchId || product.vendor.toString() !== vendorId) {
        return next(errorHandler(400, `Product ${product.name} does not belong to this branch/vendor`));
      }

      const amount = item.amount || product.price;
      const durationMinutes = item.durationMinutes;

      // Validate Staff
      const staff = await User.findById(staffId);
      if (!staff) return next(errorHandler(404, `Staff not found: ${staffId}`));
      
      // Check if staff belongs to the branch
      if (staff.branch?.toString() !== branchId) {
        return next(errorHandler(400, `Staff ${staff.firstName} ${staff.lastName} does not belong to this branch`));
      }

      if (!serviceId || !staffId || !startTime || !endTime) {
        return res.status(400).json({ success: false, message: "Each item must have service/product, staff, startTime, and endTime." });
      }

      validationItems.push({
        serviceId: serviceId,
        staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });

      processedItems.push({
        service: serviceId,
        staff: staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes: durationMinutes || (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000,
        amount: amount || 0
      });
    }

    const availability = await validateOptionAvailability(branchId, vendorId, validationItems);
    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    const overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));

    const appointment = await Appointment.create({
      appointmentNumber: await generateAppointmentNumber(),
      customer: customerId,
      branch: branchId,
      vendor: vendorId,
      staff: Array.from(new Set(processedItems.map(i => i.staff))),
      items: processedItems,
      overallStartTime,
      overallEndTime,
      status: "PENDING",
      bookingFeeAmount,
      remainingAmount: totalAmount - bookingFeeAmount
    });

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};
```

#### `createAppointmentByAdmin()`
**Purpose:** Create a new appointment for any customer, defaulting to PENDING status and a standard booking fee.  
**Access:** Admin, Branch Admin, Vendor Admin  
**Validation:**
- Customer, Branch, and Vendor must exist.
- Branch must belong to the specified Vendor.
- Staff and products (services) must exist and belong to the specified branch.
- Availability must be confirmed for the selected slots.
**Process:**
- Similar to customer creation but allows manual status and fee override (defaults: status='PENDING', bookingFeeAmount=50).

**Controller Implementation:**
```typescript
export const createAppointmentByAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, branch: branchId, vendor: vendorId, items, bookingFeeAmount = 50, status = "PENDING" } = req.body;

    if (!customerId || !branchId || !vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields: customerId, branch, vendor, and items." });
    }

    // 0. Validate Branch and Vendor
    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    if (branch.vendorId.toString() !== vendorId) {
      return next(errorHandler(400, "Branch does not belong to the specified vendor"));
    }
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    const processedItems = [];
    const validationItems: OptionItem[] = [];

    for (const item of items) {
      const { serviceId, staffId, startTime, endTime, amount, durationMinutes } = item;
      
      // Verify product/service exists for this branch
      const product = await Product.findById(serviceId);
      if (!product) {
        return next(errorHandler(404, `Product not found: ${serviceId}`));
      }
      if (product.branch.toString() !== branchId || product.vendor.toString() !== vendorId) {
        return next(errorHandler(400, `Product ${product.name} does not belong to this branch/vendor`));
      }

      // Validate Staff
      const staff = await User.findById(staffId);
      if (!staff) return next(errorHandler(404, `Staff not found: ${staffId}`));
      if (staff.branch?.toString() !== branchId) {
        return next(errorHandler(400, `Staff ${staff.firstName} ${staff.lastName} does not belong to this branch`));
      }

      validationItems.push({
        serviceId,
        staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });

      processedItems.push({
        service: serviceId,
        staff: staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes: durationMinutes || (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000,
        amount: amount || 0
      });
    }

    const availability = await validateOptionAvailability(branchId, vendorId, validationItems);
    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    const overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));

    const appointment = await Appointment.create({
      appointmentNumber: await generateAppointmentNumber(),
      customer: customerId,
      branch: branchId,
      vendor: vendorId,
      staff: Array.from(new Set(processedItems.map(i => i.staff))),
      items: processedItems,
      overallStartTime,
      overallEndTime,
      status,
      bookingFeeAmount,
      remainingAmount: totalAmount - bookingFeeAmount
    });

    res.status(201).json({
      success: true,
      message: "Appointment created by admin successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};
```

#### `rescheduleAppointment()`
**Purpose:** Change appointment timing.  
**Access:** Owner or Admin  
**Validation:**
- Appointment status must be `CONFIRMED` (only confirmed appointments can be rescheduled).
- User must be the owner or an admin.
- New items must be provided and valid for the branch.
**Process:**
- Verify status and authorization.
- Re-validate availability for new slots while excluding current appointment ID.
- Update items, overall times, and staff list.
- Re-calculate `remainingAmount`.

**Controller Implementation:**
```typescript
export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required for rescheduling." });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    const isOwner = appointment.customer.toString() === req.user?._id.toString();
    const isAdmin = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'].some(role => 
      req.user?.roles.some((r: any) => (typeof r === 'string' ? r : r.name) === role)
    );

    if (!isOwner && !isAdmin) return next(errorHandler(403, "Not authorized to reschedule this appointment"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be rescheduled"));
    }

    const validationItems: OptionItem[] = items.map(i => ({
      serviceId: i.serviceId,
      staffId: i.staffId,
      startTime: new Date(i.startTime),
      endTime: new Date(i.endTime)
    }));

    const availability = await validateOptionAvailability(
      appointment.branch.toString(),
      appointment.vendor.toString(),
      validationItems,
      id as string
    );

    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    const processedItems = items.map(i => ({
      service: i.serviceId,
      staff: i.staffId,
      startTime: new Date(i.startTime),
      endTime: new Date(i.endTime),
      durationMinutes: i.durationMinutes || (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000,
      amount: i.amount || 0
    }));

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    appointment.items = processedItems as any;
    appointment.overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    appointment.overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));
    appointment.remainingAmount = totalAmount - appointment.bookingFeeAmount;
    appointment.staff = Array.from(new Set(processedItems.map(i => i.staff))) as any;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};
```

#### `cancelAppointment()`
**Purpose:** Mark appointment as CANCELLED.  
**Access:** Owner or Admin  
**Validation:**
- Appointment status must be `CONFIRMED` (only confirmed appointments can be cancelled).
- Cancellation must be at least 2 hours before the appointment start time.
- User must be the owner or an admin.
**Process:**
- Verify status, timing constraints, and authorization.
- Update status to `CANCELLED`.

**Controller Implementation:**
```typescript
export const cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    const isOwner = appointment.customer.toString() === req.user?._id.toString();
    const isAdmin = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'].some(role => 
      req.user?.roles.some((r: any) => (typeof r === 'string' ? r : r.name) === role)
    );

    if (!isOwner && !isAdmin) return next(errorHandler(403, "Not authorized to cancel this appointment"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be cancelled"));
    }

    // Check if cancellation is at least 2 hours before start time
    const now = new Date();
    const startTime = new Date(appointment.overallStartTime);
    const diffInMilliseconds = startTime.getTime() - now.getTime();
    const diffInHours = diffInMilliseconds / (1000 * 60 * 60);

    if (diffInHours < 2) {
      return next(errorHandler(400, "Cancellations must be at least 2 hours before the appointment start time"));
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment cancelled successfully" });
  } catch (error) {
    next(error);
  }
};
```

#### `checkIn()`
**Purpose:** Record customer arrival time.  
**Access:** Admin, Staff  
**Validation:**
- Appointment status must be `CONFIRMED` (only confirmed appointments can be checked in).
- Check-in is only allowed on the same day as the appointment start time.
**Process:**
- Verify status and date.
- Update `checkedInAt` timestamp.

**Controller Implementation:**
```typescript
export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be checked in"));
    }

    // Check if check-in is on the same day
    const now = new Date();
    const appointmentDate = new Date(appointment.overallStartTime);
    
    const isSameDay = 
      now.getFullYear() === appointmentDate.getFullYear() &&
      now.getMonth() === appointmentDate.getMonth() &&
      now.getDate() === appointmentDate.getDate();

    if (!isSameDay) {
      return next(errorHandler(400, "Check-in is only allowed on the same day as the appointment"));
    }

    appointment.checkedInAt = new Date();
    await appointment.save();

    res.status(200).json({ success: true, message: "Checked in successfully", checkedInAt: appointment.checkedInAt });
  } catch (error) {
    next(error);
  }
};
```

#### `completeAppointment()`
**Purpose:** Mark service as COMPLETED and record actual end time.  
**Access:** Admin, Staff  
**Validation:**
- Appointment must exist.
**Process:**
- Update status to `COMPLETED` and record `actualEndTime`.

**Controller Implementation:**
```typescript
export const completeAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    appointment.status = "COMPLETED";
    appointment.actualEndTime = new Date();
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment completed successfully", actualEndTime: appointment.actualEndTime });
  } catch (error) {
    next(error);
  }
};
```

#### `markNoShow()`
**Purpose:** Mark customer as failed to appear.  
**Access:** Admin, Staff  
**Validation:**
- Appointment status must be `CONFIRMED` (only confirmed appointments can be marked as No-Show).
**Process:**
- Verify status.
- Update status to `NO_SHOW`.

**Controller Implementation:**
```typescript
export const markNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be marked as No-Show"));
    }

    appointment.status = "NO_SHOW";
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment marked as No-Show" });
  } catch (error) {
    next(error);
  }
};
```

#### `getAppointments()`
**Purpose:** List all appointments with pagination and advanced filters.  
**Access:** Admin, Staff  
**Filters:** `branch`, `vendor`, `staff`, `status`, `startDate`, `endDate`  
**Search:** `search` (matches `appointmentNumber`)  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Sorting:** Results are sorted by `overallStartTime` in descending order (latest first)

**Controller Implementation:**
```typescript
export const getAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      branch: branchId, 
      vendor: vendorId, 
      staff: staffId,
      status, 
      startDate, 
      endDate, 
      search,
      page = 1, 
      limit = 10 
    } = req.query;
    
    const query: any = {};

    if (branchId) query.branch = branchId;
    if (vendorId) query.vendor = vendorId;
    if (staffId) query.staff = staffId;
    if (status) query.status = status;
    
    if (search) {
      query.appointmentNumber = { $regex: search, $options: "i" };
    }

    if (startDate || endDate) {
      query.overallStartTime = {};
      if (startDate) query.overallStartTime.$gte = new Date(startDate as string);
      if (endDate) query.overallStartTime.$lte = new Date(endDate as string);
    }

    const options = { 
      page: parseInt(page as string) || 1, 
      limit: parseInt(limit as string) || 10 
    };

    const appointments = await Appointment.find(query)
      .populate('customer')
      .populate('branch')
      .populate('items.service')
      .populate('items.staff')
      .sort({ overallStartTime: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalAppointments: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
```

#### `getMyAppointments()`
**Purpose:** List authenticated user's appointments.  
**Access:** Authenticated Customer  
**Filters:** `branch`, `vendor`, `staff`, `status`  
**Search:** `search` (matches `appointmentNumber`)  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Sorting:** Results are sorted by `overallStartTime` in descending order (latest first)

**Controller Implementation:**
```typescript
export const getMyAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user?._id;
    const { 
      branch: branchId, 
      vendor: vendorId, 
      staff: staffId,
      status, 
      search,
      page = 1, 
      limit = 10 
    } = req.query;

    const query: any = { customer: customerId };

    if (branchId) query.branch = branchId;
    if (vendorId) query.vendor = vendorId;
    if (staffId) query.staff = staffId;
    if (status) query.status = status;
    
    if (search) {
      query.appointmentNumber = { $regex: search, $options: "i" };
    }

    const options = { 
      page: parseInt(page as string) || 1, 
      limit: parseInt(limit as string) || 10 
    };

    const appointments = await Appointment.find(query)
      .populate('branch')
      .populate('items.service')
      .populate('items.staff')
      .sort({ overallStartTime: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
      success: true, 
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalAppointments: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
```

#### `getAppointmentById()`
**Purpose:** Fetch full appointment details with full object population.  
**Access:** Owner, Admin, Staff  
**Validation:**
- Appointment must exist.
**Process:**
- Find appointment by ID.
- Populate all related fields: `customer`, `branch`, `vendor`, `items.service`, and `items.staff`.

**Controller Implementation:**
```typescript
export const getAppointmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id)
      .populate('customer')
      .populate('branch')
      .populate('vendor')
      .populate('items.service')
      .populate('items.staff');

    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};
```

---

## 🛣️ Appointment Routes

### Base Path: `/api/appointments`

```typescript
POST   /                  // Create appointment (Customer)
POST   /admin              // Create appointment (Admin)
GET    /my                 // Get my appointments
GET    /                   // Get all appointments (Admin/Staff)
GET    /:id                // Get appointment details
PUT    /:id/reschedule     // Reschedule appointment
PUT    /:id/cancel         // Cancel appointment
PUT    /:id/check-in       // Record check-in
PUT    /:id/complete       // Record completion
PUT    /:id/no-show        // Record no-show
```

### Router Implementation

**File: `src/routes/appointmentRoutes.ts`**

```typescript
import { Router } from 'express';
import {
  createAppointment,
  createAppointmentByAdmin,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  completeAppointment,
  markNoShow,
  getAppointments,
  getMyAppointments,
  getAppointmentById
} from '../controllers/appointmentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRoleType } from '../types';

const router = Router();
const adminRoles: UserRoleType[] = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'];
const staffRoles: UserRoleType[] = [...adminRoles, 'staff'];

router.post('/', authenticateToken, createAppointment);
router.post('/admin', authenticateToken, authorizeRoles(adminRoles), createAppointmentByAdmin);
router.get('/my', authenticateToken, getMyAppointments);
router.get('/', authenticateToken, authorizeRoles(staffRoles), getAppointments);
router.get('/:id', authenticateToken, getAppointmentById);
router.put('/:id/reschedule', authenticateToken, rescheduleAppointment);
router.put('/:id/cancel', authenticateToken, cancelAppointment);
router.put('/:id/check-in', authenticateToken, authorizeRoles(staffRoles), checkIn);
router.put('/:id/complete', authenticateToken, authorizeRoles(staffRoles), completeAppointment);
router.put('/:id/no-show', authenticateToken, authorizeRoles(staffRoles), markNoShow);

export default router;
```

### Route Details

#### `POST /api/appointments`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "branch": "650af1230000000000000001",
  "vendor": "650af4560000000000000001",
  "items": [
    {
      "serviceId": "650af7890000000000000001",
      "staffId": "650af0120000000000000001",
      "startTime": "2026-05-20T10:00:00Z",
      "endTime": "2026-05-20T11:00:00Z"
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Appointment created successfully",
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "customer": "650af9870000000000000001",
    "branch": "650af1230000000000000001",
    "vendor": "650af4560000000000000001",
    "staff": ["650af0120000000000000001"],
    "items": [
      {
        "service": "650af7890000000000000001",
        "staff": "650af0120000000000000001",
        "startTime": "2026-05-20T10:00:00.000Z",
        "endTime": "2026-05-20T11:00:00.000Z",
        "durationMinutes": 60,
        "amount": 2000
      }
    ],
    "status": "PENDING",
    "bookingFeeAmount": 50,
    "remainingAmount": 1950,
    "createdAt": "2026-05-20T09:00:00.000Z",
    "updatedAt": "2026-05-20T09:00:00.000Z",
    "__v": 0
  }
}
```

#### `POST /api/appointments/admin`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "customerId": "650af9870000000000000001",
  "branch": "650af1230000000000000001",
  "vendor": "650af4560000000000000001",
  "status": "CONFIRMED",
  "items": [
    {
      "serviceId": "650af7890000000000000001",
      "staffId": "650af0120000000000000001",
      "startTime": "2026-05-20T10:00:00Z",
      "endTime": "2026-05-20T11:00:00Z",
      "amount": 2000,
      "durationMinutes": 60
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Appointment created by admin successfully",
  "data": {
    "_id": "650af3210000000000000002",
    "appointmentNumber": "APT-2026-0002",
    "customer": "650af9870000000000000001",
    "branch": "650af1230000000000000001",
    "vendor": "650af4560000000000000001",
    "staff": ["650af0120000000000000001"],
    "items": [
      {
        "service": "650af7890000000000000001",
        "staff": "650af0120000000000000001",
        "startTime": "2026-05-20T10:00:00.000Z",
        "endTime": "2026-05-20T11:00:00.000Z",
        "durationMinutes": 60,
        "amount": 2000
      }
    ],
    "status": "CONFIRMED",
    "bookingFeeAmount": 0,
    "remainingAmount": 2000,
    "createdAt": "2026-05-20T09:10:00.000Z",
    "updatedAt": "2026-05-20T09:10:00.000Z",
    "__v": 0
  }
}
```

#### `GET /api/appointments`
**Headers:** `Authorization: Bearer <admin_token>`
**Query Params:** `branch=650af123...`, `vendor=650af456...`, `staff=650af012...`, `status=PENDING`, `search=APT-2026`, `page=1`, `limit=10`
**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "650af3210000000000000001",
        "appointmentNumber": "APT-2026-0001",
        "status": "PENDING",
        "createdAt": "2026-05-20T09:00:00.000Z",
        "updatedAt": "2026-05-20T09:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAppointments": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/appointments/my`
**Headers:** `Authorization: Bearer <token>`
**Query Params:** `status=PENDING`, `search=APT-2026`, `page=1`, `limit=10`
**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "650af3210000000000000001",
        "appointmentNumber": "APT-2026-0001",
        "status": "PENDING",
        "createdAt": "2026-05-20T09:00:00.000Z",
        "updatedAt": "2026-05-20T09:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAppointments": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/appointments/:id`
**Headers:** `Authorization: Bearer <token>`
**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "customer": {
      "_id": "650af9870000000000000001",
      "firstName": "John",
      "lastName": "Doe"
    },
    "status": "PENDING",
    "createdAt": "2026-05-20T09:00:00.000Z",
    "updatedAt": "2026-05-20T09:00:00.000Z",
    "__v": 0
  }
}
```

#### `PUT /api/appointments/:id/reschedule`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "items": [
    {
      "serviceId": "650af7890000000000000001",
      "staffId": "650af0120000000000000001",
      "startTime": "2026-05-21T10:00:00Z",
      "endTime": "2026-05-21T11:00:00Z",
      "amount": 2000
    }
  ]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "status": "PENDING",
    "updatedAt": "2026-05-21T09:00:00.000Z",
    "__v": 0
  }
}
```

#### `PUT /api/appointments/:id/cancel`
**Headers:** `Authorization: Bearer <token>`
**Response (200):**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully"
}
```

#### `PUT /api/appointments/:id/check-in`
**Headers:** `Authorization: Bearer <admin_token>`
**Response (200):**
```json
{
  "success": true,
  "message": "Checked in successfully",
  "checkedInAt": "2026-05-20T09:55:00.000Z"
}
```

#### `PUT /api/appointments/:id/complete`
**Headers:** `Authorization: Bearer <admin_token>`
**Response (200):**
```json
{
  "success": true,
  "message": "Appointment completed successfully",
  "actualEndTime": "2026-05-20T11:05:00.000Z"
}
```

#### `PUT /api/appointments/:id/no-show`
**Headers:** `Authorization: Bearer <admin_token>`
**Response (200):**
```json
{
  "success": true,
  "message": "Appointment marked as No-Show"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, createAppointment);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.post('/admin', authenticateToken, authorizeRoles(['admin', 'super_admin']), createAppointmentByAdmin);
```

---

## 📝 API Examples

### Create Appointment (Customer)
```bash
curl -X POST http://localhost:3500/api/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "650af1230000000000000001",
    "vendor": "650af4560000000000000001",
    "items": [
      {
        "serviceId": "650af7890000000000000001",
        "staffId": "650af0120000000000000001",
        "startTime": "2026-05-20T10:00:00Z",
        "endTime": "2026-05-20T11:00:00Z"
      }
    ]
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment created successfully",
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "customer": "650af9870000000000000001",
    "branch": "650af1230000000000000001",
    "vendor": "650af4560000000000000001",
    "staff": ["650af0120000000000000001"],
    "items": [
      {
        "service": "650af7890000000000000001",
        "staff": "650af0120000000000000001",
        "startTime": "2026-05-20T10:00:00.000Z",
        "endTime": "2026-05-20T11:00:00.000Z",
        "durationMinutes": 60,
        "amount": 2000
      }
    ],
    "status": "PENDING",
    "bookingFeeAmount": 50,
    "remainingAmount": 1950,
    "createdAt": "2026-05-20T09:00:00.000Z",
    "updatedAt": "2026-05-20T09:00:00.000Z"
  }
}
```

### Create Appointment (Admin)
```bash
curl -X POST http://localhost:3500/api/appointments/admin \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "650af9870000000000000001",
    "branch": "650af1230000000000000001",
    "vendor": "650af4560000000000000001",
    "status": "CONFIRMED",
    "items": [
      {
        "serviceId": "650af7890000000000000001",
        "staffId": "650af0120000000000000001",
        "startTime": "2026-05-20T10:00:00Z",
        "endTime": "2026-05-20T11:00:00Z",
        "amount": 2000,
        "durationMinutes": 60
      }
    ]
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment created by admin successfully",
  "data": {
    "_id": "650af3210000000000000002",
    "appointmentNumber": "APT-2026-0002",
    "customer": "650af9870000000000000001",
    "status": "CONFIRMED",
    "createdAt": "2026-05-20T09:10:00.000Z"
  }
}
```

### Get My Appointments
```bash
curl -X GET http://localhost:3500/api/appointments/my \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "650af3210000000000000001",
      "appointmentNumber": "APT-2026-0001",
      "status": "PENDING"
    }
  ]
}
```

### Get All Appointments
```bash
curl -X GET "http://localhost:3500/api/appointments?branchId=650af1230000000000000001" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "650af3210000000000000001",
      "appointmentNumber": "APT-2026-0001",
      "status": "PENDING"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Get Appointment Details
```bash
curl -X GET http://localhost:3500/api/appointments/650af3210000000000000001 \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "customer": {
      "_id": "650af9870000000000000001",
      "firstName": "John",
      "lastName": "Doe"
    },
    "status": "PENDING"
  }
}
```

### Reschedule Appointment
```bash
curl -X PUT http://localhost:3500/api/appointments/650af3210000000000000001/reschedule \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "serviceId": "650af7890000000000000001",
        "staffId": "650af0120000000000000001",
        "startTime": "2026-05-21T10:00:00Z",
        "endTime": "2026-05-21T11:00:00Z",
        "amount": 2000
      }
    ]
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "_id": "650af3210000000000000001",
    "appointmentNumber": "APT-2026-0001",
    "status": "PENDING"
  }
}
```

### Cancel Appointment
```bash
curl -X PUT http://localhost:3500/api/appointments/650af3210000000000000001/cancel \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully"
}
```

### Check-in Appointment
```bash
curl -X PUT http://localhost:3500/api/appointments/650af3210000000000000001/check-in \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Checked in successfully",
  "checkedInAt": "2026-05-20T09:55:00.000Z"
}
```

### Complete Appointment
```bash
curl -X PUT http://localhost:3500/api/appointments/650af3210000000000000001/complete \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment completed successfully",
  "actualEndTime": "2026-05-20T11:05:00.000Z"
}
```

### Mark No-Show
```bash
curl -X PUT http://localhost:3500/api/appointments/650af3210000000000000001/no-show \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Appointment marked as No-Show"
}
```

---

## 🛡️ Security Features

- **RBAC:** Only authorized roles can perform administrative actions (check-in, complete, no-show).
- **Ownership Check:** Customers can only cancel or reschedule their own appointments.
- **Availability Validation:** Prevents double-booking via `validateOptionAvailability` helper.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Staff is already booked during this time" }
```

---

## 📊 Database Indexes

```typescript
appointmentSchema.index({ appointmentNumber: 1 }, { unique: true });
appointmentSchema.index({ customer: 1, status: 1 });
appointmentSchema.index({ branch: 1, overallStartTime: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.1.0
