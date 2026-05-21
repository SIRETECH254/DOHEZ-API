import Payment from '../../models/paymentModel';
import Invoice from '../../models/Invoice';
import Order from '../../models/Order';
import Receipt from '../../models/receiptModel';
import Coupon from '../../models/Coupon';
import Product from '../../models/Product';
import Appointment from '../../models/Appointment';
import Ticket from '../../models/Ticket';
import { initiateStkPush } from '../external/darajaService';
import QRCode from 'qrcode';
import type { IPayment } from '../../types';

export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};

export const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}-${randomSuffix}`;
};

export const generateReceiptNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Receipt.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `RCP-${year}-${String(count + 1).padStart(4, "0")}`;
};

export const generateTicketNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Ticket.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `TKT-${year}-${String(count + 1).padStart(4, "0")}`;
};

const updateInventoryForOrder = async (order: any): Promise<void> => {
  if (!order.items || order.items.length === 0) {
    console.log('No items in order to update inventory');
    return;
  }

  console.log(`Updating inventory for order ${order._id} with ${order.items.length} items`);

  for (const item of order.items) {
    try {
      const product = await Product.findOne({ 
        'skus._id': item.sku 
      });

      if (!product) {
        console.error(`Product not found for SKU ${item.sku}`);
        continue;
      }

      const sku = (product.skus as any).id(item.sku);
      if (!sku) {
        console.error(`SKU ${item.sku} not found in product ${product._id}`);
        continue;
      }

      if (sku.stock < item.quantity) {
        console.warn(`Insufficient stock for SKU ${item.sku}. Available: ${sku.stock}, Requested: ${item.quantity}`);
      }

      sku.stock = Math.max(0, sku.stock - item.quantity);

      console.log(`Updated SKU ${item.sku} stock: ${sku.stock} (reduced by ${item.quantity})`);

      await product.save();
    } catch (error) {
      console.error(`Failed to update inventory for SKU ${item.sku}:`, error);
    }
  }

  console.log(`Completed inventory update for order ${order._id}`);
};

const updateInventoryForTicket = async (ticket: any): Promise<void> => {
  try {
    const event = await Product.findById(ticket.event);
    if (event && event.trackInventory) {
      // Find the SKU using the skuId stored on the ticket
      const sku = (event.skus as any).id(ticket.skuId);

      if (sku) {
        sku.stock = Math.max(0, sku.stock - 1);
        await event.save();
        console.log(`Updated Ticket Event SKU stock for ticket ${ticket._id}: ${sku.stock}`);
      } else {
        console.warn(`SKU not found for ticket ${ticket._id} and SKU ID ${ticket.skuId}`);
      }
    }
  } catch (error) {
    console.error(`Failed to update inventory for ticket ${ticket._id}:`, error);
  }
};

export const createPaymentRecord = async (params: {
  invoice?: any;
  branch: any;
  vendor: any;
  amount: number;
  method: "mpesa" | "paystack" | "cash" | "post_to_bill" | "cod";
}): Promise<IPayment> => {
  return await Payment.create({
    ...params,
    paymentNumber: await generatePaymentNumber(),
    status: "PENDING"
  } as any);
};

export const applySucceFullProductPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  invoice.paymentStatus = 'PAID';
  invoice.balanceDue = 0;
  await invoice.save();

  const order = await Order.findById(invoice.order);
  if (!order) {
    throw new Error('Order not found for successful payment');
  }

  order.paymentStatus = 'PAID';
  await order.save();

  // Increment coupon usage if applied
  const couponSnapshot = invoice.metadata?.coupon;
  if (couponSnapshot) {
    try {
      const c = await Coupon.findById(couponSnapshot._id);
      if (c) {
        await c.incrementUsage(String(order.customer));
      }
    } catch (couponError) {
      console.error('Failed to increment coupon usage after payment:', couponError);
    }
  }

  // Update SKU inventory
  try {
    await updateInventoryForOrder(order);
  } catch (inventoryError) {
    console.error('Failed to update inventory for order:', order._id, inventoryError);
  }

  const receipt: any = await Receipt.create({
    order: invoice.order,
    invoice: invoice._id,
    branch: invoice.branch,
    vendor: invoice.vendor,
    receiptNumber: await generateReceiptNumber(),
    amountPaid: payment.amount,
    paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
    issuedAt: new Date(),
    metadata: {
      coupon: invoice?.metadata?.coupon || null
    }
  });

  order.receipt = receipt._id as any;
  await order.save();

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.order) });

  return { receipt };
};

export const applySuccessFullAppointmentPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt?: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  const appointment = await Appointment.findById(invoice.appointment);
  if (!appointment) {
    throw new Error('Appointment not found for successful payment');
  }

  let receipt = null;

  if (payment.type === 'BOOKING_FEE' && appointment.status === 'PENDING') {
    invoice.paymentStatus = 'PARTIAL';
    invoice.balanceDue = appointment.remainingAmount;
    await invoice.save();

    appointment.status = 'CONFIRMED';
    await appointment.save();
  } else if (payment.type === 'FULLPAYMENT') {
    invoice.paymentStatus = 'PAID';
    invoice.balanceDue = 0;
    await invoice.save();

    appointment.remainingAmount = 0;
    if (appointment.status === 'PENDING') {
      appointment.status = 'CONFIRMED';
    }
    await appointment.save();

    receipt = await Receipt.create({
      appointment: invoice.appointment,
      invoice: invoice._id,
      branch: invoice.branch,
      vendor: invoice.vendor,
      receiptNumber: await generateReceiptNumber(),
      amountPaid: payment.amount,
      paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
      issuedAt: new Date(),
    });
  }

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  if (receipt) {
    io?.emit('receipt.created', { receiptId: receipt._id.toString(), appointmentId: String(invoice.appointment) });
  }

  return { receipt };
  
};

export const applySuccessfulTicketPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  invoice.paymentStatus = 'PAID';
  invoice.balanceDue = 0;
  await invoice.save();

  const ticket = await Ticket.findById(invoice.ticket).populate('event');
  if (!ticket) {
    throw new Error('Ticket not found for successful payment');
  }

  // Update inventory
  await updateInventoryForTicket(ticket);

  // QR Code generation payload
  const qrDataPayload = {
    ticketId: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber,
    status: 'BOOKED',
    event: {
      id: (ticket.event as any)._id.toString(),
      name: (ticket.event as any).name,
      venue: (ticket.event as any).venue,
      startDate: (ticket.event as any).startDate
    },
    attendee: {
      name: ticket.details.name,
      email: ticket.details.email,
      phone: ticket.details.phone
    },
    tier: ticket.type,
    generationTimestamp: new Date().toISOString()
  };

  const stringifiedData = JSON.stringify(qrDataPayload);

  // Generate QR Code as Base64 Data URL
  const qrCodeBase64String = await QRCode.toDataURL(stringifiedData, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400
  });

  // Immediate save after QR generation
  ticket.status = 'BOOKED';
  ticket.qrCodeData = qrCodeBase64String;
  await ticket.save();

  // Post-save logic: Handling pdfUrl
  ticket.pdfUrl = `https://cdn.dohez.com/tickets/${ticket.ticketNumber}.pdf`; 
  await ticket.save();

  const receipt: any = await Receipt.create({
    ticket: ticket._id,
    invoice: invoice._id,
    branch: invoice.branch,
    vendor: invoice.vendor,
    receiptNumber: await generateReceiptNumber(),
    amountPaid: payment.amount,
    paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
    issuedAt: new Date(),
  });

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  io?.emit('ticket.activated', { ticketId: ticket._id.toString(), status: 'BOOKED' });
  io?.emit('receipt.created', { receiptId: receipt._id.toString(), ticketId: String(ticket._id) });

  return { receipt };
};

export const initiateMpesaProductPayment = async (params: {
  invoiceId?: any;
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  invoiceNumber: string;
}): Promise<any> => {
  const { invoiceId, amount, phone, invoiceNumber, branch, vendor } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference: invoiceNumber
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: [invoiceId],
    branch,
    vendor,
    method: 'mpesa',
    amount,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};

export const initiateMpesaAppointmentPayment = async (params: {
  invoiceId?: any;
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  invoiceNumber: string;
  type: 'BOOKING_FEE' | 'FULLPAYMENT';
}): Promise<any> => {
  const { invoiceId, amount, phone, invoiceNumber, branch, vendor, type } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference: invoiceNumber
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: [invoiceId],
    branch,
    vendor,
    method: 'mpesa',
    amount,
    type,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};

export const initiateMpesaTicketPayment = async (params: {
  invoiceIds: any[];
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  accountReference: string;
}): Promise<any> => {
  const { invoiceIds, amount, phone, accountReference, branch, vendor } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: invoiceIds,
    branch,
    vendor,
    method: 'mpesa',
    amount,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};

