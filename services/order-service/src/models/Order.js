import mongoose from 'mongoose';
import { jsonOptions, schemaOptions } from '../utils/schema.js';

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
});

// Allowed next statuses for each status.
export const ORDER_TRANSITIONS = Object.freeze({
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
});

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: String
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    changedBy: String,
    note: String,
    at: { type: Date, default: Date.now }
  },
  { _id: false, toJSON: jsonOptions }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: String,
    restaurantId: { type: String, required: true, index: true },
    restaurantName: String,
    restaurantOwnerId: { type: String, index: true },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, 'An order must contain at least one item']
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    deliveryAddress: { type: addressSchema, required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    paymentMethod: { type: String, enum: ['CASH', 'CARD'], default: 'CASH' },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    cancellationReason: String
  },
  schemaOptions
);

orderSchema.methods.changeStatus = function changeStatus(status, changedBy, note) {
  this.status = status;
  this.statusHistory.push({ status, changedBy, note });
};

export const Order = mongoose.model('Order', orderSchema);
