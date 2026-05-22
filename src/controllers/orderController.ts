import { Request, Response, NextFunction } from 'express';
import Order from '../models/Order';
import Invoice from '../models/Invoice';
import Cart from '../models/Cart';
import Product from '../models/Product';
import Packaging from '../models/Packaging';
import Coupon from '../models/Coupon';
import { IOrder, IInvoice, ICart, IProduct, IPackaging, ICoupon, IOrderItem } from '../types';
import mongoose from 'mongoose';
import { generateInvoiceNumber } from '../services/internal/paymentService';

/**
 * Create a new order from a user's active cart
 */
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');

    const {
      customerId,
      vendorId,
      branchId,
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      packagingSelections = [],
      couponCode = null,
      cartId = null,
      metadata = {}
    } = req.body;

    const actingUserId = req.user?._id;
    const ownerCustomerId = customerId || actingUserId;

    if (!vendorId || !branchId) {
      return res.status(400).json({ success: false, message: 'vendorId and branchId are required' });
    }

    const cart = await Cart.findOne({ userId: ownerCustomerId });

    if (!cart) {
      return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    const group = cart.cartGroups.find(
      (g) => g.vendorId.toString() === vendorId && g.branchId.toString() === branchId
    );

    if (!group || !group.items || group.items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in cart for this vendor/branch' });
    }

    const packagingMap = new Map();
    for (const sel of (packagingSelections || [])) {
      if (sel?.sku && sel?.choiceId) packagingMap.set(String(sel.sku), sel.choiceId);
    }

    const productIds = Array.from(new Set(group.items.map(ci => String(ci.productId))));
    const productDocs = await Product.find({ _id: { $in: productIds } }, 'name');
    const productIdToName = new Map(productDocs.map(p => [String(p._id), p.name]));

    const items: IOrderItem[] = group.items.map((ci) => ({
      sku: ci.skuId,
      product: ci.productId,
      title: productIdToName.get(String(ci.productId)) || 'Unknown product',
      quantity: ci.quantity,
      unitPrice: ci.priceAtAddition,
      variants: ci.variants,
      modifiers: ci.modifiers,
      packagingChoice: packagingMap.has(String(ci.skuId)) ? { id: packagingMap.get(String(ci.skuId)), name: '', fee: 0 } : undefined
    }));

    let selectedPackaging: any = null;
    if (packagingOptionId) {
      const opt = await Packaging.findOne({ _id: packagingOptionId, isActive: true });
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price };
    }
    if (!selectedPackaging) {
      const def = await Packaging.findOne({ isActive: true, isDefault: true });
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price };
    }

    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0;
    const schedulingFee = timing?.isScheduled ? 0 : 0; 
    const deliveryFee = (type === 'delivery') ? 0 : 0; 
    
    let couponSnapshot = null;
    let discounts = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() });
      if (coupon) {
        const validation = coupon.validateCoupon(String(ownerCustomerId), subtotal);
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal);
          discounts = Math.max(0, Number(discountAmount) || 0);
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          };
        }
      }
    }
    const tax = 0;
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax;

    const order = await Order.create({
      customer: ownerCustomerId,
      vendor: vendorId,
      branch: branchId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      address: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED',
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID',
      metadata: {
        ...metadata,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    });

    const invoice = await Invoice.create({
      order: order._id,
      branch: order.branch,
      vendor: order.vendor,
      invoiceNumber: await generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    });

    order.invoice = invoice._id as any;
    await order.save();

    cart.cartGroups = cart.cartGroups.filter(
      (g) => !(g.vendorId.toString() === vendorId && g.branchId.toString() === branchId)
    );

    // Recalculate total cart value after removing the ordered group
    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);
    cart.totalItems = cart.cartGroups.reduce((sum, g) => sum + g.items.reduce((iSum, item) => iSum + item.quantity, 0), 0);

    await cart.save();

    io?.emit('order.created', { orderId: order._id.toString() });
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};

/**
 * Admin: Create order for a specific customer with manual item selection
 */
