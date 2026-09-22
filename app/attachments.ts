'use client';

import { isSupportedImageFile, prepareTopicImage } from './topic-images';

export const MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';

const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf', PPTX]);

/** Browsers sometimes leave the type empty for pptx / heic; infer from the extension. */
export function attachmentType(file: File): string | null {
  if (TYPES.has(file.type)) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'pptx') return PPTX;
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return null;
}

export function isSupportedAttachment(file: File) {
  return attachmentType(file) !== null;
}

export function isPreviewableImage(type: string) {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/gif';
}

export function attachmentKind(type: string): 'image' | 'pdf' | 'pptx' | 'file' {
  if (isPreviewableImage(type) || type === 'image/heic' || type === 'image/heif') return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type === PPTX) return 'pptx';
  return 'file';
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Shrinks big JPEG/PNG/WebP images the same way the local note images are; everything else is sent as is. */
export async function prepareAttachment(file: File): Promise<{ blob: Blob; type: string; name: string }> {
  const type = attachmentType(file);
  if (!type) throw new Error('USE AN IMAGE, PDF, OR PPTX');
  if (isSupportedImageFile(file)) {
    const prepared = await prepareTopicImage(file);
    return { blob: prepared.blob, type: prepared.mimeType, name: file.name || prepared.name };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('FILE IS TOO LARGE · 40 MB MAX');
  return { blob: file, type, name: file.name };
}
