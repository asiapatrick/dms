/**
 * MySQL stores UIDs as BINARY(16) via UUID_TO_BIN(UUID(), 1).
 * The swap_flag=1 rearranges bytes for better index locality on time-based UUIDs:
 *   binary[0-1] = uuid time_hi_version  (uuid bytes 6-7)
 *   binary[2-3] = uuid time_mid         (uuid bytes 4-5)
 *   binary[4-7] = uuid time_low         (uuid bytes 0-3)
 *   binary[8-15]= clock_seq + node      (unchanged)
 *
 * These helpers convert between the stored Uint8Array and standard UUID strings.
 * We use Uint8Array<ArrayBuffer> (not Buffer<ArrayBufferLike>) so the return type
 * is compatible with Prisma v7's Bytes where-clause which expects Uint8Array<ArrayBuffer>.
 */

/** Convert a BINARY(16) Uint8Array (from UUID_TO_BIN with swap=1) to a UUID string. */
export function bufferToUuid(buf: Uint8Array): string {
  const out = new Uint8Array(16);
  out.set(buf.subarray(4, 8), 0);  // time_low
  out.set(buf.subarray(2, 4), 4);  // time_mid
  out.set(buf.subarray(0, 2), 6);  // time_hi_version
  out.set(buf.subarray(8, 16), 8); // clock_seq + node
  let h = '';
  for (const byte of out) { h += byte.toString(16).padStart(2, '0'); }
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Convert a UUID string to a BINARY(16) Uint8Array compatible with UUID_TO_BIN(uuid, 1). */
export function uuidToBuffer(uuid: string): Uint8Array<ArrayBuffer> {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`Invalid UUID: "${uuid}"`);
  const orig = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    orig[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const out = new Uint8Array(16);
  out.set(orig.subarray(6, 8), 0);  // time_hi_version → binary[0-1]
  out.set(orig.subarray(4, 6), 2);  // time_mid         → binary[2-3]
  out.set(orig.subarray(0, 4), 4);  // time_low          → binary[4-7]
  out.set(orig.subarray(8, 16), 8); // clock_seq + node  → binary[8-15]
  return out;
}
