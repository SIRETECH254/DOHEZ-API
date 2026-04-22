import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import User from "../models/User";
import Role from "../models/Role";
import { errorHandler } from "../middleware/errorHandler";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles");

    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) return next(errorHandler(404, "User not found"));

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      if (!validator.isMobilePhone(phone)) return next(errorHandler(400, "Please provide a valid phone number"));
      user.phone = phone;
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return next(errorHandler(400, "Current password and new password are required"));

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) return next(errorHandler(404, "User not found"));

    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) return next(errorHandler(400, "Current password is incorrect"));

    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    next(error);
  }
};

export const getNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("notificationPreferences");
    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      data: {
        notificationPreferences: user.notificationPreferences || {}
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, sms, inApp } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) return next(errorHandler(404, "User not found"));

    user.notificationPreferences = {
      email: email !== undefined ? email : user.notificationPreferences?.email,
      sms: sms !== undefined ? sms : user.notificationPreferences?.sms,
      inApp: inApp !== undefined ? inApp : user.notificationPreferences?.inApp,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Preferences updated",
      data: {
        notificationPreferences: user.notificationPreferences
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
      
    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalUsers: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles");

    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone, email, isActive, avatar } = req.body;
    const user = await User.findById(req.params.userId);
    
    if (!user) return next(errorHandler(404, "User not found"));

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/avatars");

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === "string" && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === "string" && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous avatar:", deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { isActive }, { new: true });
    
    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      message: "Status updated"
    });
  } catch (error: any) {
    next(error);
  }
};

export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return next(errorHandler(404, "User not found"));
    
    const role = await Role.findOne({ name: "admin" });
    if (!role) return next(errorHandler(404, "Role not found"));
    
    user.roles = [role._id as any];
    await user.save();

    res.status(200).json({
      success: true,
      message: "User is now admin"
    });
  } catch(error: any) {
    next(error);
  }
};

export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).populate("roles");
    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      data: {
        roles: user.roles
      }
    });
  } catch(error: any) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      message: "User deleted"
    });
  } catch(error: any) {
    next(error);
  }
};

export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    const role = await Role.findOne({ name: "customer" });
    if (!role) return next(errorHandler(404, "Customer role not found"));
    
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password: bcrypt.hashSync(phone, 12),
      roles: [role._id]
    });

    res.status(201).json({
      success: true,
      data: {
        user
      }
    });
  } catch(error: any) {
    next(error);
  }
};

export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleName } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return next(errorHandler(404, "User not found"));
    
    const role = await Role.findOne({ name: roleName });
    if (!role) return next(errorHandler(404, "Role not found"));
    
    user.roles = [...(user.roles as any[]), role._id];
    await user.save();

    res.status(200).json({
      success: true,
      message: "Role assigned"
    });
  } catch(error: any) {
    next(error);
  }
};

export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return next(errorHandler(404, "User not found"));
    
    user.roles = (user.roles as any[]).filter(r => r.toString() !== req.params.roleId);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Role removed"
    });
  } catch(error: any) {
    next(error);
  }
};

export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = await Role.findOne({ name: "customer" });
    const users = await User.find({ roles: role?._id });

    res.status(200).json({
      success: true,
      data: {
        users
      }
    });
  } catch(error: any) {
    next(error);
  }
};

export const getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = await Role.findOne({ name: "staff" });
    const users = await User.find({ roles: role?._id });

    res.status(200).json({
      success: true,
      data: {
        users
      }
    });
  } catch(error: any) {
    next(error);
  }
};
