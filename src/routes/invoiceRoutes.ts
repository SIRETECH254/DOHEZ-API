import express from 'express';
import {
    createInvoice,
    getInvoices,
    getInvoiceById
} from '../controllers/invoiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice management
 */

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Create a new invoice (Admin/Vendor)
 *     tags: [Invoices]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string }
 *     responses:
 *       201:
 *         description: Invoice created successfully
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), createInvoice);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List all invoices (Admin/Super-Admin)
 *     tags: [Invoices]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [PENDING, PAID, CANCELLED] }
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), getInvoices);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID (Admin/Super-Admin)
 *     tags: [Invoices]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), getInvoiceById);

export default router;
