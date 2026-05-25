# 🛡️ Dohez API - Role Management Documentation

## 📋 Table of Contents
- [Role Overview](#role-overview)
- [Role Model](#role-model)
- [Role Controller](#role-controller)
- [Role Routes](#role-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Scripts](#scripts)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with User System](#integration-with-user-system)

---

## 🎭 Role Overview

The Appointment API uses a unified role-based access control (RBAC) system where all users are managed through a single User model with role assignments. Roles define user permissions and access levels throughout the system.

### Role System Features
- **Unified User Model** - All users use the same User model
- **Multiple Roles** - Users can have multiple roles assigned
- **Role Management** - Full CRUD operations for roles (admin only)
- **System Roles** - Protected default roles that cannot be deleted
- **Permission-Based** - Each role has an array of permissions
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### Default Roles
- `customer` - Default role for customers (assigned on registration)
- `admin` - Full system access with all permissions
- `staff` - Basic admin access for staff members
- `rider` - Delivery and logistics access
- `super_admin` - Root-level system access
- `vendor_admin` - Full management of vendor-specific data and branches
- `branch_admin` - Management of a specific branch and its operations

---

## Role Model

### Schema Definition
```typescript
interface IRole extends Document {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Role.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IRole } from '../types/index';

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  permissions: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  isSystemRole: { type: Boolean, default: false }
}, { timestamps: true });

roleSchema.index({ isActive: 1 });
roleSchema.index({ isSystemRole: 1 });

const Role = mongoose.model<IRole>('Role', roleSchema);
export default Role;
```

### Default Roles Configuration
```typescript
{
  name: 'customer',
  displayName: 'Customer',
  description: 'Default role for customers',
  permissions: ['view_own_profile', 'update_own_profile', 'view_own_appointments'],
  isSystemRole: true
},
{
  name: 'admin',
  displayName: 'Admin',
  description: 'Full system access for administrators',
  permissions: ['*'],
  isSystemRole: true
},
{
  name: 'staff',
  displayName: 'Staff',
  description: 'Staff access for managing appointments and customers',
  permissions: ['view_customers', 'manage_appointments', 'view_services'],
  isSystemRole: true
}
```

---

## Role Controller

**File:** `src/controllers/roleController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";
```

### Functions Overview

#### `getAllRoles(query)`
**Purpose:** List roles with optional filters  
**Access:** Admin  
**Validation:** Optional `isActive` and `search` filters  
**Pagination:** `page`, `limit` (default: page=1, limit=10)  
**Process:**
- Build query filters for status/search
- Return sorted roles list with pagination
**Response:** Array of roles with pagination metadata

**Controller Implementation:**
```typescript
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive, search, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // Optional filters
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Search by name/display/description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    // Pagination options
    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    // Query roles with pagination
    const roles = await Role.find(query)
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await Role.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        roles,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalRoles: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    console.error("Get all roles error:", error);
    next(errorHandler(500, "Server error while fetching roles"));
  }
};
```

#### `getRoleById(id)`
**Purpose:** Get details of a single role  
**Access:** Admin/Super Admin  
**Validation:** Valid MongoDB ID required in params  
**Process:**
- Find role by ID in the database
- Return role details or 404 error if not found
**Response:** Role object

**Controller Implementation:**
```typescript
export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }
    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};
```

#### `createRole(data)`
**Purpose:** Create a new custom role  
**Access:** Super Admin  
**Validation:** `name` and `displayName` required; `name` must be unique  
**Process:**
- Check if a role with the same name already exists
- Create and save the new role document
**Response:** Created role object

**Controller Implementation:**
```typescript
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, displayName, description, permissions } = req.body;
    
    const roleExists = await Role.findOne({ name });
    if (roleExists) {
      return next(errorHandler(400, 'Role already exists'));
    }

    const role = await Role.create({
      name,
      displayName,
      description,
      permissions,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};
```

#### `updateRole(id, data)`
**Purpose:** Update existing role details  
**Access:** Super Admin  
**Validation:** Valid MongoDB ID; cannot change `name` of system roles  
**Process:**
- Find role by ID
- Validate if the role is a system role (restricting name updates)
- Update the role with new data and return it
**Response:** Updated role object

**Controller Implementation:**
```typescript
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, displayName, description, permissions, isActive } = req.body;
    
    let role = await Role.findById(req.params.id);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }

    if (role.isSystemRole && name && name !== role.name) {
      return next(errorHandler(400, 'Cannot change the name of a system role'));
    }

    role = await Role.findByIdAndUpdate(
      req.params.id,
      { name, displayName, description, permissions, isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};
```

#### `deleteRole(id)`
**Purpose:** Permanently remove a role  
**Access:** Super Admin  
**Validation:** Valid MongoDB ID; system roles cannot be deleted  
**Process:**
- Find role by ID
- Verify if the role is a protected system role
- Delete the document from the database
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }

    if (role.isSystemRole) {
      return next(errorHandler(400, 'System roles cannot be deleted'));
    }

    await role.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};
```

---

## Role Routes

### Base Path: `/api/roles`

```typescript
GET    /                          // Get all roles (admin)
GET    /:roleId                   // Get single role (admin)
POST   /                          // Create role (admin)
PUT    /:roleId                   // Update role (admin)
DELETE /:roleId                   // Delete role (admin)
GET    /:roleId/users             // Get users by role (admin)
GET    /customer/users            // Get customers (admin)
```

### Router Implementation

**File: `src/routes/roleRoutes.ts`**

```typescript
import express from 'express';
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUsersByRole,
  getCustomers
} from '../controllers/roleController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles(['admin']), getAllRoles);

router.get('/customer/users', authenticateToken, authorizeRoles(['admin']), getCustomers);

router.get('/:roleId', authenticateToken, authorizeRoles(['admin']), getRole);

router.post('/', authenticateToken, requireAdmin, createRole);

router.put('/:roleId', authenticateToken, requireAdmin, updateRole);

router.delete('/:roleId', authenticateToken, requireAdmin, deleteRole);

router.get('/:roleId/users', authenticateToken, authorizeRoles(['admin']), getUsersByRole);

export default router;
```

### Route Details

#### `GET /api/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `isActive=true`, `search=admin`, `page=1`, `limit=10`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "_id": "650af1234567890abcdef001",
        "name": "admin",
        "displayName": "Admin",
        "description": "Full system access for administrators",
        "permissions": ["*"],
        "isActive": true,
        "isSystemRole": true,
        "createdAt": "2026-05-20T08:00:00.000Z",
        "updatedAt": "2026-05-20T08:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalRoles": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `roleId: 650af1234567890abcdef001`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "650af1234567890abcdef001",
    "name": "admin",
    "displayName": "Admin",
    "description": "Full system access for administrators",
    "permissions": ["*"],
    "isActive": true,
    "isSystemRole": true,
    "createdAt": "2026-05-20T08:00:00.000Z",
    "updatedAt": "2026-05-20T08:00:00.000Z",
    "__v": 0
  }
}
```

#### `POST /api/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "name": "support_agent",
  "displayName": "Support Agent",
  "description": "Role for customer support agents",
  "permissions": ["view_customers", "reply_tickets"],
  "isActive": true
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "650af1234567890abcdef005",
    "name": "support_agent",
    "displayName": "Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_customers", "reply_tickets"],
    "isActive": true,
    "isSystemRole": false,
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:00:00.000Z",
    "__v": 0
  }
}
```

#### `PUT /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `roleId: 650af1234567890abcdef005`
**Body:**
```json
{
  "displayName": "Senior Support Agent",
  "permissions": ["view_customers", "reply_tickets", "manage_tickets"]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "650af1234567890abcdef005",
    "name": "support_agent",
    "displayName": "Senior Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_customers", "reply_tickets", "manage_tickets"],
    "isActive": true,
    "isSystemRole": false,
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:05:00.000Z",
    "__v": 0
  }
}
```

