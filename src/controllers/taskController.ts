import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Task from "../models/Task";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole, UserRoleType } from "../types";

/**
 * @desc    Create a new task category
 * @route   POST /api/tasks
 * @access  Private (Super Admin)
 */
export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return next(errorHandler(400, "Task name is required"));
    }

    const existingTask = await Task.findOne({ name });
    if (existingTask) {
      return next(errorHandler(400, "Task with this name already exists"));
    }

    const taskData: any = {
      name,
      description,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/tasks");
      taskData.image = uploadResult.url;
      taskData.imagePublicId = uploadResult.public_id;
    }

    const task = await Task.create(taskData);

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all tasks
 * @route   GET /api/tasks
 * @access  Public
 */
export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // For public view, only show active tasks unless 'all' is requested by an admin
    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const tasks = await Task.find(query)
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Task.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        tasks,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalTasks: total,
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
 * @desc    Get single task
 * @route   GET /api/tasks/:taskId
 * @access  Public
 */
export const getTaskById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    res.status(200).json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:taskId
 * @access  Private (Super Admin)
 */
export const updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    if (name) task.name = name;
    if (description !== undefined) task.description = description;
    if (isActive !== undefined) task.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/tasks");
      if (task.imagePublicId) {
        await deleteFromCloudinary(task.imagePublicId);
      }
      task.image = uploadResult.url;
      task.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      // Logic to remove image if explicitly set to null/empty string
      if (task.imagePublicId) {
        await deleteFromCloudinary(task.imagePublicId);
      }
      task.image = null;
      task.imagePublicId = null;
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: { task },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:taskId
 * @access  Private (Super Admin)
 */
export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return next(errorHandler(404, "Task not found"));
    }

    if (task.imagePublicId) {
      await deleteFromCloudinary(task.imagePublicId);
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
