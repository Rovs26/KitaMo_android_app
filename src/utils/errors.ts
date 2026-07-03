export function logDevError(scope: string, error: unknown) {
  if (__DEV__) {
    console.error(`[${scope}]`, error);
  }
}

export function getFriendlyErrorMessage(fallback: string) {
  return fallback;
}

export function getUserSafeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const technicalPattern = /sqlite|native|prepare|statement|database|shared object|released|migration/i;
  return technicalPattern.test(message) ? fallback : message;
}
