import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis';

/**
 * Queue names used throughout the application.
 * Using constants prevents typos and enables easier refactoring.
 */
export const QUEUE_NAMES = {
  IMAGE_SCAN: 'image-scan',
  PROFILE_SCAN: 'profile-scan',
  BREACH_CHECK: 'breach-check',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job data types for each queue.
 */
export interface ImageScanJobData {
  scanJobId: string;
  userId: string;
  targetId?: string; // Optional: specific image to scan
}

export interface ProfileScanJobData {
  scanJobId: string;
  userId: string;
  accountId?: string; // Optional: specific connected account to scan
}

export interface BreachCheckJobData {
  scanJobId: string;
  userId: string;
  email: string;
}

/**
 * Union type for all job data types
 */
export type JobData = ImageScanJobData | ProfileScanJobData | BreachCheckJobData;

/**
 * Default job options for all queues.
 * These ensure reliable job processing with retries.
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // Start with 1 second, then 2s, 4s
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000, // Keep at most 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days for debugging
  },
};

/**
 * Creates a BullMQ queue if Redis is available.
 * Returns null if Redis is not configured.
 */
function createQueue<T extends object>(name: string): Queue<T> | null {
  if (!redisOptions) {
    console.warn(`[Queue] ${name}: Queue disabled - Redis not configured`);
    return null;
  }

  const queue = new Queue<T>(name, {
    connection: redisOptions,
    defaultJobOptions,
  });

  queue.on('error', (error) => {
    console.error(`[Queue] ${name}: Error:`, error.message);
  });

  return queue;
}

/**
 * Image scan queue for processing uploaded images.
 * Jobs include:
 * - Reverse image search
 * - Deepfake detection
 * - Similar image matching
 */
export const imageScanQueue = createQueue<ImageScanJobData>(QUEUE_NAMES.IMAGE_SCAN);

/**
 * Profile scan queue for analyzing connected social accounts.
 * Jobs include:
 * - Follower analysis
 * - Behavioral pattern detection
 * - Suspicious account identification
 */
export const profileScanQueue = createQueue<ProfileScanJobData>(QUEUE_NAMES.PROFILE_SCAN);

/**
 * Breach check queue for monitoring email/data breaches.
 * Jobs query Have I Been Pwned API and similar services.
 */
export const breachCheckQueue = createQueue<BreachCheckJobData>(QUEUE_NAMES.BREACH_CHECK);

/**
 * Adds an image scan job to the queue.
 * Returns the job or null if queues are disabled.
 */
export async function addImageScanJob(data: ImageScanJobData) {
  if (!imageScanQueue) {
    console.warn('[Queue] Cannot add image scan job - queue disabled');
    return null;
  }

  const job = await imageScanQueue.add('scan', data, {
    jobId: `image-scan-${data.scanJobId}`, // Prevent duplicate jobs
  });

  console.log(`[Queue] Added image scan job: ${job.id}`);
  return job;
}

/**
 * Adds a profile scan job to the queue.
 */
export async function addProfileScanJob(data: ProfileScanJobData) {
  if (!profileScanQueue) {
    console.warn('[Queue] Cannot add profile scan job - queue disabled');
    return null;
  }

  const job = await profileScanQueue.add('scan', data, {
    jobId: `profile-scan-${data.scanJobId}`,
  });

  console.log(`[Queue] Added profile scan job: ${job.id}`);
  return job;
}

/**
 * Adds a breach check job to the queue.
 */
export async function addBreachCheckJob(data: BreachCheckJobData) {
  if (!breachCheckQueue) {
    console.warn('[Queue] Cannot add breach check job - queue disabled');
    return null;
  }

  const job = await breachCheckQueue.add('check', data, {
    jobId: `breach-check-${data.scanJobId}`,
  });

  console.log(`[Queue] Added breach check job: ${job.id}`);
  return job;
}

/**
 * Gracefully closes all queues.
 * Call this during application shutdown.
 */
export async function closeQueues(): Promise<void> {
  const queues = [imageScanQueue, profileScanQueue, breachCheckQueue].filter(
    (q): q is Queue => q !== null
  );

  await Promise.all(queues.map((q) => q.close()));
  console.log('[Queue] All queues closed');
}

/**
 * Queue statistics for health checks.
 */
export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Gets statistics for all queues.
 * Returns null if queues are disabled.
 */
export async function getQueueStats(): Promise<QueueStats[] | null> {
  const queues = [
    { queue: imageScanQueue, name: QUEUE_NAMES.IMAGE_SCAN },
    { queue: profileScanQueue, name: QUEUE_NAMES.PROFILE_SCAN },
    { queue: breachCheckQueue, name: QUEUE_NAMES.BREACH_CHECK },
  ];

  const activeQueues = queues.filter((q) => q.queue !== null);

  if (activeQueues.length === 0) {
    return null;
  }

  const stats: QueueStats[] = await Promise.all(
    activeQueues.map(async ({ queue, name }) => {
      const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
        queue!.getWaitingCount(),
        queue!.getActiveCount(),
        queue!.getCompletedCount(),
        queue!.getFailedCount(),
        queue!.getDelayedCount(),
        queue!.isPaused(),
      ]);

      return {
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      };
    })
  );

  return stats;
}

/**
 * Gets a specific queue by name.
 * Useful for monitoring individual queues.
 */
export function getQueue(name: QueueName): Queue | null {
  switch (name) {
    case QUEUE_NAMES.IMAGE_SCAN:
      return imageScanQueue;
    case QUEUE_NAMES.PROFILE_SCAN:
      return profileScanQueue;
    case QUEUE_NAMES.BREACH_CHECK:
      return breachCheckQueue;
    default:
      return null;
  }
}
