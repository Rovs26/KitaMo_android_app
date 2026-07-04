export type LinePricingInput = {
  quantity: number;
  unitPrice: number;
  bundleQuantity?: number | null;
  bundlePrice?: number | null;
  bundleLabel?: string | null;
};

export type LinePricingResult = {
  lineTotal: number;
  regularTotal: number;
  bundleApplied: boolean;
  bundleCount: number;
  remainingUnits: number;
  discountAmount: number;
  bundleLabel: string | null;
  displayLabel: string | null;
};

function formatBundlePeso(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function bundleLabelFor(quantity?: number | null, price?: number | null, label?: string | null) {
  const bundleQuantity = Math.floor(Number(quantity) || 0);
  const bundlePrice = Math.max(Number(price) || 0, 0);

  if (label?.trim()) {
    return label.trim();
  }

  if (bundleQuantity > 1 && bundlePrice > 0) {
    return `${bundleQuantity} for ₱${formatBundlePeso(bundlePrice)}`;
  }

  return null;
}

export function hasBundlePricing(product: { bundleQuantity?: number | null; bundlePrice?: number | null }) {
  return Math.floor(Number(product.bundleQuantity) || 0) > 1 && Math.max(Number(product.bundlePrice) || 0, 0) > 0;
}

export function calculateLineTotal(input: LinePricingInput): LinePricingResult {
  const quantity = Math.max(Number(input.quantity) || 0, 0);
  const unitPrice = Math.max(Number(input.unitPrice) || 0, 0);
  const bundleQuantity = Math.floor(Number(input.bundleQuantity) || 0);
  const bundlePrice = Math.max(Number(input.bundlePrice) || 0, 0);
  const regularTotal = quantity * unitPrice;
  const fallback: LinePricingResult = {
    lineTotal: regularTotal,
    regularTotal,
    bundleApplied: false,
    bundleCount: 0,
    remainingUnits: quantity,
    discountAmount: 0,
    bundleLabel: null,
    displayLabel: null,
  };

  if (quantity <= 0 || unitPrice <= 0 || bundleQuantity <= 1 || bundlePrice <= 0) {
    return fallback;
  }

  const bundleCount = Math.floor(quantity / bundleQuantity);
  if (bundleCount <= 0) {
    return fallback;
  }

  const remainingUnits = quantity % bundleQuantity;
  const bundledTotal = bundleCount * bundlePrice + remainingUnits * unitPrice;
  if (bundledTotal >= regularTotal) {
    return fallback;
  }

  const label = bundleLabelFor(bundleQuantity, bundlePrice, input.bundleLabel);
  const remainderLabel = remainingUnits > 0 ? ` + ${remainingUnits} regular` : "";

  return {
    lineTotal: bundledTotal,
    regularTotal,
    bundleApplied: true,
    bundleCount,
    remainingUnits,
    discountAmount: regularTotal - bundledTotal,
    bundleLabel: label,
    displayLabel: label ? `${label}${remainderLabel}` : null,
  };
}

export function calculateBundleBreakdown(input: LinePricingInput) {
  return calculateLineTotal(input);
}

export function calculateCartSubtotal(items: LinePricingInput[]) {
  return items.reduce((total, item) => total + calculateLineTotal(item).lineTotal, 0);
}
