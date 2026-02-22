/**
 * Agent Orchestrator — BullMQ job scheduling, agent state machine, lifecycle
 * Core engine that runs all agent operations via background jobs
 */

import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { registerAllWorkers } from "./agent-workers";
import { REDIS_URL } from "@/lib/redis";

// BullMQ needs its own connection with maxRetriesPerRequest: null
let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

// ──────────────────────────────────────────────
// QUEUE DEFINITIONS
// ──────────────────────────────────────────────

export type AgentJobType =
  | "selling-agent-price-adjust"
  | "selling-agent-auto-respond"
  | "selling-agent-daily-summary"
  | "buying-agent-monitor"
  | "buying-agent-auto-negotiate"
  | "moderation-review"
  | "moderation-antifraud"
  | "support-ticket"
  | "scraper-sslv"
  | "quality-check"
  | "quality-daily"
  | "engagement-email"
  | "engagement-daily"
  | "analytics-snapshot"
  | "analytics-weekly"
  | "seo-optimization"
  | "liquidation-price-adjust"
  | "liquidation-batch-check"
  | "watchdog-duplicate-check"
  | "watchdog-message-scan"
  | "timing-snapshot"
  | "swap-matching";

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, { connection: getConnection() as ConnectionOptions }),
    );
  }
  return queues.get(name)!;
}

// ──────────────────────────────────────────────
// JOB SCHEDULING
// ──────────────────────────────────────────────

/** Schedule a one-time agent job */
export async function scheduleJob(
  queueName: string,
  jobName: AgentJobType,
  data: Record<string, unknown>,
  options?: { delay?: number; priority?: number },
) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, {
    delay: options?.delay,
    priority: options?.priority,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

/** Schedule a recurring agent job (CRON) */
export async function scheduleRecurring(
  queueName: string,
  jobName: AgentJobType,
  data: Record<string, unknown>,
  pattern: string, // CRON pattern
) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, {
    repeat: { pattern },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

/** Remove all recurring jobs for an agent */
export async function removeRecurringJobs(queueName: string, agentId: string) {
  const queue = getQueue(queueName);
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name.includes(agentId)) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}

// ──────────────────────────────────────────────
// WORKER REGISTRATION
// ──────────────────────────────────────────────

const workers = new Map<string, Worker>();

export function registerWorker(
  queueName: string,
  processor: (job: Job) => Promise<void>,
): Worker {
  if (workers.has(queueName)) {
    return workers.get(queueName)!;
  }

  const worker = new Worker(queueName, processor, {
    connection: getConnection() as ConnectionOptions,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[Agent] Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Agent] Job ${job?.name} failed:`, err.message);
  });

  workers.set(queueName, worker);
  return worker;
}

// ──────────────────────────────────────────────
// AGENT STATE MACHINE
// ──────────────────────────────────────────────

export type AgentState = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

/** Valid state transitions for agents */
const validTransitions: Record<AgentState, AgentState[]> = {
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/** Check if a state transition is valid */
export function isValidTransition(from: AgentState, to: AgentState): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

/** Transition agent state with side effects */
export async function transitionAgent(
  currentState: AgentState,
  newState: AgentState,
  agentId: string,
  queueName: string,
): Promise<void> {
  if (!isValidTransition(currentState, newState)) {
    throw new Error(`Invalid transition: ${currentState} → ${newState}`);
  }

  // Handle side effects
  switch (newState) {
    case "PAUSED":
      // Pause recurring jobs
      await removeRecurringJobs(queueName, agentId);
      break;
    case "CANCELLED":
    case "COMPLETED":
      // Remove all jobs
      await removeRecurringJobs(queueName, agentId);
      break;
    case "ACTIVE":
      // Jobs will be re-scheduled by the specific agent service
      break;
  }
}

// ──────────────────────────────────────────────
// INITIALIZATION — Set up default recurring jobs
// ──────────────────────────────────────────────

export async function initializeOrchestrator() {
  console.log("[Agent Orchestrator] Initializing...");

  // 1. Register all BullMQ workers (processors)
  registerAllWorkers();

  // 2. Schedule recurring jobs

  // Selling agent price adjustments every 2 hours
  await scheduleRecurring(
    "selling-agents",
    "selling-agent-price-adjust",
    {},
    "0 */2 * * *",
  );

  // Selling agent daily summaries at 8 AM
  await scheduleRecurring(
    "selling-agents",
    "selling-agent-daily-summary",
    {},
    "0 8 * * *",
  );

  // Buying agent monitor every 5 minutes
  await scheduleRecurring(
    "buying-agents",
    "buying-agent-monitor",
    {},
    "*/5 * * * *",
  );

  // Daily quality check at 6 AM (full quality pipeline)
  await scheduleRecurring("quality", "quality-daily", {}, "0 6 * * *");

  // Basic quality check for recent listings at noon
  await scheduleRecurring("quality", "quality-check", {}, "0 12 * * *");

  // Daily engagement emails at 10 AM
  await scheduleRecurring("engagement", "engagement-daily", {}, "0 10 * * *");

  // Daily analytics snapshot at 1 AM
  await scheduleRecurring("analytics", "analytics-snapshot", {}, "0 1 * * *");

  // Weekly analytics summary every Monday at 9 AM
  await scheduleRecurring("analytics", "analytics-weekly", {}, "0 9 * * 1");

  // SEO optimization daily at 4 AM
  await scheduleRecurring("seo", "seo-optimization", {}, "0 4 * * *");

  // SS.lv scraper (if enabled)
  if (process.env.SSLV_SCRAPER_ENABLED === "true") {
    const cron = process.env.SSLV_SCRAPER_CRON || "0 3 * * *";
    await scheduleRecurring("scraper", "scraper-sslv", {}, cron);
  }

  // Liquidation batch pricing adjustments every hour
  await scheduleRecurring(
    "liquidation",
    "liquidation-price-adjust",
    {},
    "0 */1 * * *",
  );

  // Liquidation batch completion check every 30 minutes
  await scheduleRecurring(
    "liquidation",
    "liquidation-batch-check",
    {},
    "*/30 * * * *",
  );

  // Watchdog message scan every 15 minutes
  await scheduleRecurring(
    "watchdog",
    "watchdog-message-scan",
    {},
    "*/15 * * * *",
  );

  // Timing data snapshot daily at 2 AM (after analytics snapshot)
  await scheduleRecurring("timing", "timing-snapshot", {}, "0 2 * * *");

  // Swap matching daily at 11 AM
  await scheduleRecurring("swap", "swap-matching", {}, "0 11 * * *");

  console.log(
    "[Agent Orchestrator] Initialized — workers registered, CRON jobs scheduled",
  );
}

/** Gracefully shut down all workers, queues, and the Redis connection */
export async function shutdownOrchestrator() {
  console.log("[Agent Orchestrator] Shutting down...");

  // Close workers first so no new jobs are picked up
  await Promise.all([...workers.values()].map((w) => w.close()));
  workers.clear();

  // Close queues
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();

  // Close shared Redis connection
  if (connection) {
    await connection.quit();
    connection = null;
  }

  console.log("[Agent Orchestrator] Shut down complete");
}
