import express from 'express';
import upload from '../middleware/upload';
import {
  createProductType,
  getProductTypes,
  getProductTypeById,
  updateProductType,
  deleteProductType
} from '../controllers/productTypeController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/product-types:
 *   post:
 *     summary: Create product type
 *     tags: [ProductTypes]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               details: { type: string }
 *               order: { type: number }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductType);

/**
 * @swagger
 * /api/product-types:
 *   get:
 *     summary: Get all product types
 *     tags: [ProductTypes]
 *     responses:
 *       200: { description: Success }
 */
router.get('/', getProductTypes);

/**
 * @swagger
 * /api/product-types/{id}:
 *   get:
 *     summary: Get product type by ID
 *     tags: [ProductTypes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get('/:id', getProductTypeById);

/**
 * @swagger
 * /api/product-types/{id}:
 *   put:
 *     summary: Update product type
 *     tags: [ProductTypes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               details: { type: string }
 *               order: { type: number }
 *               icon: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), updateProductType);

/**
 * @swagger
 * /api/product-types/{id}:
 *   delete:
 *     summary: Delete product type
 *     tags: [ProductTypes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductType);

export default router;
