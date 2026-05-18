import Branch from "../models/Branch";
import User from "../models/User";
import Appointment from "../models/Appointment";
import Break from "../models/Break";

/**
 * Utility: Convert HH:MM time string to minutes since midnight
 */
export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/**
 * Utility: Check if two time ranges overlap
 */
export const isOverlap = (s1: number, e1: number, s2: number, e2: number): boolean => {
  return s1 < e2 && e1 > s2;
};

/**
 * Utility: Check if two Date ranges overlap
 */
export const isOverlapDate = (s1: Date, e1: Date, s2: Date, e2: Date): boolean => {
  return s1 < e2 && e1 > s2;
};

/**
 * Utility: Convert minutes to ISO date string for a specific date (UTC)
 */
export const minutesToIso = (dateStr: string, minutes: number): string => {
  const d = new Date(dateStr);
  d.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
};

/**
 * Utility: Parse duration string (could be minutes "180" or HH:MM "03:00")
 */
export const parseDuration = (d: string | null | undefined): number => {
  if (d === null || d === undefined || d === "") return 30;
  if (d.includes(':')) return timeToMinutes(d);
  const parsed = parseInt(d, 10);
  return isNaN(parsed) ? 30 : parsed;
};

export interface OptionItem {
  serviceId: string; // Product ID
  staffId: string;
  startTime: Date;
  endTime: Date;
}

/**
 * Validates if a specific set of service slots (an "option") is still available.
 * Checks branch/staff working hours, qualifications, and overlapping appointments/breaks.
 */
export const validateOptionAvailability = async (
  branchId: string,
  vendorId: string,
  items: OptionItem[],
  excludeAppointmentId?: string
): Promise<{ ok: boolean; message?: string }> => {
  try {
    // 1. Fetch Resources
    const branch = await Branch.findById(branchId);
    if (!branch) return { ok: false, message: "Branch not found" };

    const staffIds = Array.from(new Set(items.map(i => i.staffId)));
    const staffs = await User.find({ _id: { $in: staffIds }, branch: branchId });
    const staffMap = new Map(staffs.map(s => [s._id.toString(), s]));

    // 2. Query existing appointments and breaks once
    const minDate = new Date(Math.min(...items.map(i => i.startTime.getTime())));
    const maxDate = new Date(Math.max(...items.map(i => i.endTime.getTime())));

    const appointments = await Appointment.find({
      branch: branchId,
      status: { $in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      overallStartTime: { $lt: maxDate },
      overallEndTime: { $gt: minDate },
      ...(excludeAppointmentId && { _id: { $ne: excludeAppointmentId } as any })
    });

    const breaks = await Break.find({ staff: { $in: staffIds } });

    // 3. Validate each item in the option
    for (const item of items) {
      const staff = staffMap.get(item.staffId);
      if (!staff) return { ok: false, message: `Staff not found or not assigned to this branch` };

      // Qualification check
      const isQualified = staff.services?.some(s => s.toString() === item.serviceId);
      if (!isQualified) {
        return { ok: false, message: `Staff ${staff.firstName} does not provide the requested service` };
      }

      const itemStartMin = item.startTime.getUTCHours() * 60 + item.startTime.getUTCMinutes();
      const itemEndMin = item.endTime.getUTCHours() * 60 + item.endTime.getUTCMinutes();
      const dayOfWeek = item.startTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();

      // Branch Working Hours
      const bWH = (branch.workingHours as any)?.[dayOfWeek];
      if (!bWH || !bWH.start || !bWH.end) {
        return { ok: false, message: `Branch is closed on this day` };
      }
      if (itemStartMin < timeToMinutes(bWH.start) || itemEndMin > timeToMinutes(bWH.end)) {
        return { ok: false, message: `Appointment time is outside branch working hours` };
      }

      // Staff Working Hours
      const sWH = (staff.workingHours as any)?.[dayOfWeek];
      if (!sWH || !sWH.start || !sWH.end) {
        return { ok: false, message: `Staff ${staff.firstName} is not working on this day` };
      }
      if (itemStartMin < timeToMinutes(sWH.start) || itemEndMin > timeToMinutes(sWH.end)) {
        return { ok: false, message: `Staff ${staff.firstName} is not working during the requested time` };
      }

      // Appointment Overlap
      const hasAppointmentConflict = appointments.some(app => 
        app.items.some(appItem => 
          appItem.staff.toString() === item.staffId && 
          isOverlapDate(item.startTime, item.endTime, appItem.startTime, appItem.endTime)
        )
      );
      if (hasAppointmentConflict) {
        return { ok: false, message: `Staff ${staff.firstName} is already booked during this time` };
      }

      // Break Overlap
      const hasBreakConflict = breaks.some(b => 
        b.staff.toString() === item.staffId && 
        isOverlap(itemStartMin, itemEndMin, timeToMinutes(b.startTime), timeToMinutes(b.endTime))
      );
      if (hasBreakConflict) {
        return { ok: false, message: `Staff ${staff.firstName} has a break during this time` };
      }
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, message: error.message || "An error occurred during availability validation" };
  }
};
