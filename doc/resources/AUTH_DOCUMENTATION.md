# 🔐 Dohez API - Authentication System Documentation

## 📋 Table of Contents
- [Authentication Overview](#authentication-overview)
- [Authentication Controller](#authentication-controller)
- [Authentication Routes](#authentication-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 🔑 Authentication Overview

The Dohez API uses JWT (JSON Web Tokens) for authentication with a unified role-based access control (RBAC) system. All users are managed through a single User model with role assignments. The system incorporates OTP verification and comprehensive security features.

### Authentication Flow
1. **Registration/Login** → Generate JWT tokens with role-based payload (roleIds array)
2. **OTP Verification** → Email/SMS verification for new accounts
3. **Token Validation** → Middleware verifies tokens and user status
4. **Role Authorization** → Check user roles and permissions
5. **Protected Routes** → Access granted based on roles and verification status

### Unified User System
- **Single User Model** - All users use the same User model
- **Role-Based Access** - Users have roles array referencing Role documents
- **Default Role** - New users automatically receive "customer" role on registration
- **Multiple Roles** - Users can have multiple roles assigned
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### User Roles
- `customer` - Default role for customers (assigned automatically on registration)
- `admin` - Full system access, can manage all users and system settings
- `staff` - Basic admin access, customer and appointment operations
- `super_admin` - Highest level of access

### Security Features
- **OTP Verification** - Email and SMS verification for new accounts
- **Password Reset** - Secure token-based password reset flow
- **Refresh Tokens** - Separate refresh token mechanism for security
- **Account Status** - Active/inactive user management
- **Verification Status** - `isVerified` field tracks account activation

---

## 🎮 Authentication Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import { generateTokens, generateOTP } from "../utils/authHelpers";
import {
  sendOTPNotification,
  sendPasswordResetNotification,
  sendWelcomeNotification
} from "../services/internal/notificationService";
```

### Functions Overview

#### `register(userData)`
**Purpose:** Register a new user with OTP verification  
**Access:** Public (customer registration) or Admin (admin/staff creation)  
**Validation:**
- Required fields (firstName, lastName, email, phone, password)
- Valid email format
- Unique email or phone
- Optional role must exist (defaults to `customer`)
**Process:**
- Hash password and generate OTP/expiry
- Create user with OTP details and roles
- Send OTP notification
- Populate roles for response
**Response:** User summary + verification status

**Controller Implementation:**
```typescript
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role
    }: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      role?: string;
    } = req.body;

    // Basic required field validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return next(errorHandler(400, "All fields are required"));
    }

    // Validate email and phone formats
    if (!validator.isEmail(email)) {
      return next(errorHandler(400, "Please provide a valid email"));
    }

    // Check for existing user by email or phone
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      return next(errorHandler(400, "User already exists with this email or phone"));
    }

    // Hash password and generate OTP
    const hashedPassword = bcrypt.hashSync(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    let assignedRoles: any[] = [];
    // Resolve role assignment (default customer)
    if (role) {
      const specifiedRole = await Role.findOne({ name: role.toLowerCase() });
      if (specifiedRole) {
        assignedRoles = [specifiedRole._id];
      } else {
        return next(errorHandler(400, `Role "${role}" not found`));
      }
    } else {
      const customerRole = await Role.findOne({ name: "customer" });
      if (!customerRole) {
        return next(
          errorHandler(500, "Default customer role not found. Please run seed script first.")
        );
      }
      assignedRoles = [customerRole._id];
    }

    // Persist user with OTP details
    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      roles: assignedRoles,
      otpCode: otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // Send OTP via email and SMS
    await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
    
    await user.populate("roles", "name displayName");

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your account with the OTP sent.",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
        isVerified: user.isVerified
      }
    });
  } catch (error: any) {
    console.error("Register error:", error);
    next(errorHandler(500, "Server error during registration"));
  }
};
```

#### `verifyOTP(email/phone, otp)`
**Purpose:** Verify OTP and activate account  
**Access:** Public  
**Validation:**
- OTP is required
- Email or phone is required
- User exists and OTP matches/not expired
**Process:**
- Mark user verified (`isVerified = true`) and clear OTP fields
- Send welcome notification
- Issue access/refresh tokens
**Response:** User data + access/refresh tokens

**Controller Implementation:**
```typescript
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, otp }: { email?: string; phone?: string; otp: string } = req.body;

    if (!otp) {
      return next(errorHandler(400, "OTP is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+otpCode +otpExpiry");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return next(errorHandler(400, "OTP has expired. Please request a new one"));
    }

    if (user.otpCode !== otp.trim()) {
      return next(errorHandler(400, "Incorrect OTP code"));
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    await sendWelcomeNotification(user.email, user.phone, `${user.firstName} ${user.lastName}`);
    await user.populate("roles", "name displayName");

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    next(errorHandler(500, "Server error during OTP verification"));
  }
};
```

#### `resendOTP(email/phone)`
**Purpose:** Resend OTP for verification  
**Access:** Public  
**Validation:**
- Email or phone is required
- User exists and is not verified
**Process:**
- Generate new OTP and expiry
- Persist OTP values
- Send OTP notifications
**Response:** Confirmation + OTP expiry

**Controller Implementation:**
```typescript
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Account is already verified"));
    }

    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    user.otpCode = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTPNotification(user.email, user.phone, otp, `${user.firstName} ${user.lastName}`);

    res.status(200).json({
      success: true,
      message: "OTP has been resent to your email and phone",
      data: {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        otpExpiry
      }
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    next(errorHandler(500, "Server error during OTP resend"));
  }
};
```

#### `login(credentials)`
**Purpose:** Authenticate user and issue tokens  
**Access:** Public  
**Validation:**
- Password required
- Email or phone required
- User exists (Specific: "Email does not exist" or "Phone does not exist")
- Password matches (Specific: "Invalid password")
- User is verified and active
**Process:**
- Update last login timestamp
- Populate roles
- Issue access/refresh tokens
**Response:** User data + access/refresh tokens

**Controller Implementation:**
```typescript
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, password }: { email?: string; phone?: string; password: string } = req.body;

    if (!password) {
      return next(errorHandler(400, "Password is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return next(errorHandler(401, email ? "Email does not exist" : "Phone does not exist"));
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Invalid password"));
    }

    if (!user.isVerified) {
      return next(errorHandler(403, "Please verify your account before logging in"));
    }

    if (!user.isActive) {
      return next(errorHandler(403, "Account is deactivated. Please contact support."));
    }

    user.lastLoginAt = new Date();
    await user.save();

    await user.populate("roles", "name displayName");
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    next(errorHandler(500, "Server error during login"));
  }
};
```

#### `logout()`
**Purpose:** Log out user  
**Access:** Authenticated users  
**Validation:** None  
**Process:** Return success response  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    next(errorHandler(500, "Server error during logout"));
  }
};
```

