import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Cart from "../models/Cart";
import Product from "../models/Product";

/**
 * @description Get user's cart
 * @access Authenticated
 */
export const getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cart = await Cart.findOne({ userId: req.user?._id })
      .populate("cartGroups.vendorId")
      .populate("cartGroups.branchId")
      .populate("cartGroups.items.productId");

    if (!cart) {
      return res.status(200).json({ success: true, data: { cart: null } });
    }

    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Add item to cart
 * @access Authenticated
 */
export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, branchId, productId, skuId, quantity, priceAtAddition, variants } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    let cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user?._id, cartGroups: [], totalCartValue: 0 });
    }

    let group = cart.cartGroups.find(g => g.branchId.toString() === branchId);

    if (group) {
      const itemIndex = group.items.findIndex(i => i.skuId.toString() === skuId);
      if (itemIndex > -1) {
        group.items[itemIndex].quantity += quantity;
      } else {
        group.items.push({ productId, skuId, quantity, priceAtAddition, variants });
      }
    } else {
      cart.cartGroups.push({
        vendorId,
        branchId,
        items: [{ productId, skuId, quantity, priceAtAddition, variants }],
        groupSubtotal: 0
      });
      group = cart.cartGroups[cart.cartGroups.length - 1];
    }

    // Recalculate Subtotals
    group.groupSubtotal = group.items.reduce((sum, item) => sum + (item.priceAtAddition * item.quantity), 0);
    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);

    await cart.save();

    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Update item quantity
 * @access Authenticated
 */
export const updateQuantity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branchId, skuId, quantity } = req.body;
    
    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    const group = cart.cartGroups.find(g => g.branchId.toString() === branchId);
    if (!group) return next(errorHandler(404, "Branch group not found in cart"));

    const item = group.items.find(i => i.skuId.toString() === skuId);
    if (!item) return next(errorHandler(404, "Item not found in cart"));

    if (quantity <= 0) {
      group.items = group.items.filter(i => i.skuId.toString() !== skuId);
      if (group.items.length === 0) {
        cart.cartGroups = cart.cartGroups.filter(g => g.branchId.toString() !== branchId);
      }
    } else {
      item.quantity = quantity;
    }

    // Recalculate
    group.groupSubtotal = group.items.reduce((sum, i) => sum + (i.priceAtAddition * i.quantity), 0);
    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);

    await cart.save();

    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Remove item from cart
 * @access Authenticated
 */
export const removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branchId, skuId } = req.body;

    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    const group = cart.cartGroups.find(g => g.branchId.toString() === branchId);
    if (!group) return next(errorHandler(404, "Branch group not found"));

    group.items = group.items.filter(i => i.skuId.toString() !== skuId);
    if (group.items.length === 0) {
      cart.cartGroups = cart.cartGroups.filter(g => g.branchId.toString() !== branchId);
    }

    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);
    await cart.save();

    res.status(200).json({ success: true, message: "Item removed" });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Clear full cart
 * @access Authenticated
 */
export const clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    cart.cartGroups = [];
    cart.totalCartValue = 0;
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error: any) {
    next(error);
  }
};
