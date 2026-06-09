import { Request, Response, NextFunction } from 'express';
import Invoice from '../models/Invoice';
import Order from '../models/Order';
import { generateInvoiceNumber } from '../services/internal/paymentService';
import { errorHandler } from '../middleware/errorHandler';

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const { orderId } = req.body || {};

    if (!orderId) return next(errorHandler(400, 'orderId is required'));

    const order = await Order.findById(orderId);
    if (!order) return next(errorHandler(404, 'Order not found'));

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ order: orderId });
    if (existingInvoice) {
      return res.status(409).json({ success: false, message: 'Invoice already exists for this order', data: { invoiceId: existingInvoice._id } });
    }

    const { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total } = (order as any).pricing || {};

    const lineItems = [
      { label: 'Items subtotal', amount: subtotal || 0 },
      ...(packagingFee ? [{ label: 'Packaging', amount: packagingFee }] : []),
      ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
      ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
      ...(tax ? [{ label: 'Tax', amount: tax }] : [])
    ];

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      order: order._id,
      branch: order.branch,
      vendor: order.vendor,
      invoiceNumber,
      lineItems,
      subtotal: subtotal || 0,
      discounts: discounts || 0,
      fees: (packagingFee || 0) + (schedulingFee || 0) + (deliveryFee || 0),
      tax: tax || 0,
      total: total || 0,
      balanceDue: total || 0,
      paymentStatus: 'PENDING'
    });

    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};

export const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, paymentStatus, vendor, branch } = req.query;
    const query: any = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;

    const options = {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10
    };

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit)
      .populate('order appointment ticket laundry branch vendor');
      
    const total = await Invoice.countDocuments(query);

    return res.status(200).json({ 
        success: true, 
        data: { 
            invoices,
            pagination: {
                currentPage: options.page,
                totalPages: Math.ceil(total / options.limit),
                total
            }
        } 
    });
  } catch (err) {
    return next(err);
  }
};

export const getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('order appointment ticket laundry branch vendor');
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));
    return res.status(200).json({ success: true, data: { invoice } });
  } catch (err) {
    return next(err);
  }
};