#### `forgotPassword(email)`
**Purpose:** Send password reset instructions  
**Access:** Public  
**Validation:**
- Email is required
- User exists
**Process:**
- Generate reset token/expiry
- Persist reset fields
- Send reset notifications
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(errorHandler(400, "Email is required"));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return next(errorHandler(404, "No user found with this email"));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetExpiry;
    await user.save();

    await sendPasswordResetNotification(
      user.email,
      user.phone,
      resetToken,
      `${user.firstName} ${user.lastName}`
    );

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email and phone"
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    next(errorHandler(500, "Server error during password reset request"));
  }
};
```

#### `resetPassword(token, newPassword)`
**Purpose:** Reset password with token  
**Access:** Public  
**Validation:**
- Token and new password required
- Reset token must be valid ("Invalid reset token")
- Reset token must not be expired ("Reset token has expired") - Tokens are valid for 15 minutes
**Process:**
- Hash new password
- Clear reset fields
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return next(errorHandler(400, "Token and new password are required"));
    }

    // Check if token exists
    const user = await User.findOne({ resetPasswordToken: token }).select("+password");

    if (!user) {
      return next(errorHandler(400, "Invalid reset token"));
    }

    // Check if token is expired
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
      return next(errorHandler(400, "Reset token has expired"));
    }

    user.password = bcrypt.hashSync(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    next(errorHandler(500, "Server error during password reset"));
  }
};
```

