import express from 'express';
import upload from '../middleware/upload';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask
} from '../controllers/taskController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the task
 *         name:
 *           type: string
 *           description: The name of the task
 *         description:
 *           type: string
 *           description: Brief description of the task
 *         image:
 *           type: string
 *           description: URL of the task image
 *         isActive:
 *           type: boolean
 *           description: Whether the task is currently active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 650af1234567890abcdef123
 *         name: Laundry
 *         description: Professional washing and ironing services
 *         image: https://res.cloudinary.com/demo/image/upload/v1234567890/dohez/tasks/laundry.jpg
 *         isActive: true
 *         createdAt: 2023-09-20T12:00:00Z
 *         updatedAt: 2023-09-20T12:00:00Z
 */

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task category management (Global)
 */

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task category
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
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
 *         description: Task created successfully
 *       400:
 *         description: Missing required fields or task already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super Admin access required
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createTask);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all task categories
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search tasks by name
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *         description: Set to 'true' to see inactive tasks (Admin only)
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 */
router.get('/', optionalAuthenticateToken, getTasks);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   get:
 *     summary: Get task details by ID
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task details
 *       404:
 *         description: Task not found
 */
router.get('/:taskId', getTaskById);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   put:
 *     summary: Update a task category
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
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
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/:taskId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateTask);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   delete:
 *     summary: Delete a task category
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete('/:taskId', authenticateToken, authorizeRoles(['super_admin']), deleteTask);

export default router;
