import express from 'express';
import {
    getTickets,
    getTicket,
    updateTicket,
    deleteTicket
} from '../controllers/ticketController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket management
 */

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: List all tickets
 *     tags: [Tickets]
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
 *         description: Search by ticketNumber
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *       - in: query
 *         name: event
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, BOOKED, CANCELLED, USED, EXPIRED] }
 *     responses:
 *       200:
 *         description: List of tickets
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor_admin', 'branch_admin','staff']), getTickets);

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket details
 */
router.get('/:id', authenticateToken, getTicket);

/**
 * @swagger
 * /api/tickets/{id}:
 *   put:
 *     summary: Update ticket
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [PENDING, BOOKED, CANCELLED, USED, EXPIRED] }
 *               details: { type: object }
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor_admin', 'branch_admin',"staff"]), updateTicket);

/**
 * @swagger
 * /api/tickets/{id}:
 *   delete:
 *     summary: Delete ticket
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin',"vendor_admin","branch_admin"]), deleteTicket);

export default router;
