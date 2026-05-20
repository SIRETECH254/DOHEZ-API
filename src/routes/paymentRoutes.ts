import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { 
  payProductInvoice, 
  confirmAppointment,
  payAppointmentInvoice,
  bookTicket,
  payTicketInvoices,
  mpesaWebhook, 
  queryMpesaByCheckoutId, 
  getPayments, 
  getPaymentById 
} from '../controllers/paymentController';

const router = express.Router();

/**
 * @swagger
 * /api/payments/pay:
 *   post:
 *     summary: Initiate payment for an invoice
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/pay', authenticateToken, payProductInvoice);

/**
 * @swagger
 * /api/payments/tickets/book:
 *   post:
 *     summary: Reserve tickets and initiate payment
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/tickets/book', authenticateToken, bookTicket);

/**
 * @swagger
 * /api/payments/tickets/pay:
 *   post:
 *     summary: Pay ticket invoices group
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/tickets/pay', authenticateToken, payTicketInvoices);

/**
 * @swagger
 * /api/payments/appointments/confirm/{appointmentId}:
 *   post:
 *     summary: Confirm appointment and initiate booking fee
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/appointments/confirm/:appointmentId', authenticateToken, confirmAppointment);

/**
 * @swagger
 * /api/payments/appointments/pay:
 *   post:
 *     summary: Pay appointment invoice
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/appointments/pay', authenticateToken, payAppointmentInvoice);


/**
 * @swagger
 * /api/payments/webhooks/mpesa:
 *   post:
 *     summary: M-Pesa callback handler
 *     tags: [Payments]
 */
router.post('/webhooks/mpesa', mpesaWebhook);

/**
 * @swagger
 * /api/payments/mpesa/{checkoutId}:
 *   get:
 *     summary: Query M-Pesa payment status
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/mpesa/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List all payments (Admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by payment number
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Filter by vendor ID
 */
router.get('/', authenticateToken, requireAdmin, getPayments);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment details (Admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', authenticateToken, requireAdmin, getPaymentById);

export default router;
