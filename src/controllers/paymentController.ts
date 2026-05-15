import { Request, Response, NextFunction } from 'express';
import Payment from '../models/paymentModel';
import Invoice from '../models/Invoice';
import Appointment from '../models/Appointment';
import Order from '../models/Order';
import Receipt from '../models/receiptModel';
import { 
  createPaymentRecord, 
  initiateMpesaAppointmentPayment, 
  initiateMpesaProductPayment,
  applySucceFullProductPayment, 
  applySuccessFullAppointmentPayment,
  generateInvoiceNumber 
} from '../services/internal/paymentService';
import { normalizePhoneNumber, parseCallback as parseDarajaCallback, queryStkPushStatus } from '../services/external/darajaService';
import { errorHandler } from '../middleware/errorHandler';
import { validateOptionAvailability } from '../utils/availability';

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
      appointment.items.map(item => ({
        serviceId: (item.service as any)._id,
        staffId: String(item.staff),
        startTime: item.startTime,
        endTime: item.endTime
      })),
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

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
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

    const payment = await createPaymentRecord({
      invoice: String(invoice._id),
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

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
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
      const invoice = await Invoice.findById(payment.invoice);
      if (invoice) {
        if (invoice.order) {
          await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
        } else if (invoice.appointment) {
          await applySuccessFullAppointmentPayment({ invoice, payment, io, method: 'mpesa_stk' });
        }
      }
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
      const invoice = await Invoice.findById(payment.invoice);
      if (invoice) {
        if (invoice.order) {
          await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
        } else if (invoice.appointment) {
          await applySuccessFullAppointmentPayment({ invoice, payment, io, method: 'mpesa_stk' });
        }
      }
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
