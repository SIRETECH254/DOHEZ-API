import express from 'express';
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getUsersByRole,
  getCustomers
} from '../controllers/roleController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), getAllRoles);

/**
 * @swagger
 * /api/roles/customer/users:
 *   get:
 *     summary: Get all customers
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/customer/users', authenticateToken, authorizeRoles(['admin', 'super_admin']), getCustomers);

/**
 * @swagger
 * /api/roles/{roleId}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:roleId', authenticateToken, authorizeRoles(['admin', 'super_admin']), getRole);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateToken, requireAdmin, createRole);

/**
 * @swagger
 * /api/roles/{roleId}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:roleId', authenticateToken, requireAdmin, updateRole);

/**
 * @swagger
 * /api/roles/{roleId}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:roleId', authenticateToken, requireAdmin, deleteRole);

/**
 * @swagger
 * /api/roles/{roleId}/users:
 *   get:
 *     summary: Get users by role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:roleId/users', authenticateToken, authorizeRoles(['admin', 'super_admin']), getUsersByRole);

export default router;
