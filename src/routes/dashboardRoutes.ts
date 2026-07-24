import express from 'express';
import {
  getSuperAdminDashboard,
  getAdminDashboard,
  getVendorAdminDashboard,
  getBranchAdminDashboard,
  getStaffDashboard
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * Super Admin Dashboard
 */
router.get(
  '/super-admin',
  authenticateToken,
  authorizeRoles(['super_admin']),
  getSuperAdminDashboard
);

/**
 * Admin Dashboard
 */
router.get(
  '/admin',
  authenticateToken,
  authorizeRoles(['admin', 'super_admin']),
  getAdminDashboard
);

/**
 * Vendor Admin Dashboard
 */
router.get(
  '/vendor',
  authenticateToken,
  authorizeRoles(['vendor_admin', 'super_admin']),
  getVendorAdminDashboard
);

/**
 * Branch Admin Dashboard
 */
router.get(
  '/branch',
  authenticateToken,
  authorizeRoles(['branch_admin', 'super_admin']),
  getBranchAdminDashboard
);

/**
 * Staff Dashboard
 */
router.get(
  '/staff',
  authenticateToken,
  authorizeRoles(['staff', 'super_admin']),
  getStaffDashboard
);

export default router;
