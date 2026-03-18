/** Convert TON (number) to nanoTON (bigint) */
export function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * 1_000_000_000));
}

/** Convert nanoTON (bigint or number) to TON (number) */
export function nanoToTon(nano: bigint | number): number {
  return Number(BigInt(nano)) / 1_000_000_000;
}

/** Format nanoTON as a human-readable TON string */
export function formatTon(nano: bigint | number, decimals: number = 2): string {
  return nanoToTon(nano).toFixed(decimals);
}
