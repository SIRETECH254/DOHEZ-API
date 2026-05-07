# 🌍 DOHEZ-API - Location Search Documentation

## 📋 Table of Contents
- [Location Search Overview](#location-search-overview)
- [Location Controller](#-location-controller)
- [Location Routes](#-location-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)

---

## Location Search Overview

Location Search integration allows users to find places and addresses using the Google Maps Text Search API. This feature acts as a proxy to Google Places, providing detailed location data including names, addresses, and geographic coordinates.

---

## 🎮 Location Controller

**File:** `src/controllers/locationController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { Client } from "@googlemaps/google-maps-services-js";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `searchLocation()`
**Purpose:** Search for locations and places using a text query  
**Access:** Public  
**Validation:** `query` parameter is required and must be a string  
**Process:** 
1. Extracts `query` from request query parameters.
2. Calls Google Maps `textSearch` API using the `GOOGLE_PLACES_API_KEY` from environment variables.
**Response:** Array of location results from Google Places.

**Controller Implementation:**
```typescript
export const searchLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return next(errorHandler(400, "Query parameter is required and must be a string"));
    }

    const response = await client.textSearch({
      params: {
        query: query,
        key: process.env.GOOGLE_PLACES_API_KEY || '',
      },
      timeout: 1000,
    });

    res.status(200).json({
        success: true,
        data: response.data.results
    });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    next(errorHandler(500, "Failed to fetch location data"));
  }
};
```

---

## 🛣️ Location Routes

### Base Path: `/api/locations`

```typescript
GET    /search                  // Search for locations and places
```

### Router Implementation

**File: `src/routes/locationRoutes.ts`**

```typescript
import express from 'express';
import { searchLocation } from '../controllers/locationController';

const router = express.Router();

router.get('/search', searchLocation);

export default router;
```

### Route Details

#### `GET /api/locations/search`
**Query Parameters:** `query` (required)
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "business_status": "OPERATIONAL",
      "formatted_address": "Nairobi, Kenya",
      "geometry": {
        "location": {
          "lat": -1.2920659,
          "lng": 36.8219462
        },
        "viewport": {
          "northeast": {
            "lat": -1.155428,
            "lng": 37.065423
          },
          "southwest": {
            "lat": -1.450254,
            "lng": 36.650938
          }
        }
      },
      "icon": "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/geocode-71.png",
      "icon_background_color": "#7B9EB0",
      "icon_mask_base_uri": "https://maps.gstatic.com/mapfiles/place_api/icons/v2/generic_pin_let_71",
      "name": "Nairobi",
      "photos": [
        {
          "height": 4032,
          "html_attributions": [
            "<a href=\"https://maps.google.com/maps/contrib/114620023475143301016\">John Doe</a>"
          ],
          "photo_reference": "Aap_uEDR_...",
          "width": 3024
        }
      ],
      "place_id": "ChIJ77p_JpE_LxARtIuN-k9sR5I",
      "reference": "ChIJ77p_JpE_LxARtIuN-k9sR5I",
      "types": [
        "locality",
        "political"
      ]
    }
  ]
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### Public Access
**Purpose:** Allow unrestricted access for location picking during registration or address creation  
**Usage:**
```typescript
router.get('/search', searchLocation);
```

---

## 📝 API Examples

### Search Location
```bash
curl -X GET "http://localhost:3500/api/locations/search?query=Nairobi"
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "business_status": "OPERATIONAL",
      "formatted_address": "Nairobi, Kenya",
      "geometry": {
        "location": {
          "lat": -1.2920659,
          "lng": 36.8219462
        },
        "viewport": {
          "northeast": {
            "lat": -1.155428,
            "lng": 37.065423
          },
          "southwest": {
            "lat": -1.450254,
            "lng": 36.650938
          }
        }
      },
      "icon": "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/geocode-71.png",
      "icon_background_color": "#7B9EB0",
      "icon_mask_base_uri": "https://maps.gstatic.com/mapfiles/place_api/icons/v2/generic_pin_let_71",
      "name": "Nairobi",
      "photos": [
        {
          "height": 4032,
          "html_attributions": [
            "<a href=\"https://maps.google.com/maps/contrib/114620023475143301016\">John Doe</a>"
          ],
          "photo_reference": "Aap_uEDR_...",
          "width": 3024
        }
      ],
      "place_id": "ChIJ77p_JpE_LxARtIuN-k9sR5I",
      "reference": "ChIJ77p_JpE_LxARtIuN-k9sR5I",
      "types": [
        "locality",
        "political"
      ]
    }
  ]
}
```

---

## 🛡️ Security Features

- **Environment Protection:** API keys are never exposed to the client; they are stored securely on the server in environment variables.
- **Query Validation:** Input queries are validated to ensure they are present and are strings.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Query parameter is required and must be a string" }
{ "success": false, "message": "Failed to fetch location data" }
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
