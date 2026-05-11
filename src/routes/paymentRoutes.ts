import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { 
  payInvoice, 
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
router.post('/pay', authenticateToken, payInvoice);

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
