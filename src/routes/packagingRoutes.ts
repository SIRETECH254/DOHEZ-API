import express from 'express';
import {
    createPackaging,
    updatePackaging,
    deletePackaging,
    getPackagingList,
    getPackagingById,
    setDefaultPackaging
} from '../controllers/packagingController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Packaging
 *   description: Packaging management
 */

/**
 * @swagger
 * /api/packaging:
 *   post:
 *     summary: Create a new packaging option (Admin/Vendor)
 *     tags: [Packaging]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, vendor, branch]
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               isActive: { type: boolean, default: true }
 *               isDefault: { type: boolean, default: false }
 *               vendor: { type: string }
 *               branch: { type: string }
 *     responses:
 *       201:
 *         description: Packaging option created successfully
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), createPackaging);

/**
 * @swagger
 * /api/packaging:
 *   get:
 *     summary: List all packaging options
 *     tags: [Packaging]
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
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *       - in: query
 *         name: isDefault
 *         schema: { type: boolean }
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of packaging options
 */
router.get('/', getPackagingList);

/**
 * @swagger
 * /api/packaging/{id}:
 *   get:
 *     summary: Get packaging option by ID
 *     tags: [Packaging]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Packaging option details
 */
router.get('/:id', getPackagingById);

/**
 * @swagger
 * /api/packaging/{id}:
 *   put:
 *     summary: Update packaging option (Admin/Vendor/Super-Admin)
 *     tags: [Packaging]
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
 *     responses:
 *       200:
 *         description: Packaging option updated successfully
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), updatePackaging);

/**
 * @swagger
 * /api/packaging/{id}:
 *   delete:
 *     summary: Delete packaging option (Admin/Vendor/Super-Admin)
 *     tags: [Packaging]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Packaging option deleted successfully
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), deletePackaging);

/**
 * @swagger
 * /api/packaging/{id}/default:
 *   patch:
 *     summary: Set packaging option as default (Admin/Vendor/Super-Admin)
 *     tags: [Packaging]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Packaging option set as default successfully
 */
router.patch('/:id/default', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), setDefaultPackaging);

export default router;
