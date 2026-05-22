import Appointment from "../models/Appointment";

/**
 * Generates a sequential appointment number: APT-YYYY-XXXX.
 */
export const generateAppointmentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Appointment.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `APT-${year}-${String(count + 1).padStart(4, "0")}`;
};
