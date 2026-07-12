import { create } from "zustand";

import type { Branch, Business } from "@/domain/types";

export type AppMode = "owner" | "kiosk";

type AppState = {
  currentMode: AppMode;
  activeBusinessId: string | null;
  activeBusinessName: string | null;
  activeBranchId: string | null;
  activeBranchName: string | null;
  kioskSessionBranchId: string | null;
  setCurrentMode: (mode: AppMode) => void;
  setOwnerContext: (business: Business | null, branch: Branch | null) => void;
  confirmKioskContext: (business: Business, branch: Branch) => void;
  clearKioskSession: () => void;
  resetAppContext: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentMode: "owner",
  activeBusinessId: null,
  activeBusinessName: null,
  activeBranchId: null,
  activeBranchName: null,
  kioskSessionBranchId: null,
  setCurrentMode: (currentMode) => set({ currentMode }),
  setOwnerContext: (business, branch) => {
    const validBranch = business && branch?.businessId === business.id && branch.active ? branch : null;
    set({
      currentMode: "owner",
      activeBusinessId: business?.id ?? null,
      activeBusinessName: business?.businessName ?? null,
      activeBranchId: validBranch?.id ?? null,
      activeBranchName: validBranch?.branchName ?? null,
      kioskSessionBranchId: null,
    });
  },
  confirmKioskContext: (business, branch) => {
    if (branch.businessId !== business.id || !branch.active) {
      throw new Error("Kiosk requires an active stall from the selected business.");
    }

    set({
      currentMode: "kiosk",
      activeBusinessId: business.id,
      activeBusinessName: business.businessName,
      activeBranchId: branch.id,
      activeBranchName: branch.branchName,
      kioskSessionBranchId: branch.id,
    });
  },
  clearKioskSession: () => set({ currentMode: "owner", kioskSessionBranchId: null }),
  resetAppContext: () =>
    set({
      currentMode: "owner",
      activeBusinessId: null,
      activeBusinessName: null,
      activeBranchId: null,
      activeBranchName: null,
      kioskSessionBranchId: null,
    }),
}));
