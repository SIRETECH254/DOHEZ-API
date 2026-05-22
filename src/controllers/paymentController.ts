import { Request, Response, NextFunction } from 'express';
import Payment from '../models/paymentModel';
import Invoice from '../models/Invoice';
import Appointment from '../models/Appointment';
import Order from '../models/Order';
import Receipt from '../models/receiptModel';
import Product from '../models/Product';
import Ticket from '../models/Ticket';
import Laundry from '../models/Laundry';
import Vendor from '../models/Vendor';
import Branch from '../models/Branch';
import { 
  createPaymentRecord, 
  initiateMpesaAppointmentPayment, 
  initiateMpesaProductPayment,
  initiateMpesaTicketPayment,
  initiateMpesaLaundryPayment,
  applySucceFullProductPayment, 
  applySuccessFullAppointmentPayment,
  applySuccessfulTicketPayment,
  applySuccessFullLaundryPayment,
  generateInvoiceNumber,
  generateTicketNumber,
  generateLaundryNumber
} from '../services/internal/paymentService';
import { normalizePhoneNumber, parseCallback as parseDarajaCallback, queryStkPushStatus } from '../services/external/darajaService';
import { errorHandler } from '../middleware/errorHandler';
import { validateOptionAvailability } from '../utils/availability';
import mongoose from 'mongoose';



export const payProductInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const {
      invoiceId,
      method,
      amount: clientAmount,
      payerPhone,
    } = req.body || {};

    if (!invoiceId || !method) {
      return next(errorHandler(400, 'invoiceId and method are required'));
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));

    if (invoice.paymentStatus === 'PAID') {
      return next(errorHandler(409, 'Invoice already paid'));
    }
    if (invoice.paymentStatus === 'CANCELLED') {
      return next(errorHandler(409, 'Invoice is cancelled'));
    }

    const amount = typeof clientAmount === 'number' ? clientAmount : invoice.balanceDue;
    if (!amount || amount <= 0) {
      return next(errorHandler(400, 'Invalid amount to charge'));
    }

    const userId = (req as any).user?._id;

    const payment = await createPaymentRecord({
      invoice: String(invoice._id),
      customer: userId,
      branch: String(invoice.branch),
      vendor: String(invoice.vendor),
      amount,
      method: method === 'mpesa_stk' ? 'mpesa' : 'paystack'
    });

    if (method === 'mpesa_stk') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa_stk'));

      const msisdn = normalizePhoneNumber(payerPhone);

      const { payment: updatedPayment, res: darajaRes } = await initiateMpesaProductPayment({
        invoiceId: String(invoice._id),
        customer: userId,
        branch: String(invoice.branch),
        vendor: String(invoice.vendor),
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber
      });

      return res.status(202).json({ 
        success: true, 
        data: { 
          paymentId: updatedPayment._id, 
          status: updatedPayment.status, 
          daraja: { 
            merchantRequestId: darajaRes.merchantRequestId, 
            checkoutRequestId: darajaRes.checkoutRequestId 
          } 
        } 
      });
    }

    if (method === 'paystack_card') {
      return next(errorHandler(501, 'paystack_card method not yet implemented'));
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (err) {
    next(err);
  }
};


export const confirmAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;
    const { method, payerPhone } = req.body || {};

    if (!appointmentId || !method) {
      return next(errorHandler(400, 'appointmentId (params) and method are required'));
    }

    const appointment = await Appointment.findById(appointmentId).populate('items.service');
    if (!appointment) return next(errorHandler(404, 'Appointment not found'));

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
      return next(errorHandler(400, 'Cannot pay for a completed, cancelled, or no-show appointment'));
    }

    if (appointment.overallStartTime < new Date()) {
      return next(errorHandler(400, 'Appointment time is in the past'));
    }

    const availability = await validateOptionAvailability(
      String(appointment.branch),
      String(appointment.vendor),
      appointment.items.map(item => {
        // Robust ID extraction whether populated or not
        const serviceId = (item.service as any)._id 
          ? (item.service as any)._id.toString() 
          : item.service.toString();
          
        return {
          serviceId,
          staffId: String(item.staff),
          startTime: item.startTime,
          endTime: item.endTime
        };
      }),
      String(appointment._id)
    );

    if (!availability.ok) {
      return next(errorHandler(400, availability.message || 'Appointment slot is no longer available'));
    }

    const invoice = await Invoice.create({
      appointment: appointment._id,
      branch: appointment.branch,
      vendor: appointment.vendor,
      subtotal: appointment.bookingFeeAmount,
      total: appointment.bookingFeeAmount,
      balanceDue: appointment.remainingAmount,
      paymentStatus: 'PENDING',
      invoiceNumber: await generateInvoiceNumber()
    });

    const userId = (req as any).user?._id;

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: appointment.branch,
        vendor: appointment.vendor,
        amount: appointment.bookingFeeAmount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'BOOKING_FEE'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Booking fee initiated',
      data: { appointment } 
    });
  } catch (err) {
    next(err);
  }
};


