/**
 * Client-side provably fair verification.
 * Uses Web Crypto API (works in browser without Node.js crypto).
 */

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify that serverSeedHash matches SHA-256(serverSeed) */
export async function verifyServerSeedHash(serverSeed: string, serverSeedHash: string): Promise<boolean> {
  const computed = await sha256Hex(serverSeed);
  return computed === serverSeedHash;
}

/** Recompute mine positions from seeds — same algorithm as backend */
export async function computeMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
): Promise<number[]> {
  const hash = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);

  const cells = Array.from({ length: 25 }, (_, i) => i);

  for (let i = 24; i > 0; i--) {
    const offset = (i * 4) % 60;
    const val = parseInt(hash.slice(offset, offset + 8), 16);
    const j = val % (i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, mineCount).sort((a, b) => a - b);
}

/** Full game verification */
export async function verifyGame(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
  claimedPositions: number[],
): Promise<{ valid: boolean; hashMatch: boolean; positionsMatch: boolean }> {
  const hashMatch = await verifyServerSeedHash(serverSeed, serverSeedHash);
  const computedPositions = await computeMinePositions(serverSeed, clientSeed, nonce, mineCount);
  const positionsMatch = JSON.stringify(computedPositions) === JSON.stringify([...claimedPositions].sort((a, b) => a - b));

  return { valid: hashMatch && positionsMatch, hashMatch, positionsMatch };
}
