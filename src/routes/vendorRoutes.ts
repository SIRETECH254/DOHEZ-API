import express from 'express';
import upload from '../middleware/upload';
import {
  registerVendor,
  getVendors,
  getVendorById,
  updateVendorProfile,
  deleteVendor
} from '../controllers/vendorController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Vendor:
 *       type: object
 *       required:
 *         - userId
 *         - name
 *         - categoryId
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         logo:
 *           type: string
 *         cover:
 *           type: string
 *         categoryId:
 *           type: string
 *         isActive:
 *           type: boolean
 *         isVerified:
 *           type: boolean
 */

/**
 * @swagger
 * /api/vendors/register:
 *   post:
 *     summary: Register as a new vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - name
 *               - categoryId
 *               - phone
 *               - email
 *             properties:
 *               userId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               location:
 *                 type: string
 *                 description: JSON string of location object
 *               workingHours:
 *                 type: string
 *                 description: JSON string of working hours array
 *               logo:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Vendor registered
 */
router.post('/register', authenticateToken, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), registerVendor);

/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: Get all verified vendors
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of vendors
 */
router.get('/', getVendors);

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   get:
 *     summary: Get vendor details
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor details
 */
router.get('/:vendorId', getVendorById);

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   put:
 *     summary: Update vendor profile
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
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
 *               categoryId:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: binary
 *               banner:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.put('/:vendorId', authenticateToken, authorizeRoles(['super_admin', 'admin']), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateVendorProfile);

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   delete:
 *     summary: Delete a vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:vendorId', authenticateToken, authorizeRoles(['super_admin']), deleteVendor);

export default router;
