import { create } from "zustand";

export type PlaceholderCartItem = {
  id: string;
  name: string;
  quantity: number;
};

type KioskState = {
  currentCart: PlaceholderCartItem[];
  activeShiftId: string | null;
  setCurrentCart: (cart: PlaceholderCartItem[]) => void;
  setActiveShiftId: (shiftId: string | null) => void;
  clearCart: () => void;
};

export const useKioskStore = create<KioskState>((set) => ({
  currentCart: [],
  activeShiftId: null,
  setCurrentCart: (currentCart) => set({ currentCart }),
  setActiveShiftId: (activeShiftId) => set({ activeShiftId }),
  clearCart: () => set({ currentCart: [] }),
}));
