/** Convert nanoTON to TON number */
export function nanoToTon(nano: number): number {
  return nano / 1_000_000_000;
}

/** Convert TON number to nanoTON */
export function tonToNano(ton: number): number {
  return Math.round(ton * 1_000_000_000);
}

/** Format nanoTON as display string (e.g. "12.50 TON") */
export function formatTon(nano: number, decimals = 2): string {
  return nanoToTon(nano).toFixed(decimals);
}

/** Format nanoTON as display string with TON suffix */
export function formatTonWithUnit(nano: number, decimals = 2): string {
  return `${formatTon(nano, decimals)} TON`;
}

/** Format a multiplier (e.g. "1.38x") */
export function formatMultiplier(mult: number): string {
  return `${mult.toFixed(mult >= 100 ? 0 : mult >= 10 ? 1 : 2)}x`;
}
