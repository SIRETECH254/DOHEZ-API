# 📊 DOHEZ-API - Dashboard Documentation

## 📋 Table of Contents
- [Dashboard Overview](#dashboard-overview)
- [Dashboard Data Summary](#-dashboard-data-summary)
- [Dashboard Controller](#-dashboard-controller)
- [Dashboard Routes](#-dashboard-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Dashboard Overview

The Dashboard API provides role-specific operational summaries and status counts. These endpoints are designed for real-time overview and daily task management, excluding historical analytics or financial reports.

---

## 📊 Dashboard Data Summary

The dashboard does not have a dedicated database model but instead aggregates data from multiple sources to provide a real-time operational overview.

### Source Models
- **User:** For user counts, staff lists, and working hours.
- **Vendor & Branch:** For organizational counts and associations.
- **Order:** For fulfillment status counts and recent activity.
- **Appointment:** For scheduling summaries and personal queues.
- **Ticket:** For support status overview.
- **Break:** For staff operational status.

### Data Categorization
- **Global Stats:** System-wide counts for Super Admins.
- **Branch Stats:** Daily operational metrics for Branch Admins.
- **Personal Stats:** Task-specific data for Staff members.

---

## 🎮 Dashboard Controller

**File:** `src/controllers/dashboardController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Vendor from '../models/Vendor';
import Order from '../models/Order';
import Branch from '../models/Branch';
import Product from '../models/Product';
import Appointment from '../models/Appointment';
import Ticket from '../models/Ticket';
import Break from '../models/Break';
import Role from '../models/Role';
import { startOfDay, endOfDay } from 'date-fns';
```

### Functions Overview

#### `getSuperAdminDashboard()`
**Purpose:** Global system overview.  
**Access:** Super Admin only.  
**Validation:** None.  
**Process:** Aggregate global counts for vendors (total/active), users (by role), total orders, and fetch recent orders/vendors.  
**Response:** Global operational counts and recent activity lists.

**Controller Implementation:**
```typescript
export const getSuperAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalVendors,
      activeVendors,
      totalUsers,
      totalOrders,
      recentOrders,
      recentVendors,
      userRolesSummary
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ isActive: true }),
      User.countDocuments(),
      Order.countDocuments(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({ path: 'customer', select: 'firstName lastName email' })
        .populate({ path: 'vendor', select: 'name' }),
      Vendor.find().sort({ createdAt: -1 }).limit(5).select('name email phone isActive'),
      User.aggregate([
        { $unwind: '$roles' },
        {
          $lookup: {
            from: 'roles',
            localField: 'roles',
            foreignField: '_id',
            as: 'roleInfo'
          }
        },
        { $unwind: '$roleInfo' },
        {
          $group: {
            _id: '$roleInfo.name',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        vendorCounts: {
          total: totalVendors,
          active: activeVendors,
          inactive: totalVendors - activeVendors
        },
        userSummary: {
          total: totalUsers,
          byRole: userRolesSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        },
        orderOverview: {
          total: totalOrders
        },
        recentActivity: {
          latestOrders: recentOrders,
          newVendors: recentVendors
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
```

#### `getAdminDashboard()`
**Purpose:** General business oversight.  
**Access:** Admin, Super Admin.  
**Validation:** None.  
**Process:** Fetch active user counts, global order status breakdown, ticket status breakdown, and recent user logins.  
**Response:** Management overview and operational feed.

**Controller Implementation:**
```typescript
export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      activeCustomers,
      orderStatusSummary,
      recentLogins,
      ticketSummary
    ] = await Promise.all([
      User.countDocuments({ isActive: true }), // Simplified for this context
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.find({ lastLoginAt: { $ne: null } })
        .sort({ lastLoginAt: -1 })
        .limit(10)
        .select('firstName lastName email lastLoginAt'),
      Ticket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        managementOverview: {
          activeUsers: activeCustomers,
          orderOverview: orderStatusSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          ticketSummary: ticketSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        },
        operationalFeed: {
          recentUserLogins: recentLogins
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
```

#### `getVendorAdminDashboard()`
**Purpose:** Vendor-wide resource management.  
**Access:** Vendor Admin, Super Admin.  
**Validation:** Logged-in user must be linked to a vendor.  
**Process:** Count branches, staff, and products linked to the vendor; aggregate order statuses and upcoming appointments.  
**Response:** Vendor resource and operational summary.

**Controller Implementation:**
```typescript
export const getVendorAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user?.vendor;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'User is not associated with a vendor' });
    }

    const [
      branchCount,
      staffCount,
      productCount,
      orderStatusSummary,
      upcomingAppointmentsCount
    ] = await Promise.all([
      Branch.countDocuments({ vendorId }),
      User.countDocuments({ vendor: vendorId }),
      Product.countDocuments({ vendorId }),
      Order.aggregate([
        { $match: { vendor: vendorId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Appointment.countDocuments({
        vendor: vendorId,
        overallStartTime: { $gte: new Date() }
      })
    ]);

    return res.json({
      success: true,
      data: {
        resourceSummary: {
          branchCount,
          staffCount,
          inventorySummary: {
            totalProducts: productCount
          }
        },
        operationalSummary: {
          globalOrderStates: orderStatusSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          upcomingAppointments: upcomingAppointmentsCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
```

#### `getBranchAdminDashboard()`
**Purpose:** Real-time branch operations.  
**Access:** Branch Admin, Super Admin.  
**Validation:** Logged-in user must be linked to a branch.  
**Process:** Count today's orders, active staff, and staff on break; fetch current pending orders and today's appointments.  
**Response:** Branch status, fulfillment queue, and break status.

**Controller Implementation:**
```typescript
export const getBranchAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.user?.branch;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'User is not associated with a branch' });
    }

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const [
      ordersToday,
      activeStaffCount,
      pendingOrders,
      todaysAppointments,
      staffOnBreakCount
    ] = await Promise.all([
      Order.countDocuments({
        branch: branchId,
        createdAt: { $gte: start, $lte: end }
      }),
      User.countDocuments({ branch: branchId, isActive: true }),
      Order.find({
        branch: branchId,
        status: { $in: ['PLACED', 'CONFIRMED'] }
      })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate({ path: 'customer', select: 'firstName lastName' }),
      Appointment.find({
        branch: branchId,
        overallStartTime: { $gte: start, $lte: end }
      })
        .sort({ overallStartTime: 1 })
        .populate({ path: 'customer', select: 'firstName lastName' })
        .populate({ path: 'staff', select: 'firstName lastName' }),
      Break.countDocuments({
        branch: branchId,
        endTime: null // Assuming endTime null means they are currently on break
      })
    ]);

    return res.json({
      success: true,
      data: {
        branchStats: {
          ordersToday,
          activeStaff: activeStaffCount
        },
        fulfillmentQueue: {
          currentOrders: pendingOrders,
          todaysAppointments: todaysAppointments
        },
        breakStatus: {
          staffOnBreak: staffOnBreakCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
```

#### `getStaffDashboard()`
**Purpose:** Personal task queue.  
**Access:** Staff, Super Admin.  
**Validation:** None.  
**Process:** Fetch upcoming personal appointments, count assigned order tasks, and check current duty/break status.  
**Response:** Personal queue, schedule, and duty status.

**Controller Implementation:**
```typescript
export const getStaffDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const [
      myAppointments,
      assignedTasksCount,
      activeBreak
    ] = await Promise.all([
      Appointment.find({
        staff: userId,
        overallStartTime: { $gte: start }
      })
        .sort({ overallStartTime: 1 })
        .populate({ path: 'customer', select: 'firstName lastName' }),
      Order.countDocuments({
        'items.staff': userId, // This depends on how tasks are assigned to staff in orders
        status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED'] }
      }),
      Break.findOne({
        userId,
        endTime: null
      })
    ]);

    return res.json({
      success: true,
      data: {
        myQueue: {
          myAppointments,
          assignedTasks: assignedTasksCount
        },
        schedule: {
          workingHours: req.user?.workingHours || {},
          currentStatus: activeBreak ? 'On Break' : 'On Duty'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
```

---

## 🛣️ Dashboard Routes

### Base Path: `/api/dashboard`

```typescript
GET /super-admin    // Get Super Admin Dashboard
GET /admin         // Get Admin Dashboard
GET /vendor        // Get Vendor Admin Dashboard
GET /branch        // Get Branch Admin Dashboard
GET /staff         // Get Staff Dashboard
```

### Router Implementation

**File: `src/routes/dashboardRoutes.ts`**

```typescript
import express from 'express';
import {
  getSuperAdminDashboard,
  getAdminDashboard,
  getVendorAdminDashboard,
  getBranchAdminDashboard,
  getStaffDashboard
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.get('/super-admin', authenticateToken, authorizeRoles(['super_admin']), getSuperAdminDashboard);
router.get('/admin', authenticateToken, authorizeRoles(['admin', 'super_admin']), getAdminDashboard);
router.get('/vendor', authenticateToken, authorizeRoles(['vendor_admin', 'super_admin']), getVendorAdminDashboard);
router.get('/branch', authenticateToken, authorizeRoles(['branch_admin', 'super_admin']), getBranchAdminDashboard);
router.get('/staff', authenticateToken, authorizeRoles(['staff', 'super_admin']), getStaffDashboard);

export default router;
```

### Route Details

#### `GET /api/dashboard/super-admin`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "vendorCounts": {
      "total": 50,
      "active": 45,
      "inactive": 5
    },
    "userSummary": {
      "total": 1200,
      "byRole": {
        "customer": 1000,
        "staff": 150,
        "vendor_admin": 25,
        "branch_admin": 20,
        "admin": 5
      }
    },
    "orderOverview": {
      "total": 5000
    },
    "recentActivity": {
      "latestOrders": [
        {
          "_id": "650af1234567890abcdef123",
          "customer": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@example.com"
          },
          "vendor": {
            "name": "Acme Laundry"
          },
          "status": "PLACED",
          "createdAt": "2026-06-16T10:00:00Z"
        }
      ],
      "newVendors": [
        {
          "_id": "650af1234567890abcdef124",
          "name": "Global Services",
          "email": "contact@global.com",
          "phone": "+1234567890",
          "isActive": true
        }
      ]
    }
  }
}
```

#### `GET /api/dashboard/admin`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "managementOverview": {
      "activeUsers": 1000,
      "orderOverview": {
        "PLACED": 50,
        "CONFIRMED": 30,
        "SHIPPED": 20,
        "DELIVERED": 4000
      },
      "ticketSummary": {
        "PENDING": 10,
        "BOOKED": 100,
        "CANCELLED": 5,
        "USED": 85
      }
    },
    "operationalFeed": {
      "recentUserLogins": [
        {
          "firstName": "Alice",
          "lastName": "Smith",
          "email": "alice@example.com",
          "lastLoginAt": "2026-06-16T11:30:00Z"
        }
      ]
    }
  }
}
```

