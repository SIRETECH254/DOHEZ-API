# 📋 DOHEZ-API - Task Management Documentation

## 📋 Table of Contents
- [Task Management Overview](#task-management-overview)
- [Task Model](#-task-model)
- [Task Controller](#-task-controller)
- [Task Routes](#-task-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Task Management Overview

Task Management defines the global categories of services offered on the platform (e.g., Laundry, Cleaning, Events). These are managed by Super Admins and serve as the parent containers for specific services.

---

## 👤 Task Model

### Schema Definition
```typescript
export interface ITask extends Document {
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

**File: `src/models/Task.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { ITask } from '../types';

const taskSchema = new Schema<ITask>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
```

### Validation Rules
```typescript
name:        { required: true, unique: true, trim: true }
description: { optional, trim: true }
image:       { optional, url }
isActive:    { default: true }
```

---

## 🎮 Task Controller

**File:** `src/controllers/taskController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Task from "../models/Task";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `createTask()`
**Purpose:** Create a new task category  
**Access:** Super Admin  
**Validation:** Name is required and must be unique  
**Process:** Create task, handle optional image upload to Cloudinary  
**Response:** Success message and created task

**Controller Implementation:**
```typescript
export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return next(errorHandler(400, "Task name is required"));
    }

    const existingTask = await Task.findOne({ name });
    if (existingTask) {
      return next(errorHandler(400, "Task with this name already exists"));
    }

    const taskData: any = {
      name,
      description,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/tasks");
      taskData.image = uploadResult.url;
      taskData.imagePublicId = uploadResult.public_id;
    }

    const task = await Task.create(taskData);

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getTasks()`
**Purpose:** List all task categories  
**Access:** Public  
**Validation:** None  
**Process:** Fetch tasks with pagination. Sorted by `createdAt` descending. Public view only sees `isActive: true`. Admins can see all via `all=true`.  
**Response:** List of tasks and pagination metadata

**Controller Implementation:**
```typescript
export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // For public view, only show active tasks unless 'all' is requested by an admin
    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const tasks = await Task.find(query)
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Task.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        tasks,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalTasks: total,
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

#### `getTaskById()`
**Purpose:** Get single task details  
**Access:** Public  
**Validation:** Task must exist  
**Process:** Find task by ID  
**Response:** Task details

**Controller Implementation:**
```typescript
export const getTaskById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateTask()`
**Purpose:** Update task details or image  
**Access:** Super Admin  
**Validation:** Task must exist  
**Process:** Update fields, handle image replacement or removal on Cloudinary  
**Response:** Updated task

**Controller Implementation:**
```typescript
export const updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    if (name) task.name = name;
    if (description !== undefined) task.description = description;
    if (isActive !== undefined) task.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/tasks");
      if (task.imagePublicId) {
        await deleteFromCloudinary(task.imagePublicId);
      }
      task.image = uploadResult.url;
      task.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      // Logic to remove image if explicitly set to null/empty string
      if (task.imagePublicId) {
        await deleteFromCloudinary(task.imagePublicId);
      }
      task.image = null;
      task.imagePublicId = null;
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteTask()`
**Purpose:** Delete a task category  
**Access:** Super Admin  
**Validation:** Task must exist  
**Process:** Delete record and its associated image from Cloudinary  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    if (task.imagePublicId) {
      await deleteFromCloudinary(task.imagePublicId);
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Task Routes

### Base Path: `/api/tasks`

```typescript
GET    /                          // Get all tasks (Public)
GET    /:taskId                   // Get task details (Public)
POST   /                          // Create task (Super Admin)
PUT    /:taskId                   // Update task (Super Admin)
DELETE /:taskId                   // Delete task (Super Admin)
```

### Router Implementation

**File: `src/routes/taskRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask
} from '../controllers/taskController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createTask);

router.get('/', optionalAuthenticateToken, getTasks);

router.get('/:taskId', getTaskById);

router.put('/:taskId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateTask);

router.delete('/:taskId', authenticateToken, authorizeRoles(['super_admin']), deleteTask);

export default router;
```

### Route Details

#### `GET /api/tasks`
**Headers:**
- **Authorization:** Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
**Query:**
- **search:** Laundry
- **all:** true
- **page:** 1
- **limit:** 10
**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Laundry",
        "description": "Professional washing services",
        "isActive": true,
        "image": "https://res.cloudinary.com/demo/image/upload/v123/task.jpg",
        "createdAt": "2023-09-20T12:00:00Z",
        "updatedAt": "2023-09-20T12:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTasks": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/tasks/:taskId`
**Params:**
- **taskId:** 650af1234567890abcdef123
**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "_id": "650af1234567890abcdef123",
      "name": "Laundry",
      "description": "Professional washing and ironing services",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v123/task.jpg"
    }
  }
}
```

#### `POST /api/tasks`
**Headers:**
- **Authorization:** Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
**Body:**
```json
{
  "name": "Cleaning",
  "description": "Full house cleaning",
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "task": {
      "_id": "650af1234567890abcdef124",
      "name": "Cleaning",
      "description": "Full house cleaning",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v124/cleaning.jpg"
    }
  }
}
```

#### `PUT /api/tasks/:taskId`
**Headers:**
- **Authorization:** Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
**Params:**
- **taskId:** 650af1234567890abcdef123
**Body:**
```json
{
  "name": "Laundry Premium",
  "description": "Express washing services",
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "task": {
      "_id": "650af1234567890abcdef123",
      "name": "Laundry Premium",
      "description": "Express washing services",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v125/premium.jpg"
    }
  }
}
```

#### `DELETE /api/tasks/:taskId`
**Headers:**
- **Authorization:** Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
**Params:**
- **taskId:** 650af1234567890abcdef123
**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createTask);
```