#### `refreshToken(refreshToken)`
**Purpose:** Generate new access token  
**Access:** Public  
**Validation:**
- Refresh token required
- Token is valid and user is active
**Process:** Verify refresh token and issue new token pair  
**Response:** New token pair

**Controller Implementation:**
```typescript
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(errorHandler(400, "Refresh token is required"));
    }

    const decoded = jwt.verify(
      refreshToken,
      (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string
    ) as any;

    const user = await User.findById(decoded.userId).populate("roles");
    if (!user || !user.isActive) {
      return next(errorHandler(403, "User not found or inactive"));
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    next(errorHandler(403, "Invalid refresh token"));
  }
};
```

#### `getMe()`
**Purpose:** Get current user profile  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch user profile  
**Response:** Current user data

**Controller Implementation:**
```typescript
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId).populate("roles").select("-password -otpCode -resetPasswordToken");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          isVerified: user.isVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error("Get me error:", error);
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};
```

---

## 🛣️ Authentication Routes

### Base Path: `/api/auth`

```typescript
POST   /register                 // Register new user with OTP
POST   /verify-otp               // Verify OTP and activate account
POST   /resend-otp               // Resend OTP for verification
POST   /login                    // User login (email/phone + password)
POST   /logout                   // Logout user
POST   /forgot-password          // Request password reset
POST   /reset-password/:token    // Reset password with token
POST   /refresh-token            // Refresh access token
GET    /me                       // Get current user profile
```

### Router Implementation

**File: `src/routes/authRoutes.ts`**

```typescript
import express from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  getMe
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);

router.post('/verify-otp', verifyOTP);

router.post('/resend-otp', resendOTP);

router.post('/login', login);

router.post('/logout', authenticateToken, logout);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.post('/refresh-token', refreshToken);

router.get('/me', authenticateToken, getMe);

export default router;
```

### Route Details

#### `POST /api/auth/register`
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+254712345678",
  "password": "securePassword123",
  "role": "staff"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your account with the OTP sent.",
  "data": {
    "userId": "650af1234567890abcdef123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "roles": [
      {
        "_id": "650af1234567890abcdef001",
        "name": "staff",
        "displayName": "Staff"
      }
    ],
    "isVerified": false
  }
}
```

#### `POST /api/auth/verify-otp`
**Body:**
```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Account verified successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "roles": [
        {
          "_id": "650af1234567890abcdef001",
          "name": "staff",
          "displayName": "Staff"
        }
      ],
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /api/auth/resend-otp`
**Body:**
```json
{
  "email": "john.doe@example.com"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP has been resent to your email and phone",
  "data": {
    "userId": "650af1234567890abcdef123",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "otpExpiry": "2026-05-22T10:45:00.000Z"
  }
}
```

#### `POST /api/auth/login`
**Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "avatar": "https://res.cloudinary.com/dohez/image/upload/v1234567890/avatars/john.jpg",
      "roles": [
        {
          "_id": "650af1234567890abcdef001",
          "name": "staff",
          "displayName": "Staff"
        }
      ],
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /api/auth/forgot-password`
**Body:**
```json
{
  "email": "john.doe@example.com"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email and phone"
}
```

