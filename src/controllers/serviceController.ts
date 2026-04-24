import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Service from "../models/Service";
import Task from "../models/Task";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";

/**
 * @desc    Create a new service under a task
 * @route   POST /api/services
 * @access  Private (Super Admin)
 */
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, name, description, isActive } = req.body;

    if (!task || !name) {
      return next(errorHandler(400, "Task and Service name are required"));
    }

    const taskExists = await Task.findById(task);
    if (!taskExists) {
      return next(errorHandler(404, "Parent Task not found"));
    }

    const serviceData: any = {
      task,
      name,
      description,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/services");
      serviceData.image = uploadResult.url;
      serviceData.imagePublicId = uploadResult.public_id;
    }

    const service = await Service.create(serviceData);

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all services
 * @route   GET /api/services
 * @access  Public
 */
export const getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (task) {
      query.task = task;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const services = await Service.find(query)
      .populate("task", "name")
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Service.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        services,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalServices: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get single service
 * @route   GET /api/services/:serviceId
 * @access  Public
 */
export const getServiceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const service = await Service.findById(req.params.serviceId).populate("task", "name description image");

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    res.status(200).json({
      success: true,
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update service
 * @route   PUT /api/services/:serviceId
 * @access  Private (Super Admin)
 */
export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { task, name, description, isActive, image } = req.body;
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (task) {
      const taskExists = await Task.findById(task);
      if (!taskExists) return next(errorHandler(404, "Parent Task not found"));
      service.task = task;
    }
    
    if (name) service.name = name;
    if (description !== undefined) service.description = description;
    if (isActive !== undefined) service.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/services");
      if (service.imagePublicId) {
        await deleteFromCloudinary(service.imagePublicId);
      }
      service.image = uploadResult.url;
      service.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (service.imagePublicId) {
        await deleteFromCloudinary(service.imagePublicId);
      }
      service.image = null;
      service.imagePublicId = null;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: { service },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete service
 * @route   DELETE /api/services/:serviceId
 * @access  Private (Super Admin)
 */
export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return next(errorHandler(404, "Service not found"));
    }

    if (service.imagePublicId) {
      await deleteFromCloudinary(service.imagePublicId);
    }

    await service.deleteOne();

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
