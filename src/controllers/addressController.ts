import { Request, Response, NextFunction } from 'express';
import Address from '../models/Address';
import User from '../models/User';
import { errorHandler } from '../middleware/errorHandler';

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body;

        if (!name) return next(errorHandler(400, "Address name is required"));
        if (!coordinates || coordinates.lat === undefined || coordinates.lng === undefined) {
            return next(errorHandler(400, "Coordinates lat and lng are required"));
        }
        if (!regions || !regions.country) {
            return next(errorHandler(400, "Region country is required"));
        }
        if (!formatted) return next(errorHandler(400, "Full formatted address is required"));

        const user = await User.findById(req.user?._id);
        if (!user) return next(errorHandler(404, "User not found"));

        const newAddress = new Address({
            userId: req.user?._id,
            name: name.trim(),
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            regions: {
                country: regions.country?.trim(),
                locality: regions.locality?.trim(),
                sublocality: regions.sublocality?.trim(),
                sublocality_level_1: regions.sublocality_level_1?.trim(),
                administrative_area_level_1: regions.administrative_area_level_1?.trim(),
                plus_code: regions.plus_code?.trim(),
                political: regions.political?.trim()
            },
            address: formatted.trim(),
            details: details ?? null,
            isDefault: isDefault || false
        });

        await newAddress.save();

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            data: { address: newAddress }
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map((err: any) => err.message).join(', ');
            return next(errorHandler(400, message));
        }
        next(errorHandler(500, "Server error while creating address"));
    }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const { name, coordinates, regions, address: formatted, details, isDefault } = req.body;

        const address = await Address.findOne({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        if (name !== undefined) address.name = name?.trim() || address.name;

        if (coordinates && coordinates.lat !== undefined && coordinates.lng !== undefined) {
            address.coordinates = {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            };
        }

        if (regions) {
            address.regions = {
                country: regions.country?.trim() ?? address.regions.country,
                locality: regions.locality?.trim() ?? address.regions.locality,
                sublocality: regions.sublocality?.trim() ?? address.regions.sublocality,
                sublocality_level_1: regions.sublocality_level_1?.trim() ?? address.regions.sublocality_level_1,
                administrative_area_level_1: regions.administrative_area_level_1?.trim() ?? address.regions.administrative_area_level_1,
                plus_code: regions.plus_code?.trim() ?? address.regions.plus_code,
                political: regions.political?.trim() ?? address.regions.political
            };
        }

        if (formatted !== undefined) address.address = formatted?.trim() || address.address;
        if (details !== undefined) address.details = details ?? address.details;
        if (isDefault !== undefined) address.isDefault = isDefault;

        await address.save();

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: { address }
        });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map((err: any) => err.message).join(', ');
            return next(errorHandler(400, message));
        }
        next(errorHandler(500, "Server error while updating address"));
    }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const address = await Address.findOneAndDelete({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        res.status(200).json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        next(errorHandler(500, "Server error while deleting address"));
    }
};

export const setDefaultAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const address = await Address.findOne({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));

        address.isDefault = true;
        await address.save();

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            data: { address }
        });
    } catch (error) {
        next(errorHandler(500, "Server error while setting default address"));
    }
};

export const getUserAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const query: any = { userId: req.user?._id };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { address: { $regex: search, $options: "i" } }
            ];
        }

        const options = { 
            page: parseInt(page as string) || 1, 
            limit: parseInt(limit as string) || 10 
        };

        const addresses = await Address.find(query)
            .sort({ isDefault: -1, createdAt: -1 })
            .limit(options.limit)
            .skip((options.page - 1) * options.limit);

        const total = await Address.countDocuments(query);
        const totalPages = Math.ceil(total / options.limit);

        res.status(200).json({ 
            success: true, 
            data: { 
                addresses,
                pagination: {
                    currentPage: options.page,
                    totalPages,
                    totalAddresses: total,
                    hasNextPage: options.page < totalPages,
                    hasPrevPage: options.page > 1
                }
            } 
        });
    } catch (error) {
        next(errorHandler(500, "Server error while retrieving addresses"));
    }
};

export const getAddressById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { addressId } = req.params;
        const address = await Address.findOne({ _id: addressId, userId: req.user?._id });
        if (!address) return next(errorHandler(404, "Address not found"));
        res.status(200).json({ success: true, data: { address } });
    } catch (error) {
        next(errorHandler(500, "Server error while retrieving address"));
    }
};
