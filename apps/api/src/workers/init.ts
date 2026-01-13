/**
 * Worker Initialization for Main Server Process
 *
 * This module provides functions to initialize and shutdown workers
 * within the main API server process (as opposed to running workers
 * in a separate process via `pnpm worker`).
 */

import type { Worker } from 'bullmq';
import { createImageScanWorker } from './image-scan.worker';
import { createBreachCheckWorker } from './breach.worker';

// Track all active workers for graceful shutdown
const activeWorkers: Worker[] = [];

/**
 * Initializes all workers within the main server process.
 * Call this after Fastify plugins are registered.
 */
export function initializeWorkers(): void {
  console.log('[Workers] Initializing workers in server process...');

  // Image scan worker
  const imageScanWorker = createImageScanWorker();
  if (imageScanWorker) {
    activeWorkers.push(imageScanWorker);
    console.log('[Workers] Image scan worker initialized');
  }

  // Breach check worker
  const breachCheckWorker = createBreachCheckWorker();
  if (breachCheckWorker) {
    activeWorkers.push(breachCheckWorker);
    console.log('[Workers] Breach check worker initialized');
  }

  // Add more workers here as they are implemented:
  // const profileScanWorker = createProfileScanWorker();

  if (activeWorkers.length === 0) {
    console.warn('[Workers] No workers initialized - check Redis configuration');
  } else {
    console.log(`[Workers] ${activeWorkers.length} worker(s) running in server process`);
  }
}

/**
 * Returns the list of active workers.
 * Useful for health checks and monitoring.
 */
export function getActiveWorkers(): Worker[] {
  return activeWorkers;
}

/**
 * Gracefully shuts down all workers.
 * Waits for in-progress jobs to complete before returning.
 */
export async function shutdownWorkers(): Promise<void> {
  if (activeWorkers.length === 0) {
    console.log('[Workers] No active workers to shut down');
    return;
  }

  console.log(`[Workers] Shutting down ${activeWorkers.length} worker(s)...`);

  // Close all workers (waits for current jobs to complete)
  for (const worker of activeWorkers) {
    console.log(`[Workers] Closing worker: ${worker.name}`);
    await worker.close();
  }

  // Clear the array
  activeWorkers.length = 0;

  console.log('[Workers] All workers shut down');
}
