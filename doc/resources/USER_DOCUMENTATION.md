# 👥 DOHEZ-API - User Management Documentation

## 📋 Table of Contents
- [User Management Overview](#user-management-overview)
- [User Model](#-user-model)
- [User Controller](#-user-controller)
- [User Routes](#-user-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## User Management Overview

User Management covers all users in the system. All users authenticate via JWT and are assigned roles from the Role model. Role-based access control (RBAC) governs permissions throughout the system.

---

## 👤 User Model

### Schema Definition
```typescript
interface IUser extends Document {
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
```

### Model Implementation

**File: `src/models/User.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    phone: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    otpCode: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
```

### Validation Rules
```typescript
firstName: { required: true, maxlength: 50 }
lastName:  { required: true, maxlength: 50 }
email:     { required: true, unique: true, format: email }
password:  { required: true, minlength: 6, select: false }
roles:     { type: Array, ref: 'Role' }
phone:     { required: true, unique: true }
address:   { optional, maxlength: 200 }
city:      { optional, maxlength: 50 }
country:   { optional, maxlength: 50 }
services:  { type: Array, ref: 'Service' }
workingHours: { optional, days: monday-sunday }
isActive:  { default: true }
emailVerified: { default: false }
```

---

## 🎮 User Controller

**File:** `src/controllers/userController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
```

### Functions Overview

#### `getUserProfile()`
**Purpose:** Get current user profile  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch profile and populate roles  
**Response:** User profile data

**Controller Implementation:**
```typescript
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles");

    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({ success: true, data: { user } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateUserProfile()`
**Purpose:** Update current user profile, including avatar image.  
**Access:** Authenticated users  
**Validation:** User must exist, valid phone number, image size limit  
**Process:** Update profile fields and save. If file provided, upload to Cloudinary and delete old avatar.  
**Response:** Success message and updated profile

**Controller Implementation:**
```typescript
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) return next(errorHandler(404, "User not found"));

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      if (!validator.isMobilePhone(phone)) return next(errorHandler(400, "Please provide a valid phone number"));
      user.phone = phone;
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/avatars");
      if (user.avatarPublicId) await deleteFromCloudinary(user.avatarPublicId);
      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || avatar === "") {
        if (user.avatarPublicId) await deleteFromCloudinary(user.avatarPublicId);
        user.avatar = null;
        user.avatarPublicId = null;
    }

    await user.save();
    res.status(200).json({ success: true, message: "Profile updated successfully", data: { user } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `changePassword()`
**Purpose:** Change user password  
**Access:** Authenticated users  
**Validation:** Current/new passwords required, current password match  
**Process:** Hash new password and save  
**Response:** Success message

**Controller Implementation:**
```typescript
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return next(errorHandler(400, "Current password and new password are required"));

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) return next(errorHandler(404, "User not found"));

    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) return next(errorHandler(400, "Current password is incorrect"));

    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getNotificationPreferences()`
**Purpose:** Fetch notification preferences  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch preferences  
**Response:** Preferences object

**Controller Implementation:**
```typescript
export const getNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("notificationPreferences");
    if (!user) return next(errorHandler(404, "User not found"));
    res.status(200).json({ success: true, data: { notificationPreferences: user.notificationPreferences || {} } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateNotificationPreferences()`
**Purpose:** Update notification preferences  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Update flags and save  
**Response:** Updated preferences

**Controller Implementation:**
```typescript
export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, sms, inApp } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) return next(errorHandler(404, "User not found"));

    user.notificationPreferences = {
      email: email !== undefined ? email : user.notificationPreferences?.email,
      sms: sms !== undefined ? sms : user.notificationPreferences?.sms,
      inApp: inApp !== undefined ? inApp : user.notificationPreferences?.inApp,
    };

    await user.save();
    res.status(200).json({ success: true, message: "Preferences updated", data: { notificationPreferences: user.notificationPreferences } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getAllUsers()`
**Purpose:** List users  
**Access:** Admin  
**Validation:** None  
**Process:** Filter, paginate, return users  
**Response:** User list and pagination

**Controller Implementation:**
```typescript
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    const options = { page: parseInt(page as string), limit: parseInt(limit as string) };
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
    const total = await User.countDocuments(query);
    res.status(200).json({ success: true, data: { users, pagination: { currentPage: options.page, totalPages: Math.ceil(total / options.limit), totalUsers: total } } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getUserById()`
**Purpose:** Fetch user by ID  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Find user and populate roles  
**Response:** User details

**Controller Implementation:**
```typescript
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select("-password -otpCode -resetPasswordToken").populate("roles");
    if (!user) return next(errorHandler(404, "User not found"));
    res.status(200).json({ success: true, data: { user } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateUser()`
**Purpose:** Update user record by ID, including avatar.  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Update fields, handle avatar upload via Cloudinary, and save.  
**Response:** Updated user

**Controller Implementation:**
```typescript
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, email, isActive, avatar } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return next(errorHandler(404, "User not found"));

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/avatars");
      if (user.avatarPublicId) await deleteFromCloudinary(user.avatarPublicId);
      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || avatar === "") {
        if (user.avatarPublicId) await deleteFromCloudinary(user.avatarPublicId);
        user.avatar = null;
        user.avatarPublicId = null;
    }

    await user.save();
    res.status(200).json({ success: true, message: "User updated successfully", data: { user } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateUserStatus()`
**Purpose:** Activate/deactivate user  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Toggle active status  
**Response:** Success message

**Controller Implementation:**
```typescript
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { isActive }, { new: true });
    if (!user) return next(errorHandler(404, "User not found"));
    res.status(200).json({ success: true, message: "Status updated" });
  } catch (error: any) {
    next(error);
  }
};
```

#### `setUserAdmin()`
**Purpose:** Promote to admin  
**Access:** Admin  
**Validation:** Role must exist  
**Process:** Replace roles with admin role  
**Response:** Success message

**Controller Implementation:**
```typescript
export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return next(errorHandler(404, "User not found"));
        const role = await Role.findOne({ name: "admin" });
        if (!role) return next(errorHandler(404, "Role not found"));
        user.roles = [role._id as any];
        await user.save();
        res.status(200).json({ success: true, message: "User is now admin" });
    } catch(error: any) {
        next(error);
    }
};
```

#### `getUserRoles()`
**Purpose:** Get user roles  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Populate roles  
**Response:** Role list

**Controller Implementation:**
```typescript
export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.params.userId).populate("roles");
        if (!user) return next(errorHandler(404, "User not found"));
        res.status(200).json({ success: true, data: { roles: user.roles } });
    } catch(error: any) {
        next(error);
    }
};
```

#### `deleteUser()`
**Purpose:** Delete user  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Delete record  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findByIdAndDelete(req.params.userId);
        if (!user) return next(errorHandler(404, "User not found"));
        res.status(200).json({ success: true, message: "User deleted" });
    } catch(error: any) {
        next(error);
    }
};
```

