import express from 'express';
import {
    getReceipts,
    getReceipt
} from '../controllers/receiptController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Receipts
 *   description: Receipt management
 */

/**
 * @swagger
 * /api/receipts:
 *   get:
 *     summary: List all receipts
 *     tags: [Receipts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by receiptNumber
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *       - in: query
 *         name: paymentMethod
 *         schema: { type: string, enum: [mpesa, paystack, cash] }
 *     responses:
 *       200:
 *         description: List of receipts
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getReceipts);

/**
 * @swagger
 * /api/receipts/{id}:
 *   get:
 *     summary: Get receipt by ID
 *     tags: [Receipts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Receipt details
 */
router.get('/:id', authenticateToken, getReceipt);

export default router;
