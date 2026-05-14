import { Router } from 'express';
import { getAvailability } from '../controllers/availabilityController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Availability scheduling and management
 */

/**
 * @swagger
 * /api/availability:
 *   post:
 *     summary: Fetch available schedule options
 *     tags: [Availability]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - branch
 *               - vendor
 *               - items
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-20"
 *               branch:
 *                 type: string
 *                 example: "branch_001"
 *               vendor:
 *                 type: string
 *                 example: "vendor_001"
 *               items:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["service_id_001", "service_id_002"]
 *               staff:
 *                 type: string
 *                 example: "staff_id_001"
 *     responses:
 *       200:
 *         description: Available schedules fetched successfully
 */
router.post('/', authenticateToken, getAvailability);

export default router;