export const payAppointmentInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payerPhone, method, appointmentId } = req.body || {};

    if (!appointmentId || !method) {
      return next(errorHandler(400, 'appointmentId and method are required'));
    }

    const invoice = await Invoice.findOne({ appointment: appointmentId });
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, 'Appointment not found'));

    if (invoice.paymentStatus === 'PAID') return next(errorHandler(409, 'Invoice already paid'));
    if (invoice.paymentStatus === 'CANCELLED') return next(errorHandler(409, 'Invoice is cancelled'));

    if (appointment.status === 'COMPLETED') return next(errorHandler(409, 'Appointment is already completed'));
    if (appointment.status === 'CANCELLED') return next(errorHandler(409, 'Appointment is cancelled'));
    if (appointment.status === 'NO_SHOW') return next(errorHandler(409, 'Appointment was a no-show'));

    const amount = invoice.balanceDue;
    const userId = (req as any).user?._id;

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: appointment.branch,
        vendor: appointment.vendor,
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "appointment paidfully",
      data: { appointment, invoice } 
    });
  } catch (err) {
    next(err);
  }
};


export const bookTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, ticketsRequested, paymentMethod, phoneNumber } = req.body;
    const userId = (req as any).user?._id;

    const event = await Product.findById(eventId);
    if (!event) return next(errorHandler(404, 'Event not found'));

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      return next(errorHandler(400, 'phoneNumber is required for mpesa'));
    }

    const compiledInvoiceIds: mongoose.Types.ObjectId[] = [];
    const responseItems = [];
    let combinedGrandTotal = 0;

    for (const group of ticketsRequested) {
      const { skuId, quantity, attendees } = group;

      const sku = event.skus.id(skuId);
      
      if (!sku) return next(errorHandler(400, `Invalid ticket tier specified: ${skuId}`));

      if (sku.stock < quantity) {
        return next(errorHandler(400, `Insufficient ticket inventory for tier. Available: ${sku.stock}`));
      }

      for (let i = 0; i < quantity; i++) {
        const attendee = attendees[i] || {};
        const ticketNumber = await generateTicketNumber();

        const ticket = await Ticket.create({
          ticketNumber,
          event: eventId,
          skuId: sku._id,
          vendor: event.vendor,
          branch: event.branch,
          details: {
            name: attendee.name || 'Guest',
            email: attendee.email || 'guest@example.com',
            phone: attendee.phone || '0000000000'
          },
          type: sku.skuCode || 'REGULAR',
          status: 'PENDING'
        });

        const invoice = await Invoice.create({
          invoiceNumber: await generateInvoiceNumber(),
          ticket: ticket._id,
          branch: event.branch,
          vendor: event.vendor,
          subtotal: sku.price,
          total: sku.price,
          balanceDue: sku.price,
          paymentStatus: 'PENDING',
          metadata: {
            attendeeName: attendee.name || 'Guest'
          }
        });

        compiledInvoiceIds.push(invoice._id as mongoose.Types.ObjectId);
        combinedGrandTotal += sku.price;
        
        responseItems.push({
          ticketId: ticket._id,
          invoiceId: invoice._id,
          ticketNumber,
          invoiceNumber: invoice.invoiceNumber,
          price: sku.price,
          attendee: attendee.name || 'Guest'
        });
      }
    }

    if (paymentMethod === 'mpesa') {
      const msisdn = normalizePhoneNumber(phoneNumber);
      const baseInvoice = responseItems[0];

      const { payment, res: darajaRes } = await initiateMpesaTicketPayment({
        invoiceIds: compiledInvoiceIds,
        customer: userId,
        branch: event.branch?.toString() || '',
        vendor: event.vendor.toString(),
        amount: combinedGrandTotal,
        phone: msisdn,
        accountReference: compiledInvoiceIds.length === 1 ? baseInvoice.invoiceNumber : 'DOHEZ TICKETS'
      });

      return res.status(202).json({
        success: true,
        message: 'Tickets reserved and M-Pesa STK Push initiated',
        data: {
          eventId: event._id,
          paymentId: payment._id,
          status: payment.status,
          items: responseItems,
          daraja: {
            merchantRequestId: darajaRes.merchantRequestId,
            checkoutRequestId: darajaRes.checkoutRequestId
          }
        }
      });
    }

    return next(errorHandler(400, 'Unsupported payment method'));

  } catch (error) {
    next(error);
  }
};


