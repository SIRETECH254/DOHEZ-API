import express from 'express';
import { authenticateToken, requireAdmin ,authorizeRoles } from '../middleware/auth';
import {
  createOrder,
  adminCreateOrder,
  getOrderById,
  updateOrderStatus,
  assignRider,
  getOrders,
  deleteOrder,
  getUserOrders
} from '../controllers/orderController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and fulfillment
 */

// Public/Common order routes

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order from active cart group
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendorId, branchId, location, type, paymentPreference]
 *             properties:
 *               vendorId: { type: string }
 *               branchId: { type: string }
 *               location: { type: string, enum: [in_shop, away] }
 *               type: { type: string, enum: [pickup, delivery] }
 *               timing:
 *                 type: object
 *                 properties:
 *                   isScheduled: { type: boolean }
 *                   scheduledAt: { type: string, format: date-time }
 *               addressId: { type: string }
 *               paymentPreference:
 *                 type: object
 *                 required: [mode]
 *                 properties:
 *                   mode: { type: string, enum: [post_to_bill, pay_now, cash, cod] }
 *                   method: { type: string, enum: [mpesa_stk, paystack_card], nullable: true }
 *               packagingOptionId: { type: string }
 *               couponCode: { type: string }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Bad request
 */
router.post('/', authenticateToken, createOrder);

/**
 * @swagger
 * /api/orders/my-orders:
 *   get:
 *     summary: Get authenticated user's orders
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         description: Search by invoice number
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully
 */
router.get('/my-orders', authenticateToken, getUserOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get detailed order by ID
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', authenticateToken, getOrderById);

// Admin-only order routes

/**
 * @swagger
 * /api/orders/admin/create:
 *   post:
 *     summary: Create an order for a customer manually (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, vendorId, branchId, items, location, type, paymentPreference]
 *             properties:
 *               customerId: { type: string }
 *               vendorId: { type: string }
 *               branchId: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, skuId, quantity]
 *                   properties:
 *                     productId: { type: string }
 *                     skuId: { type: string }
 *                     quantity: { type: number }
 *               location: { type: string, enum: [in_shop, away] }
 *               type: { type: string, enum: [pickup, delivery] }
 *               timing:
 *                 type: object
 *                 properties:
 *                   isScheduled: { type: boolean }
 *                   scheduledAt: { type: string, format: date-time }
 *               addressId: { type: string }
 *               paymentPreference:
 *                 type: object
 *                 required: [mode]
 *                 properties:
 *                   mode: { type: string, enum: [post_to_bill, pay_now, cash, cod] }
 *                   method: { type: string, enum: [mpesa_stk, paystack_card], nullable: true }
 *               packagingOptionId: { type: string }
 *               couponCode: { type: string }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post('/admin/create', authenticateToken, requireAdmin, adminCreateOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: List all orders (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         description: Search by invoice number
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully
 */
router.get('/', authenticateToken,authorizeRoles(['admin', 'super_admin', 'vendor_admin', 'branch_admin',"staff"]), getOrders);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order fulfillment status (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);

/**
 * @swagger
 * /api/orders/{id}/assign-rider:
 *   patch:
 *     summary: Assign a rider to the order (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Rider assigned successfully
 */
router.patch('/:id/assign-rider', authenticateToken, requireAdmin, assignRider);

/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     summary: Delete an order (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order deleted successfully
 */
router.delete('/:id', authenticateToken, requireAdmin, deleteOrder);

export default router;
