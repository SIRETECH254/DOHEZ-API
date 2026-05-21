import { Request, Response, NextFunction } from "express";
import Ticket from "../models/Ticket";
import { errorHandler } from "../middleware/errorHandler";

/**
 * @desc    Get all tickets with pagination and search/filtering
 * @route   GET /api/tickets
 */
export const getTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, vendor, branch, event, type, status } = req.query;
    const query: any = {};

    if (search) query.ticketNumber = { $regex: search, $options: "i" };
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (event) query.event = event;
    if (type) query.type = type;
    if (status) query.status = status;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const tickets = await Ticket.find(query)
      .populate({
        path: "event",
        populate: {
          path: "variants"
        }
      })
      .populate("vendor")
      .populate("branch")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Ticket.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalTickets: total,
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
 * @desc    Get single ticket
 * @route   GET /api/tickets/:id
 */
export const getTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate({
        path: "event",
        populate: {
          path: "variants"
        }
      })
      .populate("vendor")
      .populate("branch");

    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    res.status(200).json({ success: true, data: { ticket } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update ticket
 * @route   PUT /api/tickets/:id
 */
export const updateTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, details } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    if (ticket.status === 'USED') {
      return next(errorHandler(400, "Cannot update a ticket that has already been used"));
    }

    if (status) ticket.status = status;
    if (details) {
      ticket.details = {
        name: details.name || ticket.details.name,
        email: details.email || ticket.details.email,
        phone: details.phone || ticket.details.phone,
      };
    }

    await ticket.save();

    res.status(200).json({ success: true, data: { ticket } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete ticket
 * @route   DELETE /api/tickets/:id
 */
export const deleteTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return next(errorHandler(404, "Ticket not found"));

    res.status(200).json({ success: true, message: "Ticket deleted successfully" });
  } catch (error: any) {
    next(error);
  }
};