#### `GET /api/dashboard/vendor`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "resourceSummary": {
      "branchCount": 5,
      "staffCount": 20,
      "inventorySummary": {
        "totalProducts": 100
      }
    },
    "operationalSummary": {
      "globalOrderStates": {
        "PLACED": 10,
        "CONFIRMED": 8,
        "SHIPPED": 5,
        "DELIVERED": 150
      },
      "upcomingAppointments": 15
    }
  }
}
```

#### `GET /api/dashboard/branch`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "branchStats": {
      "ordersToday": 25,
      "activeStaff": 10
    },
    "fulfillmentQueue": {
      "currentOrders": [
        {
          "_id": "650af1234567890abcdef125",
          "customer": {
            "firstName": "Bob",
            "lastName": "Jones"
          },
          "status": "PLACED",
          "createdAt": "2026-06-16T09:15:00Z"
        }
      ],
      "todaysAppointments": [
        {
          "_id": "650af1234567890abcdef126",
          "customer": {
            "firstName": "Charlie",
            "lastName": "Brown"
          },
          "staff": {
            "firstName": "Dave",
            "lastName": "Wilson"
          },
          "overallStartTime": "2026-06-16T14:00:00Z",
          "status": "CONFIRMED"
        }
      ]
    },
    "breakStatus": {
      "staffOnBreak": 2
    }
  }
}
```

