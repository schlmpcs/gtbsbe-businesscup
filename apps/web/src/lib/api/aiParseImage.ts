// Client for POST /api/ai/parse-image (JF9): a photo, screenshot or PDF of a statement or a loan
// offer → parsed inputs the user confirms. Photos are downsized in the browser first (long side
// ≤ 1600 px, JPEG) so a phone camera shot uploads fast and stays under the provider's image cap.
// Nothing is stored: the server reads the file for this request only.
import { DEBT_KINDS, LoanInputSchema, type Debt, type LoanInput, type Money, type Rate } from '@lifeguessr/types';
import { z } from 'zod';
import { ApiError, postJson } from './http';

export type ParsedDebt = { kind: Debt['kind'] | null; balance: Money; apr: Rate | null; minPayment: Money | null };
export type ImageParseKind = 'debt' | 'loan';
export type ImageParseValueOf = { debt: ParsedDebt; loan: LoanInput };

/** What the file picker accepts. */
export const SCAN_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf';

const MAX_SIDE = 1600;
const MAX_BYTES = 4_500_000;

const ParsedDebtSchema = z.object({
  kind: z.enum(DEBT_KINDS).nullable(),
  balance: z.number().nonnegative(),
  apr: z.number().min(0).max(1).nullable(),
  minPayment: z.number().nonnegative().nullable(),
});
const valueSchemas = { debt: ParsedDebtSchema, loan: LoanInputSchema } as const;

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** The file as base64 in a type the server takes: PDFs as is, images re-encoded as a downsized JPEG. */
export async function encodeFile(file: File): Promise<{ mediaType: string; data: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new ApiError('file too large', 413);
    return { mediaType: file.type, data: toBase64(await file.arrayBuffer()) };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ApiError('not an image the browser can read', 400);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ApiError('canvas unavailable', 400);
  ctx.fillStyle = '#fff'; // transparent screenshots → white, not black, in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new ApiError('could not encode the image', 400);
  return { mediaType: 'image/jpeg', data: toBase64(await blob.arrayBuffer()) };
}

export async function parseImage<K extends ImageParseKind>(
  kind: K,
  file: File,
  opts: { anonId?: string; signal?: AbortSignal } = {},
): Promise<ImageParseValueOf[K]> {
  const { mediaType, data } = await encodeFile(file);
  const schema = z.object({
    ok: z.literal(true),
    kind: z.literal(kind),
    value: valueSchemas[kind] as unknown as z.ZodType<ImageParseValueOf[K]>,
  });
  const res = await postJson('/api/ai/parse-image', { kind, mediaType, data }, schema, opts);
  return res.value;
}
