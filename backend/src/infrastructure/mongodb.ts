import mongoose from 'mongoose';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      // Connection pool tuning
      maxPoolSize: config.MONGODB_POOL_SIZE,
      minPoolSize: Math.min(10, config.MONGODB_POOL_SIZE),

      // Timeouts
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: config.MONGODB_QUERY_TIMEOUT_MS,
      connectTimeoutMS: 10_000,

      // Write concern for data safety
      writeConcern: { w: 'majority', wtimeoutMS: 5000 },

      // Read preference — read from secondaries when available
      readPreference: 'secondaryPreferred',

      // Retry
      retryWrites: true,
      retryReads: true,
    });
    logger.info(
      { poolSize: config.MONGODB_POOL_SIZE, queryTimeout: config.MONGODB_QUERY_TIMEOUT_MS },
      'MongoDB connected',
    );
  } catch (error) {
    logger.error(error, 'MongoDB connection failed');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error(err, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