#### `optionalAuthenticateToken`
**Purpose:** Optionally verify JWT token to identify user without enforcing authentication  
**Usage:**
```typescript
router.get('/', optionalAuthenticateToken, getTasks);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.put('/:taskId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateTask);
```

---

## 📝 API Examples

### Get All Tasks
```bash
curl -X GET "http://localhost:3500/api/tasks?page=1&limit=10"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Laundry",
        "description": "Professional washing services",
        "isActive": true,
        "image": "https://res.cloudinary.com/demo/image/upload/v123/task.jpg",
        "createdAt": "2023-09-20T12:00:00Z",
        "updatedAt": "2023-09-20T12:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTasks": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Task By ID
```bash
curl -X GET http://localhost:3500/api/tasks/650af1234567890abcdef123
```
**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "_id": "650af1234567890abcdef123",
      "name": "Laundry",
      "description": "Professional washing and ironing services",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v123/task.jpg"
    }
  }
}
```

### Create Task (Super Admin)
```bash
curl -X POST http://localhost:3500/api/tasks \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Cleaning" \
  -F "description=Full house cleaning" \
  -F "isActive=true" \
  -F "image=@/path/to/cleaning.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "task": {
      "_id": "650af1234567890abcdef124",
      "name": "Cleaning",
      "description": "Full house cleaning",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v124/cleaning.jpg"
    }
  }
}
```

### Update Task (Super Admin)
```bash
curl -X PUT http://localhost:3500/api/tasks/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Laundry Premium" \
  -F "description=Express washing services" \
  -F "image=@/path/to/new_laundry.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "task": {
      "_id": "650af1234567890abcdef123",
      "name": "Laundry Premium",
      "description": "Express washing services",
      "isActive": true,
      "image": "https://res.cloudinary.com/demo/image/upload/v125/premium.jpg"
    }
  }
}
```

### Delete Task (Super Admin)
```bash
curl -X DELETE http://localhost:3500/api/tasks/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Write access restricted to `super_admin`.
- **Public Access:** Read-only access for customers and unauthenticated users.
- **Resource Cleanup:** Automatic deletion of Cloudinary assets upon task deletion or image update.

---

## 🚨 Error Handling

Standard error responses:
```json
{ "success": false, "message": "Task not found" }
```

---

## 📊 Database Indexes

```typescript
taskSchema.index({ name: 1 });
taskSchema.index({ isActive: 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
