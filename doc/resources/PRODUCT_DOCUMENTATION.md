# 📦 DOHEZ-API - Product Management Documentation

## 📋 Table of Contents
- [Product Management Overview](#product-management-overview)
- [Product Model](#-product-model)
- [Product Controller](#-product-controller)
- [Product Routes](#-product-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Product Management Overview

Product Management covers all products available in the system. Products can have multiple variants and automatically generated SKUs for inventory tracking. Access control ensures only authorized vendors or admins can modify product data.

---

## 📦 Product Model

### Schema Definition
```typescript
export interface IProduct extends Document {
  name: string;
  slug: string;
  details?: string;
  price: number;
  offerPrice?: number;
  images: Array<{ url: string; publicId: string }>;
  category: Types.ObjectId | IProductCategory;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  service: Types.ObjectId | IService;
  variants: Types.ObjectId[] | IVariant[];
  selectedVariantOptions: ISelectedVariantOption[];
  modifiers: Types.ObjectId[] | IProductModifier[];
  selectedModifierOptions: ISelectedModifierOption[];
  skus: Types.DocumentArray<ISKU & Types.Subdocument>;
  status: boolean;
  trackInventory: boolean;
  duration?: string;
  buffertime?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Product.ts`**

```typescript
import mongoose, { Schema, Types } from "mongoose";
import { IProduct, ISKU, ISKUAttribute } from "../types";

const skuSchema = new Schema<ISKU>(
  {
    attributes: [
      {
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "Variant",
          required: true,
        },
        optionId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    comparePrice: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    skuCode: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    barcode: {
      type: String,
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    allowPreOrder: {
      type: Boolean,
      default: false,
    },
    preOrderStock: {
      type: Number,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    details: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    offerPrice: {
      type: Number,
      min: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    category: {
      type: Schema.Types.ObjectId,
      ref: "ProductCategory",
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    variants: [
      {
        type: Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],
    selectedVariantOptions: [
      {
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "Variant",
          required: true,
        },
        optionIds: [
          {
            type: Schema.Types.ObjectId,
            required: true,
          },
        ],
      },
    ],
    modifiers: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProductModifier",
      },
    ],
    selectedModifierOptions: [
      {
        modifierId: {
          type: Schema.Types.ObjectId,
          ref: "ProductModifier",
          required: true,
        },
        optionIds: [
          {
            type: Schema.Types.ObjectId,
            required: true,
          },
        ],
      },
    ],
    skus: [skuSchema],
    status: {
      type: Boolean,
      default: true,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    duration: {
      type: String,
      default: null,
    },
    buffertime: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ branch: 1 });
productSchema.index({ createdAt: -1 });

// Instance methods

/**
 * Generates or updates SKUs based on selected variant options.
 * If no options are selected, it creates a single default SKU.
 * Preserves existing SKU data (price, stock, etc.) where attribute combinations match.
 */
productSchema.methods.generateSKUs = async function (this: IProduct): Promise<IProduct> {
  if (!this.selectedVariantOptions || this.selectedVariantOptions.length === 0) {
    this.variants = [];
    this.skus = [
      {
        attributes: [],
        price: this.price,
        stock: 0,
        skuCode: this.generateSKUCode([]),
        isActive: true,
        allowPreOrder: false,
        preOrderStock: 0,
        lowStockThreshold: 5,
      },
    ] as any;
    return this.save();
  }

  const Variant = mongoose.model("Variant");
  const variantIds = this.selectedVariantOptions.map((sel) => sel.variantId);
  const variants = await Variant.find({ _id: { $in: variantIds } });

  const selectedOptionsMap = new Map<string, Set<string>>();
  this.selectedVariantOptions.forEach((sel) => {
    selectedOptionsMap.set(
      sel.variantId.toString(),
      new Set(sel.optionIds.map((id) => id.toString()))
    );
  });

  const variantsWithSelectedOptions = variants
    .map((variant) => {
      const selectedOptionIds = selectedOptionsMap.get(variant._id.toString());
      if (!selectedOptionIds || selectedOptionIds.size === 0) {
        return null;
      }
      const filteredOptions = variant.options.filter((option: any) =>
        selectedOptionIds.has(option._id.toString())
      );
      return {
        ...variant.toObject(),
        options: filteredOptions,
      };
    })
    .filter((v) => v !== null && v.options.length > 0);

  if (variantsWithSelectedOptions.length === 0) {
    this.skus = [
      {
        attributes: [],
        price: this.price,
        stock: 0,
        skuCode: this.generateSKUCode([]),
        isActive: true,
        allowPreOrder: false,
        preOrderStock: 0,
        lowStockThreshold: 5,
      },
    ] as any;
    return this.save();
  }

  const combinations = this.generateCombinations(variantsWithSelectedOptions);

  const buildAttributesKey = (attributes: ISKUAttribute[]) => {
    const normalized = (attributes || [])
      .map((attr) => ({
        variantId: attr.variantId.toString(),
        optionId: attr.optionId.toString(),
      }))
      .sort((a, b) => {
        if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
        return a.optionId.localeCompare(b.optionId);
      });
    return normalized.map((n) => `${n.variantId}:${n.optionId}`).join("|");
  };

  const existingSkusMap = new Map<string, ISKU>();
  this.skus.forEach((sku: any) => {
    const key = buildAttributesKey(sku.attributes);
    existingSkusMap.set(key, sku);
  });

  this.skus = combinations.map((combination: any) => {
    const key = buildAttributesKey(combination);
    const existingSku = existingSkusMap.get(key);

    return {
      attributes: combination,
      price: existingSku?.price ?? this.price,
      stock: existingSku?.stock ?? 0,
      skuCode: existingSku?.skuCode ?? this.generateSKUCode(combination),
      barcode: existingSku?.barcode ?? null,
      lowStockThreshold: existingSku?.lowStockThreshold ?? 5,
      allowPreOrder: existingSku?.allowPreOrder ?? false,
      preOrderStock: existingSku?.preOrderStock ?? 0,
      isActive: existingSku?.isActive ?? true,
    };
  }) as any;

  return this.save();
};

/**
 * Recursively generates all possible combinations of variant options.
 * @param variants Array of variants with their selected options.
 * @returns A 2D array representing all attribute combinations.
 */
productSchema.methods.generateCombinations = function (variants: any[]): any[][] {
  if (variants.length === 0) return [[]];

  const [firstVariant, ...restVariants] = variants;
  const restCombinations = this.generateCombinations(restVariants);

  const combinations: any[][] = [];

  firstVariant.options.forEach((option: any) => {
    const attribute = {
      variantId: firstVariant._id,
      optionId: option._id,
    };

    restCombinations.forEach((restCombination: any[]) => {
      combinations.push([attribute, ...restCombination]);
    });
  });

  return combinations;
};

/**
 * Generates a unique SKU code based on the product slug and attribute combination.
 * @param attributes Array of attributes (variantId + optionId) for the SKU.
 * @returns A formatted SKU string.
 */
productSchema.methods.generateSKUCode = function (this: IProduct, attributes: ISKUAttribute[]): string {
  if (attributes.length === 0) {
    return `${this.slug.toUpperCase()}-DEFAULT`;
  }

  const optionValues = attributes
    .map((attr) => {
      return attr.optionId.toString().slice(-4).toUpperCase();
    })
    .join("-");

  return `${this.slug.toUpperCase()}-${optionValues}`;
};

/**
 * Updates specific fields of an existing SKU by its ID.
 * @param skuId The MongoDB ID of the SKU subdocument.
 * @param updateData Partial SKU data to apply.
 */
productSchema.methods.updateSKU = function (
  this: IProduct,
  skuId: string | Types.ObjectId,
  updateData: Partial<ISKU>
): Promise<IProduct> {
  const sku = this.skus.id(skuId);
  if (sku) {
    Object.assign(sku, updateData);
    return this.save();
  }
  throw new Error("SKU not found");
};

/**
 * Deletes a SKU subdocument by its ID.
 * @param skuId The MongoDB ID of the SKU to remove.
 */
productSchema.methods.deleteSKU = function (this: IProduct, skuId: string | Types.ObjectId): Promise<IProduct> {
  const idStr = skuId.toString();
  this.skus = this.skus.filter((sku: any) => sku._id.toString() !== idStr) as any;
  return this.save();
};

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;
```

### Validation Rules
```typescript
name:           { required: true, trim: true }
slug:           { required: true, unique: true, lowercase: true }
price:          { required: true, min: 0 }
category:       { required: true, ref: 'ProductCategory' }
vendor:         { required: true, ref: 'Vendor' }
branch:         { required: true, ref: 'Branch' }
service:        { required: true, ref: 'Service' }
status:         { default: true }
trackInventory: { default: true }
duration:       { optional, type: String }
buffertime:     { optional, type: String }
```

**Note:** For `createProduct`, `createService`, and `createEvent`, the system validates the existence of referenced `category`, `vendor`, `branch`, and `service` IDs sequentially. Additionally, `createProduct` performs independent validation for `variants` and their nested `selectedVariantOptions`.

---

## 🎮 Product Controller

**File:** `src/controllers/productController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Product from "../models/Product";
import slugify from "slugify";
```

### Functions Overview

#### `createProduct()`
**Purpose:** Create a new product and generate initial SKUs  
**Access:** Admin/Super Admin  
**Validation:** Required relational IDs must be provided  
**Process:** Slugify name, upload images to Cloudinary, create product, and generate SKUs if variants selected.  
**Response:** Created product details

**Controller Implementation:**
```typescript
export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      offerPrice, 
      category, 
      vendor, 
      branch, 
      service, 
      variants, 
      selectedVariantOptions, 
      status, 
      trackInventory 
    } = req.body;

    if (!name || typeof name !== 'string') {
      return next(errorHandler(400, "Product name is required"));
    }

    if (!category || !vendor || !branch || !service) {
      return next(errorHandler(400, "Category, vendor, branch, and service are required"));
    }

    // Check existence individually
    const categoryExists = await Category.findById(category);
    if (!categoryExists) return next(errorHandler(400, "Category not found"));

    const vendorExists = await Vendor.findById(vendor);
    if (!vendorExists) return next(errorHandler(400, "Vendor not found"));

    const branchExists = await Branch.findById(branch);
    if (!branchExists) return next(errorHandler(400, "Branch not found"));

    const serviceExists = await Service.findById(service);
    if (!serviceExists) return next(errorHandler(400, "Service not found"));

    // Parse JSON strings
    const parsedVariants = variants ? (typeof variants === 'string' ? JSON.parse(variants) : variants) : [];
    const parsedSelectedVariantOptions = selectedVariantOptions ? (typeof selectedVariantOptions === 'string' ? JSON.parse(selectedVariantOptions) : selectedVariantOptions) : [];

    // Validate Variants independently
    if (parsedVariants && Array.isArray(parsedVariants)) {
      for (const variantId of parsedVariants) {
        const variantExists = await Variant.findById(variantId);
        if (!variantExists) {
          return next(errorHandler(400, `Variant ${variantId} not found`));
        }
      }
    }
    
    // Validate Selected Variant Options independently
    if (parsedSelectedVariantOptions && Array.isArray(parsedSelectedVariantOptions)) {
      for (const sel of parsedSelectedVariantOptions) {
        if (!sel.variantId || !Array.isArray(sel.optionIds)) {
          return next(errorHandler(400, "Invalid format for selected variant options"));
        }

        const variant = await Variant.findById(sel.variantId);
        if (!variant) return next(errorHandler(400, `Variant ${sel.variantId} not found`));
        
        const validOptionIds = variant.options.map((opt: any) => opt._id.toString());
        for (const optId of sel.optionIds) {
          if (!validOptionIds.includes(optId.toString())) {
            return next(errorHandler(400, `Option ${optId} not valid for variant ${sel.variantId}`));
          }
        }
      }
    }

    const files = req.files as Express.Multer.File[];
    let images: Array<{ url: string; publicId: string }> = [];
    // ... upload logic
```

#### `createService()`
**Purpose:** Create a new appointment service.
**Access:** Admin/Super Admin
**Validation:** `name`, `price`, `vendor`, `branch`, and `service` fields are required; existence of referenced `category`, `vendor`, `branch`, and `service` records is verified.
**Process:** Slugify name, upload images, create service product instance, and generate SKUs.
**Response:** Created service product details.

**Controller Implementation:**
```typescript
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      category, 
      vendor, 
      branch, 
      service, 
      duration, 
      buffertime 
    } = req.body;

    if (!name || !price || !vendor || !branch) {
      return next(errorHandler(400, "Missing required fields for service"));
    }

    const files = req.files as Express.Multer.File[];
    let images: Array<{ url: string; publicId: string }> = [];

    if (files && files.length > 0) {
      images = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToCloudinary(file, "dohez/products");
          return { url: result.url, publicId: result.public_id };
        })
      );
    }

    const slug = slugify(name, { lower: true, strict: true });

    const product = new Product({
      name,
      slug,
      details,
      price,
      images,
      category,
      vendor,
      branch,
      service,
      duration,
      buffertime,
      trackInventory: false
    });

    await product.generateSKUs();

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `createEvent()`
**Purpose:** Create a new event for ticketing.
**Access:** Admin/Super Admin
**Validation:** `name`, `price`, `vendor`, `branch`, `startDate`, `endDate`, `venue` fields are required; existence of referenced `category`, `vendor`, and `branch` records is verified.
**Process:** Slugify name, upload images, create event product instance (with `trackInventory: true`), parse variants/options, and generate SKUs.
**Response:** Created event product details.

**Controller Implementation:**
```typescript
export const createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      category, 
      vendor, 
      branch, 
      startDate, 
      endDate, 
      venue, 
      maxTicket,
      variants,
      selectedVariantOptions,
      location,
      openAt
    } = req.body;

    if (!name || !price || !vendor || !branch || !startDate || !endDate || !venue) {
      return next(errorHandler(400, "Missing required fields for event"));
    }

    const files = req.files as Express.Multer.File[];
    let images: Array<{ url: string; publicId: string }> = [];

    if (files && files.length > 0) {
      images = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToCloudinary(file, "dohez/products");
          return { url: result.url, publicId: result.public_id };
        })
      );
    }

    const slug = slugify(name, { lower: true, strict: true });
    
    const parsedVariants = variants ? (typeof variants === 'string' ? JSON.parse(variants) : variants) : [];
    const parsedSelectedVariantOptions = selectedVariantOptions ? (typeof selectedVariantOptions === 'string' ? JSON.parse(selectedVariantOptions) : selectedVariantOptions) : [];
    const parsedLocation = location ? (typeof location === 'string' ? JSON.parse(location) : location) : undefined;

    const product = new Product({
      name,
      slug,
      details,
      price,
      images,
      category,
      vendor,
      branch,
      startDate,
      endDate,
      venue,
      maxTicket,
      variants: parsedVariants,
      selectedVariantOptions: parsedSelectedVariantOptions,
      location: parsedLocation,
      openAt,
      trackInventory: true
    });

    await product.generateSKUs();

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getProducts()`
**Purpose:** List products with search, pagination, and advanced filtering  
**Access:** Public/Admin  
**Validation:** None  
**Process:** Apply filters (category, vendor, branch, service), apply search, and paginate.  
**Response:** Product list with pagination metadata

**Controller Implementation:**
```typescript
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      category,
      vendor,
      branch,
      service,
      status 
    } = req.query;

    const query: any = {};

    // Search by name or details
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } }
      ];
    }

    // Filters
    if (category) query.category = category;
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (service) query.service = service;
    if (status !== undefined) query.status = status === 'true';

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const products = await Product.find(query)
      .populate("category")
      .populate("vendor")
      .populate("branch")
      .populate("service")
      .populate("variants")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalProducts: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getProductById()`
**Purpose:** Get full details of a single product  
**Access:** Public/Admin  
**Validation:** Product must exist  
**Process:** Find product and populate all relations  
**Response:** Product object

**Controller Implementation:**
```typescript
export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("vendor")
      .populate("branch")
      .populate("service")
      .populate("variants");

    if (!product) return next(errorHandler(404, "Product not found"));

    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateProduct()`
**Purpose:** Update product fields and optionally regenerate SKUs  
**Access:** Admin/Super Admin  
**Process:** Update fields, handle image updates (Cloudinary), and SKU regeneration.  
**Response:** Updated product

**Controller Implementation:**
```typescript
export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      offerPrice, 
      category, 
      vendor, 
      branch, 
      service, 
      variants, 
      selectedVariantOptions, 
      status, 
      trackInventory 
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return next(errorHandler(404, "Product not found"));

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      // Delete old images from Cloudinary
      if (product.images && product.images.length > 0) {
        await Promise.all(product.images.map((img) => deleteFromCloudinary(img.publicId)));
      }

      // Upload new images
      const newImages = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToCloudinary(file, "dohez/products");
          return { url: result.url, publicId: result.public_id };
        })
      );
      product.images = newImages;
    }

    // Update basic fields
    if (name) {
      product.name = name;
      product.slug = slugify(name, { lower: true, strict: true });
    }
    
    if (details !== undefined) product.details = details;
    if (price !== undefined) product.price = price;
    if (offerPrice !== undefined) product.offerPrice = offerPrice;
    if (category) product.category = category;
    if (vendor) product.vendor = vendor;
    if (branch) product.branch = branch;
    if (service) product.service = service;
    
    if (variants !== undefined) {
      product.variants = typeof variants === 'string' ? JSON.parse(variants) : variants;
    }
    
    if (status !== undefined) product.status = status;
    if (trackInventory !== undefined) product.trackInventory = trackInventory;

    // Handle variant option updates and SKU regeneration
    if (selectedVariantOptions !== undefined) {
      product.selectedVariantOptions = typeof selectedVariantOptions === 'string' 
        ? JSON.parse(selectedVariantOptions) 
        : selectedVariantOptions;
      await product.generateSKUs(); // This handles saving
    } else {
      await product.save();
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteProduct()`
**Purpose:** Permanently remove a product  
**Access:** Admin/Super Admin  
**Process:** Delete images from Cloudinary, then remove product from database.  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) return next(errorHandler(404, "Product not found"));

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map((img) => deleteFromCloudinary(img.publicId)));
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateProductSKU()`
**Purpose:** Update specific product SKU  
**Access:** Admin/Super Admin  
**Process:** Update SKU subdocument fields.  
**Response:** Updated product

**Controller Implementation:**
```typescript
export const updateProductSKU = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, skuId } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) return next(errorHandler(404, "Product not found"));

    await product.updateSKU(skuId as string, updateData);

    res.status(200).json({
      success: true,
      message: "SKU updated successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Product Routes

### Base Path: `/api/products`

```typescript
POST   /                         // Create new product
GET    /                         // Get all products
GET    /:id                      // Get single product
PUT    /:id                      // Update product
DELETE /:id                      // Delete product
PUT    /:id/skus/:skuId          // Update product SKU
```

### Router Implementation
**File:** `src/routes/productRoutes.ts`

```typescript
import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductSKU
} from '../controllers/productController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import upload from '../middleware/upload';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), updateProduct);
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProduct);
router.put('/:id/skus/:skuId', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProductSKU);

