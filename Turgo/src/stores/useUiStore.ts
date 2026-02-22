import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────

export interface UiState {
  isSidebarOpen: boolean;
  isMobileNavOpen: boolean;
  activeModal: string | null;
  conciergeMinimized: boolean;
}

export interface UiActions {
  toggleSidebar: () => void;
  toggleMobileNav: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  toggleConcierge: () => void;
  setConciergeMinimized: (minimized: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_UI: UiState = {
  isSidebarOpen: true,
  isMobileNavOpen: false,
  activeModal: null,
  conciergeMinimized: false,
};

// ─── Store ───────────────────────────────────────────────

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set) => ({
      ...DEFAULT_UI,

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      toggleMobileNav: () =>
        set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),

      openModal: (modalId) => set({ activeModal: modalId }),

      closeModal: () => set({ activeModal: null }),

      toggleConcierge: () =>
        set((state) => ({ conciergeMinimized: !state.conciergeMinimized })),

      setConciergeMinimized: (minimized) =>
        set({ conciergeMinimized: minimized }),

      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
    }),
    {
      name: "turgo-ui-store",
      // Persist sidebar and concierge preferences
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        conciergeMinimized: state.conciergeMinimized,
      }),
    },
  ),
);
