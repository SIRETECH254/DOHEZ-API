import { Request, Response, NextFunction } from "express";
import { Client } from "@googlemaps/google-maps-services-js";
import { errorHandler } from "../middleware/errorHandler";

const client = new Client({});

/**
 * Search for locations and places using a text query.
 * Calls Google Maps textSearch API.
 */
export const searchLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return next(errorHandler(400, "Query parameter is required and must be a string"));
    }

    const response = await client.textSearch({
      params: {
        query: query,
        key: process.env.GOOGLE_PLACES_API_KEY || '',
      },
      timeout: 1000,
    });

    res.status(200).json({
        success: true,
        data: response.data.results
    });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    next(errorHandler(500, "Failed to fetch location data"));
  }
};
