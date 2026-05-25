# 🎟️ DOHEZ-API - Ticket Management Documentation

## 📋 Table of Contents
- [Ticket Management Overview](#ticket-management-overview)
- [Ticket Model](#-ticket-model)
- [Ticket Controller](#-ticket-controller)
- [Ticket Routes](#-ticket-routes)
- [API Examples](#-api-examples)
- [Database Indexes](#-database-indexes)
- [Middleware](#-middleware)
- [Error Handling](#-error-handling)

---

## Ticket Management Overview

The Ticket Management resource allows for event-based ticketing. It tracks ticket issuance, participant contact details, event association, and status lifecycles (Pending, Booked, Cancelled, Used, Expired).

---

## 🎫 Ticket Model

### Schema Definition
```typescript
interface ITicket extends Document {
  ticketNumber: string;
  event: Types.ObjectId | IProduct;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  details: {
    name: string;
    email: string;
    phone: string;
  };
  type: string;
  qrCodeData?: string;
  pdfUrl?: string;
  status: 'PENDING' | 'BOOKED' | 'CANCELLED' | 'USED' | 'EXPIRED';
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Ticket.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { ITicket } from '../types';

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    details: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    type: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
    },
    pdfUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['PENDING', 'BOOKED', 'CANCELLED', 'USED', 'EXPIRED'],
      default: 'PENDING',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;
```

### Validation Rules
```typescript
ticketNumber: { required: true, unique: true }
event:        { required: true, ref: 'Product' }
vendor:       { required: true, ref: 'Vendor' }
branch:       { required: true, ref: 'Branch' }
details:      { name: { required: true }, email: { required: true }, phone: { required: true } }
type:         { required: true }
qrCodeData:   { optional }
pdfUrl:       { optional }
status:       { enum: ['PENDING', 'BOOKED', 'CANCELLED', 'USED', 'EXPIRED'], default: 'PENDING' }
```

---

## 🎮 Ticket Controller

**File:** `src/controllers/ticketController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import Ticket from "../models/Ticket";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `getTickets()`
**Purpose:** List tickets with pagination, search by `ticketNumber`, and filters.  
**Access:** Authenticated (Admin/Vendor)  
**Validation:** None  
**Process:** Apply query filters (vendor, branch, event, type, status), populate references, paginate, and return result.

**Controller Implementation:**
```typescript
export const getTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, vendor, branch, event, type, status } = req.query;
    const query: any = {};

    if (search) query.ticketNumber = { $regex: search, $options: "i" };
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (event) query.event = event;
    if (type) query.type = type;
    if (status) query.status = status;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const tickets = await Ticket.find(query)
      .populate("event vendor branch")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Ticket.countDocuments(query);
    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalTickets: total
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getTicket()`
**Purpose:** Fetch ticket by ID.  
**Access:** Authenticated (Admin/Vendor)  
**Validation:** Ticket must exist  
**Process:** Find by ID and populate related data.

**Controller Implementation:**
```typescript
export const getTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("event vendor branch");

    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    res.status(200).json({ success: true, data: { ticket } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateTicket()`
**Purpose:** Update ticket details or status.  
**Access:** Authenticated (Admin/Vendor)  
**Validation:** Ticket must exist  
**Process:** Update fields via Mongoose and save.

**Controller Implementation:**
```typescript
export const updateTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, details } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    if (ticket.status === 'USED') {
      return next(errorHandler(400, "Cannot update a ticket that has already been used"));
    }

    if (status) ticket.status = status;
    if (details) {
      ticket.details = {
        name: details.name || ticket.details.name,
        email: details.email || ticket.details.email,
        phone: details.phone || ticket.details.phone,
      };
    }

    await ticket.save();

    res.status(200).json({ success: true, data: { ticket } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteTicket()`
**Purpose:** Remove a ticket.  
**Access:** Authenticated (Admin)  
**Validation:** Ticket must exist  
**Process:** Delete record.

**Controller Implementation:**
```typescript
export const deleteTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    res.status(200).json({ success: true, message: "Ticket deleted successfully" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Ticket Routes

### Base Path: `/api/tickets`

```typescript
GET    /                          // List all tickets
GET    /:id                       // Get ticket details
PUT    /:id                       // Update ticket
DELETE /:id                       // Delete ticket
```

### Router Implementation

**File: `src/routes/ticketRoutes.ts`**

```typescript
import express from 'express';
import {
    getTickets,
    getTicket,
    updateTicket,
    deleteTicket
} from '../controllers/ticketController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getTickets);
router.get('/:id', authenticateToken, getTicket);
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), updateTicket);
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteTicket);

export default router;
```

### Route Details

#### `GET /api/tickets`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `search`, `vendor`, `branch`, `event`, `type`, `status`  
**Response:** List of tickets with pagination.
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "650af1234567890abcdef123",
        "ticketNumber": "TCK-123456",
        "event": {
          "_id": "650af1234567890abcdef001",
          "name": "Summer Concert"
        },
        "vendor": "650af1234567890abcdef002",
        "branch": "650af1234567890abcdef003",
        "details": {
          "name": "Jane Doe",
          "email": "jane.doe@example.com",
          "phone": "+254712345678"
        },
        "type": "VIP",
        "status": "PENDING",
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTickets": 1
    }
  }
}
```

#### `GET /api/tickets/:id`
**Headers:** `Authorization: Bearer <token>`  
**Response:** Detailed ticket object.
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "650af1234567890abcdef123",
      "ticketNumber": "TCK-123456",
      "event": {
        "_id": "650af1234567890abcdef001",
        "name": "Summer Concert"
      },
      "vendor": {
        "_id": "650af1234567890abcdef002",
        "name": "Vendor Co"
      },
      "branch": {
        "_id": "650af1234567890abcdef003",
        "name": "Main Branch"
      },
      "details": {
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "phone": "+254712345678"
      },
      "type": "VIP",
      "status": "PENDING",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/tickets/:id`
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "status": "USED"
}
```
**Response:** Updated ticket object.
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "650af1234567890abcdef123",
      "ticketNumber": "TCK-123456",
      "event": "650af1234567890abcdef001",
      "vendor": "650af1234567890abcdef002",
      "branch": "650af1234567890abcdef003",
      "details": {
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "phone": "+254712345678"
      },
      "type": "VIP",
      "status": "USED",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `DELETE /api/tickets/:id`
**Headers:** `Authorization: Bearer <token>`  
**Response:** Success message.
```json
{
  "success": true,
  "message": "Ticket deleted successfully"
}
```

---

## 📝 API Examples

### List Tickets
```bash
curl -X GET "http://localhost:3500/api/tickets?status=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "_id": "650af1234567890abcdef123",
        "ticketNumber": "TCK-123456",
        "status": "PENDING"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTickets": 1
    }
  }
}
```

### Get Ticket by ID
```bash
curl -X GET http://localhost:3500/api/tickets/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "650af1234567890abcdef123",
      "ticketNumber": "TCK-123456",
      "status": "PENDING"
    }
  }
}
```

### Update Ticket
```bash
curl -X PUT http://localhost:3500/api/tickets/650af1234567890abcdef123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "status": "USED"
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "650af1234567890abcdef123",
      "ticketNumber": "TCK-123456",
      "status": "USED"
    }
  }
}
```

### Delete Ticket
```bash
curl -X DELETE http://localhost:3500/api/tickets/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Ticket deleted successfully"
}
```

---

## 📊 Database Indexes
```typescript
ticketSchema.index({ ticketNumber: 1 }, { unique: true });
ticketSchema.index({ event: 1 });
ticketSchema.index({ vendor: 1 });
ticketSchema.index({ branch: 1 });
```

---

## 🔐 Middleware

### Authentication Middleware
**Purpose:** Verify JWT token and load user with roles.  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getTickets);
```

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Ticket not found" }
```
```json
{ "success": false, "message": "Server error while updating ticket" }
```

---

**Last Updated:** May 2026
**Version:** 1.0.0