export const payTicketInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceIds, method, payerPhone } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return next(errorHandler(400, 'An array of invoiceIds is required'));
    }

    if (method !== 'mpesa') {
      return next(errorHandler(400, 'Only mpesa method is supported for ticket checkout groups'));
    }

    if (!payerPhone) {
      return next(errorHandler(400, 'payerPhone is required for mpesa'));
    }

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } });
    if (invoices.length !== invoiceIds.length) {
      return next(errorHandler(404, 'One or more ticket invoices could not be found'));
    }

    let combinedGrandTotal = 0;

    for (const inv of invoices) {
      if (inv.paymentStatus === 'PAID') {
        return next(errorHandler(409, `Invoice ${inv.invoiceNumber} has already been paid`));
      }
      if (inv.paymentStatus === 'CANCELLED') {
        return next(errorHandler(409, `Invoice ${inv.invoiceNumber} is cancelled`));
      }
      combinedGrandTotal += inv.balanceDue;
    }

    const msisdn = normalizePhoneNumber(payerPhone);
    const baseInvoice = invoices[0];
    const userId = (req as any).user?._id;

    const { payment, res: darajaRes } = await initiateMpesaTicketPayment({
      invoiceIds,
      customer: userId,
      branch: baseInvoice.branch?.toString() || '',
      vendor: baseInvoice.vendor.toString(),
      amount: combinedGrandTotal,
      phone: msisdn,
      accountReference: invoices.length === 1 ? baseInvoice.invoiceNumber : 'DOHEZ TICKETS'
    });

    return res.status(202).json({
      success: true,
      message: 'M-Pesa STK Push initiated',
      data: {
        paymentId: payment._id,
        status: payment.status,
        daraja: {
          merchantRequestId: darajaRes.merchantRequestId,
          checkoutRequestId: darajaRes.checkoutRequestId
        }
      }
    });

  } catch (error) {
    next(error);
  }
};


export const bookLaundry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      vendorId, 
      branchId, 
      location, 
      services, 
      pickUpDate, 
      paymentMethod, 
      phoneNumber 
    } = req.body;
    
    const userId = (req as any).user?._id;

    // 1. Validation
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, 'Vendor not found'));

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, 'Branch not found'));

    const serviceProducts = await Product.find({ _id: { $in: services } });
    if (serviceProducts.length !== services.length) {
      return next(errorHandler(404, 'One or more services not found'));
    }

    const totalAmount = serviceProducts.reduce((sum, p) => sum + (p.offerPrice || p.price), 0);

    // 2. Laundry creation
    const laundry = await Laundry.create({
      laundryNumber: await generateLaundryNumber(),
      customer: userId,
      vendor: vendorId,
      branch: branchId,
      location,
      services,
      pickUpDate,
      status: 'PENDING',
      remainingAmount: totalAmount
    });

    // 3. Invoice creation
    const invoice = await Invoice.create({
      laundry: laundry._id,
      branch: branchId,
      vendor: vendorId,
      invoiceNumber: await generateInvoiceNumber(),
      subtotal: totalAmount,
      total: totalAmount,
      balanceDue: totalAmount,
      paymentStatus: 'PENDING'
    });

    // 4. Payment Initiation
    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) return next(errorHandler(400, 'phoneNumber is required for mpesa'));
      const msisdn = normalizePhoneNumber(phoneNumber);

      const { payment, res: darajaRes } = await initiateMpesaLaundryPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: branchId,
        vendor: vendorId,
        amount: totalAmount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });

      return res.status(202).json({
        success: true,
        message: 'Laundry booked and M-Pesa STK Push initiated',
        data: {
          laundryId: laundry._id,
          paymentId: payment._id,
          status: payment.status,
          daraja: {
            merchantRequestId: darajaRes.merchantRequestId,
            checkoutRequestId: darajaRes.checkoutRequestId
          }
        }
      });
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (error) {
    next(error);
  }
};


export const payLaundryInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, method, payerPhone } = req.body;

    if (!invoiceId || !method) {
      return next(errorHandler(400, 'invoiceId and method are required'));
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));
    
    if (!invoice.laundry) return next(errorHandler(400, 'Invoice is not associated with a laundry request'));

    const laundry = await Laundry.findById(invoice.laundry);
    if (!laundry) return next(errorHandler(404, 'Laundry request not found'));

    if (invoice.paymentStatus === 'PAID') return next(errorHandler(409, 'Invoice already paid'));
    if (invoice.paymentStatus === 'CANCELLED') return next(errorHandler(409, 'Invoice is cancelled'));

    const amount = invoice.balanceDue;
    const userId = (req as any).user?._id;

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));
      const msisdn = normalizePhoneNumber(payerPhone);

      const { payment, res: darajaRes } = await initiateMpesaLaundryPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: invoice.branch as any,
        vendor: invoice.vendor as any,
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });

      return res.status(202).json({
        success: true,
        message: 'Payment initiated for laundry',
        data: {
          paymentId: payment._id,
          status: payment.status,
          daraja: {
            merchantRequestId: darajaRes.merchantRequestId,
            checkoutRequestId: darajaRes.checkoutRequestId
          }
        }
      });
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (error) {
    next(error);
  }
};


