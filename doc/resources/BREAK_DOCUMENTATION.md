# ☕ DOHEZ-API - Break Management Documentation

## 📋 Table of Contents
- [Break Management Overview](#break-management-overview)
- [Break Model](#-break-model)
- [Break Controller](#-break-controller)
- [Break Routes](#-break-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Break Management Overview

Break Management allows administrators to track staff break times. Each break record includes the staff member, start time, end time, and an optional reason. System-level validations ensure that time formats are correct (HH:MM) and that start times are always earlier than end times.

---

## ☕ Break Model

### Schema Definition
```typescript
export interface IBreak extends Document {
  staff: Types.ObjectId | IUser;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  reason?: string;
  createdAt: Date;
}
```

### Model Implementation

**File: `src/models/Break.ts`**

```typescript
import mongoose, { Schema } from "mongoose";
import type { IBreak } from "../types/index";

// Validation function for HH:MM format
const validateTimeFormat = (time: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const breakSchema = new Schema<IBreak>(
  {
    staff: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { 
      type: String, 
      required: true,
      validate: {
        validator: validateTimeFormat,
        message: "Start time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    endTime: { 
      type: String, 
      required: true,
      validate: {
        validator: validateTimeFormat,
        message: "End time must be in HH:MM format (00:00 to 23:59)"
      }
    },
    reason: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Validate that startTime < endTime
breakSchema.pre("save", function (next) {
  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      return next(new Error("startTime must be earlier than endTime"));
    }
  }
  next();
});

// Index on staff only
breakSchema.index({ staff: 1 });

const Break = mongoose.model<IBreak>("Break", breakSchema);
export default Break;
```

### Validation Rules
```javascript
staff:     { required: true, ref: 'User' }
startTime: { required: true, format: "HH:MM", validator: "00:00-23:59" }
endTime:   { required: true, format: "HH:MM", validator: "00:00-23:59" }
reason:    { maxlength: 300 }
logic:     { startTime must be < endTime }
```

---

## 🎮 Break Controller

**File:** `src/controllers/breakController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import Break from "../models/Break";
import User from "../models/User";
import Role from "../models/Role";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `createBreak()`
- **Purpose:** Create a new break record.
- **Access:** Private (Authorized Roles)
- **Validation:** 
    - `staff` must be a valid User ID.
    - **The target user must have the `staff` role.**
    - `startTime` and `endTime` must be in `HH:MM` format.
    - `startTime` must be earlier than `endTime`.
- **Response:** Created break object.

**Controller Implementation:**
```typescript
export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staff: staffId, startTime, endTime, reason } = req.body;

    // Verify staff user exists and has the 'staff' role
    const staffUser = await User.findById(staffId).populate("roles");
    if (!staffUser) {
      return next(errorHandler(404, "Staff user not found"));
    }

    const hasStaffRole = (staffUser.roles as any[]).some(
      (role) => role.name === "staff"
    );

    if (!hasStaffRole) {
      return next(errorHandler(403, "Breaks can only be created for users with the 'staff' role"));
    }

    const newBreak = await Break.create({
      staff: staffId,
      startTime,
      endTime,
      reason
    });

    res.status(201).json({
      success: true,
      message: "Break created successfully",
      data: {
        break: newBreak
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getBreak()`
- **Purpose:** Get a single break record by ID.
- **Access:** Private (Authorized Roles)
- **Response:** Break record with populated staff details.

**Controller Implementation:**
```typescript
export const getBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakRecord = await Break.findById(req.params.id).populate("staff", "firstName lastName email");

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        break: breakRecord
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getBreaks()`
- **Purpose:** List all breaks with pagination and optional filtering by staff.
- **Access:** Private (Authorized Roles)
- **Response:** Paginated list of breaks.

**Controller Implementation:**
```typescript
export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, staff } = req.query;

    const query: any = {};
    if (staff) query.staff = staff;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const breaks = await Break.find(query)
      .populate("staff", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Break.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        breaks,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalBreaks: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateBreak()`
- **Purpose:** Update an existing break record (times or reason).
- **Access:** Private (Authorized Roles)
- **Response:** Updated break object.

**Controller Implementation:**
```typescript
export const updateBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startTime, endTime, reason } = req.body;
    const breakRecord = await Break.findById(req.params.id);

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    if (startTime) breakRecord.startTime = startTime;
    if (endTime) breakRecord.endTime = endTime;
    if (reason !== undefined) breakRecord.reason = reason;

    await breakRecord.save();

    res.status(200).json({
      success: true,
      message: "Break record updated successfully",
      data: {
        break: breakRecord
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteBreak()`
- **Purpose:** Delete a break record.
- **Access:** Private (Authorized Roles)
- **Response:** Success message.

**Controller Implementation:**
```typescript
export const deleteBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakRecord = await Break.findByIdAndDelete(req.params.id);

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    res.status(200).json({
      success: true,
      message: "Break record deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Break Routes

### Base Path: `/api/breaks`

```typescript
POST   /        // Create break
GET    /        // List breaks (paginated)
GET    /:id     // Get break details
PUT    /:id     // Update break
DELETE /:id     // Delete break
```

### Router Implementation

**File: `src/routes/breakRoutes.ts`**

```typescript
import express from 'express';
import {
  createBreak,
  getBreak,
  getBreaks,
  updateBreak,
  deleteBreak
} from '../controllers/breakController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), createBreak);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), getBreaks);
router.get('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), getBreak);
router.put('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), updateBreak);
router.delete('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), deleteBreak);

export default router;
```

### Route Details

#### `POST /api/breaks`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "staff": "650af1234567890abcdef123",
  "startTime": "12:00",
  "endTime": "13:00",
  "reason": "Lunch break"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Break created successfully",
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": "650af1234567890abcdef123",
      "startTime": "12:00",
      "endTime": "13:00",
      "reason": "Lunch break",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/breaks`
**Headers:** `Authorization: Bearer <token>`
**Query Parameters:** `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "breaks": [
      {
        "_id": "6648a123b567890abcdef101",
        "staff": {
          "_id": "650af1234567890abcdef123",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "startTime": "12:00",
        "endTime": "13:00",
        "reason": "Lunch break",
        "createdAt": "2026-05-12T09:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalBreaks": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/breaks/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": {
        "_id": "650af1234567890abcdef123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "startTime": "12:00",
      "endTime": "13:00",
      "reason": "Lunch break",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/breaks/:id`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "startTime": "12:30",
  "endTime": "13:30",
  "reason": "Updated reason"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Break record updated successfully",
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": "650af1234567890abcdef123",
      "startTime": "12:30",
      "endTime": "13:30",
      "reason": "Updated reason",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

### DELETE /api/breaks/:id
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "message": "Break record deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user information  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), createBreak);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Ensure the authenticated user has appropriate permissions  
**Usage:**
```typescript
router.put('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), updateBreak);
```

---

## 📝 API Examples

### Create Break
```bash
curl -X POST http://localhost:3500/api/breaks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staff": "650af1234567890abcdef123",
    "startTime": "12:00",
    "endTime": "13:00",
    "reason": "Lunch break"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Break created successfully",
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": "650af1234567890abcdef123",
      "startTime": "12:00",
      "endTime": "13:00",
      "reason": "Lunch break",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

### List Breaks
```bash
curl -X GET "http://localhost:3500/api/breaks?page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "breaks": [
      {
        "_id": "6648a123b567890abcdef101",
        "staff": {
          "_id": "650af1234567890abcdef123",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "startTime": "12:00",
        "endTime": "13:00",
        "reason": "Lunch break",
        "createdAt": "2026-05-12T09:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalBreaks": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Break By ID
```bash
curl -X GET http://localhost:3500/api/breaks/6648a123b567890abcdef101 \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": {
        "_id": "650af1234567890abcdef123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "startTime": "12:00",
      "endTime": "13:00",
      "reason": "Lunch break",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

### Update Break
```bash
curl -X PUT http://localhost:3500/api/breaks/6648a123b567890abcdef101 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "12:30",
    "endTime": "13:30",
    "reason": "Updated reason"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Break record updated successfully",
  "data": {
    "break": {
      "_id": "6648a123b567890abcdef101",
      "staff": "650af1234567890abcdef123",
      "startTime": "12:30",
      "endTime": "13:30",
      "reason": "Updated reason",
      "createdAt": "2026-05-12T09:00:00.000Z",
      "__v": 0
    }
  }
}
```

### Delete Break
```bash
curl -X DELETE http://localhost:3500/api/breaks/6648a123b567890abcdef101 \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Break record deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Access restricted to `super_admin`, `admin`, `branch_admin`, and `vendor_admin`.
- **Validation:** Strict regex validation for time formats and logical sequence.

---

## 🚨 Error Handling

Standard error response for validation failure:
```json
{
  "success": false,
  "message": "startTime must be earlier than endTime"
}
```

---

## 📊 Database Indexes

```typescript
breakSchema.index({ staff: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
