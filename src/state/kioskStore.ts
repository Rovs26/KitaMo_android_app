import { create } from "zustand";

import type { Product, UnitType } from "@/domain/types";
import { makeCheckoutId } from "@/domain/ids";

export type KioskCartItem = {
  productId: string;
  branchId: string | null;
  name: string;
  category: string;
  unitType: UnitType;
  unitPrice: number;
  unitCost: number;
  stockQty: number;
  lowStockThreshold: number;
  bundleQuantity: number | null;
  bundlePrice: number | null;
  bundleLabel: string | null;
  quantity: number;
  cookedToOrder: boolean;
};

type AddProductResult = {
  ok: boolean;
  reason?: string;
};

type KioskState = {
  cartItems: KioskCartItem[];
  checkoutToken: string | null;
  activeShiftId: string | null;
  lastSaleId: string | null;
  lastReceiptText: string | null;
  addProductToCart: (product: Product, cookedToOrder?: boolean) => AddProductResult;
  incrementCartItem: (productId: string) => AddProductResult;
  decrementCartItem: (productId: string) => void;
  removeCartItem: (productId: string) => void;
  clearCart: () => void;
  setActiveShiftId: (shiftId: string | null) => void;
  setLastReceipt: (saleId: string | null, receiptText: string | null) => void;
};

export const useKioskStore = create<KioskState>((set, get) => ({
  cartItems: [],
  checkoutToken: null,
  activeShiftId: null,
  lastSaleId: null,
  lastReceiptText: null,
  addProductToCart: (product, cookedToOrder = false) => {
    if (!cookedToOrder && product.stockQty <= 0) {
      return { ok: false, reason: `${product.name} is out of stock.` };
    }

    const currentItem = get().cartItems.find((item) => item.productId === product.id);
    const checkoutToken = get().checkoutToken ?? makeCheckoutId();
    if (currentItem && !cookedToOrder && currentItem.quantity >= product.stockQty) {
      return { ok: false, reason: `Only ${product.stockQty} ${product.unitType} available.` };
    }

    if (currentItem) {
      set((state) => ({
        checkoutToken,
        cartItems: state.cartItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                stockQty: product.stockQty,
                unitPrice: product.price,
                bundleQuantity: product.bundleQuantity,
                bundlePrice: product.bundlePrice,
                bundleLabel: product.bundleLabel,
                cookedToOrder,
              }
            : item,
        ),
      }));
      return { ok: true };
    }

    set((state) => ({
      checkoutToken,
      cartItems: [
        ...state.cartItems,
        {
          productId: product.id,
          branchId: product.branchId,
          name: product.name,
          category: product.category,
          unitType: product.unitType,
          unitPrice: product.price,
          unitCost: product.cost,
          stockQty: product.stockQty,
          lowStockThreshold: product.lowStockThreshold,
          bundleQuantity: product.bundleQuantity,
          bundlePrice: product.bundlePrice,
          bundleLabel: product.bundleLabel,
          quantity: 1,
          cookedToOrder,
        },
      ],
    }));

    return { ok: true };
  },
  incrementCartItem: (productId) => {
    const currentItem = get().cartItems.find((item) => item.productId === productId);
    if (!currentItem) {
      return { ok: false, reason: "Cart item not found." };
    }

    if (!currentItem.cookedToOrder && currentItem.quantity >= currentItem.stockQty) {
      return { ok: false, reason: `Only ${currentItem.stockQty} ${currentItem.unitType} available.` };
    }

    set((state) => ({
      cartItems: state.cartItems.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)),
    }));

    return { ok: true };
  },
  decrementCartItem: (productId) => {
    set((state) => {
      const cartItems = state.cartItems
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0);
      return { cartItems, checkoutToken: cartItems.length > 0 ? state.checkoutToken : null };
    });
  },
  removeCartItem: (productId) => {
    set((state) => {
      const cartItems = state.cartItems.filter((item) => item.productId !== productId);
      return { cartItems, checkoutToken: cartItems.length > 0 ? state.checkoutToken : null };
    });
  },
  clearCart: () => set({ cartItems: [], checkoutToken: null }),
  setActiveShiftId: (activeShiftId) => set({ activeShiftId }),
  setLastReceipt: (lastSaleId, lastReceiptText) => set({ lastSaleId, lastReceiptText }),
}));