export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const payload = req.body;

    console.log('===== M-PESA WEBHOOK RECEIVED =====');
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    const parsed = parseDarajaCallback(payload);

    if (payload?.Body?.stkCallback) {
      io.emit("callback.received", { 
        message: payload?.Body?.stkCallback.ResultDesc, 
        CODE: payload?.Body?.stkCallback.ResultCode 
      });
    }

    if (!parsed.valid) return next(errorHandler(400, 'Invalid payload'));

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': parsed.checkoutRequestId });
    if (!payment) return next(errorHandler(404, 'Payment not found'));

    payment.rawPayload = payload;

    if (parsed.success) {
      // 1. Normalize the invoice property into an array
      const invoiceIds = Array.isArray(payment.invoice) ? payment.invoice : [payment.invoice];

      // 2. Loop through every invoice ID contained in the payment
      for (const invId of invoiceIds) {
        const invoice = await Invoice.findById(invId);
        
        if (invoice) {
          if (invoice.order) 
          {
            await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
          } 
          else if (invoice.appointment) 
          {
            await applySuccessFullAppointmentPayment({ invoice, payment, io, method: 'mpesa_stk' });
          } 
          else if (invoice.ticket) 
          {
            await applySuccessfulTicketPayment({ invoice, payment, io, method: 'mpesa_stk' });
          }
          else if (invoice.laundry) 
          {
            await applySuccessFullLaundryPayment({ invoice, payment, io, method: 'mpesa_stk' });
          }
        }
      }
      
      // Update the parent payment status to SUCCESS after the loop
      payment.status = 'SUCCESS';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });

    } else {
      payment.status = 'FAILED';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
    }

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};


export const queryMpesaByCheckoutId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checkoutRequestId } = req.params;
    const io = req.app.get('io');

    if (!checkoutRequestId) return next(errorHandler(400, 'checkoutRequestId is required'));

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': checkoutRequestId });
    if (!payment) return next(errorHandler(404, 'Payment not found for this checkout request'));

    const result = await queryStkPushStatus(checkoutRequestId as string);
    if (!result.ok) {
      return next(errorHandler(502, result.error || 'Failed to query Daraja API'));
    }

    console.log('===== SAFARICOM QUERY RESULT =====');
    console.log('Result Code:', result.resultCode);
    console.log('Result Desc:', result.resultDesc);
    console.log('Full Result:', JSON.stringify(result.raw, null, 2));
    console.log('==================================');

    const status = result.resultCode === 0 ? 'SUCCESS' : 'FAILED';
    
    if (result.resultCode === 0 && payment.status !== 'SUCCESS') {
      const invoiceIds = Array.isArray(payment.invoice) ? payment.invoice : [payment.invoice];

      for (const invId of invoiceIds) {
        const invoice = await Invoice.findById(invId);
        
        if (invoice) {
          if (invoice.order) 
          {
            await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
          }
          else if (invoice.appointment) 
          {
            await applySuccessFullAppointmentPayment({ invoice, payment, io, method: 'mpesa_stk' });
          } 
          else if (invoice.ticket) 
          {
            await applySuccessfulTicketPayment({ invoice, payment, io, method: 'mpesa_stk' });
          }
          else if (invoice.laundry) 
          {
            await applySuccessFullLaundryPayment({ invoice, payment, io, method: 'mpesa_stk' });
          }
        }
      }

      payment.status = 'SUCCESS';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
    } else if (result.resultCode !== 0 && payment.status !== 'FAILED') {
      payment.status = 'FAILED';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
    }

    return res.json({ 
      success: true, 
      data: { 
        status, 
        resultCode: result.resultCode, 
        resultDesc: result.resultDesc,
        paymentId: payment._id,
        invoiceId: payment.invoice,
        raw: result.raw
      } 
    });
  } catch (err) {
    next(err);
  }
};


export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, search, branch, vendor } = req.query;
    const query: any = {};

    if (search) {
      query.paymentNumber = { $regex: search, $options: 'i' };
    }

    if (branch) {
      query.branch = branch;
    }

    if (vendor) {
      query.vendor = vendor;
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const payments = await Payment.find(query)
      .populate('invoice')
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Payment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            payments, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalPayments: total,
                hasNextPage: options.page < totalPages,
                hasPrevPage: options.page > 1
            } 
        } 
    });
  } catch (error) {
    next(error);
  }
};


export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('invoice');
    if (!payment) return next(errorHandler(404, 'Payment not found'));
    
    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};
