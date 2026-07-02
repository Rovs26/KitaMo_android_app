export function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`;
}
