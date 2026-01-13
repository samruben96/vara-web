/**
 * Worker Process Entry Point
 *
 * This file initializes all BullMQ workers and handles graceful shutdown.
 * Run this as a separate process from the main API server.
 *
 * Usage: pnpm worker
 */

// Load environment variables from .env file BEFORE any other imports
import 'dotenv/config';

import { Worker } from 'bullmq';
import { createImageScanWorker } from './image-scan.worker';
import { createBreachCheckWorker } from './breach.worker';
import { prisma } from '../config/prisma';

// Track all active workers for graceful shutdown
const activeWorkers: Worker[] = [];

/**
 * Initializes all workers.
 */
function initializeWorkers(): void {
  console.log('[Workers] Initializing workers...');

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
    console.log(`[Workers] ${activeWorkers.length} worker(s) running`);
  }
}

/**
 * Gracefully shuts down all workers.
 * Waits for in-progress jobs to complete before exiting.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Workers] Received ${signal}, starting graceful shutdown...`);

  // Close all workers (waits for current jobs to complete)
  for (const worker of activeWorkers) {
    console.log(`[Workers] Closing worker: ${worker.name}`);
    await worker.close();
  }

  // Disconnect Prisma
  await prisma.$disconnect();

  console.log('[Workers] Shutdown complete');
  process.exit(0);
}

/**
 * Main entry point for the worker process.
 */
async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  Vara - Worker Process');
  console.log('==========================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Workers] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Workers] Unhandled rejection:', reason);
    shutdown('unhandledRejection');
  });

  // Initialize workers
  initializeWorkers();

  // Keep the process running
  console.log('[Workers] Worker process started. Press Ctrl+C to stop.');
}

// Start the worker process
main().catch((error) => {
  console.error('[Workers] Failed to start:', error);
  process.exit(1);
});
