import mongoose from 'mongoose';
import { schemaOptions } from '../utils/schema.js';

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    cuisine: { type: String, required: true, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true }
    },
    phone: { type: String, trim: true },
    // Id of the RESTAURANT_OWNER user in the Auth Service.
    ownerId: { type: String, index: true },
    isOpen: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    deliveryFee: { type: Number, min: 0, default: 250 },
    minOrderAmount: { type: Number, min: 0, default: 0 },
    openingHours: { type: String, trim: true }
  },
  schemaOptions
);

export const Restaurant = mongoose.model('Restaurant', restaurantSchema);