#### `DELETE /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `roleId: 650af1234567890abcdef005`
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

#### `GET /api/roles/:roleId/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `roleId: 650af1234567890abcdef001`
**Response (200 OK):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "650af1234567890abcdef888",
      "firstName": "Super",
      "lastName": "Admin",
      "email": "admin@dohez.com"
    }
  ]
}
```

#### `GET /api/roles/customer/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    {
      "_id": "650af1234567890abcdef124",
      "firstName": "Jane",
      "lastName": "Customer",
      "email": "jane@customer.com"
    }
  ]
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.get('/roles', authenticateToken, authorizeRoles(['admin']), getAllRoles);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.get('/roles/:roleId', authenticateToken, authorizeRoles(['admin']), getRole);
```

#### `requireAdmin`
**Purpose:** Admin access only  
**Usage:**
```typescript
router.post('/roles', authenticateToken, requireAdmin, createRole);
```

---

## API Examples

### Get All Roles
```bash
curl -X GET http://localhost:4500/api/roles \
  -H "Authorization: Bearer <admin_access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "_id": "...",
        "name": "customer",
        "displayName": "Customer"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalRoles": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Create Custom Role (Admin)
```bash
curl -X POST http://localhost:4500/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "support_agent",
    "displayName": "Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_customers", "reply_tickets"],
    "isActive": true
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "support_agent",
    "displayName": "Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_customers", "reply_tickets"],
    "isActive": true,
    "isSystemRole": false
  }
}
```

