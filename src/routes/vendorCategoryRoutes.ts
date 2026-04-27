import express from 'express';
import upload from '../middleware/upload';
import {
  createVendorCategory,
  getVendorCategories,
  getVendorCategoryById,
  updateVendorCategory,
  deleteVendorCategory
} from '../controllers/vendorCategoryController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VendorCategory:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         slug:
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
 */

/**
 * @swagger
 * tags:
 *   name: VendorCategories
 *   description: Vendor Category management
 */

/**
 * @swagger
 * /api/vendor-categories:
 *   post:
 *     summary: Create a new vendor category
 *     tags: [VendorCategories]
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
 *         description: Created
 *       400:
 *         description: Bad Request
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorCategory);

/**
 * @swagger
 * /api/vendor-categories:
 *   get:
 *     summary: Get all vendor categories
 *     tags: [VendorCategories]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, createdAt]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of vendor categories
 */
router.get('/', optionalAuthenticateToken, getVendorCategories);

/**
 * @swagger
 * /api/vendor-categories/{idOrSlug}:
 *   get:
 *     summary: Get vendor category by ID or slug
 *     tags: [VendorCategories]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details
 */
router.get('/:idOrSlug', getVendorCategoryById);

/**
 * @swagger
 * /api/vendor-categories/{categoryId}:
 *   put:
 *     summary: Update vendor category
 *     tags: [VendorCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
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
 *         description: Updated
 */
router.put('/:categoryId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorCategory);

/**
 * @swagger
 * /api/vendor-categories/{categoryId}:
 *   delete:
 *     summary: Delete vendor category
 *     tags: [VendorCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:categoryId', authenticateToken, authorizeRoles(['super_admin']), deleteVendorCategory);

export default router;
