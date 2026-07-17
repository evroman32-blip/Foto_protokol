import type { FileSignatureRule } from './types';

const SIGNATURE_RULES: FileSignatureRule[] = [
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'], signatures: [[0xff, 0xd8, 0xff]] },
  { mimeType: 'image/png', extensions: ['png'], signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  { mimeType: 'image/tiff', extensions: ['tiff', 'tif'], signatures: [[0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a]] },
  { mimeType: 'application/pdf', extensions: ['pdf'], signatures: [[0x25, 0x50, 0x44, 0x46]] },
  { mimeType: 'video/mp4', extensions: ['mp4'], signatures: [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]] },
  { mimeType: 'video/quicktime', extensions: ['mov'], signatures: [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]] },
  { mimeType: 'application/dicom', extensions: ['dcm', 'dicom'], signatures: [[0x44, 0x49, 0x43, 0x4d]] },
  { mimeType: 'application/zip', extensions: ['zip'], signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]] },
];

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}

export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const rule = SIGNATURE_RULES.find((r) => r.mimeType === mimeType);
  if (!rule) return true;
  return rule.signatures.some((sig) => matchesSignature(buffer, sig));
}

export function detectMimeFromSignature(buffer: Buffer): string | null {
  for (const rule of SIGNATURE_RULES) {
    if (rule.signatures.some((sig) => matchesSignature(buffer, sig))) {
      return rule.mimeType;
    }
  }
  return null;
}

export { SIGNATURE_RULES };
