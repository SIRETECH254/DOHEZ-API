import express from 'express';
import {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
  attachVariant,
  detachVariant
} from '../controllers/variantController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/variants/attach:
 *   post:
 *     summary: Attach a variant to a product
 *     tags: [Variants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *     responses:
 *       200: { description: Attached }
 */
router.post('/attach', authenticateToken, authorizeRoles(['admin', 'super_admin']), attachVariant);

/**
 * @swagger
 * /api/variants/detach:
 *   post:
 *     summary: Detach a variant from a product
 *     tags: [Variants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, variantId]
 *             properties:
 *               productId: { type: string }
 *               variantId: { type: string }
 *     responses:
 *       200: { description: Detached }
 */
router.post('/detach', authenticateToken, authorizeRoles(['admin', 'super_admin']), detachVariant);

/**
 * @swagger
 * /api/variants:
 *   post:
 *     summary: Create variant
 *     tags: [Variants]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               options: { type: array, items: { type: object } }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createVariant);

/**
 * @swagger
 * /api/variants:
 *   get:
 *     summary: Get all variants
 *     tags: [Variants]
 *     responses:
 *       200: { description: Success }
 */
router.get('/', getVariants);

/**
 * @swagger
 * /api/variants/{id}:
 *   get:
 *     summary: Get variant by ID
 *     tags: [Variants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get('/:id', getVariantById);

/**
 * @swagger
 * /api/variants/{id}:
 *   put:
 *     summary: Update variant
 *     tags: [Variants]
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
 *               options: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateVariant);

/**
 * @swagger
 * /api/variants/{id}:
 *   delete:
 *     summary: Delete variant
 *     tags: [Variants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteVariant);

export default router;
