import express from 'express';
import upload from '../middleware/upload';
import {
  createProductCategory,
  getProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory
} from '../controllers/productCategoryController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/product-categories:
 *   post:
 *     summary: Create product category
 *     tags: [ProductCategories]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               details: { type: string }
 *               sort: { type: number }
 *               productType: { type: string }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductCategory);

/**
 * @swagger
 * /api/product-categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [ProductCategories]
 *     responses:
 *       200: { description: Success }
 */
router.get('/', getProductCategories);

/**
 * @swagger
 * /api/product-categories/{id}:
 *   get:
 *     summary: Get product category by ID
 *     tags: [ProductCategories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get('/:id', getProductCategoryById);

/**
 * @swagger
 * /api/product-categories/{id}:
 *   put:
 *     summary: Update product category
 *     tags: [ProductCategories]
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
 *               sort: { type: number }
 *               productType: { type: string }
 *               icon: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), updateProductCategory);

/**
 * @swagger
 * /api/product-categories/{id}:
 *   delete:
 *     summary: Delete product category
 *     tags: [ProductCategories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductCategory);

export default router;