#### `adminCreateCustomer()`
**Purpose:** Create customer  
**Access:** Admin/Staff  
**Validation:** Required fields  
**Process:** Create and save user  
**Response:** Created user details

**Controller Implementation:**
```typescript
export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, email, phone } = req.body;
        const role = await Role.findOne({ name: "customer" });
        if (!role) return next(errorHandler(404, "Customer role not found"));
        const user = await User.create({ firstName, lastName, email, phone, password: bcrypt.hashSync(phone, 12), roles: [role._id] });
        res.status(201).json({ success: true, data: { user } });
    } catch(error: any) {
        next(error);
    }
};
```

#### `assignRole()`
**Purpose:** Assign role  
**Access:** Admin  
**Validation:** Role must exist  
**Process:** Append role to list  
**Response:** Success message

**Controller Implementation:**
```typescript
export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { roleName } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return next(errorHandler(404, "User not found"));
        const role = await Role.findOne({ name: roleName });
        if (!role) return next(errorHandler(404, "Role not found"));
        user.roles = [...(user.roles as any[]), role._id];
        await user.save();
        res.status(200).json({ success: true, message: "Role assigned" });
    } catch(error: any) {
        next(error);
    }
};
```

#### `removeRole()`
**Purpose:** Remove role  
**Access:** Admin  
**Validation:** Role must exist  
**Process:** Filter role from list  
**Response:** Success message

