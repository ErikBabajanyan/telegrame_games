import { createHmac, createHash, randomBytes } from 'crypto';

export function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

export function hmacSha256Hex(key: string | Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

export function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function generateRandomHex(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}
