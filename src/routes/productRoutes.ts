import express from 'express';
import {
  createProduct,
  createService,
  createEvent,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductSKU
} from '../controllers/productController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import upload from '../middleware/upload';

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, price, category, vendor, branch, service]
 *             properties:
 *               name: { type: string }
 *               details: { type: string }
 *               price: { type: number }
 *               offerPrice: { type: number }
 *               images: { type: array, items: { type: string, format: binary } }
 *               category: { type: string }
 *               vendor: { type: string }
 *               branch: { type: string }
 *               service: { type: string }
 *               variants: { type: array, items: { type: string } }
 *               selectedVariantOptions: { type: string }
 *               status: { type: boolean }
 *               trackInventory: { type: boolean }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), createProduct);

/**
 * @swagger
 * /api/products/services:
 *   post:
 *     summary: Create a new appointment service
 *     tags: [Products]
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
 *               details: { type: string }
 *               price: { type: number }
 *               category: { type: string }
 *               vendor: { type: string }
 *               branch: { type: string }
 *               service: { type: string }
 *               duration: { type: string }
 *               buffertime: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/services', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), createService);

/**
 * @swagger
 * /api/products/events:
 *   post:
 *     summary: Create a new event for ticketing
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, price, vendor, branch, startDate, endDate, venue]
 *             properties:
 *               name: { type: string }
 *               details: { type: string }
 *               price: { type: number }
 *               images: { type: array, items: { type: string, format: binary } }
 *               category: { type: string }
 *               vendor: { type: string }
 *               branch: { type: string }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               venue: { type: string }
 *               location: { type: string }
 *               openAt: { type: string }
 *               maxTicket: { type: number }
 *               variants: { type: array, items: { type: string } }
 *               selectedVariantOptions: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/events', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), createEvent);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with filters
 *     tags: [Products]
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
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *       - in: query
 *         name: service
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Success }
 */
router.get('/', getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get('/:id', getProductById);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
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
 *               price: { type: number }
 *               offerPrice: { type: number }
 *               images: { type: array, items: { type: string, format: binary } }
 *               category: { type: string }
 *               vendor: { type: string }
 *               branch: { type: string }
 *               service: { type: string }
 *               variants: { type: array, items: { type: string } }
 *               selectedVariantOptions: { type: string }
 *               status: { type: boolean }
 *               trackInventory: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.array('images', 5), updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProduct);

/**
 * @swagger
 * /api/products/{id}/skus/{skuId}:
 *   put:
 *     summary: Update specific product SKU
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: skuId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price: { type: number }
 *               stock: { type: number }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id/skus/:skuId', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProductSKU);

export default router;
