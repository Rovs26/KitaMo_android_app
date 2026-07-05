export const numbersOnlyMessage = "Numbers only, like 1500 or 12.5. Walang comma.";

export function parseRequiredNumber(value: string, fallback: number): number | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.includes(",")) {
    return "invalid";
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

export function parseOptionalStrictNumber(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(",")) {
    return "invalid";
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "invalid";
}