### Get Role By ID
```bash
curl -X GET http://localhost:4500/api/roles/60d... \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60d...",
    "name": "customer",
    "displayName": "Customer",
    "isSystemRole": true
  }
}
```

### Update Role
```bash
curl -X PUT http://localhost:4500/api/roles/60d... \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "displayName": "Premium Customer",
    "permissions": ["view_offers", "priority_support"]
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60d...",
    "name": "customer",
    "displayName": "Premium Customer",
    "isSystemRole": true
  }
}
```

### Delete Role
```bash
curl -X DELETE http://localhost:4500/api/roles/60d... \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

### Get Users By Role
```bash
curl -X GET http://localhost:4500/api/roles/60d.../users \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  ]
}
```

### Get Customers
```bash
curl -X GET http://localhost:4500/api/roles/customer/users \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [ ... ]
}
```

---

## 📜 Scripts

### Seed Roles Script
**File:** `src/scripts/seedRoles.ts`  
**Purpose:** Upsert default system roles into the database  
**Command:**
```bash
npm run seed:roles
```
**Behavior:**
- Creates or updates the `customer`, `admin`, and `staff` roles
- Ensures roles remain active and system-protected

---

## Security Features

1.  **System Role Protection:** Roles marked as `isSystemRole` cannot be deleted and their unique `name` cannot be changed.
2.  **Super Admin Gatekeeping:** Critical operations like creating or deleting roles are restricted exclusively to the `super_admin` role.
3.  **Active Status Check:** The `authenticateToken` middleware verifies if the user account is `isActive` before granting access.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Role not found" }
```

---

## 🔗 Integration with User System

Users have a `roles` array field that references Role documents:

**Example User Document:**
```json
{
  "_id": "650af1234567890abcdef123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "roles": [
    "650af4567890abcdef123456",
    "650af7890abcdef123456789"
  ],
  "isActive": true,
  "isVerified": true
}
```

JWT tokens include roleIds in the payload:

**Example JWT Payload:**
```json
{
  "userId": "650af1234567890abcdef123",
  "roleIds": [
    "650af4567890abcdef123456",
    "650af7890abcdef123456789"
  ],
  "userType": "user",
  "iat": 1713696000,
  "exp": 1713782400
}
```

---

**Last Updated:** January 2026  
**Version:** 1.0.0
