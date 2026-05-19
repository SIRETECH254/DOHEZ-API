import { Request, Response, NextFunction } from 'express';
import Appointment from '../models/Appointment';
import Branch from '../models/Branch';
import User from '../models/User';
import Product from '../models/Product';
import Vendor from '../models/Vendor';
import Service from '../models/Service';
import { errorHandler } from '../middleware/errorHandler';
import { validateOptionAvailability, OptionItem } from '../utils/availability';
import { generateAppointmentNumber } from '../utils/appointment';
import mongoose from 'mongoose';

/**
 * Create a new appointment (Customer)
 */
export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch: branchId, vendor: vendorId, items, bookingFeeAmount = 50 } = req.body;
    const customerId = req.user?._id;

    if (!branchId || !vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields: branch, vendor, and items." });
    }

    // 0. Validate Branch and Vendor
    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    
    // Check if branch belongs to vendor (Branch model uses vendorId)
    if (branch.vendorId.toString() !== vendorId) {
      return next(errorHandler(400, "Branch does not belong to the specified vendor"));
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    // 1. Prepare items for validation and storage
    const processedItems = [];
    const validationItems: OptionItem[] = [];

    for (const item of items) {
      const { serviceId, staffId, startTime, endTime } = item;
      
      // Resolve Product and verify it belongs to the branch
      const product = await Product.findById(serviceId);

      if (!product) {
        return next(errorHandler(404, `Product/Service not found: ${serviceId}`));
      }

      if (product.branch.toString() !== branchId || product.vendor.toString() !== vendorId) {
        return next(errorHandler(400, `Product ${product.name} does not belong to this branch/vendor`));
      }

      const amount = item.amount || product.price;
      const durationMinutes = item.durationMinutes;

      // Validate Staff
      const staff = await User.findById(staffId);
      if (!staff) return next(errorHandler(404, `Staff not found: ${staffId}`));
      
      // Check if staff belongs to the branch
      if (staff.branch?.toString() !== branchId) {
        return next(errorHandler(400, `Staff ${staff.firstName} ${staff.lastName} does not belong to this branch`));
      }

      if (!serviceId || !staffId || !startTime || !endTime) {
        return res.status(400).json({ success: false, message: "Each item must have service/product, staff, startTime, and endTime." });
      }

      validationItems.push({
        serviceId: serviceId,
        staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });

      processedItems.push({
        service: serviceId,
        staff: staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes: durationMinutes || (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000,
        amount: amount || 0
      });
    }

    // 2. Validate availability
    const availability = await validateOptionAvailability(branchId, vendorId, validationItems);
    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    // 3. Calculate totals
    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    const overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));

    // 4. Generate appointment
    const appointment = await Appointment.create({
      appointmentNumber: await generateAppointmentNumber(),
      customer: customerId,
      branch: branchId,
      vendor: vendorId,
      staff: Array.from(new Set(processedItems.map(i => i.staff))),
      items: processedItems,
      overallStartTime,
      overallEndTime,
      status: "PENDING",
      bookingFeeAmount,
      remainingAmount: totalAmount - bookingFeeAmount
    });

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new appointment by Admin
 */
