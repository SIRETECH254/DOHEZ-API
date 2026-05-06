import { Request, Response, NextFunction } from 'express';
import Payment from '../models/paymentModel';
import Invoice from '../models/Invoice';
import Order from '../models/Order';
import Receipt from '../models/receiptModel';
import { createPaymentRecord, initiateMpesaProductPayment, applySuccessfulPayment } from '../services/internal/paymentService';
import { normalizePhoneNumber, parseCallback as parseDarajaCallback, queryStkPushStatus } from '../services/external/darajaService';
import { errorHandler } from '../middleware/errorHandler';

export const payInvoice = async (req: Request, res: Response, next: NextFunction) => {
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
        await applySuccessfulPayment({ 
            invoice, 
            payment, 
            io, 
            method: 'mpesa_stk' 
        });
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
        await applySuccessfulPayment({ invoice, payment, io, method: 'mpesa_stk' });
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
