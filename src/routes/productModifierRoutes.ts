import express from 'express';
import {
  createProductModifier,
  getProductModifiers,
  getProductModifierById,
  updateProductModifier,
  deleteProductModifier
} from '../controllers/productModifierController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/product-modifiers:
 *   post:
 *     summary: Create product modifier
 *     tags: [Product Modifiers]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               min_selection: { type: number }
 *               max_selection: { type: number }
 *               is_required: { type: boolean }
 *               sortOrder: { type: number }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createProductModifier);

/**
 * @swagger
 * /api/product-modifiers:
 *   get:
 *     summary: Get all product modifiers
 *     tags: [Product Modifiers]
 *     responses:
 *       200: { description: Success }
 */
router.get('/', getProductModifiers);

/**
 * @swagger
 * /api/product-modifiers/{id}:
 *   get:
 *     summary: Get product modifier by ID
 *     tags: [Product Modifiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get('/:id', getProductModifierById);

/**
 * @swagger
 * /api/product-modifiers/{id}:
 *   put:
 *     summary: Update product modifier
 *     tags: [Product Modifiers]
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
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               min_selection: { type: number }
 *               max_selection: { type: number }
 *               is_required: { type: boolean }
 *               sortOrder: { type: number }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProductModifier);

/**
 * @swagger
 * /api/product-modifiers/{id}:
 *   delete:
 *     summary: Delete product modifier
 *     tags: [Product Modifiers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductModifier);

export default router;
