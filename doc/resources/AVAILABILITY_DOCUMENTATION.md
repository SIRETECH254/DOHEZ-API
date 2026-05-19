# 📅 DOHEZ-API - Availability Scheduling Documentation

## 📋 Table of Contents
- [Availability Overview](#availability-overview)
- [Multi-Service Availability Logic](#-multi-service-availability-logic)
- [Availability Controller](#-availability-controller)
- [Availability Routes](#-availability-routes)
- [API Examples](#-api-examples)
- [Error Handling](#-error-handling)

---

## Availability Overview

The Availability module provides the backend logic for determining schedule options for booking multiple services in sequence. It processes staff availability, working hours, and existing appointment/break constraints to present viable booking options to the customer.

---

## 🧠 Multi-Service Availability Logic (Core Summary)

This section explains the core multi-service availability logic only.

### What an Availability Option Is

* An availability option is not stored in the database.
* An availability option is a calculated arrangement of multiple services (products) across one or more staff members.
* One availability option represents one complete customer session.
* Only confirmed appointments and appointment items are stored permanently.

### Data Used for Availability Calculation

Only these inputs are required:

* Vendor-Id
* Brand-Id
* Selected services/products
* Optional preferred staffs
* Brand working hours
* Staff working hours
* Product durations
* Staff skills/service capabilities
* Existing appointments for staff on the selected date
* Staff breaks (time-only recurring daily)

### Availability Logic Process

1. Read the brand working hours for the selected day.
2. Fetch all requested services/products.
3. Fetch all staffs under the vendor/brand capable of providing each requested service/product.
4. If preferred staffs are provided, give them priority during staff assignment.
5. Fetch all existing appointment items for the selected staffs on the selected date.
6. Fetch all staff breaks (breaks are stored as time-only strings, e.g. "13:00" to "14:00").
7. Convert break time strings into date-time ranges for the selected date.
8. Starting from the brand working hours and the staff working hours, generate sequential timelines for all requested services/products.
9. For each service/product:

   * assign an available qualified staff
   * calculate start time
   * calculate end time using the product duration
10. For each generated item check:

* if the assigned staff is available
* if the generated time fits inside both brand and staff working hours
* if the generated time overlaps any existing appointment
* if the generated item overlaps any break

11. If any generated item is invalid, discard the whole availability option.
12. If all generated items are valid, create one selectable availability option.
13. Move to the next possible valid start time.
14. Continue generating until multiple valid availability options are found.
15. Return all valid availability options.

**Note:** Breaks are recurring daily time ranges (e.g. "13:00" to "14:00") that automatically apply every day when the staff has working hours. They are converted into specific date-time ranges during availability calculation.

### Overlap Rule

A generated item overlaps an appointment item (or break) if:

```text
slotStart < eventEnd
AND
slotEnd > eventStart
```

If this condition is true, the generated item is invalid.

### Example Response

```json
{
  "success": true,
  "message": "Available schedules fetched successfully",
  "data": {
    "vendorId": "vendor_001",
    "branchId": "branch_001",
    "date": "2026-05-20",
    "services": [
      {
        "serviceId": "650af1234567890abcdef001",
        "serviceName": "Medium Knotless Braids"
      },
      {
        "serviceId": "650af1234567890abcdef002",
        "serviceName": "Gel Manicure"
      }
    ],
    "scheduleOptions": [
      {
        "overallStartTime": "2026-05-20T09:00:00.000Z",
        "overallEndTime": "2026-05-20T12:45:00.000Z",
        "totalDurationMinutes": 225,
        "bookingFeeAmount": 50,
        "totalAmount": 3200,
        "remainingAmount": 3150,
        "items": [
          {
            "serviceId": "650af1234567890abcdef001",
            "serviceName": "Medium Knotless Braids",
            "staffId": "staff_001",
            "staffName": "Jane",
            "startTime": "2026-05-20T09:00:00.000Z",
            "endTime": "2026-05-20T12:00:00.000Z",
            "durationMinutes": 180,
            "amount": 2500
          },
          {
            "serviceId": "650af1234567890abcdef002",
            "serviceName": "Gel Manicure",
            "staffId": "staff_002",
            "staffName": "Mary",
            "startTime": "2026-05-20T12:00:00.000Z",
            "endTime": "2026-05-20T12:45:00.000Z",
            "durationMinutes": 45,
            "amount": 700
          }
        ]
      }
    ]
  }
}
```

---

## 🎮 Availability Controller

**File:** `src/controllers/availabilityController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Appointment from '../models/Appointment';
import User from '../models/User';
import Product from '../models/Product';
import Break from '../models/Break';
import Branch from '../models/Branch';
import { Types } from 'mongoose';
import { 
  timeToMinutes, 
  isOverlap, 
  minutesToIso, 
  parseDuration 
} from '../utils/availability';
```

### Functions Overview

#### `getAvailability()`
**Purpose:** Fetch available schedule options based on services and preferences.  
**Access:** Authenticated users  
**Validation:** 
- Date, branch, vendor, and items are required.
- Selected date must not have passed.
- Vendor must exist.
- Branch must exist.
- All requested items must be available in the selected branch.
**Process:** Validate inputs, aggregate qualified staff, recursively calculate sequential slots for multiple services, check constraints (working hours, overlaps, breaks), and return paginated schedule options.
**Response:** JSON with available `scheduleOptions` and `pagination` metadata.

**Controller Implementation:**
```typescript

/**
 * Fetch available schedule options based on services and preferences.
 */
export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, branch: branchId, vendor: vendorId, items, preferredStaffs, page = 1, limit = 10 } = req.body;

    if (!date || !branchId || !vendorId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: date, branch, vendor, and items (array) are required."
      });
    }

    // Validation: Date has passed
    const selectedDate = new Date(date);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Selected date has already passed."
      });
    }

    // Validation: Vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    // Validation: Branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
    const branchWH = (branch.workingHours as any)?.[dayOfWeek];

    if (!branchWH || !branchWH.start || !branchWH.end) {
      return res.status(200).json({
        success: true,
        message: "The branch is closed on the selected date.",
        data: { vendorId, branchId, date, services: [], scheduleOptions: [], pagination: { currentPage: 1, totalPages: 0, totalOptions: 0, hasNextPage: false, hasPrevPage: false } }
      });
    }

    const branchStartMin = timeToMinutes(branchWH.start);
    const branchEndMin = timeToMinutes(branchWH.end);

    // 2. Fetch requested products and Validate items are provided in the branch
    const products = await Product.find({
      $or: [
        { _id: { $in: items.filter(id => Types.ObjectId.isValid(id)) } },
        { slug: { $in: items } }
      ],
      branch: branchId
    });

    // Order products as requested in the items array
    const orderedProducts = items.map(id => 
      products.find(p => p._id.toString() === id || p.slug === id)
    ).filter(p => !!p) as any[];

    if (orderedProducts.length !== items.length) {
      return res.status(404).json({ 
        success: false, 
        message: "One or more items are not available in this branch." 
      });
    }

    // 3. Identify all qualified staff for each product
    const staffByProduct = new Map<string, any[]>();
    const allQualifiedStaffIds = new Set<string>();
    
    const staffRole = await Role.findOne({ name: "staff" });

    for (const product of orderedProducts) {
      const staffs = await User.find({
        branch: branchId,
        vendor: vendorId,
        services: product._id,
        isActive: true,
        ...(staffRole && { roles: staffRole._id })
      });
      staffByProduct.set(product._id.toString(), staffs);
      staffs.forEach(s => allQualifiedStaffIds.add(s._id.toString()));
    }

    if (allQualifiedStaffIds.size === 0) {
      return res.status(200).json({
        success: true,
        message: "No qualified staff members found for the requested services in this branch.",
        data: { 
          vendorId, 
          branchId, 
          date, 
          services: orderedProducts.map(p => ({ serviceId: p.slug || p._id.toString(), serviceName: p.name })), 
          scheduleOptions: [],
          pagination: { currentPage: 1, totalPages: 0, totalOptions: 0, hasNextPage: false, hasPrevPage: false }
        }
      });
    }

    // Fetch full staff details once to have their working hours and info
    const qualifiedStaffList = await User.find({ _id: { $in: Array.from(allQualifiedStaffIds) } });
    const staffMap = new Map(qualifiedStaffList.map(s => [s._id.toString(), s]));

    // Check if any of these staff have working hours for this day
    const staffWithWH = qualifiedStaffList.filter(s => {
      const sWH = (s.workingHours as any)?.[dayOfWeek];
      return sWH && sWH.start && sWH.end;
    });

    if (staffWithWH.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Qualified staff found, but none have working hours set for the selected date.",
        data: { 
          vendorId, 
          branchId, 
          date, 
          services: orderedProducts.map(p => ({ serviceId: p.slug || p._id.toString(), serviceName: p.name })), 
          scheduleOptions: [],
          pagination: { currentPage: 1, totalPages: 0, totalOptions: 0, hasNextPage: false, hasPrevPage: false }
        }
      });
    }

    // 4. Fetch existing appointments and breaks for all qualified staff on that date
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      branch: branchId,
      overallStartTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      "items.staff": { $in: Array.from(allQualifiedStaffIds) }
    });

    const breaks = await Break.find({
      staff: { $in: Array.from(allQualifiedStaffIds) }
    });

    // 5. Availability Logic Process
    const allScheduleOptions: any[] = [];
    const searchStep = 15; // Search every 15 minutes for possible start times

    const isStaffAvailable = (staffId: string, startMin: number, endMin: number): boolean => {
      const staff = staffMap.get(staffId);
      if (!staff) return false;

      // Staff working hours check
      const sWH = (staff.workingHours as any)?.[dayOfWeek];
      if (!sWH || !sWH.start || !sWH.end) return false;
      const sStartMin = timeToMinutes(sWH.start);
      const sEndMin = timeToMinutes(sWH.end);
      if (startMin < sStartMin || endMin > sEndMin) return false;

      // Appointment overlaps check
      for (const app of appointments) {
        for (const item of app.items) {
          if (item.staff.toString() === staffId) {
            const aStartMin = item.startTime.getUTCHours() * 60 + item.startTime.getUTCMinutes();
            const aEndMin = item.endTime.getUTCHours() * 60 + item.endTime.getUTCMinutes();
            if (isOverlap(startMin, endMin, aStartMin, aEndMin)) return false;
          }
        }
      }

      // Break overlaps check
      const staffBreaks = breaks.filter(b => b.staff.toString() === staffId);
      for (const b of staffBreaks) {
        const bStartMin = timeToMinutes(b.startTime);
        const bEndMin = timeToMinutes(b.endTime);
        if (isOverlap(startMin, endMin, bStartMin, bEndMin)) return false;
      }

      return true;
    };

    /**
     * Recursive function to find all valid staff/time combinations for the sequential services
     */
    const findOptions = (productIdx: number, currentStartMin: number, currentItems: any[]) => {
      if (productIdx === orderedProducts.length) {
        // All services placed successfully for this start time and staff combination
        const totalDuration = currentItems.reduce((sum, item) => sum + item.durationMinutes, 0);
        const totalAmount = currentItems.reduce((sum, item) => sum + item.amount, 0);
        const bookingFee = 50; // Standard booking fee example

        allScheduleOptions.push({
          overallStartTime: minutesToIso(date, currentItems[0].startMin),
          overallEndTime: minutesToIso(date, currentItems[currentItems.length - 1].endMin),
          totalDurationMinutes: totalDuration,
          bookingFeeAmount: bookingFee,
          totalAmount: totalAmount,
          remainingAmount: totalAmount - bookingFee,
          items: currentItems.map(ci => ({
            serviceId: ci.serviceId,
            serviceName: ci.serviceName,
            staffId: ci.staffId,
            staffName: ci.staffName,
            startTime: minutesToIso(date, ci.startMin),
            endTime: minutesToIso(date, ci.endMin),
            durationMinutes: ci.durationMinutes,
            amount: ci.amount
          }))
        });
        return;
      }

      const product = orderedProducts[productIdx];
      const duration = parseDuration(product.duration);
      const buffer = parseDuration(product.buffertime || "0");
      let qualifiedStaffs = staffByProduct.get(product._id.toString()) || [];

      // Priority to preferred staffs if provided
      if (preferredStaffs && Array.isArray(preferredStaffs)) {
        qualifiedStaffs = [...qualifiedStaffs].sort((a, b) => {
          const aPref = preferredStaffs.includes(a._id.toString()) || preferredStaffs.includes(a.email);
          const bPref = preferredStaffs.includes(b._id.toString()) || preferredStaffs.includes(b.email);
          if (aPref && !bPref) return -1;
          if (!aPref && bPref) return 1;
          return 0;
        });
      }

      for (const staff of qualifiedStaffs) {
        const endMin = currentStartMin + duration;
        // Check if item fits in branch hours and staff is available
        if (endMin <= branchEndMin && isStaffAvailable(staff._id.toString(), currentStartMin, endMin)) {
          findOptions(productIdx + 1, endMin + buffer, [
          ...currentItems,
          {
            serviceId: product._id.toString(),
            serviceName: product.name,
            staffId: staff._id.toString(),
            staffName: `${staff.firstName} ${staff.lastName}`,
            startMin: currentStartMin,
            endMin: endMin,
            durationMinutes: duration,
            amount: product.price
          }
          ]);          
          // Safety: If we've found enough variations for this start time, move on
          if (allScheduleOptions.length > 500) return;
        }
      }
    };

    // Iterate through the day from branch opening to closing
    for (let time = branchStartMin; time <= branchEndMin - searchStep; time += searchStep) {
      findOptions(0, time, []);
      if (allScheduleOptions.length >= 500) break;
    }

    // Pagination Logic
    const optionsPage = parseInt(page as string) || 1;
    const optionsLimit = parseInt(limit as string) || 10;
    const totalOptions = allScheduleOptions.length;
    const totalPages = Math.ceil(totalOptions / optionsLimit);
    const paginatedOptions = allScheduleOptions.slice((optionsPage - 1) * optionsLimit, optionsPage * optionsLimit);

    return res.status(200).json({
      success: true,
      message: "Available schedules fetched successfully",
      data: {
        vendorId,
        branchId,
        date,
        services: orderedProducts.map(p => ({
          serviceId: p._id.toString(),
          serviceName: p.name
        })),
        scheduleOptions: paginatedOptions,
        pagination: {
          currentPage: optionsPage,
          totalPages: totalPages,
          totalOptions: totalOptions,
          hasNextPage: optionsPage < totalPages,
          hasPrevPage: optionsPage > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
};
```

---

## 🛣️ Availability Routes

### Base Path: `/api/availability`

```typescript
POST /                  // Fetch available schedule options
```

### Router Implementation

**File: `src/routes/availabilityRoutes.ts`**

```typescript
import { Router } from 'express';
import { getAvailability } from '../controllers/availabilityController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, getAvailability);

export default router;
```

### Route Details

#### `POST /api/availability`
**Headers:** `Authorization: Bearer <token>`  
**Body:**
```json
{
  "date": "2026-05-20",
  "branch": "650af1234567890abcdef123",
  "vendor": "650af1234567890abcdef456",
  "items": [
    "service_hair_knotless_medium",
    "service_gel_manicure"
  ],
  "page": 1,
  "limit": 10
}
```
**Response:**
```json
{
  "success": true,
  "message": "Available schedules fetched successfully",
  "data": {
    "vendorId": "vendor_001",
    "branchId": "branch_001",
    "date": "2026-05-20",
    "services": [
      {
        "serviceId": "service_hair_knotless_medium",
        "serviceName": "Medium Knotless Braids"
      },
      {
        "serviceId": "service_gel_manicure",
        "serviceName": "Gel Manicure"
      }
    ],
    "scheduleOptions": [
      {
        "overallStartTime": "2026-05-20T09:00:00.000Z",
        "overallEndTime": "2026-05-20T12:45:00.000Z",
        "totalDurationMinutes": 225,
        "bookingFeeAmount": 50,
        "totalAmount": 3200,
        "remainingAmount": 3150,
        "items": [
          {
            "serviceId": "service_hair_knotless_medium",
            "serviceName": "Medium Knotless Braids",
            "staffId": "staff_001",
            "staffName": "Jane",
            "startTime": "2026-05-20T09:00:00.000Z",
            "endTime": "2026-05-20T12:00:00.000Z",
            "durationMinutes": 180,
            "amount": 2500
          }
        ]
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalOptions": 48,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, getAvailability);
```

---

## 📝 API Examples

### Get Availability
```bash
curl -X POST http://localhost:3500/api/availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "date": "2026-05-20",
    "branch": "650af1234567890abcdef123",
    "vendor": "650af1234567890abcdef456",
    "items": [
      "service_hair_knotless_medium",
      "service_gel_manicure"
    ],
    "page": 1,
    "limit": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Available schedules fetched successfully",
  "data": {
    "vendorId": "vendor_001",
    "branchId": "branch_001",
    "date": "2026-05-20",
    "services": [
      {
        "serviceId": "650af1234567890abcdef001",
        "serviceName": "Medium Knotless Braids"
      },
      {
        "serviceId": "650af1234567890abcdef002",
        "serviceName": "Gel Manicure"
      }
    ],
    "scheduleOptions": [
      {
        "overallStartTime": "2026-05-20T09:00:00.000Z",
        "overallEndTime": "2026-05-20T12:45:00.000Z",
        "totalDurationMinutes": 225,
        "bookingFeeAmount": 50,
        "totalAmount": 3200,
        "remainingAmount": 3150,
        "items": [
          {
            "serviceId": "650af1234567890abcdef001",
            "serviceName": "Medium Knotless Braids",
            "staffId": "staff_001",
            "staffName": "Jane",
            "startTime": "2026-05-20T09:00:00.000Z",
            "endTime": "2026-05-20T12:00:00.000Z",
            "durationMinutes": 180,
            "amount": 2500
          },
          {
            "serviceId": "650af1234567890abcdef002",
            "serviceName": "Gel Manicure",
            "staffId": "staff_002",
            "staffName": "Mary",
            "startTime": "2026-05-20T12:00:00.000Z",
            "endTime": "2026-05-20T12:45:00.000Z",
            "durationMinutes": 45,
            "amount": 700
          }
        ]
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalOptions": 48,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "..." }
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
