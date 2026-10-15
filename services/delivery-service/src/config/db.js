import mongoose from 'mongoose';

export async function connectDB(uri, { retries = 10, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log(`MongoDB connected: ${mongoose.connection.name}`);
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export const disconnectDB = () => mongoose.disconnect();

export const isDBConnected = () => mongoose.connection.readyState === 1;