**Controller Implementation:**
```typescript
export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return next(errorHandler(404, "User not found"));
        user.roles = (user.roles as any[]).filter(r => r.toString() !== req.params.roleId);
        await user.save();
        res.status(200).json({ success: true, message: "Role removed" });
    } catch(error: any) {
        next(error);
    }
};
```

#### `getCustomers()`
**Purpose:** List customers  
**Access:** Admin/Staff  
**Validation:** Role must exist  
**Process:** Filter users by customer role  
**Response:** Customer list

**Controller Implementation:**
```typescript
export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const role = await Role.findOne({ name: "customer" });
        const users = await User.find({ roles: role?._id });
        res.status(200).json({ success: true, data: { users } });
    } catch(error: any) {
        next(error);
    }
};
```

#### `getStaff()`
**Purpose:** List staff  
**Access:** Auth  
**Validation:** Role must exist  
**Process:** Filter users by staff role  
**Response:** Staff list

**Controller Implementation:**
```typescript
export const getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const role = await Role.findOne({ name: "staff" });
        const users = await User.find({ roles: role?._id });
        res.status(200).json({ success: true, data: { users } });
    } catch(error: any) {
        next(error);
    }
};
```

---

## 🛣️ User Routes

### Base Path: `/api/users`

```typescript
GET    /profile                  // Get current user profile
PUT    /profile                  // Update own profile
PUT    /change-password          // Change password
GET    /notifications            // Get notification preferences
PUT    /notifications            // Update notification preferences
POST   /admin-create             // Admin create customer
GET    /customers                // Get customers (admin)
GET    /staff                    // Get staff (any authenticated user)
GET    /                         // Get all users (admin)
GET    /:userId                  // Get single user (admin)
PUT    /:userId                  // Update user (admin)
PUT    /:userId/status           // Update user status (admin)
PUT    /:userId/admin            // Set user admin role (admin)
GET    /:userId/roles            // Get user roles (admin)
DELETE /:userId                  // Delete user (admin)
POST   /:userId/roles            // Assign role to user (admin)
DELETE /:userId/roles/:roleId    // Remove role from user (admin)
```

### Router Implementation

**File: `src/routes/userRoutes.ts`**

```typescript
import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  setUserAdmin,
  getUserRoles,
  deleteUser,
  adminCreateCustomer,
  assignRole,
  removeRole,
  getCustomers,
  getStaff
} from '../controllers/userController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', authenticateToken, updateUserProfile);
router.put('/change-password', authenticateToken, changePassword);
router.get('/notifications', authenticateToken, getNotificationPreferences);
router.put('/notifications', authenticateToken, updateNotificationPreferences);
router.post('/admin-create', authenticateToken, authorizeRoles(['admin', 'super_admin']), adminCreateCustomer);
router.get('/customers', authenticateToken, authorizeRoles(['admin', 'super_admin']), getCustomers);
router.get('/staff', authenticateToken, getStaff);
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), getAllUsers);
router.get('/:userId', authenticateToken, authorizeRoles(['admin', 'super_admin']), getUserById);
router.put('/:userId', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateUser);
router.put('/:userId/status', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateUserStatus);
router.put('/:userId/admin', authenticateToken, requireAdmin, setUserAdmin);
router.get('/:userId/roles', authenticateToken, authorizeRoles(['admin', 'super_admin']), getUserRoles);
router.delete('/:userId', authenticateToken, requireAdmin, deleteUser);
router.post('/:userId/roles', authenticateToken, requireAdmin, assignRole);
router.delete('/:userId/roles/:roleId', authenticateToken, requireAdmin, removeRole);

export default router;
```

### Route Details

#### `GET /api/users/profile`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    }
  }
}
```

#### `PUT /api/users/profile`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
**Body:** `multipart/form-data` (firstName, lastName, phone, avatar)
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "avatar": "https://cloudinary.com/..."
    }
  }
}
```

