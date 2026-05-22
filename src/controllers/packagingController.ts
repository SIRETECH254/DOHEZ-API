import { Request, Response, NextFunction } from 'express';
import Packaging from '../models/Packaging';
import { errorHandler } from '../middleware/errorHandler';

/**
 * Create a new packaging option
 */
export const createPackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, price, isActive = true, isDefault = false, vendor, branch } = req.body || {};

        if (!name || typeof name !== 'string') {
            return next(errorHandler(400, 'Name is required'));
        }

        if (price == null || Number(price) < 0) {
            return next(errorHandler(400, 'Price must be a non-negative number'));
        }

        if (!vendor || !branch) {
            return next(errorHandler(400, 'Vendor and Branch are required'));
        }

        // If making default, unset others for the same vendor/branch
        if (isDefault) {
            await Packaging.updateMany(
                { vendor, branch, isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const packaging = await Packaging.create({
            name: name.trim(),
            price: Number(price),
            isActive: Boolean(isActive),
            isDefault: Boolean(isDefault && isActive),
            vendor,
            branch
        });

        return res.status(201).json({ success: true, data: { packaging } });
    } catch (err: any) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'));
        }
        return next(err);
    }
};

/**
 * Update a packaging option
 */
export const updatePackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, price, isActive, isDefault } = req.body || {};

        const packaging = await Packaging.findById(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));

        const update: any = {};
        if (name != null) update.name = String(name).trim();
        if (price != null) {
            if (Number(price) < 0) return next(errorHandler(400, 'Price must be a non-negative number'));
            update.price = Number(price);
        }
        if (isActive != null) update.isActive = Boolean(isActive);
        if (isDefault != null) update.isDefault = Boolean(isDefault);

        // Handle default flag transitions
        if (update.isDefault === true) {
            // Unset default on others for the same vendor/branch
            await Packaging.updateMany(
                { _id: { $ne: id }, vendor: packaging.vendor, branch: packaging.branch, isDefault: true },
                { $set: { isDefault: false } }
            );
            // Ensure active when default
            update.isActive = true;
        }

        if (update.isActive === false) {
            // If deactivating, cannot remain default
            update.isDefault = false;
        }

        const updatedPackaging = await Packaging.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        return res.json({ success: true, data: { packaging: updatedPackaging } });
    } catch (err: any) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'));
        }
        return next(err);
    }
};

/**
 * Delete a packaging option
 */
export const deletePackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findByIdAndDelete(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));

        // If deleted was default, try auto-promote the lowest-priced active option for the same vendor/branch
        if (packaging.isDefault) {
            const replacement = await Packaging.findOne({ 
                vendor: packaging.vendor, 
                branch: packaging.branch, 
                isActive: true 
            }).sort({ price: 1, name: 1 });
            
            if (replacement) {
                replacement.isDefault = true;
                await replacement.save();
            }
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
};

/**
 * Get all packaging options with filters and pagination
 */
export const getPackagingList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            isDefault,
            minPrice,
            maxPrice,
            vendor,
            branch,
            sort = 'createdAt:desc'
        } = req.query || {};

        const filters: any = {};
        if (search) filters.name = { $regex: search, $options: 'i' };
        if (active !== undefined) filters.isActive = String(active) === 'true';
        if (isDefault !== undefined) filters.isDefault = String(isDefault) === 'true';
        if (vendor) filters.vendor = vendor;
        if (branch) filters.branch = branch;
        
        if (minPrice != null || maxPrice != null) {
            filters.price = {};
            if (minPrice != null) filters.price.$gte = Number(minPrice);
            if (maxPrice != null) filters.price.$lte = Number(maxPrice);
        }

        const [sortField, sortDirRaw] = String(sort).split(':');
        const sortDir = String(sortDirRaw).toLowerCase() === 'asc' ? 1 : -1;

        const skip = (Number(page) - 1) * Number(limit);

        const [data, total] = await Promise.all([
            Packaging.find(filters)
                .collation({ locale: 'en', strength: 2 })
                .sort({ [sortField || 'createdAt']: sortDir })
                .skip(skip)
                .limit(Number(limit)),
            Packaging.countDocuments(filters)
        ]);

        return res.json({
            success: true,
            data: {
                packaging: data,
                pagination: {
                    currentPage: Number(page),
                    pageSize: Number(limit),
                    totalItems: Number(total),
                    totalPages: Math.max(1, Math.ceil(Number(total) / Number(limit)))
                }
            }
        });
    } catch (err) {
        return next(err);
    }
};

/**
 * Get a single packaging option by ID
 */
export const getPackagingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findById(id).populate('vendor branch');
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));
        return res.json({ success: true, data: { packaging } });
    } catch (err) {
        return next(err);
    }
};

/**
 * Set a packaging option as default
 */
export const setDefaultPackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findById(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));
        if (!packaging.isActive) return next(errorHandler(400, 'Cannot set an inactive option as default'));

        // Unset current default for this vendor/branch
        await Packaging.updateMany(
            { _id: { $ne: id }, vendor: packaging.vendor, branch: packaging.branch, isDefault: true },
            { $set: { isDefault: false } }
        );

        packaging.isDefault = true;
        await packaging.save();

        return res.json({ success: true, data: { packaging } });
    } catch (err) {
        return next(err);
    }
};
