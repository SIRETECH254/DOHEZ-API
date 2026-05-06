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

router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createCoupon);

router.get('/', authenticateToken, authorizeRoles(['admin']), getAllCoupons);

router.post('/validate', authenticateToken, validateCoupon);

router.post('/apply', authenticateToken, applyCoupon);

router.post('/:couponId/generate-code', authenticateToken, authorizeRoles(['admin', 'vendor']), generateNewCode);

router.get('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponById);

router.put('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), updateCoupon);

router.delete('/:couponId', authenticateToken, requireAdmin, deleteCoupon);

router.get('/:couponId/stats', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponStats);

export default router;
