import IORedis from 'ioredis';
import logger from './logger';

const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

redisClient.on('error', (err) => {
  logger.error(`[redis]: Connection error: ${err.message}`);
});

export default redisClient;
