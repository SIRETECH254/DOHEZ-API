import express from 'express';
import {
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getUserAddresses,
    getAddressById
} from '../controllers/addressController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Addresses
 *   description: Address management
 */

/**
 * @swagger
 * /api/addresses:
 *   post:
 *     summary: Create a new address
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, coordinates, regions, address]
 *             properties:
 *               name: { type: string }
 *               coordinates: { type: object, properties: { lat: { type: number }, lng: { type: number } } }
 *               regions: { type: object }
 *               address: { type: string }
 *               details: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201:
 *         description: Address created successfully
 */
router.post('/', authenticateToken, createAddress);

/**
 * @swagger
 * /api/addresses:
 *   get:
 *     summary: List user's addresses
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of addresses
 */
router.get('/', authenticateToken, getUserAddresses);

/**
 * @swagger
 * /api/addresses/{addressId}:
 *   get:
 *     summary: Get address by ID
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address details
 */
router.get('/:addressId', authenticateToken, getAddressById);

/**
 * @swagger
 * /api/addresses/{addressId}:
 *   put:
 *     summary: Update an address
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address updated successfully
 */
router.put('/:addressId', authenticateToken, updateAddress);

/**
 * @swagger
 * /api/addresses/{addressId}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address deleted successfully
 */
router.delete('/:addressId', authenticateToken, deleteAddress);

/**
 * @swagger
 * /api/addresses/{addressId}/default:
 *   patch:
 *     summary: Set an address as default
 *     tags: [Addresses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Default address updated successfully
 */
router.patch('/:addressId/default', authenticateToken, setDefaultAddress);

export default router;