export const adminCreateOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');

    const {
      customerId,
      vendorId,
      branchId,
      items: inputItems,
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      couponCode = null,
      metadata = {}
    } = req.body;

    if (!customerId || !vendorId || !branchId) {
      return res.status(400).json({ success: false, message: 'customerId, vendorId, and branchId are required' });
    }

    if (!inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const actingUserId = req.user?._id;

    const productIds = Array.from(new Set(inputItems.map((it: any) => String(it.productId))));
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [String(p._id), p]));

    const items: IOrderItem[] = [];
    for (const inputItem of inputItems) {
      const product = productMap.get(String(inputItem.productId));
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${inputItem.productId} not found` });
      }

      const sku = (product.skus as any).id(inputItem.skuId);
      if (!sku) {
        return res.status(404).json({ success: false, message: `SKU ${inputItem.skuId} not found in product ${product.name}` });
      }

      if (sku.stock < inputItem.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${sku.stock}` });
      }

      items.push({
        sku: sku._id,
        product: product._id,
        title: product.name,
        quantity: inputItem.quantity,
        unitPrice: sku.price,
        variants: inputItem.variants,
        modifiers: inputItem.modifiers,
        packagingChoice: undefined
      });
    }

    let selectedPackaging: any = null;
    if (packagingOptionId) {
      const opt = await Packaging.findOne({ _id: packagingOptionId, isActive: true });
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price };
    }
    if (!selectedPackaging) {
      const def = await Packaging.findOne({ isActive: true, isDefault: true });
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price };
    }

    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0;
    const schedulingFee = timing?.isScheduled ? 0 : 0; 
    const deliveryFee = (type === 'delivery') ? 0 : 0; 

    let couponSnapshot = null;
    let discounts = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() });
      if (coupon) {
        const validation = coupon.validateCoupon(String(customerId), subtotal);
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal);
          discounts = Math.max(0, Number(discountAmount) || 0);
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          };
        }
      }
    }

    const tax = 0;
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax;

    const order = await Order.create({
      customer: customerId,
      vendor: vendorId,
      branch: branchId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      address: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED',
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID',
      metadata: {
        ...metadata,
        adminCreated: true,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    });

    const invoice = await Invoice.create({
      order: order._id,
      branch: order.branch,
      vendor: order.vendor,
      invoiceNumber: await generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    });

    order.invoice = invoice._id as any;
    await order.save();

    io?.emit('order.created', { orderId: order._id.toString() });
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get a single order by ID
 */
export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate('invoice')
      .populate('receipt')
      .populate('address')
      .populate({ path: 'customer', select: 'firstName lastName email phone' })
      .populate({ path: 'createdBy', select: 'firstName lastName email phone' })
      .populate({ path: 'items.product', select: 'name images price' })
      .populate('vendor')
      .populate('branch');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true, data: { order } });
  } catch (err) {
    return next(err);
  }
};

/**
 * Update order fulfillment status
 */
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    io?.to(`order_${order._id}`).emit('order.updated', { orderId: order._id.toString(), status: order.status });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

/**
 * Assign a rider to an order (Placeholder)
 */
export const assignRider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, message: 'Rider assigned successfully (placeholder)' });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get authenticated user's orders
 */
export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query as any;

    const filters: any = { customer: req.user?._id };
    if (status) filters.status = status;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (type) filters.type = type;
    if (location) filters.location = location;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filters },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: { 'invoice.invoiceNumber': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 as any } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', invoiceNumber: '$invoice.invoiceNumber' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.meta?.[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get all orders (Admin)
 */
export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query as any;

    const filters: any = {};
    if (status) filters.status = status;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (type) filters.type = type;
    if (location) filters.location = location;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filters },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: { 'invoice.invoiceNumber': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 as any } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', invoiceNumber: '$invoice.invoiceNumber' },
                customer: { _id: '$customer._id', firstName: '$customer.firstName', lastName: '$customer.lastName', email: '$customer.email' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.meta?.[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Delete an order
 */
export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};