export default router;
```

### Route Details

#### `POST /api/products`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
**Body:** (name, details, price, images, category, vendor, branch, service, variants, selectedVariantOptions, status, trackInventory)
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "slug": "luxury-pizza",
      "details": "Delicious wood-fired pizza",
      "price": 1500,
      "offerPrice": 1200,
      "images": [
        {
          "url": "https://cloudinary.com/dohez/products/pizza.jpg",
          "publicId": "dohez/products/pizza123",
          "_id": "650af9995555555555555555"
        }
      ],
      "category": "650af1238888888888888888",
      "vendor": "650af4569999999999999999",
      "branch": "650af7890000000000000000",
      "service": "650af0001111111111111111",
      "variants": ["650af1112222222222222222"],
      "selectedVariantOptions": [
        {
          "variantId": "650af1112222222222222222",
          "optionIds": ["650af2223333333333333333"],
          "_id": "650af3334444444444444444"
        }
      ],
      "skus": [],
      "status": true,
      "trackInventory": true,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/products`
**Query:** `page=1`, `limit=10`, `search=...`, `category=...`, `vendor=...`, `branch=...`, `service=...`
**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "650af9994444444444444444",
        "name": "Luxury Pizza",
        "slug": "luxury-pizza",
        "price": 1500,
        "createdAt": "2026-05-20T10:00:00.000Z",
        "updatedAt": "2026-05-20T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalProducts": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/products/:id`
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "slug": "luxury-pizza",
      "details": "Delicious wood-fired pizza",
      "price": 1500,
      "offerPrice": 1200,
      "category": "650af1238888888888888888",
      "vendor": "650af4569999999999999999",
      "branch": "650af7890000000000000000",
      "service": "650af0001111111111111111",
      "status": true,
      "trackInventory": true,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/products/:id`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
