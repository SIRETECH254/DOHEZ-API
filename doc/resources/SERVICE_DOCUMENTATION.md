# 📋 DOHEZ-API - Service Management Documentation

## 📋 Table of Contents
- [Service Management Overview](#service-management-overview)
- [Service Model](#-service-model)
- [Service Controller](#-service-controller)
- [Service Routes](#-service-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Service Management Overview

Service Management covers the specific services offered under each Task category (e.g., "Shirt Wash" under "Laundry"). These are managed by Super Admins and define the actual offerings that customers can interact with.

---

## 👤 Service Model

### Schema Definition
```typescript
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
```

### Model Implementation

**File: `src/models/Service.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IService } from '../types';

const serviceSchema = new Schema<IService>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceSchema.index({ task: 1 });
serviceSchema.index({ name: 1 });
serviceSchema.index({ isActive: 1 });

const Service = mongoose.model<IService>('Service', serviceSchema);

export default Service;
```

### Validation Rules
```typescript
task:        { required: true, ref: 'Task' }
name:        { required: true, trim: true }
description: { optional, trim: true }
image:       { optional, url }
isActive:    { default: true }
```

---

## 🎮 Service Controller

**File:** `src/controllers/serviceController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Service from "../models/Service";
import Task from "../models/Task";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `createService()`
**Purpose:** Create a new service under a task category  
**Access:** Super Admin  
**Validation:** `task` and `name` are required  
**Process:** Validate parent Task exists, handle optional image upload to Cloudinary  
**Response:** Success message and created service

**Controller Implementation:**
```typescript
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, name, description, isActive } = req.body;

    if (!task || !name) {
      return next(errorHandler(400, "Task and Service name are required"));
    }

    const taskExists = await Task.findById(task);
    if (!taskExists) {
      return next(errorHandler(404, "Parent Task not found"));
    }

    const serviceData: any = {
      task,
      name,
      description,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/services");
      serviceData.image = uploadResult.url;
      serviceData.imagePublicId = uploadResult.public_id;
    }

    const service = await Service.create(serviceData);

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getServices()`
**Purpose:** List all services  
**Access:** Public  
**Validation:** None  
**Process:** Fetch services with pagination. Supports filtering by `task` and `search`. Public view only sees `isActive: true`.  
**Response:** List of services and pagination metadata

**Controller Implementation:**
```typescript
export const getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (task) {
      query.task = task;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const services = await Service.find(query)
      .populate("task", "name")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Service.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        services,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalServices: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getServiceById()`
**Purpose:** Get single service details  
**Access:** Public  
**Validation:** Service must exist  
**Process:** Find service by ID and populate parent Task  
**Response:** Service details

**Controller Implementation:**
```typescript
export const getServiceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const service = await Service.findById(req.params.serviceId).populate("task", "name description image");

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    res.status(200).json({
      success: true,
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateService()`
**Purpose:** Update service details or image  
**Access:** Super Admin  
**Validation:** Service must exist  
**Process:** Update fields, handle image replacement or removal on Cloudinary  
**Response:** Updated service

**Controller Implementation:**
```typescript
export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, name, description, isActive, image } = req.body;
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (task) {
      const taskExists = await Task.findById(task);
      if (!taskExists) return next(errorHandler(404, "Parent Task not found"));
      service.task = task;
    }
    
    if (name) service.name = name;
    if (description !== undefined) service.description = description;
    if (isActive !== undefined) service.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/services");
      if (service.imagePublicId) {
        await deleteFromCloudinary(service.imagePublicId);
      }
      service.image = uploadResult.url;
      service.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (service.imagePublicId) {
        await deleteFromCloudinary(service.imagePublicId);
      }
      service.image = null;
      service.imagePublicId = null;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteService()`
**Purpose:** Delete a service  
**Access:** Super Admin  
**Validation:** Service must exist  
**Process:** Delete record and its associated image from Cloudinary  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (service.imagePublicId) {
      await deleteFromCloudinary(service.imagePublicId);
    }

    await service.deleteOne();

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Service Routes

### Base Path: `/api/services`

```typescript
GET    /                  // Get all services (Public)
GET    /:serviceId        // Get service details (Public)
POST   /                  // Create service (Super Admin)
PUT    /:serviceId        // Update service (Super Admin)
DELETE /:serviceId        // Delete service (Super Admin)
```

### Router Implementation

**File: `src/routes/serviceRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService
} from '../controllers/serviceController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createService);

router.get('/', optionalAuthenticateToken, getServices);

router.get('/:serviceId', getServiceById);

router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateService);

router.delete('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), deleteService);

export default router;
```

### Route Details

#### `GET /api/services`
**Headers:**
- **Authorization:** Bearer <token> (Optional)
**Query:**
- **task:** 650af1234567890abcdef000
- **search:** Shirt
- **page:** 1
- **limit:** 10
**Response:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "_id": "650af1234567890abcdef123",
        "task": {
          "_id": "650af1234567890abcdef000",
          "name": "Laundry"
        },
        "name": "Shirt Wash",
        "description": "Standard wash",
        "isActive": true,
        "image": "https://res.cloudinary.com/demo/image/upload/v123/service.jpg"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalServices": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/services/:serviceId`
**Params:**
- **serviceId:** 650af1234567890abcdef123
**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "_id": "650af1234567890abcdef123",
      "task": {
        "name": "Laundry",
        "description": "...",
        "image": "..."
      },
      "name": "Shirt Wash",
      "description": "...",
      "isActive": true,
      "image": "..."
    }
  }
}
```

#### `POST /api/services`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
**Body:**
```json
{
  "task": "650af1234567890abcdef000",
  "name": "VIP Ticket",
  "description": "Access to VIP lounge",
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "service": {
      "_id": "650af1234567890abcdef124",
      "task": "650af1234567890abcdef000",
      "name": "VIP Ticket",
      "description": "Access to VIP lounge",
      "isActive": true,
      "image": "..."
    }
  }
}
```

#### `PUT /api/services/:serviceId`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
**Params:**
- **serviceId:** 650af1234567890abcdef123
**Body:**
```json
{
  "name": "Deluxe Wash",
  "description": "Extra care washing",
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Service updated successfully",
  "data": {
    "service": {
      "_id": "650af1234567890abcdef123",
      "task": "650af1234567890abcdef000",
      "name": "Deluxe Wash",
      "description": "Extra care washing",
      "isActive": true,
      "image": "..."
    }
  }
}
```

#### `DELETE /api/services/:serviceId`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
**Params:**
- **serviceId:** 650af1234567890abcdef123
**Response:**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createService);
```

