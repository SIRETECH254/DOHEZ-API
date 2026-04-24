import express from 'express';
import upload from '../middleware/upload';
import {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService
} from '../controllers/serviceController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       required:
 *         - taskId
 *         - name
 *       properties:
 *         id:
 *           type: string
 *         taskId:
 *           oneOf:
 *             - type: string
 *             - $ref: '#/components/schemas/Task'
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         image:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 650af1234567890abcdef123
 *         taskId: 650af1234567890abcdef000
 *         name: Shirt Wash
 *         description: Standard machine wash and dry for shirts
 *         image: https://res.cloudinary.com/demo/image/upload/v123/service.jpg
 *         isActive: true
 */

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Service management under Tasks
 */

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Create a new service under a task
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Service created successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Forbidden
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createService);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get all services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *         description: Filter by parent task ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by service name
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *         description: Set to 'true' to see inactive services (Admin only)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of services
 */
router.get('/', optionalAuthenticateToken, getServices);

/**
 * @swagger
 * /api/services/{serviceId}:
 *   get:
 *     summary: Get service details by ID
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service details
 *       404:
 *         description: Service not found
 */
router.get('/:serviceId', getServiceById);

/**
 * @swagger
 * /api/services/{serviceId}:
 *   put:
 *     summary: Update a service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Service updated successfully
 */
router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateService);

/**
 * @swagger
 * /api/services/{serviceId}:
 *   delete:
 *     summary: Delete a service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 */
router.delete('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), deleteService);

export default router;
