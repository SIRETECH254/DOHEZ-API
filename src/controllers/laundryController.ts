import { Request, Response, NextFunction } from "express";
import Laundry from "../models/Laundry";
import { errorHandler } from "../middleware/errorHandler";

export const getLaundries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, branch, vendor, status, startDate, endDate } = req.query;
    const query: any = {};

    if (search) {
      query.laundryNumber = { $regex: search, $options: "i" };
    }
    if (branch) query.branch = branch;
    if (vendor) query.vendor = vendor;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };
    const laundries = await Laundry.find(query)
      .populate("vendor branch services")
      .populate({
        path: "customer",
        select: "-password -otpCode -resetPasswordToken -resetPasswordExpiry"
      })
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Laundry.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        laundries,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalLaundries: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const laundry = await Laundry.findById(req.params.laundryId)
      .populate("vendor branch services")
      .populate({
        path: "customer",
        select: "-password -otpCode -resetPasswordToken -resetPasswordExpiry"
      });
    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    res.status(200).json({
      success: true,
      data: { laundry }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, pickUpDate, dropDate, location } = req.body;
    const laundry = await Laundry.findById(req.params.laundryId);

    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    if (status) laundry.status = status;
    if (pickUpDate) laundry.pickUpDate = pickUpDate;
    if (dropDate) laundry.dropDate = dropDate;
    if (location) laundry.location = location;

    await laundry.save();

    res.status(200).json({
      success: true,
      message: "Laundry updated successfully",
      data: { laundry }
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const laundry = await Laundry.findByIdAndDelete(req.params.laundryId);
    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    res.status(200).json({
      success: true,
      message: "Laundry request deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
