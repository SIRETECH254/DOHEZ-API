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

router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), createCoupon);

router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), getAllCoupons);

router.post('/validate', authenticateToken, validateCoupon);

router.post('/apply', authenticateToken, applyCoupon);

router.post('/:couponId/generate-code', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), generateNewCode);

router.get('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), getCouponById);

router.put('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), updateCoupon);

router.delete('/:couponId', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteCoupon);

router.get('/:couponId/stats', authenticateToken, authorizeRoles(['admin', 'vendor', 'super_admin']), getCouponStats);

export default router;
