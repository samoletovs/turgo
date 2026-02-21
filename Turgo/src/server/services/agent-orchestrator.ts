/**
 * Agent Orchestrator — BullMQ job scheduling, agent state machine, lifecycle
 * Core engine that runs all agent operations via background jobs
 */

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

// Redis connection (lazy init for dev environments without Redis)
let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    connection = new IORedis(url, { maxRetriesPerRequest: null });
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
  | "scraper-sslv"
  | "quality-check"
  | "engagement-email"
  | "analytics-snapshot";

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, { connection: getConnection() })
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
  options?: { delay?: number; priority?: number }
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
  pattern: string // CRON pattern
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
  processor: (job: Job) => Promise<void>
): Worker {
  if (workers.has(queueName)) {
    return workers.get(queueName)!;
  }

  const worker = new Worker(queueName, processor, {
    connection: getConnection(),
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
  queueName: string
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

  // Daily quality check
  await scheduleRecurring("quality", "quality-check", {}, "0 6 * * *"); // 6 AM daily

  // Buying agent monitor every 5 minutes
  await scheduleRecurring("buying-agents", "buying-agent-monitor", {}, "*/5 * * * *");

  // Daily analytics snapshot
  await scheduleRecurring("analytics", "analytics-snapshot", {}, "0 1 * * *"); // 1 AM daily

  // SS.lv scraper (if enabled)
  if (process.env.SSLV_SCRAPER_ENABLED === "true") {
    const cron = process.env.SSLV_SCRAPER_CRON || "0 3 * * *";
    await scheduleRecurring("scraper", "scraper-sslv", {}, cron);
  }

  console.log("[Agent Orchestrator] Initialized successfully");
}
