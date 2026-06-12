import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import Vendor from "../models/Vendor";
import Branch from "../models/Branch";
import { generateTokens, generateOTP } from "../utils/authHelpers";
import {
  sendOTPNotification,
  sendPasswordResetNotification,
  sendWelcomeNotification
} from "../services/internal/notificationService";


/**
 * Register a new user with OTP verification
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role
    }: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      role?: string;
    } = req.body;

    // Basic required field validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return next(errorHandler(400, "All fields are required"));
    }

    // Validate email and phone formats
    if (!validator.isEmail(email)) {
      return next(errorHandler(400, "Please provide a valid email"));
    }

    // Check for existing user by email or phone
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      return next(errorHandler(400, "User already exists with this email or phone"));
    }

    // Hash password and generate OTP
    const hashedPassword = bcrypt.hashSync(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    let assignedRoles: any[] = [];
    // Resolve role assignment (default customer)
    if (role) {
      const specifiedRole = await Role.findOne({ name: role.toLowerCase() });
      if (specifiedRole) {
        assignedRoles = [specifiedRole._id];
      } else {
        return next(errorHandler(400, `Role "${role}" not found`));
      }
    } else {
      const customerRole = await Role.findOne({ name: "customer" });
      if (!customerRole) {
        return next(
          errorHandler(500, "Default customer role not found. Please run seed script first.")
        );
      }
      assignedRoles = [customerRole._id];
    }

    // Persist user with OTP details
    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      roles: assignedRoles,
      otpCode: otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // Send OTP via email and SMS
    await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
    
    await user.populate("roles", "name displayName");

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your account with the OTP sent.",
      data: {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
        isVerified: user.isVerified
      }
    });
  } catch (error: any) {
    console.error("Register error:", error);
    next(errorHandler(500, "Server error during registration"));
  }
};

/**
 * Verify OTP and activate account
 */
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, otp }: { email?: string; phone?: string; otp: string } = req.body;

    if (!otp) {
      return next(errorHandler(400, "OTP is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+otpCode +otpExpiry");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return next(errorHandler(400, "OTP has expired. Please request a new one"));
    }

    if (user.otpCode !== otp.trim()) {
      return next(errorHandler(400, "Incorrect OTP code"));
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    await sendWelcomeNotification(user.email, user.phone, `${user.firstName} ${user.lastName}`);
    await user.populate("roles", "name displayName");

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    next(errorHandler(500, "Server error during OTP verification"));
  }
};

/**
 * Resend OTP for verification
 */
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Account is already verified"));
    }

    const otp = generateOTP();
    const otpExpiry = new Date(
      Date.now() + parseInt(process.env.OTP_EXP_MINUTES || "10", 10) * 60 * 1000
    );

    user.otpCode = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTPNotification(user.email, user.phone, otp, `${user.firstName} ${user.lastName}`);

    res.status(200).json({
      success: true,
      message: "OTP has been resent to your email and phone",
      data: {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        otpExpiry
      }
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    next(errorHandler(500, "Server error during OTP resend"));
  }
};

/**
 * User login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, password }: { email?: string; phone?: string; password: string } = req.body;

    if (!password) {
      return next(errorHandler(400, "Password is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return next(errorHandler(401, email ? "Email does not exist" : "Phone does not exist"));
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Invalid password"));
    }

    if (!user.isVerified) {
      return next(errorHandler(403, "Please verify your account before logging in"));
    }

    if (!user.isActive) {
      return next(errorHandler(403, "Account is deactivated. Please contact support."));
    }

    user.lastLoginAt = new Date();
    await user.save();

    await user.populate("roles", "name displayName");
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    next(errorHandler(500, "Server error during login"));
  }
};

/**
 * Admin/Staff Login with conditional populated fields
 */
export const loginAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, password }: { email?: string; phone?: string; password: string } = req.body;

    if (!password) {
      return next(errorHandler(400, "Password is required"));
    }

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return next(errorHandler(401, email ? "Email does not exist" : "Phone does not exist"));
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Invalid password"));
    }

    if (!user.isVerified) {
      return next(errorHandler(403, "Please verify your account before logging in"));
    }

    if (!user.isActive) {
      return next(errorHandler(403, "Account is deactivated. Please contact support."));
    }

    user.lastLoginAt = new Date();
    await user.save();

    // Populate roles, vendor, and branch
    await user.populate([
      { path: "roles" },
      { path: "vendor" },
      { path: "branch" }
    ]);

    // Check if the user has admin/staff privileges
    const roles = user.roles as any[];
    const hasAdminPrivileges = roles.some(role => role.name !== "customer");

    if (!hasAdminPrivileges) {
      return next(errorHandler(403, "Access denied. You do not have administrative privileges."));
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Prepare response data
    const responseData: any = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    };

    // Add roles if exist
    if (user.roles && (user.roles as any).length > 0) {
      responseData.roles = user.roles;
    }

    // Verify vendor exists before adding to response
    if (user.vendor && (user.vendor as any)._id) {
      const vendor = await Vendor.findById((user.vendor as any)._id);
      if (vendor) {
        responseData.vendor = user.vendor;
      }
    }

    // Verify branch exists before adding to response
    if (user.branch && (user.branch as any)._id) {
      const branch = await Branch.findById((user.branch as any)._id);
      if (branch) {
        responseData.branch = user.branch;
      }
    }

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: responseData
    });
  } catch (error: any) {
    console.error("Login Admin error:", error);
    next(errorHandler(500, "Server error during admin login"));
  }
};

/**
 * Logout user
 */
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    next(errorHandler(500, "Server error during logout"));
  }
};

/**
 * Forgot password request
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(errorHandler(400, "Email is required"));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return next(errorHandler(404, "No user found with this email"));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetExpiry;
    await user.save();

    await sendPasswordResetNotification(
      user.email,
      user.phone,
      resetToken,
      `${user.firstName} ${user.lastName}`
    );

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email and phone"
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    next(errorHandler(500, "Server error during password reset request"));
  }
};

/**
 * Reset password
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return next(errorHandler(400, "Token and new password are required"));
    }

    // Check if token exists
    const user = await User.findOne({ resetPasswordToken: token }).select("+password");

    if (!user) {
      return next(errorHandler(400, "Invalid reset token"));
    }

    // Check if token is expired
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
      return next(errorHandler(400, "Reset token has expired"));
    }

    user.password = bcrypt.hashSync(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    next(errorHandler(500, "Server error during password reset"));
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(errorHandler(400, "Refresh token is required"));
    }

    const decoded = jwt.verify(
      refreshToken,
      (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string
    ) as any;

    const user = await User.findById(decoded.userId).populate("roles");
    if (!user || !user.isActive) {
      return next(errorHandler(403, "User not found or inactive"));
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: tokens
    });
  } catch (error: any) {
    console.error("Refresh token error:", error);
    next(errorHandler(403, "Invalid refresh token"));
  }
};

/**
 * Get current user profile
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId).populate("roles").select("-password -otpCode -resetPasswordToken");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          isVerified: user.isVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error("Get me error:", error);
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};

/**
 * googlecallback
 */
export const googleAuthCallback = (req: Request, res: Response) => {
  const user = req.user as any;

  if (!user) {
    return res.status(401).json({ message: "Authentication failed" });
  }

  // Create the JWT
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.emails?.[0].value,
      name: user.displayName 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' } // Token valid for 7 days
  );

  // Redirect to your Frontend
  const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendURL}/auth-success?token=${token}`);
};

