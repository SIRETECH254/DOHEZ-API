import { Request, Response, NextFunction } from 'express';
import Appointment from '../models/Appointment';
import User from '../models/User';
import Product from '../models/Product';
import Break from '../models/Break';
import Branch from '../models/Branch';
import { Types } from 'mongoose';
import { 
  timeToMinutes, 
  isOverlap, 
  minutesToIso, 
  parseDuration 
} from '../utils/availability';

/**
 * Fetch available schedule options based on services and preferences.
 */
export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, branch: branchId, vendor: vendorId, items, preferredStaffs } = req.body;

    if (!date || !branchId || !vendorId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: date, branch, vendor, and items (array) are required."
      });
    }

    // 1. Get branch and working hours for the selected day
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
    const branchWH = (branch.workingHours as any)?.[dayOfWeek];

    if (!branchWH || !branchWH.start || !branchWH.end) {
      return res.status(200).json({
        success: true,
        message: "The branch is closed on the selected date.",
        data: { vendorId, branchId, date, services: [], scheduleOptions: [] }
      });
    }

    const branchStartMin = timeToMinutes(branchWH.start);
    const branchEndMin = timeToMinutes(branchWH.end);

    // 2. Fetch requested products
    const products = await Product.find({
      $or: [
        { _id: { $in: items.filter(id => Types.ObjectId.isValid(id)) } },
        { slug: { $in: items } }
      ],
      branch: branchId
    });

    // Order products as requested in the items array
    const orderedProducts = items.map(id => 
      products.find(p => p._id.toString() === id || p.slug === id)
    ).filter(p => !!p) as any[];

    if (orderedProducts.length === 0) {
      return res.status(404).json({ success: false, message: "No valid products found for the given items." });
    }

    // 3. Identify all qualified staff for each product
    const staffByProduct = new Map<string, any[]>();
    const allQualifiedStaffIds = new Set<string>();

    for (const product of orderedProducts) {
      const staffs = await User.find({
        branch: branchId,
        vendor: vendorId,
        services: product._id,
        isActive: true
      });
      staffByProduct.set(product._id.toString(), staffs);
      staffs.forEach(s => allQualifiedStaffIds.add(s._id.toString()));
    }

    // Fetch full staff details once to have their working hours and info
    const qualifiedStaffList = await User.find({ _id: { $in: Array.from(allQualifiedStaffIds) } });
    const staffMap = new Map(qualifiedStaffList.map(s => [s._id.toString(), s]));

    // 4. Fetch existing appointments and breaks for all qualified staff on that date
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      branch: branchId,
      overallStartTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      "items.staff": { $in: Array.from(allQualifiedStaffIds) }
    });

    const breaks = await Break.find({
      staff: { $in: Array.from(allQualifiedStaffIds) }
    });

    // 5. Availability Logic Process
    const scheduleOptions: any[] = [];
    const searchStep = 15; // Search every 15 minutes for possible start times

    const isStaffAvailable = (staffId: string, startMin: number, endMin: number): boolean => {
      const staff = staffMap.get(staffId);
      if (!staff) return false;

      // Staff working hours check
      const sWH = (staff.workingHours as any)?.[dayOfWeek];
      if (!sWH || !sWH.start || !sWH.end) return false;
      const sStartMin = timeToMinutes(sWH.start);
      const sEndMin = timeToMinutes(sWH.end);
      if (startMin < sStartMin || endMin > sEndMin) return false;

      // Appointment overlaps check
      for (const app of appointments) {
        for (const item of app.items) {
          if (item.staff.toString() === staffId) {
            const aStartMin = item.startTime.getUTCHours() * 60 + item.startTime.getUTCMinutes();
            const aEndMin = item.endTime.getUTCHours() * 60 + item.endTime.getUTCMinutes();
            if (isOverlap(startMin, endMin, aStartMin, aEndMin)) return false;
          }
        }
      }

      // Break overlaps check
      const staffBreaks = breaks.filter(b => b.staff.toString() === staffId);
      for (const b of staffBreaks) {
        const bStartMin = timeToMinutes(b.startTime);
        const bEndMin = timeToMinutes(b.endTime);
        if (isOverlap(startMin, endMin, bStartMin, bEndMin)) return false;
      }

      return true;
    };

    /**
     * Recursive function to find all valid staff/time combinations for the sequential services
     */
    const findOptions = (productIdx: number, currentStartMin: number, currentItems: any[]) => {
      if (productIdx === orderedProducts.length) {
        // All services placed successfully for this start time and staff combination
        const totalDuration = currentItems.reduce((sum, item) => sum + item.durationMinutes, 0);
        const totalAmount = currentItems.reduce((sum, item) => sum + item.amount, 0);
        const bookingFee = 50; // Standard booking fee example

        scheduleOptions.push({
          overallStartTime: minutesToIso(date, currentItems[0].startMin),
          overallEndTime: minutesToIso(date, currentItems[currentItems.length - 1].endMin),
          totalDurationMinutes: totalDuration,
          bookingFeeAmount: bookingFee,
          totalAmount: totalAmount,
          remainingAmount: totalAmount - bookingFee,
          items: currentItems.map(ci => ({
            serviceId: ci.serviceId,
            serviceName: ci.serviceName,
            staffId: ci.staffId,
            staffName: ci.staffName,
            startTime: minutesToIso(date, ci.startMin),
            endTime: minutesToIso(date, ci.endMin),
            durationMinutes: ci.durationMinutes,
            amount: ci.amount
          }))
        });
        return;
      }

      const product = orderedProducts[productIdx];
      const duration = parseDuration(product.duration);
      const buffer = parseDuration(product.buffertime || "0");
      let qualifiedStaffs = staffByProduct.get(product._id.toString()) || [];

      // Priority to preferred staffs if provided
      if (preferredStaffs && Array.isArray(preferredStaffs)) {
        qualifiedStaffs = [...qualifiedStaffs].sort((a, b) => {
          const aPref = preferredStaffs.includes(a._id.toString()) || preferredStaffs.includes(a.email);
          const bPref = preferredStaffs.includes(b._id.toString()) || preferredStaffs.includes(b.email);
          if (aPref && !bPref) return -1;
          if (!aPref && bPref) return 1;
          return 0;
        });
      }

      for (const staff of qualifiedStaffs) {
        const endMin = currentStartMin + duration;
        // Check if item fits in branch hours and staff is available
        if (endMin <= branchEndMin && isStaffAvailable(staff._id.toString(), currentStartMin, endMin)) {
          findOptions(productIdx + 1, endMin + buffer, [
            ...currentItems,
            {
              serviceId: product.slug || product._id.toString(),
              serviceName: product.name,
              staffId: staff._id.toString(),
              staffName: `${staff.firstName} ${staff.lastName}`,
              startMin: currentStartMin,
              endMin: endMin,
              durationMinutes: duration,
              amount: product.price
            }
          ]);
          
          // Safety: If we've found enough variations for this start time, move on
          if (scheduleOptions.length > 100) return;
        }
      }
    };

    // Iterate through the day from branch opening to closing
    for (let time = branchStartMin; time <= branchEndMin - searchStep; time += searchStep) {
      findOptions(0, time, []);
      // Limit total results to keep response size and computation time reasonable
      if (scheduleOptions.length >= 50) break;
    }

    return res.status(200).json({
      success: true,
      message: "Available schedules fetched successfully",
      data: {
        vendorId,
        branchId,
        date,
        services: orderedProducts.map(p => ({
          serviceId: p.slug || p._id.toString(),
          serviceName: p.name
        })),
        scheduleOptions
      }
    });

  } catch (error) {
    next(error);
  }
};
