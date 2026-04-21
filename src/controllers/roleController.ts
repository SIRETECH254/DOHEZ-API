import mongoose, { Types } from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";

/**
 * @desc Get all roles with pagination and search
 * @route GET /api/roles
 * @access Private/Admin
 */
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive, search, page = 1, limit = 10 } = req.query;
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const roles = await Role.find(query)
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Role.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        roles,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalRoles: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching roles"));
  }
};

/**
 * @desc Get single role
 * @route GET /api/roles/:roleId
 * @access Private/Admin
 */
export const getRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.roleId);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }
    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};

/**
 * @desc Create a new role
 * @route POST /api/roles
 * @access Private/Admin
 */
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, displayName, description, permissions } = req.body;
    
    const roleExists = await Role.findOne({ name });
    if (roleExists) {
      return next(errorHandler(400, 'Role already exists'));
    }

    const role = await Role.create({
      name,
      displayName,
      description,
      permissions,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};

/**
 * @desc Update a role
 * @route PUT /api/roles/:roleId
 * @access Private/Admin
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, displayName, description, permissions, isActive } = req.body;
    
    let role = await Role.findById(req.params.roleId);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }

    if (role.isSystemRole && name && name !== role.name) {
      return next(errorHandler(400, 'Cannot change the name of a system role'));
    }

    role = await Role.findByIdAndUpdate(
      req.params.roleId,
      { name, displayName, description, permissions, isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};

/**
 * @desc Delete a role
 * @route DELETE /api/roles/:roleId
 * @access Private/Admin
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.roleId);
    if (!role) {
      return next(errorHandler(404, 'Role not found'));
    }

    if (role.isSystemRole) {
      return next(errorHandler(400, 'System roles cannot be deleted'));
    }

    await role.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};

/**
 * @desc Get users by role
 * @route GET /api/roles/:roleId/users
 * @access Private/Admin
 */
export const getUsersByRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleIdStr = req.params.roleId as string;
    if (!mongoose.isObjectIdOrHexString(roleIdStr)) {
      return next(errorHandler(400, 'Invalid Role ID'));
    }
    const roleId = new Types.ObjectId(roleIdStr);
    const users = await User.find({ roles: roleId }).select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};

/**
 * @desc Get all customers
 * @route GET /api/roles/customer/users
 * @access Private/Admin
 */
export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      return next(errorHandler(404, 'Customer role not found'));
    }

    const users = await User.find({ roles: customerRole._id as Types.ObjectId }).select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    next(errorHandler(500, error.message));
  }
};
