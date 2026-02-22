import { create } from "zustand";
import type { AgentActionEvent, PendingApproval } from "@/lib/socket-client";

// ─── Types ───────────────────────────────────────────────

export interface AgentState {
  pendingApprovals: number;
  unreadAgentUpdates: number;
  lastAgentEvent: AgentActionEvent | null;
}

export interface AgentActions {
  /** Increment pending approvals count */
  addPendingApproval: () => void;
  /** Decrement pending approvals count (e.g., after user approves/rejects) */
  removePendingApproval: () => void;
  /** Set the exact pending approvals count */
  setPendingApprovals: (count: number) => void;
  /** Increment unread agent updates */
  addUnreadUpdate: () => void;
  /** Mark all agent updates as read */
  clearUnreadUpdates: () => void;
  /** Record the latest agent event */
  setLastAgentEvent: (event: AgentActionEvent) => void;
  /** Handle a new pending approval from Socket.IO */
  handlePendingApproval: (approval: PendingApproval) => void;
  /** Handle an agent action event from Socket.IO */
  handleAgentAction: (event: AgentActionEvent) => void;
  /** Reset all agent state */
  reset: () => void;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_AGENT: AgentState = {
  pendingApprovals: 0,
  unreadAgentUpdates: 0,
  lastAgentEvent: null,
};

// ─── Store ───────────────────────────────────────────────

export const useAgentStore = create<AgentState & AgentActions>()((set) => ({
  ...DEFAULT_AGENT,

  addPendingApproval: () =>
    set((state) => ({ pendingApprovals: state.pendingApprovals + 1 })),

  removePendingApproval: () =>
    set((state) => ({
      pendingApprovals: Math.max(0, state.pendingApprovals - 1),
    })),

  setPendingApprovals: (count) => set({ pendingApprovals: count }),

  addUnreadUpdate: () =>
    set((state) => ({ unreadAgentUpdates: state.unreadAgentUpdates + 1 })),

  clearUnreadUpdates: () => set({ unreadAgentUpdates: 0 }),

  setLastAgentEvent: (event) => set({ lastAgentEvent: event }),

  handlePendingApproval: () =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals + 1,
      unreadAgentUpdates: state.unreadAgentUpdates + 1,
    })),

  handleAgentAction: (event) =>
    set((state) => ({
      lastAgentEvent: event,
      unreadAgentUpdates: state.unreadAgentUpdates + 1,
      // If the action requires approval, also bump pending count
      ...(event.requiresApproval
        ? { pendingApprovals: state.pendingApprovals + 1 }
        : {}),
    })),

  reset: () => set(DEFAULT_AGENT),
}));