#### `PUT /api/users/change-password`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### `GET /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": true,
      "inApp": true
    }
  }
}
```

#### `PUT /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "email": true,
  "sms": true,
  "inApp": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Preferences updated",
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": true,
      "inApp": true
    }
  }
}
```

#### `POST /api/users/admin-create`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Customer",
  "email": "jane@customer.com",
  "phone": "+1987654321"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef124",
      "email": "jane@customer.com"
    }
  }
}
```

#### `GET /api/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page=1`, `limit=10`, `search=John`
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "650af1234567890abcdef123",
        "firstName": "John",
        "lastName": "Doe"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalUsers": 1
    }
  }
}
```

#### `GET /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### `PUT /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: multipart/form-data`
**Body:** `multipart/form-data` (firstName, lastName, email, phone, isActive, avatar)
**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "avatar": "https://cloudinary.com/..."
    }
  }
}
```

#### `PUT /api/users/:userId/status`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "isActive": false
}
```
**Response:**
```json
{
  "success": true,
  "message": "Status updated"
}
```

#### `PUT /api/users/:userId/admin`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "User is now admin"
}
```

#### `GET /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "name": "admin",
        "displayName": "Admin"
      }
    ]
  }
}
```

#### `DELETE /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "User deleted"
}
```

#### `POST /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "roleName": "staff"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Role assigned"
}
```

#### `DELETE /api/users/:userId/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "Role removed"
}
```

---

## 🔐 Middleware

### Authentication Middleware
- `authenticateToken`: Verify JWT token.
- `authorizeRoles(allowedRoles)`: Check user permissions.
- `requireAdmin`: Admin access only (admin/super_admin).

---

## 📝 API Examples

### Get Current User Profile
```bash
curl -X GET http://localhost:3500/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    }
  }
}
```

### Update Profile
```bash
curl -X PUT http://localhost:3500/api/users/profile \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "phone=+1234567890" \
  -F "avatar=@/path/to/image.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "avatar": "https://cloudinary.com/..."
    }
  }
}
```

### Change Password
```bash
curl -X PUT http://localhost:3500/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword123"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Get Notification Preferences
```bash
curl -X GET http://localhost:3500/api/users/notifications \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": true,
      "inApp": true
    }
  }
}
```

### Update Notification Preferences
```bash
curl -X PUT http://localhost:3500/api/users/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "email": true,
    "sms": false,
    "inApp": true
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Preferences updated",
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": false,
      "inApp": true
    }
  }
}
```

### Admin Create Customer
```bash
curl -X POST http://localhost:3500/api/users/admin-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Customer",
    "email": "jane@customer.com",
    "phone": "+1987654321"
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef124",
      "firstName": "Jane",
      "lastName": "Customer",
      "email": "jane@customer.com"
    }
  }
}
```

### Get All Users (Admin)
```bash
curl -X GET "http://localhost:3500/api/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "650af1234567890abcdef123",
        "firstName": "John",
        "lastName": "Doe"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalUsers": 1
    }
  }
}
```

### Update User (Admin)
```bash
curl -X PUT http://localhost:3500/api/users/650af1234567890abcdef123 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "isActive=true" \
  -F "avatar=@/path/to/image.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "avatar": "https://cloudinary.com/..."
    }
  }
}
```

### Set User Admin (Admin)
```bash
curl -X PUT http://localhost:3500/api/users/650af1234567890abcdef123/admin \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "role": "admin"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "User is now admin"
}
```

### Assign Role (Admin)
```bash
curl -X POST http://localhost:3500/api/users/650af1234567890abcdef123/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "roleName": "staff"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Role assigned"
}
```

### Remove Role (Admin)
```bash
curl -X DELETE http://localhost:3500/api/users/650af1234567890abcdef123/roles/650af4567890abcdef123456 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Role removed"
}
```

### Delete User (Admin)
```bash
curl -X DELETE http://localhost:3500/api/users/650af1234567890abcdef123 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "User deleted"
}
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `authenticateToken`, `authorizeRoles`, `requireAdmin`.
- **Least Privilege:** Sensitive actions limited to `admin` (delete, role changes).
- **Sensitive Fields Excluded:** Password, OTP, reset tokens never returned.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "..." }
```

---

## 📊 Database Indexes

```typescript
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
