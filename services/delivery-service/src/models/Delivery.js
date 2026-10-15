import mongoose from 'mongoose';
import { schemaOptions } from '../utils/schema.js';

export const DELIVERY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

// Allowed next statuses for PATCH /:id/status (assignment uses PATCH /:id/assign).
export const DELIVERY_TRANSITIONS = Object.freeze({
  PENDING: ['CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'FAILED', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: []
});

const addressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    postalCode: String
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    restaurantId: { type: String, required: true, index: true },
    restaurantOwnerId: { type: String, index: true },
    customerUserId: { type: String, index: true },
    driverId: { type: String, index: true },
    driverName: String,
    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.PENDING, index: true },
    pickupAddress: addressSchema,
    dropoffAddress: { type: addressSchema, required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    estimatedDeliveryTime: Date,
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    failureReason: String,
    statusHistory: {
      type: [{ _id: false, status: String, changedBy: String, note: String, at: { type: Date, default: Date.now } }],
      default: []
    }
  },
  schemaOptions
);

deliverySchema.methods.changeStatus = function changeStatus(status, changedBy, note) {
  this.status = status;
  this.statusHistory.push({ status, changedBy, note });
};

export const Delivery = mongoose.model('Delivery', deliverySchema);