export const createAppointmentByAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, branch: branchId, vendor: vendorId, items, bookingFeeAmount = 0, status = "CONFIRMED" } = req.body;

    if (!customerId || !branchId || !vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields: customerId, branch, vendor, and items." });
    }

    // 0. Validate Branch and Vendor
    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    if (branch.vendorId.toString() !== vendorId) {
      return next(errorHandler(400, "Branch does not belong to the specified vendor"));
    }
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    const processedItems = [];
    const validationItems: OptionItem[] = [];

    for (const item of items) {
      const { serviceId, staffId, startTime, endTime, amount, durationMinutes } = item;
      
      // Verify product/service exists for this branch
      const product = await Product.findById(serviceId);
      if (!product) {
        return next(errorHandler(404, `Product not found: ${serviceId}`));
      }
      if (product.branch.toString() !== branchId || product.vendor.toString() !== vendorId) {
        return next(errorHandler(400, `Product ${product.name} does not belong to this branch/vendor`));
      }

      // Validate Staff
      const staff = await User.findById(staffId);
      if (!staff) return next(errorHandler(404, `Staff not found: ${staffId}`));
      if (staff.branch?.toString() !== branchId) {
        return next(errorHandler(400, `Staff ${staff.firstName} ${staff.lastName} does not belong to this branch`));
      }

      validationItems.push({
        serviceId,
        staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });

      processedItems.push({
        service: serviceId,
        staff: staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes: durationMinutes || (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000,
        amount: amount || 0
      });
    }

    const availability = await validateOptionAvailability(branchId, vendorId, validationItems);
    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    const overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));

    const appointment = await Appointment.create({
      appointmentNumber: await generateAppointmentNumber(),
      customer: customerId,
      branch: branchId,
      vendor: vendorId,
      staff: Array.from(new Set(processedItems.map(i => i.staff))),
      items: processedItems,
      overallStartTime,
      overallEndTime,
      status,
      bookingFeeAmount,
      remainingAmount: totalAmount - bookingFeeAmount
    });

    res.status(201).json({
      success: true,
      message: "Appointment created by admin successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reschedule an appointment
 */
export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items are required for rescheduling." });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    // Authorization check
    const isOwner = appointment.customer.toString() === req.user?._id.toString();
    const isAdmin = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'].some(role => 
      req.user?.roles.some((r: any) => (typeof r === 'string' ? r : r.name) === role)
    );

    if (!isOwner && !isAdmin) return next(errorHandler(403, "Not authorized to reschedule this appointment"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be rescheduled"));
    }

    const validationItems: OptionItem[] = items.map(i => ({
      serviceId: i.serviceId,
      staffId: i.staffId,
      startTime: new Date(i.startTime),
      endTime: new Date(i.endTime)
    }));

    const availability = await validateOptionAvailability(
      appointment.branch.toString(),
      appointment.vendor.toString(),
      validationItems,
      id as string
    );

    if (!availability.ok) {
      return res.status(400).json({ success: false, message: availability.message });
    }

    const processedItems = items.map(i => ({
      service: i.serviceId,
      staff: i.staffId,
      startTime: new Date(i.startTime),
      endTime: new Date(i.endTime),
      durationMinutes: i.durationMinutes || (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000,
      amount: i.amount || 0
    }));

    const totalAmount = processedItems.reduce((sum, item) => sum + item.amount, 0);
    appointment.items = processedItems as any;
    appointment.overallStartTime = new Date(Math.min(...processedItems.map(i => i.startTime.getTime())));
    appointment.overallEndTime = new Date(Math.max(...processedItems.map(i => i.endTime.getTime())));
    appointment.remainingAmount = totalAmount - appointment.bookingFeeAmount;
    appointment.staff = Array.from(new Set(processedItems.map(i => i.staff))) as any;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an appointment
 */
export const cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    const isOwner = appointment.customer.toString() === req.user?._id.toString();
    const isAdmin = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'].some(role => 
      req.user?.roles.some((r: any) => (typeof r === 'string' ? r : r.name) === role)
    );

    if (!isOwner && !isAdmin) return next(errorHandler(403, "Not authorized to cancel this appointment"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be cancelled"));
    }

    // Check if cancellation is at least 2 hours before start time
    const now = new Date();
    const startTime = new Date(appointment.overallStartTime);
    const diffInMilliseconds = startTime.getTime() - now.getTime();
    const diffInHours = diffInMilliseconds / (1000 * 60 * 60);

    if (diffInHours < 2) {
      return next(errorHandler(400, "Cancellations must be at least 2 hours before the appointment start time"));
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment cancelled successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Check-in for an appointment
 */
export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be checked in"));
    }

    // Check if check-in is on the same day
    const now = new Date();
    const appointmentDate = new Date(appointment.overallStartTime);
    
    const isSameDay = 
      now.getFullYear() === appointmentDate.getFullYear() &&
      now.getMonth() === appointmentDate.getMonth() &&
      now.getDate() === appointmentDate.getDate();

    if (!isSameDay) {
      return next(errorHandler(400, "Check-in is only allowed on the same day as the appointment"));
    }

    appointment.checkedInAt = new Date();
    // Optionally update status to CONFIRMED or IN_PROGRESS if we add that status
    await appointment.save();

    res.status(200).json({ success: true, message: "Checked in successfully", checkedInAt: appointment.checkedInAt });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete an appointment
 */
export const completeAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    appointment.status = "COMPLETED";
    appointment.actualEndTime = new Date();
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment completed successfully", actualEndTime: appointment.actualEndTime });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark appointment as No-Show
 */
export const markNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    // Check if appointment is confirmed
    if (appointment.status !== "CONFIRMED") {
      return next(errorHandler(400, "Only confirmed appointments can be marked as No-Show"));
    }

    appointment.status = "NO_SHOW";
    await appointment.save();

    res.status(200).json({ success: true, message: "Appointment marked as No-Show" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all appointments (Admin/Staff)
 */
export const getAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      branch: branchId, 
      vendor: vendorId, 
      staff: staffId,
      status, 
      startDate, 
      endDate, 
      search,
      page = 1, 
      limit = 10 
    } = req.query;
    
    const query: any = {};

    if (branchId) query.branch = branchId;
    if (vendorId) query.vendor = vendorId;
    if (staffId) query.staff = staffId;
    if (status) query.status = status;
    
    if (search) {
      query.appointmentNumber = { $regex: search, $options: "i" };
    }

    if (startDate || endDate) {
      query.overallStartTime = {};
      if (startDate) query.overallStartTime.$gte = new Date(startDate as string);
      if (endDate) query.overallStartTime.$lte = new Date(endDate as string);
    }

    const options = { 
      page: parseInt(page as string) || 1, 
      limit: parseInt(limit as string) || 10 
    };

    const appointments = await Appointment.find(query)
      .populate('customer')
      .populate('branch')
      .populate('items.service')
      .populate('items.staff')
      .sort({ overallStartTime: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalAppointments: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my appointments (Customer)
 */
export const getMyAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user?._id;
    const { 
      branch: branchId, 
      vendor: vendorId, 
      staff: staffId,
      status, 
      search,
      page = 1, 
      limit = 10 
    } = req.query;

    const query: any = { customer: customerId };

    if (branchId) query.branch = branchId;
    if (vendorId) query.vendor = vendorId;
    if (staffId) query.staff = staffId;
    if (status) query.status = status;
    
    if (search) {
      query.appointmentNumber = { $regex: search, $options: "i" };
    }

    const options = { 
      page: parseInt(page as string) || 1, 
      limit: parseInt(limit as string) || 10 
    };

    const appointments = await Appointment.find(query)
      .populate('branch')
      .populate('items.service')
      .populate('items.staff')
      .sort({ overallStartTime: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Appointment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
      success: true, 
      data: {
        appointments,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalAppointments: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointment by ID
 */
export const getAppointmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id)
      .populate('customer')
      .populate('branch')
      .populate('vendor')
      .populate('items.service')
      .populate('items.staff');

    if (!appointment) return next(errorHandler(404, "Appointment not found"));

    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};
