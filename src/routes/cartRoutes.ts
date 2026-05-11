import express from 'express';
import { getCart, addToCart, updateQuantity, removeItem, clearCart } from '../controllers/cartController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get user cart
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Success }
 */
router.get('/', authenticateToken, getCart);

/**
 * @swagger
 * /api/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendorId, branchId, productId, skuId, quantity, priceAtAddition]
 *             properties:
 *               vendorId: { type: string }
 *               branchId: { type: string }
 *               productId: { type: string }
 *               skuId: { type: string }
 *               quantity: { type: number }
 *               priceAtAddition: { type: number }
 *               variants: { type: array, items: { type: object } }
 *               modifiers: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: Success }
 */
router.post('/add', authenticateToken, addToCart);

/**
 * @swagger
 * /api/cart/update:
 *   put:
 *     summary: Update quantity
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchId, cartItemId, quantity]
 *             properties:
 *               branchId: { type: string, description: "ID of the branch group" }
 *               cartItemId: { type: string, description: "Unique ID of the specific item configuration (_id from cart item)" }
 *               quantity: { type: number, description: "New quantity" }
 *     responses:
 *       200: { description: Success }
 */
router.put('/update', authenticateToken, updateQuantity);

/**
 * @swagger
 * /api/cart/remove:
 *   delete:
 *     summary: Remove item
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchId, cartItemId]
 *             properties:
 *               branchId: { type: string, description: "ID of the branch group" }
 *               cartItemId: { type: string, description: "Unique ID of the specific item configuration to remove" }
 *     responses:
 *       200: { description: Success }
 */
router.delete('/remove', authenticateToken, removeItem);

/**
 * @swagger
 * /api/cart/clear:
 *   delete:
 *     summary: Clear full cart
 *     tags: [Cart]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Success }
 */
router.delete('/clear', authenticateToken, clearCart);

export default router;
