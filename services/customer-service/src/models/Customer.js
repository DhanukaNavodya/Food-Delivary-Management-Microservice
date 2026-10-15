import mongoose from 'mongoose';
import { jsonOptions, schemaOptions } from '../utils/schema.js';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home', maxlength: 50 },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false }
  },
  { toJSON: jsonOptions }
);

const customerSchema = new mongoose.Schema(
  {
    // Id of the user account in the Auth Service.
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
    phone: { type: String, trim: true, match: [/^\+?[0-9]{9,15}$/, 'Invalid phone number'] },
    addresses: { type: [addressSchema], default: [] }
  },
  schemaOptions
);

customerSchema.virtual('defaultAddress').get(function defaultAddress() {
  return this.addresses.find((address) => address.isDefault) || this.addresses[0] || null;
});

export const Customer = mongoose.model('Customer', customerSchema);
