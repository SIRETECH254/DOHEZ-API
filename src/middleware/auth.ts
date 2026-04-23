import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { IUser, IRole, UserRoleType } from '../types';

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).populate('roles');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware to optionally authenticate JWT token
 * Continues even if token is missing or invalid
 */
export const optionalAuthenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).populate('roles');

    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without req.user if token is invalid
    next();
  }
};

/**
 * Middleware to authorize roles
 */
export const authorizeRoles = (allowedRoles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const roles = req.user.roles as IRole[];
    const hasRole = roles.some((role) => allowedRoles.includes(role.name as UserRoleType));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this action',
      });
    }

    next();
  };
};

/**
 * Middleware to require admin or super_admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const roles = req.user.roles as IRole[];
  const isAdmin = roles.some((role) => ['admin', 'super_admin'].includes(role.name));

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};
