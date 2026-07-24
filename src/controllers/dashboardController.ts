import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Vendor from '../models/Vendor';
import Order from '../models/Order';
import Branch from '../models/Branch';
import Product from '../models/Product';
import Appointment from '../models/Appointment';
import Ticket from '../models/Ticket';
import Break from '../models/Break';
import Role from '../models/Role';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * Super Admin Dashboard: Global system state
 */
export const getSuperAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalVendors,
      activeVendors,
      totalUsers,
      totalOrders,
      recentOrders,
      recentVendors,
      userRolesSummary
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ isActive: true }),
      User.countDocuments(),
      Order.countDocuments(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({ path: 'customer', select: 'firstName lastName email' })
        .populate({ path: 'vendor', select: 'name' }),
      Vendor.find().sort({ createdAt: -1 }).limit(5).select('name email phone isActive'),
      User.aggregate([
        { $unwind: '$roles' },
        {
          $lookup: {
            from: 'roles',
            localField: 'roles',
            foreignField: '_id',
            as: 'roleInfo'
          }
        },
        { $unwind: '$roleInfo' },
        {
          $group: {
            _id: '$roleInfo.name',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        vendorCounts: {
          total: totalVendors,
          active: activeVendors,
          inactive: totalVendors - activeVendors
        },
        userSummary: {
          total: totalUsers,
          byRole: userRolesSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        },
        orderOverview: {
          total: totalOrders
        },
        recentActivity: {
          latestOrders: recentOrders,
          newVendors: recentVendors
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin Dashboard: User management and operational oversight
 */
export const getAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      activeCustomers,
      orderStatusSummary,
      recentLogins,
      ticketSummary
    ] = await Promise.all([
      User.countDocuments({ isActive: true }), // Simplified for this context
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.find({ lastLoginAt: { $ne: null } })
        .sort({ lastLoginAt: -1 })
        .limit(10)
        .select('firstName lastName email lastLoginAt'),
      Ticket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        managementOverview: {
          activeUsers: activeCustomers,
          orderOverview: orderStatusSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          ticketSummary: ticketSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {})
        },
        operationalFeed: {
          recentUserLogins: recentLogins
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Vendor Admin Dashboard: Vendor-wide resource and branch management
 */
export const getVendorAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user?.vendor;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'User is not associated with a vendor' });
    }

    const [
      branchCount,
      staffCount,
      productCount,
      orderStatusSummary,
      upcomingAppointmentsCount
    ] = await Promise.all([
      Branch.countDocuments({ vendorId }),
      User.countDocuments({ vendor: vendorId }),
      Product.countDocuments({ vendorId }),
      Order.aggregate([
        { $match: { vendor: vendorId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Appointment.countDocuments({
        vendor: vendorId,
        overallStartTime: { $gte: new Date() }
      })
    ]);

    return res.json({
      success: true,
      data: {
        resourceSummary: {
          branchCount,
          staffCount,
          inventorySummary: {
            totalProducts: productCount
          }
        },
        operationalSummary: {
          globalOrderStates: orderStatusSummary.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          upcomingAppointments: upcomingAppointmentsCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Branch Admin Dashboard: Real-time branch operations and fulfillment
 */
export const getBranchAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.user?.branch;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'User is not associated with a branch' });
    }

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const [
      ordersToday,
      activeStaffCount,
      pendingOrders,
      todaysAppointments,
      staffOnBreakCount
    ] = await Promise.all([
      Order.countDocuments({
        branch: branchId,
        createdAt: { $gte: start, $lte: end }
      }),
      User.countDocuments({ branch: branchId, isActive: true }),
      Order.find({
        branch: branchId,
        status: { $in: ['PLACED', 'CONFIRMED'] }
      })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate({ path: 'customer', select: 'firstName lastName' }),
      Appointment.find({
        branch: branchId,
        overallStartTime: { $gte: start, $lte: end }
      })
        .sort({ overallStartTime: 1 })
        .populate({ path: 'customer', select: 'firstName lastName' })
        .populate({ path: 'staff', select: 'firstName lastName' }),
      Break.countDocuments({
        branch: branchId,
        endTime: null // Assuming endTime null means they are currently on break
      })
    ]);

    return res.json({
      success: true,
      data: {
        branchStats: {
          ordersToday,
          activeStaff: activeStaffCount
        },
        fulfillmentQueue: {
          currentOrders: pendingOrders,
          todaysAppointments: todaysAppointments
        },
        breakStatus: {
          staffOnBreak: staffOnBreakCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Staff Dashboard: Personal tasks and immediate responsibilities
 */
export const getStaffDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const [
      myAppointments,
      assignedTasksCount,
      activeBreak
    ] = await Promise.all([
      Appointment.find({
        staff: userId,
        overallStartTime: { $gte: start }
      })
        .sort({ overallStartTime: 1 })
        .populate({ path: 'customer', select: 'firstName lastName' }),
      Order.countDocuments({
        'items.staff': userId, // This depends on how tasks are assigned to staff in orders
        status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED'] }
      }),
      Break.findOne({
        userId,
        endTime: null
      })
    ]);

    return res.json({
      success: true,
      data: {
        myQueue: {
          myAppointments,
          assignedTasks: assignedTasksCount
        },
        schedule: {
          workingHours: req.user?.workingHours || {},
          currentStatus: activeBreak ? 'On Break' : 'On Duty'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
