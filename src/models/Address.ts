import mongoose, { Schema } from 'mongoose';
import { IAddress } from '../types';

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    regions: {
      country: { type: String, required: true },
      locality: { type: String },
      sublocality: { type: String },
      sublocality_level_1: { type: String },
      administrative_area_level_1: { type: String },
      plus_code: { type: String },
      political: { type: String },
    },
    address: { type: String, required: true, trim: true },
    details: { type: String, default: null },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
addressSchema.index({ userId: 1, isDefault: 1 });

// Ensure only one default address per user
addressSchema.pre('save', async function () {
  if (this.isDefault && this.isModified('isDefault')) {
    await (this.constructor as any).updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
});

const Address = mongoose.model<IAddress>('Address', addressSchema);

export default Address;
