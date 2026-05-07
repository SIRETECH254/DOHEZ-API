import express from 'express';
import { searchLocation } from '../controllers/locationController';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Location and place searching via Google Maps
 */

/**
 * @swagger
 * /api/locations/search:
 *   get:
 *     summary: Search for locations and places
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The text query to search for (e.g., "Nairobi", "Pizza near me")
 *     responses:
 *       200:
 *         description: A list of location results from Google Places
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Query parameter is required
 *       500:
 *         description: Failed to fetch location data
 */
router.get('/search', searchLocation);

export default router;
