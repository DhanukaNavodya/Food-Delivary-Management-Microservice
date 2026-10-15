import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { ROLES } from '../utils/roles.js';
import { jsonOptions } from '../utils/schema.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date
  },
  {
    timestamps: true,
    toJSON: {
      ...jsonOptions,
      transform: (doc, ret) => {
        jsonOptions.transform(doc, ret);
        delete ret.password;
        return ret;
      }
    }
  }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
