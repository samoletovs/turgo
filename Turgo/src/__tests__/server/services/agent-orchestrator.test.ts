import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BullMQ with classes (needed for `new Queue(...)` / `new Worker(...)`)
const mockQueueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
const mockGetRepeatableJobs = vi.fn().mockResolvedValue([]);
const mockRemoveRepeatableByKey = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockQueueAdd;
    getRepeatableJobs = mockGetRepeatableJobs;
    removeRepeatableByKey = mockRemoveRepeatableByKey;
    close = mockQueueClose;
  },
  Worker: class MockWorker {
    on = mockWorkerOn;
    close = mockWorkerClose;
  },
}));

// Mock IORedis with a class
vi.mock("ioredis", () => ({
  default: class MockIORedis {
    quit = vi.fn().mockResolvedValue("OK");
    status = "ready";
  },
}));

// Mock redis URL
vi.mock("@/lib/redis", () => ({
  REDIS_URL: "redis://localhost:6379",
}));

// Mock agent-workers
vi.mock("@/server/services/agent-workers", () => ({
  registerAllWorkers: vi.fn(),
}));

import {
  isValidTransition,
  transitionAgent,
  scheduleJob,
  scheduleRecurring,
  removeRecurringJobs,
  getQueue,
  registerWorker,
  type AgentState,
} from "@/server/services/agent-orchestrator";

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// isValidTransition — Agent state machine
// ──────────────────────────────────────────────────────────────
describe("isValidTransition", () => {
  describe("from ACTIVE state", () => {
    it("allows transition to PAUSED", () => {
      expect(isValidTransition("ACTIVE", "PAUSED")).toBe(true);
    });

    it("allows transition to COMPLETED", () => {
      expect(isValidTransition("ACTIVE", "COMPLETED")).toBe(true);
    });

    it("allows transition to CANCELLED", () => {
      expect(isValidTransition("ACTIVE", "CANCELLED")).toBe(true);
    });

    it("disallows self-transition to ACTIVE", () => {
      expect(isValidTransition("ACTIVE", "ACTIVE")).toBe(false);
    });
  });

  describe("from PAUSED state", () => {
    it("allows transition to ACTIVE", () => {
      expect(isValidTransition("PAUSED", "ACTIVE")).toBe(true);
    });

    it("allows transition to CANCELLED", () => {
      expect(isValidTransition("PAUSED", "CANCELLED")).toBe(true);
    });

    it("disallows transition to COMPLETED", () => {
      expect(isValidTransition("PAUSED", "COMPLETED")).toBe(false);
    });
  });

  describe("from COMPLETED state (terminal)", () => {
    it("disallows transition to ACTIVE", () => {
      expect(isValidTransition("COMPLETED", "ACTIVE")).toBe(false);
    });

    it("disallows transition to PAUSED", () => {
      expect(isValidTransition("COMPLETED", "PAUSED")).toBe(false);
    });

    it("disallows transition to CANCELLED", () => {
      expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false);
    });
  });

  describe("from CANCELLED state (terminal)", () => {
    it("disallows transition to ACTIVE", () => {
      expect(isValidTransition("CANCELLED", "ACTIVE")).toBe(false);
    });

    it("disallows transition to PAUSED", () => {
      expect(isValidTransition("CANCELLED", "PAUSED")).toBe(false);
    });

    it("disallows transition to COMPLETED", () => {
      expect(isValidTransition("CANCELLED", "COMPLETED")).toBe(false);
    });
  });

  it("returns false for unknown states", () => {
    expect(isValidTransition("UNKNOWN" as AgentState, "ACTIVE")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// transitionAgent — State transitions with side effects
// ──────────────────────────────────────────────────────────────
describe("transitionAgent", () => {
  it("throws on invalid transition", async () => {
    await expect(
      transitionAgent("COMPLETED", "ACTIVE", "agent-1", "selling-agents"),
    ).rejects.toThrow("Invalid transition: COMPLETED → ACTIVE");
  });

  it("removes recurring jobs when transitioning to PAUSED", async () => {
    mockGetRepeatableJobs.mockResolvedValue([
      { name: "agent-1-price-adjust", key: "key-1" },
      { name: "other-agent-2", key: "key-2" },
    ]);

    await transitionAgent("ACTIVE", "PAUSED", "agent-1", "selling-agents");

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("key-1");
    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalledWith("key-2");
  });

  it("removes recurring jobs when transitioning to CANCELLED", async () => {
    mockGetRepeatableJobs.mockResolvedValue([
      { name: "agent-1-job", key: "key-1" },
    ]);

    await transitionAgent("ACTIVE", "CANCELLED", "agent-1", "selling-agents");

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("key-1");
  });

  it("removes recurring jobs when transitioning to COMPLETED", async () => {
    mockGetRepeatableJobs.mockResolvedValue([
      { name: "agent-1-summary", key: "key-1" },
    ]);

    await transitionAgent("ACTIVE", "COMPLETED", "agent-1", "selling-agents");

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("key-1");
  });

  it("does not remove jobs when transitioning to ACTIVE (resume)", async () => {
    await transitionAgent("PAUSED", "ACTIVE", "agent-1", "selling-agents");

    expect(mockGetRepeatableJobs).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────
// scheduleJob
// ──────────────────────────────────────────────────────────────
describe("scheduleJob", () => {
  it("adds a job to the correct queue", async () => {
    await scheduleJob("selling-agents", "selling-agent-price-adjust", {
      agentId: "a1",
    });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "selling-agent-price-adjust",
      { agentId: "a1" },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }),
    );
  });

  it("supports delay option", async () => {
    await scheduleJob(
      "buying-agents",
      "buying-agent-monitor",
      { id: "b1" },
      { delay: 60000 },
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "buying-agent-monitor",
      { id: "b1" },
      expect.objectContaining({ delay: 60000 }),
    );
  });

  it("supports priority option", async () => {
    await scheduleJob("quality", "quality-check", {}, { priority: 1 });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "quality-check",
      {},
      expect.objectContaining({ priority: 1 }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// scheduleRecurring
// ──────────────────────────────────────────────────────────────
describe("scheduleRecurring", () => {
  it("adds a recurring job with CRON pattern", async () => {
    await scheduleRecurring(
      "selling-agents",
      "selling-agent-daily-summary",
      {},
      "0 8 * * *",
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "selling-agent-daily-summary",
      {},
      expect.objectContaining({
        repeat: { pattern: "0 8 * * *" },
        attempts: 3,
      }),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// removeRecurringJobs
// ──────────────────────────────────────────────────────────────
describe("removeRecurringJobs", () => {
  it("removes only jobs matching the agentId", async () => {
    mockGetRepeatableJobs.mockResolvedValue([
      { name: "agent-123-price-adjust", key: "k1" },
      { name: "agent-456-price-adjust", key: "k2" },
      { name: "agent-123-daily-summary", key: "k3" },
    ]);

    await removeRecurringJobs("selling-agents", "agent-123");

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledTimes(2);
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("k1");
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("k3");
    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalledWith("k2");
  });

  it("does nothing when no matching jobs found", async () => {
    mockGetRepeatableJobs.mockResolvedValue([
      { name: "other-agent", key: "k1" },
    ]);

    await removeRecurringJobs("selling-agents", "my-agent");

    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────
// getQueue — Singleton queue creation
// ──────────────────────────────────────────────────────────────
describe("getQueue", () => {
  it("returns a queue instance for a given name", () => {
    const queue = getQueue("test-queue");
    expect(queue).toBeDefined();
  });

  it("returns the same queue instance for the same name", () => {
    const q1 = getQueue("same-queue");
    const q2 = getQueue("same-queue");
    expect(q1).toBe(q2);
  });
});

// ──────────────────────────────────────────────────────────────
// registerWorker
// ──────────────────────────────────────────────────────────────
describe("registerWorker", () => {
  it("creates a worker with a processor function", () => {
    const processor = vi.fn();
    const worker = registerWorker("new-worker-queue", processor);

    expect(worker).toBeDefined();
    expect(mockWorkerOn).toHaveBeenCalledWith(
      "completed",
      expect.any(Function),
    );
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
  });

  it("returns the same worker for the same queue name", () => {
    const processor = vi.fn();
    const w1 = registerWorker("reuse-queue", processor);
    const w2 = registerWorker("reuse-queue", processor);
    expect(w1).toBe(w2);
  });
});

// ──────────────────────────────────────────────────────────────
// Full state machine validation matrix
// ──────────────────────────────────────────────────────────────
describe("state machine completeness", () => {
  const allStates: AgentState[] = [
    "ACTIVE",
    "PAUSED",
    "COMPLETED",
    "CANCELLED",
  ];

  it("ACTIVE has exactly 3 valid transitions", () => {
    const valid = allStates.filter((to) => isValidTransition("ACTIVE", to));
    expect(valid).toEqual(["PAUSED", "COMPLETED", "CANCELLED"]);
  });

  it("PAUSED has exactly 2 valid transitions", () => {
    const valid = allStates.filter((to) => isValidTransition("PAUSED", to));
    expect(valid).toEqual(["ACTIVE", "CANCELLED"]);
  });

  it("COMPLETED has 0 valid transitions (terminal)", () => {
    const valid = allStates.filter((to) => isValidTransition("COMPLETED", to));
    expect(valid).toHaveLength(0);
  });

  it("CANCELLED has 0 valid transitions (terminal)", () => {
    const valid = allStates.filter((to) => isValidTransition("CANCELLED", to));
    expect(valid).toHaveLength(0);
  });
});