#### `POST /api/auth/reset-password/:token`
**Body:**
```json
{
  "newPassword": "newSecurePassword456"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

#### `POST /api/auth/refresh-token`
**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `GET /api/auth/me`
**Headers:** `Authorization: Bearer <token>`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "avatar": "https://res.cloudinary.com/dohez/image/upload/v1234567890/avatars/john.jpg",
      "roles": [
        {
          "_id": "650af1234567890abcdef001",
          "name": "staff",
          "displayName": "Staff"
        }
      ],
      "isActive": true,
      "isVerified": true,
      "lastLoginAt": "2026-05-22T10:30:00.000Z",
      "createdAt": "2026-05-20T08:00:00.000Z"
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
router.get('/me', authenticateToken, getMe);
```

---

## API Examples

### Register User with OTP
```bash
curl -X POST http://localhost:3500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "securePassword123",
    "phone": "+254712345678",
    "role": "customer"
  }'
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your account with the OTP sent.",
  "data": {
    "userId": "650af1234567890abcdef123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "roles": [
      {
        "_id": "650af1234567890abcdef002",
        "name": "customer",
        "displayName": "Customer"
      }
    ],
    "isVerified": false
  }
}
```

### Verify OTP
```bash
curl -X POST http://localhost:3500/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "otp": "123456"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Account verified successfully",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "roles": [
        {
          "_id": "650af1234567890abcdef002",
          "name": "customer",
          "displayName": "Customer"
        }
      ],
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login (Email or Phone)
```bash
curl -X POST http://localhost:3500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securePassword123"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "avatar": "https://res.cloudinary.com/dohez/image/upload/v1234567890/avatars/john.jpg",
      "roles": [
        {
          "_id": "650af1234567890abcdef002",
          "name": "customer",
          "displayName": "Customer"
        }
      ],
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Resend OTP
```bash
curl -X POST http://localhost:3500/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP has been resent to your email and phone",
  "data": {
    "userId": "650af1234567890abcdef123",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "otpExpiry": "2026-05-22T11:00:00.000Z"
  }
}
```

### Forgot Password
```bash
curl -X POST http://localhost:3500/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email and phone"
}
```

### Reset Password
```bash
curl -X POST http://localhost:3500/api/auth/reset-password/a1b2c3d4e5f6g7h8i9j0 \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "newSecurePassword456"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Refresh Token
```bash
curl -X POST http://localhost:3500/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Get Current Profile (Me)
```bash
curl -X GET http://localhost:3500/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "650af1234567890abcdef123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254712345678",
      "avatar": "https://res.cloudinary.com/dohez/image/upload/v1234567890/avatars/john.jpg",
      "roles": [
        {
          "_id": "650af1234567890abcdef002",
          "name": "customer",
          "displayName": "Customer"
        }
      ],
      "isActive": true,
      "isVerified": true,
      "lastLoginAt": "2026-05-22T10:30:00.000Z",
      "createdAt": "2026-05-20T08:00:00.000Z"
    }
  }
}
```

### Logout
```bash
curl -X POST http://localhost:3500/api/auth/logout \
  -H "Authorization: Bearer <access_token>"
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🔒 Security Features

### Password Security
- **Hashing:** bcryptjs with 12 salt rounds
- **Minimum Length:** 6 characters
- **Hidden by Default:** Password field excluded from queries
- **Password Reset:** Secure token-based reset with 15-minute expiry

### JWT Security
- **Secret Key:** Environment variables (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- **Access Token:** Short-lived (default 15m)
- **Refresh Token:** Long-lived (default 7d)
- **Token Payload:** 
  - `userId` - User ID
  - `roleIds` - Array of role IDs assigned to user
  - `userType` - "user"

### OTP Verification
- **6-Digit Code:** Random numeric OTP generation
- **Dual Channel:** Email and SMS delivery
- **Expiry Time:** Configurable (default 10 minutes)
- **Account Activation:** `isVerified` flag required before login access

---

**Last Updated:** April 2026  
**Version:** 1.0.0