#### `optionalAuthenticateToken`
**Purpose:** Optionally verify JWT token to identify user without enforcing authentication  
**Usage:**
```typescript
router.get('/', optionalAuthenticateToken, getServices);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateService);
```

---

## 📝 API Examples

### 1. Create Service
**Endpoint:** `POST /api/services`  
**Access:** Private (Super Admin)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/services \
  -H "Authorization: Bearer <super_admin_token>" \
  -F "task=650af1234567890abcdef000" \
  -F "name=Suit Wash" \
  -F "description=Dry cleaning and steam press for premium suits" \
  -F "isActive=true" \
  -F "image=@/path/to/suit.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "service": {
      "_id": "650af1234567890abcdef123",
      "task": "650af1234567890abcdef000",
      "name": "Suit Wash",
      "description": "Dry cleaning and steam press for premium suits",
      "isActive": true,
      "image": "https://res.cloudinary.com/.../suit.jpg",
      "imagePublicId": "dohez/services/...",
      "createdAt": "2026-04-24T12:00:00.000Z",
      "updatedAt": "2026-04-24T12:00:00.000Z"
    }
  }
}
```

### 2. Get All Services (with Filtering)
**Endpoint:** `GET /api/services`  
**Access:** Public

**Request Example (Filter by Task):**
```bash
curl -X GET "http://localhost:3500/api/services?task=650af1234567890abcdef000&page=1&limit=10"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "_id": "650af1234567890abcdef123",
        "task": {
          "_id": "650af1234567890abcdef000",
          "name": "Laundry"
        },
        "name": "Suit Wash",
        "description": "Dry cleaning...",
        "isActive": true,
        "image": "https://res.cloudinary.com/..."
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalServices": 48,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Single Service
**Endpoint:** `GET /api/services/:serviceId`  
**Access:** Public

**Request Example:**
```bash
curl -X GET http://localhost:3500/api/services/650af1234567890abcdef123
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "service": {
      "_id": "650af1234567890abcdef123",
      "task": {
        "_id": "650af1234567890abcdef000",
        "name": "Laundry",
        "description": "Professional cleaning services",
        "image": "https://res.cloudinary.com/..."
      },
      "name": "Suit Wash",
      "description": "Dry cleaning...",
      "isActive": true,
      "image": "https://res.cloudinary.com/..."
    }
  }
}
```

### 4. Update Service
**Endpoint:** `PUT /api/services/:serviceId`  
**Access:** Private (Super Admin)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/services/650af1234567890abcdef123 \
  -H "Authorization: Bearer <super_admin_token>" \
  -F "name=Premium Suit Wash" \
  -F "isActive=false"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Service updated successfully",
  "data": {
    "service": {
      "_id": "650af1234567890abcdef123",
      "task": "650af1234567890abcdef000",
      "name": "Premium Suit Wash",
      "description": "Dry cleaning...",
      "isActive": false,
      "image": "https://res.cloudinary.com/..."
    }
  }
}
```

### 5. Delete Service
**Endpoint:** `DELETE /api/services/:serviceId`  
**Access:** Private (Super Admin)

**Request Example:**
```bash
curl -X DELETE http://localhost:3500/api/services/650af1234567890abcdef123 \
  -H "Authorization: Bearer <super_admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Write access restricted to `super_admin`.
- **Public Access:** Read-only access for all users.
- **Resource Cleanup:** Automatic deletion of Cloudinary assets upon service deletion.

---

## 🚨 Error Handling

Standard error responses:
```json
{ "success": false, "message": "Service not found" }
```

---

## 📊 Database Indexes

```typescript
serviceSchema.index({ task: 1 });
serviceSchema.index({ name: 1 });
serviceSchema.index({ isActive: 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
