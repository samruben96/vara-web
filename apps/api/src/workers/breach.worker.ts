/**
 * Breach Check Worker
 *
 * Processes BREACH_CHECK jobs to check if user emails have been
 * exposed in known data breaches using the Have I Been Pwned API.
 */

import { Worker, Job } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { createWorkerConnectionOptions } from '../config/redis';
import { QUEUE_NAMES, BreachCheckJobData } from '../queues';
import { createBreachAlert } from '../utils/alert-creator';

/**
 * Configuration for the Have I Been Pwned API.
 */
const HIBP_CONFIG = {
  baseUrl: 'https://haveibeenpwned.com/api/v3',
  userAgent: 'Vara-Digital-Safety-Platform',
  // Rate limit: 1 request per 1.5 seconds for free tier
  rateLimitMs: 1500,
};

/**
 * Structure of a breach returned by the HIBP API.
 */
interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  LogoPath: string;
}

/**
 * Result structure for breach check jobs.
 */
interface BreachCheckResult {
  checkedAt: string;
  email: string;
  breachesFound: number;
  breaches: Array<{
    name: string;
    date: string;
    dataTypes: string[];
  }>;
  duration: number;
}

/**
 * Checks if the HIBP API key is configured.
 * When not configured, we use mock data for development/testing.
 */
function isHibpConfigured(): boolean {
  return Boolean(process.env.HIBP_API_KEY);
}

/**
 * Mock breach data for development/testing when HIBP API key is not available.
 */
function getMockBreaches(email: string): HibpBreach[] {
  // Only return mock breaches for test emails or a small percentage of checks
  // to simulate realistic behavior
  const testEmails = [
    'test@example.com',
    'demo@vara.app',
    'breach-test@example.com',
  ];

  if (testEmails.includes(email.toLowerCase())) {
    return [
      {
        Name: 'TestBreach2023',
        Title: 'Test Breach 2023',
        Domain: 'testbreach.example.com',
        BreachDate: '2023-06-15',
        AddedDate: '2023-07-01',
        ModifiedDate: '2023-07-01',
        PwnCount: 100000,
        Description: 'Mock breach for testing purposes.',
        DataClasses: ['Email addresses', 'Passwords', 'Names'],
        IsVerified: true,
        IsFabricated: false,
        IsSensitive: false,
        IsRetired: false,
        IsSpamList: false,
        IsMalware: false,
        LogoPath: '',
      },
    ];
  }

  // Simulate occasional breach findings (20% chance for demo purposes)
  if (Math.random() < 0.2) {
    return [
      {
        Name: 'ExampleBreachMock',
        Title: 'Example Service Breach',
        Domain: 'example-service.com',
        BreachDate: '2022-03-10',
        AddedDate: '2022-04-15',
        ModifiedDate: '2022-04-15',
        PwnCount: 500000,
        Description: 'Mock breach data for development.',
        DataClasses: ['Email addresses', 'Usernames'],
        IsVerified: true,
        IsFabricated: false,
        IsSensitive: false,
        IsRetired: false,
        IsSpamList: false,
        IsMalware: false,
        LogoPath: '',
      },
    ];
  }

  return [];
}

/**
 * Checks an email against the Have I Been Pwned API.
 * Returns an array of breaches the email was found in.
 *
 * @param email - The email address to check
 * @returns Array of breaches, or empty array if none found
 */
async function checkEmailBreaches(email: string): Promise<HibpBreach[]> {
  // Use mock data if HIBP API key is not configured
  if (!isHibpConfigured()) {
    console.log(
      '[BreachWorker] HIBP_API_KEY not configured, using mock data'
    );
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getMockBreaches(email);
  }

  const url = `${HIBP_CONFIG.baseUrl}/breachedaccount/${encodeURIComponent(email)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': HIBP_CONFIG.userAgent,
        'hibp-api-key': process.env.HIBP_API_KEY!,
        Accept: 'application/json',
      },
    });

    // 404 means no breaches found (good!)
    if (response.status === 404) {
      return [];
    }

    // 429 means rate limited
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '2';
      throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
    }

    // Other errors
    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status} ${response.statusText}`);
    }

    const breaches = (await response.json()) as HibpBreach[];
    return breaches;
  } catch (error) {
    // Log but don't throw for network errors - we'll retry via BullMQ
    console.error('[BreachWorker] Error checking HIBP:', error);
    throw error;
  }
}

