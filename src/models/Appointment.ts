import mongoose, { Schema } from "mongoose";
import type { IAppointment, IAppointmentItem } from "../types/index";

const appointmentItemSchema = new Schema<IAppointmentItem>(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    staff: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const appointmentSchema = new Schema<IAppointment>(
  {
    appointmentNumber: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    staff: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    items: [appointmentItemSchema],
    overallStartTime: {
      type: Date,
      required: true,
    },
    overallEndTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "PENDING",
      required: true,
    },
    bookingFeeAmount: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    remainingAmount: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    checkedInAt: {
      type: Date,
    },
    actualEndTime: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Validate that overallEndTime > overallStartTime
appointmentSchema.pre<IAppointment>("save", function (next: any) {
  if (this.overallStartTime && this.overallEndTime) {
    if (this.overallEndTime <= this.overallStartTime) {
      return next(new Error("overallEndTime must be later than overallStartTime"));
    }
  }
  next();
});

const Appointment = mongoose.model<IAppointment>("Appointment", appointmentSchema);

export default Appointment;
