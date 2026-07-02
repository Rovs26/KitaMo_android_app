import { create } from "zustand";

export type AppMode = "owner" | "kiosk";

type AppState = {
  currentMode: AppMode;
  activeBusinessId: string | null;
  activeBranchId: string | null;
  setCurrentMode: (mode: AppMode) => void;
  setActiveBusinessId: (businessId: string | null) => void;
  setActiveBranchId: (branchId: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentMode: "owner",
  activeBusinessId: null,
  activeBranchId: null,
  setCurrentMode: (currentMode) => set({ currentMode }),
  setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
  setActiveBranchId: (activeBranchId) => set({ activeBranchId }),
}));