#### `GET /api/dashboard/staff`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "myQueue": {
      "myAppointments": [
        {
          "_id": "650af1234567890abcdef127",
          "customer": {
            "firstName": "Eve",
            "lastName": "Adams"
          },
          "overallStartTime": "2026-06-16T15:30:00Z",
          "status": "CONFIRMED"
        }
      ],
      "assignedTasks": 5
    },
    "schedule": {
      "workingHours": {
        "monday": {
          "start": "08:00",
          "end": "17:00"
        },
        "tuesday": {
          "start": "08:00",
          "end": "17:00"
        },
        "wednesday": {
          "start": "08:00",
          "end": "17:00"
        },
        "thursday": {
          "start": "08:00",
          "end": "17:00"
        },
        "friday": {
          "start": "08:00",
          "end": "17:00"
        }
      },
      "currentStatus": "On Duty"
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
router.get('/super-admin', authenticateToken, authorizeRoles(['super_admin']), getSuperAdminDashboard);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.get('/admin', authenticateToken, authorizeRoles(['admin', 'super_admin']), getAdminDashboard);
```

---

## 📝 API Examples

### Get Super Admin Dashboard
```bash
curl -X GET http://localhost:3500/api/dashboard/super-admin \
  -H "Authorization: Bearer <super_admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "vendorCounts": {
      "total": 50,
      "active": 45,
      "inactive": 5
    },
    "userSummary": {
      "total": 1200,
      "byRole": {
        "customer": 1000,
        "staff": 150,
        "admin": 50
      }
    },
    "orderOverview": {
      "total": 5000
    },
    "recentActivity": {
      "latestOrders": [
        {
          "_id": "650af1234567890abcdef123",
          "status": "PLACED",
          "total": 2500,
          "createdAt": "2026-06-16T10:00:00Z"
        }
      ],
      "newVendors": [
        {
          "_id": "650af1234567890abcdef124",
          "name": "Acme Laundry",
          "isActive": true
        }
      ]
    }
  }
}
```

### Get Admin Dashboard
```bash
curl -X GET http://localhost:3500/api/dashboard/admin \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "managementOverview": {
      "activeUsers": 1000,
      "orderOverview": {
        "PLACED": 50,
        "CONFIRMED": 30
      },
      "ticketSummary": {
        "PENDING": 10,
        "BOOKED": 100
      }
    },
    "operationalFeed": {
      "recentUserLogins": [
        {
          "firstName": "John",
          "lastName": "Doe",
          "lastLoginAt": "2026-06-16T11:00:00Z"
        }
      ]
    }
  }
}
```

### Get Vendor Admin Dashboard
```bash
curl -X GET http://localhost:3500/api/dashboard/vendor \
  -H "Authorization: Bearer <vendor_admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "resourceSummary": {
      "branchCount": 5,
      "staffCount": 20,
      "inventorySummary": {
        "totalProducts": 100
      }
    },
    "operationalSummary": {
      "globalOrderStates": {
        "PLACED": 10,
        "SHIPPED": 5
      },
      "upcomingAppointments": 15
    }
  }
}
```

### Get Branch Admin Dashboard
```bash
curl -X GET http://localhost:3500/api/dashboard/branch \
  -H "Authorization: Bearer <branch_admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "branchStats": {
      "ordersToday": 25,
      "activeStaff": 10
    },
    "fulfillmentQueue": {
      "currentOrders": [
        {
          "_id": "650af1234567890abcdef128",
          "status": "PLACED",
          "customerName": "Jane Smith"
        }
      ],
      "todaysAppointments": [
        {
          "_id": "650af1234567890abcdef129",
          "time": "14:00",
          "customer": "Robert Roe"
        }
      ]
    },
    "breakStatus": {
      "staffOnBreak": 2
    }
  }
}
```

### Get Staff Dashboard
```bash
curl -X GET http://localhost:3500/api/dashboard/staff \
  -H "Authorization: Bearer <staff_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "myQueue": {
      "myAppointments": [
        {
          "_id": "650af1234567890abcdef130",
          "time": "15:00",
          "customer": "Alice Wonderland"
        }
      ],
      "assignedTasks": 3
    },
    "schedule": {
      "workingHours": {
        "monday": {
          "start": "09:00",
          "end": "18:00"
        }
      },
      "currentStatus": "On Duty"
    }
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `authenticateToken` and `authorizeRoles`.
- **Role Scoping:** Controllers strictly enforce role associations (e.g., Vendor Admin only sees their own vendor data).
- **Sensitive Data Protection:** Only operational counts and public summaries are returned; sensitive user or financial data is excluded.

---

## 🚨 Error Handling

Common responses:
```json
{
  "success": false,
  "message": "Error message details"
}
```

---

## 📊 Database Indexes

The dashboard utilizes indexes from the following models for performance:
- **Order:** `vendor: 1`, `branch: 1`, `status: 1`, `createdAt: -1`
- **User:** `vendor: 1`, `branch: 1`, `isActive: 1`
- **Appointment:** `vendor: 1`, `branch: 1`, `overallStartTime: 1`

---

**Last Updated:** June 2026  
**Version:** 1.0.0
