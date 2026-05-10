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
