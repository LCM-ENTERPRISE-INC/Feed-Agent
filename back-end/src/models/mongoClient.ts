import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://root:root123@localhost:27017/feed_agent?authSource=admin';
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export async function connectMongoDB(retryCount = 0): Promise<void> {
  try {
    console.log(`[mongodb]: Attempting connection to MongoDB... (Attempt ${retryCount + 1})`);
    
    // Mongoose handles auto-reconnect after the initial connection is established,
    // but we need a custom retry strategy for the INITIAL connection if the DB is still booting.
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('[mongodb]: Connected to MongoDB successfully.');
    
    // Event listeners for runtime disconnections
    mongoose.connection.on('disconnected', () => {
      console.warn('[mongodb]: MongoDB connection lost. Mongoose will try to reconnect automatically...');
    });

    mongoose.connection.on('reconnected', () => {
      console.info('[mongodb]: MongoDB reconnected successfully.');
    });

  } catch (error) {
    console.error(`[mongodb]: Failed to connect to MongoDB:`, (error as Error).message);
    if (retryCount < MAX_RETRIES) {
      console.log(`[mongodb]: Retrying in ${RETRY_INTERVAL_MS / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      return connectMongoDB(retryCount + 1);
    } else {
      console.error('[mongodb]: Max retries reached. Could not connect to MongoDB.');
      throw error;
    }
  }
}

export default mongoose;
