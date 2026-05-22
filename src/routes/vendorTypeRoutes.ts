import express from 'express';
import upload from '../middleware/upload';
import {
  createVendorType,
  getVendorTypes,
  getVendorTypeById,
  updateVendorType,
  deleteVendorType
} from '../controllers/vendorTypeController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VendorType:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the vendor type
 *         name:
 *           type: string
 *           description: The name of the vendor type
 *         description:
 *           type: string
 *           description: Brief description of the vendor type
 *         slug:
 *           type: string
 *           description: URL-friendly name
 *         image:
 *           type: string
 *           description: URL of the image
 *         isActive:
 *           type: boolean
 *           description: Whether the vendor type is currently active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 650af1234567890abcdef123
 *         name: Product Vendor
 *         description: Vendors that sell physical products
 *         slug: product-vendor
 *         image: https://res.cloudinary.com/demo/image/upload/v1234567890/dohez/vendor-types/product.jpg
 *         isActive: true
 *         createdAt: 2026-04-27T12:00:00Z
 *         updatedAt: 2026-04-27T12:00:00Z
 */

/**
 * @swagger
 * tags:
 *   name: VendorTypes
 *   description: Vendor Type management (e.g., Product vs Service vendors)
 */

/**
 * @swagger
 * /api/vendor-types:
 *   post:
 *     summary: Create a new vendor type
 *     tags: [VendorTypes]
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
 *         description: Vendor type created successfully
 *       400:
 *         description: Bad Request
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorType);

/**
 * @swagger
 * /api/vendor-types:
 *   get:
 *     summary: Get all vendor types
 *     tags: [VendorTypes]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *           description: Set to 'true' to see inactive types (Admin only)
 *     responses:
 *       200:
 *         description: List of vendor types
 */
router.get('/', optionalAuthenticateToken, getVendorTypes);

/**
 * @swagger
 * /api/vendor-types/{idOrSlug}:
 *   get:
 *     summary: Get vendor type details by ID or slug
 *     tags: [VendorTypes]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor type details
 *       404:
 *         description: Not found
 */
router.get('/:idOrSlug', getVendorTypeById);

/**
 * @swagger
 * /api/vendor-types/{vendorTypeId}:
 *   put:
 *     summary: Update a vendor type
 *     tags: [VendorTypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorTypeId
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
 *         description: Updated successfully
 */
router.put('/:vendorTypeId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorType);

/**
 * @swagger
 * /api/vendor-types/{vendorTypeId}:
 *   delete:
 *     summary: Delete a vendor type
 *     tags: [VendorTypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorTypeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete('/:vendorTypeId', authenticateToken, authorizeRoles(['super_admin']), deleteVendorType);

export default router;