/**
 * Filters breaches to only include relevant, verified ones.
 * Excludes spam lists, fabricated, and retired breaches.
 */
function filterRelevantBreaches(breaches: HibpBreach[]): HibpBreach[] {
  return breaches.filter(
    (breach) =>
      breach.IsVerified &&
      !breach.IsFabricated &&
      !breach.IsRetired &&
      !breach.IsSpamList
  );
}

/**
 * Processes a breach check job.
 *
 * This function:
 * 1. Updates the scan job status to RUNNING
 * 2. Queries the HIBP API (or uses mock data in development)
 * 3. Creates alerts for any breaches found
 * 4. Updates the scan job with results
 */
async function processBreachCheck(
  job: Job<BreachCheckJobData>
): Promise<BreachCheckResult> {
  const { scanJobId, userId, email } = job.data;
  const startTime = Date.now();

  console.log(`[BreachWorker] Starting job ${job.id} for scan ${scanJobId}`);

  // Update scan job status to RUNNING
  await prisma.scanJob.update({
    where: { id: scanJobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    // Update progress
    await job.updateProgress(10);

    // Check for breaches
    console.log(`[BreachWorker] Checking breaches for email: ${maskEmail(email)}`);
    const allBreaches = await checkEmailBreaches(email);

    await job.updateProgress(50);

    // Filter to relevant breaches only
    const relevantBreaches = filterRelevantBreaches(allBreaches);

    console.log(
      `[BreachWorker] Found ${relevantBreaches.length} relevant breaches ` +
        `(${allBreaches.length} total)`
    );

    await job.updateProgress(70);

    // Create alerts for each breach found
    for (const breach of relevantBreaches) {
      await createBreachAlert(userId, {
        breachName: breach.Title || breach.Name,
        breachDate: breach.BreachDate,
        affectedEmail: email,
        dataTypes: breach.DataClasses,
        source: 'haveibeenpwned',
      });
    }

    await job.updateProgress(90);

    const duration = Date.now() - startTime;
    const now = new Date();

    const result: BreachCheckResult = {
      checkedAt: now.toISOString(),
      email: maskEmail(email), // Don't store full email in results
      breachesFound: relevantBreaches.length,
      breaches: relevantBreaches.map((b) => ({
        name: b.Name,
        date: b.BreachDate,
        dataTypes: b.DataClasses,
      })),
      duration,
    };

    // Update scan job with success result
    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[BreachWorker] Completed job ${job.id}: found ${relevantBreaches.length} breaches in ${duration}ms`
    );

    return result;
  } catch (error) {
    // Update scan job with failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
    });

    console.error(`[BreachWorker] Failed job ${job.id}:`, errorMessage);
    throw error;
  }
}

/**
 * Masks an email address for logging.
 */
function maskEmail(email: string): string {
  const parts = email.split('@');
  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain) return '***';
  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Creates and starts the breach check worker.
 * Returns null if Redis is not configured.
 */
export function createBreachCheckWorker(): Worker<
  BreachCheckJobData,
  BreachCheckResult
> | null {
  const connectionOptions = createWorkerConnectionOptions();

  if (!connectionOptions) {
    console.warn('[BreachWorker] Worker disabled - Redis not configured');
    return null;
  }

  const worker = new Worker<BreachCheckJobData, BreachCheckResult>(
    QUEUE_NAMES.BREACH_CHECK,
    processBreachCheck,
    {
      connection: connectionOptions,
      concurrency: 2, // Low concurrency due to HIBP rate limits
      limiter: {
        max: 40, // Max 40 jobs per minute (staying under HIBP limits)
        duration: 60000,
      },
    }
  );

  worker.on('ready', () => {
    console.log('[BreachWorker] Worker is ready and listening for jobs');
  });

  worker.on('completed', (job, result) => {
    console.log(
      `[BreachWorker] Job ${job.id} completed: ${result.breachesFound} breaches found`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(`[BreachWorker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[BreachWorker] Worker error:', error.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[BreachWorker] Job ${jobId} stalled`);
  });

  return worker;
}
