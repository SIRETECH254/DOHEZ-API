# 🔐 Dohez API - Authentication and Authorization Middleware Documentation

## 📋 Table of Contents
- [Auth Middleware Overview](#auth-middleware-overview)
- [Implementation Details](#implementation-details)
  - [authenticateToken](#authenticatetoken)
  - [authorizeRoles](#authorizeroles)
- [Usage in Routes](#usage-in-routes)
  - [Auth Routes](#auth-routes)
  - [User Routes](#user-routes)
  - [Admin Routes](#admin-routes)
- [Error Handling](#error-handling)

---

## Auth Middleware Overview

The middleware layer (`src/middleware/auth.ts`) is the primary security gate for the Dohez API. It handles JWT verification and Role-Based Access Control (RBAC) checks to ensure only authorized users can access specific resources.

---

## Implementation Details

### `authenticateToken`

Verifies the JWT and populates the user document on the request object.

**File: `src/middleware/auth.ts` - `authenticateToken` snippet**
```typescript
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { IUser } from "../types";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ success: false, message: "Access token required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "User unauthorized or inactive" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
```

### `authorizeRoles`

Enforces role-based access control by checking if the user's roles include any of the allowed roles.

**File: `src/middleware/auth.ts` - `authorizeRoles` snippet**
```typescript
import { UserRole } from "../types";

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role as UserRole));

    if (!hasRole) {
      return res.status(403).json({ success: false, message: "Insufficient permissions for this action" });
    }

    next();
  };
};
```

---

## Usage in Routes

### Auth Routes (`src/routes/authRoutes.ts`)
Used for session management.
```typescript
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout);
```

### User Routes (`src/routes/userRoutes.ts`)
Ensures only authenticated users can access their profiles.
```typescript
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);
```

### Admin Routes
Restricted to specific administrative roles.
```typescript
router.get("/all", authenticateToken, authorizeRoles('admin', 'super_admin'), getAllUsers);
router.put("/:userId/status", authenticateToken, authorizeRoles('admin', 'super_admin'), updateUserStatus);
```

---

## Error Handling

Middleware uses standard HTTP status codes:
- `401 Unauthorized`: Missing/invalid token.
- `403 Forbidden`: Insufficient roles or inactive account.

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Status:** Updated for Dohez API RBAC System
