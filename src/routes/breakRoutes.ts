import express from 'express';
import {
  createBreak,
  getBreak,
  getBreaks,
  updateBreak,
  deleteBreak
} from '../controllers/breakController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Break:
 *       type: object
 *       required:
 *         - staff
 *         - startTime
 *         - endTime
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         staff:
 *           type: string
 *           description: User ID of the staff member
 *         startTime:
 *           type: string
 *           description: Start time in HH:MM format
 *           example: "09:00"
 *         endTime:
 *           type: string
 *           description: End time in HH:MM format
 *           example: "09:30"
 *         reason:
 *           type: string
 *           description: Reason for the break
 *           maxLength: 300
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/breaks:
 *   post:
 *     summary: Create a new break record
 *     tags: [Breaks]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staff, startTime, endTime]
 *             properties:
 *               staff: { type: string }
 *               startTime: { type: string, example: "12:00" }
 *               endTime: { type: string, example: "13:00" }
 *               reason: { type: string }
 *     responses:
 *       201:
 *         description: Created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), createBreak);

/**
 * @swagger
 * /api/breaks:
 *   get:
 *     summary: List all breaks with pagination
 *     tags: [Breaks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: staff
 *         schema: { type: string }
 *         description: Filter by staff user ID
 *     responses:
 *       200:
 *         description: List of breaks
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), getBreaks);

/**
 * @swagger
 * /api/breaks/{id}:
 *   get:
 *     summary: Get single break record by ID
 *     tags: [Breaks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Break record details
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), getBreak);

/**
 * @swagger
 * /api/breaks/{id}:
 *   put:
 *     summary: Update an existing break record
 *     tags: [Breaks]
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
 *               startTime: { type: string, example: "12:30" }
 *               endTime: { type: string, example: "13:30" }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: Not found
 */
router.put('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), updateBreak);

/**
 * @swagger
 * /api/breaks/{id}:
 *   delete:
 *     summary: Delete a break record
 *     tags: [Breaks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticateToken, authorizeRoles(['super_admin', 'admin', 'branch_admin', 'vendor_admin']), deleteBreak);

export default router;