**Response:**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza V2",
      "slug": "luxury-pizza-v2",
      "price": 1600,
      "updatedAt": "2026-05-20T11:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `DELETE /api/products/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

#### `PUT /api/products/:id/skus/:skuId`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:** `{"price": 1400, "stock": 50}`
**Response:**
```json
{
  "success": true,
  "message": "SKU updated successfully",
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza V2",
      "updatedAt": "2026-05-20T12:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `POST /api/products/services`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Haircut",
  "details": "Professional haircut service",
  "price": 500,
  "category": "650af1238888888888888888",
  "vendor": "650af4569999999999999999",
  "branch": "650af7890000000000000000",
  "service": "650af0001111111111111111",
  "duration": "30min",
  "buffertime": "10min"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444445",
      "name": "Haircut",
      "price": 500,
      "trackInventory": false,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `POST /api/products/events`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Summer Concert",
  "details": "Live music concert",
  "price": 2000,
  "category": "650af1238888888888888888",
  "vendor": "650af4569999999999999999",
  "branch": "650af7890000000000000000",
  "startDate": "2026-06-01T10:00:00Z",
  "endDate": "2026-06-01T22:00:00Z",
  "venue": "City Park",
  "maxTicket": 500,
  "location": {
    "address": "City Park Avenue",
    "coordinates": { "lat": -1.29, "lng": 36.82 }
  },
  "openAt": "09:00"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444446",
      "name": "Summer Concert",
      "venue": "City Park",
      "trackInventory": true,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
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
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createProduct);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProduct);
```

