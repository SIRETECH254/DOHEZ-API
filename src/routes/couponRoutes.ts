import express from 'express';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats,
  generateNewCode
} from '../controllers/couponController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Coupon management
 */

/**
 * @swagger
 * /api/coupons:
 *   post:
 *     summary: Create a new coupon (Admin/Vendor)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, discountType, discountValue]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               discountType: { type: string, enum: [percentage, fixed] }
 *               discountValue: { type: number }
 *               minimumOrderAmount: { type: number }
 *               maximumDiscountAmount: { type: number }
 *               isActive: { type: boolean }
 *               hasExpiry: { type: boolean }
 *               expiryDate: { type: string, format: date-time }
 *               hasUsageLimit: { type: boolean }
 *               usageLimit: { type: number }
 *               isFirstTimeOnly: { type: boolean }
 *               vendor: { type: string }
 *               branch: { type: string }
 *     responses:
 *       201:
 *         description: Coupon created successfully
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createCoupon);

/**
 * @swagger
 * /api/coupons:
 *   get:
 *     summary: List all coupons (Admin)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
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
 *         name: isActive
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: vendor
 *         schema: { type: string }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of coupons
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), getAllCoupons);

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate a coupon code
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *               orderAmount: { type: number }
 *     responses:
 *       200:
 *         description: Coupon is valid
 */
router.post('/validate', authenticateToken, validateCoupon);

/**
 * @swagger
 * /api/coupons/apply:
 *   post:
 *     summary: Apply a coupon to an order
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *               orderAmount: { type: number }
 *     responses:
 *       200:
 *         description: Coupon applied successfully
 */
router.post('/apply', authenticateToken, applyCoupon);

/**
 * @swagger
 * /api/coupons/{couponId}/generate-code:
 *   post:
 *     summary: Generate a new unique code for an existing coupon (Admin/Vendor)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: New coupon code generated successfully
 */
router.post('/:couponId/generate-code', authenticateToken, authorizeRoles(['admin', 'vendor']), generateNewCode);

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   get:
 *     summary: Get coupon details by ID
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon details
 */
router.get('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponById);

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   put:
 *     summary: Update coupon details (Admin/Vendor)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 */
router.put('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), updateCoupon);

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   delete:
 *     summary: Delete a coupon (Admin)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
 */
router.delete('/:couponId', authenticateToken, requireAdmin, deleteCoupon);

/**
 * @swagger
 * /api/coupons/{couponId}/stats:
 *   get:
 *     summary: Get coupon usage statistics (Admin/Vendor)
 *     tags: [Coupons]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon usage stats
 */
router.get('/:couponId/stats', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponStats);

export default router;
