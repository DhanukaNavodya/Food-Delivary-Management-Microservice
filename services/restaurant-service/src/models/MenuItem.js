import mongoose from 'mongoose';
import { schemaOptions } from '../utils/schema.js';

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: 'General' },
    isAvailable: { type: Boolean, default: true },
    imageUrl: { type: String, trim: true }
  },
  schemaOptions
);

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);