---

## 📝 API Examples

### 1. Create Product
```bash
curl -X POST http://localhost:3500/api/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Luxury Pizza" \
  -F "price=1500" \
  -F "category=650af1238888888888888888" \
  -F "vendor=650af4569999999999999999" \
  -F "branch=650af7890000000000000000" \
  -F "service=650af0001111111111111111" \
  -F "images=@/path/to/image.jpg"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "slug": "luxury-pizza",
      "images": [{"url": "...", "publicId": "..."}],
      "createdAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

### 2. Get All Products
```bash
curl -X GET "http://localhost:3500/api/products?page=1&limit=10"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "650af9994444444444444444",
        "name": "Luxury Pizza",
        "price": 1500
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalProducts": 1 }
  }
}
```

### 3. Get Product By ID
```bash
curl -X GET http://localhost:3500/api/products/650af9994444444444444444
```
**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "price": 1500
    }
  }
}
```

### 4. Update Product
```bash
curl -X PUT http://localhost:3500/api/products/650af9994444444444444444 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Luxury Pizza V2" \
  -F "price=1600"
```
**Response:**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "product": {
      "id": "650af9994444444444444444",
      "name": "Luxury Pizza V2",
      "price": 1600
    }
  }
}
```

### 5. Delete Product
```bash
curl -X DELETE http://localhost:3500/api/products/650af9994444444444444444 \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### 6. Update Product SKU
```bash
curl -X PUT http://localhost:3500/api/products/650af9994444444444444444/skus/650af8881111111111111111 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"price": 1400, "stock": 50}'
```
**Response:**
```json
{
  "success": true,
  "message": "SKU updated successfully",
  "data": {
    "product": { "id": "650af9994444444444444444", "name": "Luxury Pizza" }
  }
}
```
---

## 🛡️ Security Features

- **RBAC:** Mutation endpoints restricted to `admin` and `super_admin`.
- **Relational Integrity:** Population ensures all related data is fetched safely.
- **Relational Validation:** relational IDs are required on creation.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Product not found" }
```

---

## 📊 Database Indexes

```typescript
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ branch: 1 });
productSchema.index({ createdAt: -1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
