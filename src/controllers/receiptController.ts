import { Request, Response, NextFunction } from "express";
import Receipt from "../models/receiptModel";
import { errorHandler } from "../middleware/errorHandler";

/**
 * @desc    Get all receipts with pagination and search/filtering
 * @route   GET /api/receipts
 */
export const getReceipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, vendor, branch, paymentMethod } = req.query;
    const query: any = {};

    if (search) query.receiptNumber = { $regex: search, $options: "i" };
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const receipts = await Receipt.find(query)
      .populate("order appointment ticket customer vendor branch invoice")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Receipt.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        receipts,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalReceipts: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get single receipt
 * @route   GET /api/receipts/:id
 */
export const getReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate("order appointment ticket customer vendor branch invoice");

    if (!receipt) return next(errorHandler(404, "Receipt not found"));

    res.status(200).json({ success: true, data: { receipt } });
  } catch (error: any) {
    next(error);
  }
};
