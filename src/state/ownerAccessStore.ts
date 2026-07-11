import { create } from "zustand";

type OwnerAccessState = {
  hydrated: boolean;
  isProtectionEnabled: boolean;
  isUnlocked: boolean;
  hydrate: (enabled: boolean) => void;
  enableProtection: () => void;
  disableProtection: () => void;
  lock: () => void;
  unlock: () => void;
};

export const useOwnerAccessStore = create<OwnerAccessState>((set) => ({
  hydrated: false,
  isProtectionEnabled: false,
  isUnlocked: false,
  hydrate: (enabled) => set({ hydrated: true, isProtectionEnabled: enabled, isUnlocked: !enabled }),
  enableProtection: () => set({ hydrated: true, isProtectionEnabled: true, isUnlocked: true }),
  disableProtection: () => set({ hydrated: true, isProtectionEnabled: false, isUnlocked: true }),
  lock: () => set((state) => ({ isUnlocked: state.isProtectionEnabled ? false : state.isUnlocked })),
  unlock: () => set({ isUnlocked: true }),
}));
