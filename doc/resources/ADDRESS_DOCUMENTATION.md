# 📍 DOHEZ-API - Address Management Documentation

## 📋 Table of Contents
- [Address Management Overview](#address-management-overview)
- [Address Model](#-address-model)
- [Address Controller](#-address-controller)
- [Address Routes](#-address-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Address Management Overview

Address Management allows users to store and manage their delivery locations. Users can define multiple addresses, including custom names and detailed notes (e.g., "Near gate B"), and designate one as their default delivery address. The system uses geographic coordinates to ensure accurate location tracking for orders.

---

## 👤 Address Model

### Schema Definition
```typescript
interface IAddress extends Document {
  userId: Types.ObjectId;
  name: string;
  coordinates: { lat: number; lng: number };
  regions: {
    country: string;
    locality?: string;
    sublocality?: string;
    sublocality_level_1?: string;
    administrative_area_level_1?: string;
    plus_code?: string;
    political?: string;
  };
  address: string;
  details?: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Address.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IAddress } from '../types';

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    regions: {
      country: { type: String, required: true },
      locality: { type: String },
      sublocality: { type: String },
      sublocality_level_1: { type: String },
      administrative_area_level_1: { type: String },
      plus_code: { type: String },
      political: { type: String },
    },
    address: { type: String, required: true, trim: true },
    details: { type: String, default: null },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default address per user
addressSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await (this.constructor as any).updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

const Address = mongoose.model<IAddress>('Address', addressSchema);

export default Address;
```

### Validation Rules
```typescript
userId:      { required: true, ref: 'User' }
name:        { required: true, trim: true }
coordinates: { lat: { required: true }, lng: { required: true } }
regions:     { country: { required: true } }
address:     { required: true, trim: true }
```

---

## 🎮 Address Controller

**File:** `src/controllers/addressController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Address from '../models/Address';
import User from '../models/User';
import { errorHandler } from '../middleware/errorHandler';
```

### Functions Overview

#### `createAddress()`
**Purpose:** Create a new user address.  
**Access:** Authenticated User.  
**Process:** Validates fields, creates address, and saves to user account.  
**Response:** Created address object.

**Controller Implementation:**
```typescript
export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body;

        if (!name) return next(errorHandler(400, "Address name is required"));
        if (!coordinates || coordinates.lat === undefined || coordinates.lng === undefined) {
            return next(errorHandler(400, "Coordinates lat and lng are required"));
        }
        if (!regions || !regions.country) {
            return next(errorHandler(400, "Region country is required"));
        }
        if (!formatted) return next(errorHandler(400, "Full formatted address is required"));

        const user = await User.findById(req.user?._id);
        if (!user) return next(errorHandler(404, "User not found"));

        const newAddress = new Address({
            userId: req.user?._id,
            name: name.trim(),
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            regions: {
                country: regions.country?.trim(),
                locality: regions.locality?.trim(),
                sublocality: regions.sublocality?.trim(),
                sublocality_level_1: regions.sublocality_level_1?.trim(),
                administrative_area_level_1: regions.administrative_area_level_1?.trim(),
                plus_code: regions.plus_code?.trim(),
                political: regions.political?.trim()
            },
            address: formatted.trim(),
            details: details ?? null,
            isDefault: isDefault || false
        });

        await newAddress.save();

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            data: { address: newAddress }
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map((err: any) => err.message).join(', ');
            return next(errorHandler(400, message));
        }
        next(errorHandler(500, "Server error while creating address"));
    }
};
```

#### `getUserAddresses()`
**Purpose:** List addresses for the current user with search and pagination.  
**Access:** Authenticated User.  
**Process:** Fetches addresses based on search query (name or address), sorted by default flag and creation date, with pagination support.  
**Response:** Array of addresses and pagination metadata.

**Controller Implementation:**
```typescript
export const getUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const query: any = { userId: req.user?._id };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { address: { $regex: search, $options: "i" } }
            ];
        }

        const options = { 
            page: parseInt(page as string) || 1, 
            limit: parseInt(limit as string) || 10 
        };

        const addresses = await Address.find(query)
            .sort({ isDefault: -1, createdAt: -1 })
            .limit(options.limit)
            .skip((options.page - 1) * options.limit);

        const total = await Address.countDocuments(query);
        const totalPages = Math.ceil(total / options.limit);

        res.status(200).json({ 
            success: true, 
            data: { 
                addresses,
                pagination: {
                    currentPage: options.page,
                    totalPages,
                    totalAddresses: total,
                    hasNextPage: options.page < totalPages,
                    hasPrevPage: options.page > 1
                }
            } 
        });
    } catch (error) {
        next(errorHandler(500, "Server error while retrieving addresses"));
    }
};
```

#### `updateAddress()`
**Purpose:** Update specific address details.  
**Access:** Authenticated User.  
**Process:** Updates fields and preserves existing data if not provided.  
**Response:** Updated address object.

**Controller Implementation:**
```typescript
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const { name, coordinates, regions, address: formatted, details, isDefault } = req.body;

        const address = await Address.findOne({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        if (name !== undefined) address.name = name?.trim() || address.name;

        if (coordinates && coordinates.lat !== undefined && coordinates.lng !== undefined) {
            address.coordinates = {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            };
        }

        if (regions) {
            address.regions = {
                country: regions.country?.trim() ?? address.regions.country,
                locality: regions.locality?.trim() ?? address.regions.locality,
                sublocality: regions.sublocality?.trim() ?? address.regions.sublocality,
                sublocality_level_1: regions.sublocality_level_1?.trim() ?? address.regions.sublocality_level_1,
                administrative_area_level_1: regions.administrative_area_level_1?.trim() ?? address.regions.administrative_area_level_1,
                plus_code: regions.plus_code?.trim() ?? address.regions.plus_code,
                political: regions.political?.trim() ?? address.regions.political
            };
        }

        if (formatted !== undefined) address.address = formatted?.trim() || address.address;
        if (details !== undefined) address.details = details ?? address.details;
        if (isDefault !== undefined) address.isDefault = isDefault;

        await address.save();

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: { address }
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map((err: any) => err.message).join(', ');
            return next(errorHandler(400, message));
        }
        next(errorHandler(500, "Server error while updating address"));
    }
};
```

#### `deleteAddress()`
**Purpose:** Remove an address.  
**Access:** Authenticated User.  
**Response:** Success message.

**Controller Implementation:**
```typescript
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const address = await Address.findOneAndDelete({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        next(errorHandler(500, "Server error while deleting address"));
    }
};
```

#### `setDefaultAddress()`
**Purpose:** Set an existing address as default.  
**Access:** Authenticated User.  
**Process:** Triggers pre-save hook to unset previous default.  
**Response:** Updated address object.

**Controller Implementation:**
```typescript
export const setDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const address = await Address.findOne({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        address.isDefault = true;
        await address.save();

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            data: { address }
        });
    } catch (error) {
        next(errorHandler(500, "Server error while setting default address"));
    }
};
```


## 🛣️ Address Routes

### Base Path: `/api/addresses`

### Route Implementation

**File: `src/routes/addressRoutes.ts`**

```typescript
import express from 'express';
import {
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getUserAddresses,
    getAddressById
} from '../controllers/addressController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, createAddress);

router.get('/', authenticateToken, getUserAddresses);

router.get('/:addressId', authenticateToken, getAddressById);

router.put('/:addressId', authenticateToken, updateAddress);

router.delete('/:addressId', authenticateToken, deleteAddress);

router.patch('/:addressId/default', authenticateToken, setDefaultAddress);


export default router;
```

### Route Details

#### `POST /api/addresses`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Home",
  "coordinates": {
    "lat": -1.29,
    "lng": 36.82
  },
  "regions": {
    "country": "Kenya",
    "locality": "Nairobi"
  },
  "address": "123 Main St, Nairobi, Kenya",
  "isDefault": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Home",
      "coordinates": {
        "lat": -1.29,
        "lng": 36.82
      },
      "regions": {
        "country": "Kenya",
        "locality": "Nairobi"
      },
      "address": "123 Main St, Nairobi, Kenya",
      "details": null,
      "isDefault": true,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/addresses`
**Headers:** `Authorization: Bearer <token>`
**Query:** `page=1`, `limit=10`, `search=Home`
**Response:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k1",
        "userId": "65e26b1c09b068c201383801",
        "name": "Home",
        "coordinates": {
          "lat": -1.29,
          "lng": 36.82
        },
        "regions": {
          "country": "Kenya",
          "locality": "Nairobi"
        },
        "address": "123 Main St, Nairobi, Kenya",
        "details": null,
        "isDefault": true,
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAddresses": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/addresses/:addressId`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Home",
      "coordinates": {
        "lat": -1.29,
        "lng": 36.82
      },
      "regions": {
        "country": "Kenya",
        "locality": "Nairobi"
      },
      "address": "123 Main St, Nairobi, Kenya",
      "details": null,
      "isDefault": true,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/addresses/:addressId`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Office",
  "address": "456 Corporate Ave, Nairobi"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Office",
      "coordinates": {
        "lat": -1.29,
        "lng": 36.82
      },
      "regions": {
        "country": "Kenya",
        "locality": "Nairobi"
      },
      "address": "456 Corporate Ave, Nairobi",
      "details": null,
      "isDefault": true,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `DELETE /api/addresses/:addressId`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

#### `PATCH /api/addresses/:addressId/default`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "message": "Default address updated successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Office",
      "coordinates": {
        "lat": -1.29,
        "lng": 36.82
      },
      "regions": {
        "country": "Kenya",
        "locality": "Nairobi"
      },
      "address": "456 Corporate Ave, Nairobi",
      "details": null,
      "isDefault": true,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T12:00:00.000Z",
      "__v": 0
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user  
**Usage:**
```typescript
router.post('/', authenticateToken, createAddress);
```

---

## 📝 API Examples

### Create Address
```bash
curl -X POST http://localhost:3500/api/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Home",
    "coordinates": {"lat": -1.29, "lng": 36.82},
    "regions": {"country": "Kenya", "locality": "Nairobi"},
    "address": "123 Main St, Nairobi, Kenya",
    "isDefault": true
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Home",
      "coordinates": {"lat": -1.29, "lng": 36.82},
      "address": "123 Main St, Nairobi, Kenya",
      "isDefault": true
    }
  }
}
```

### Get User Addresses
```bash
curl -X GET "http://localhost:3500/api/addresses?page=1&limit=10&search=Home" \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k1",
        "name": "Home",
        "isDefault": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAddresses": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Address by ID
```bash
curl -X GET http://localhost:3500/api/addresses/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Home",
      "address": "123 Main St, Nairobi, Kenya"
    }
  }
}
```

### Update Address
```bash
curl -X PUT http://localhost:3500/api/addresses/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Office",
    "address": "456 Corporate Ave, Nairobi"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "userId": "65e26b1c09b068c201383801",
      "name": "Office",
      "address": "456 Corporate Ave, Nairobi"
    }
  }
}
```

### Delete Address
```bash
curl -X DELETE http://localhost:3500/api/addresses/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

### Set Default Address
```bash
curl -X PATCH http://localhost:3500/api/addresses/6638b2c3d4e5f6g7h8i9j0k1/default \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Default address updated successfully",
  "data": {
    "address": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Office",
      "isDefault": true
    }
  }
}
```

---

## 🛡️ Security Features

- **Authentication:** All address endpoints require a valid JWT token.
- **Access Control:** Users can only access, update, or delete their own addresses.
- **Integrity:** The system ensures only one default address exists per user account.

---

## 🚨 Error Handling

- `400 Bad Request`: Missing required fields (coordinates, country, address).
- `404 Not Found`: Address not found for current user.
- `500 Internal Server Error`: Unexpected server-side error.

---

## 📊 Database Indexes

```typescript
addressSchema.index({ userId: 1, isDefault: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
