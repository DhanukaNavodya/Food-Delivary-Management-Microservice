// Shared Mongoose options: expose `id` instead of `_id` and hide `__v` in API responses.
export const jsonOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    return ret;
  }
};

export const schemaOptions = { timestamps: true, toJSON: jsonOptions };
