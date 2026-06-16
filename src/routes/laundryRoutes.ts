import express from 'express';
import {
  getLaundries,
  getLaundry,
  updateLaundry,
  deleteLaundry
} from '../controllers/laundryController';
import { bookLaundry, payLaundryInvoice } from '../controllers/paymentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/laundries:
 *   get:
 *     summary: Retrieve a paginated list of laundry requests
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of laundry requests
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'staff','branch_admin','vendor_admin']), getLaundries);

/**
 * @swagger
 * /api/laundries/book:
 *   post:
 *     summary: Book a laundry service
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Laundry booked and payment initiated
 */
router.post('/book', authenticateToken, bookLaundry);

/**
 * @swagger
 * /api/laundries/pay:
 *   post:
 *     summary: Pay for a laundry invoice
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Payment initiated
 */
router.post('/pay', authenticateToken, payLaundryInvoice);

/**
 * @swagger
 * /api/laundries/{laundryId}:
 *   get:
 *     summary: Get laundry details
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: laundryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Laundry details
 *   put:
 *     summary: Update laundry
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: laundryId
 *         required: true
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     summary: Delete laundry
 *     tags: [Laundries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: laundryId
 *         required: true
 *     responses:
 *       200:
 *         description: Deleted
 */
router.get('/:laundryId', authenticateToken, getLaundry);
router.put('/:laundryId', authenticateToken, authorizeRoles(['admin', 'super_admin', 'staff','branch_admin','vendor_admin']), updateLaundry);
router.delete('/:laundryId', authenticateToken, authorizeRoles(['admin', 'super_admin','branch_admin','vendor_admin']), deleteLaundry);

export default router;
