'use client';

const DATABASE_NAME = 'fmh-oral-26-attachments';
const DATABASE_VERSION = 1;
const IMAGE_STORE = 'topic-images';
const TOPIC_INDEX = 'topicId';
const CHANNEL_NAME = 'fmh-oral-26-image-updates';
const FALLBACK_EVENT_KEY = 'fmh-oral-26-image-update';

export const MAX_TOPIC_IMAGES = 24;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_LONG_EDGE = 2200;
const RESIZE_THRESHOLD_BYTES = 2.5 * 1024 * 1024;
const MAX_BACKUP_IMAGE_BYTES = 40 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type TopicImageAttachment = {
  id: string;
  topicId: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  createdAt: number;
  blob: Blob;
};

export type TopicImageBackup = Omit<TopicImageAttachment, 'blob'> & {
  dataUrl: string;
};

type PreparedTopicImage = Omit<TopicImageAttachment, 'id' | 'topicId' | 'createdAt'>;

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Attachment storage request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Attachment storage was interrupted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Attachment storage failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Image storage is unavailable in this browser'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        const store = database.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
        store.createIndex(TOPIC_INDEX, TOPIC_INDEX, { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('Image storage could not be opened'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('Close other copies of this site and try again'));
    };
  });

  return databasePromise;
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notifyTopicChange(topicId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANNEL_NAME, { detail: { topicId } }));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ topicId });
    channel.close();
    return;
  }

  try {
    localStorage.setItem(FALLBACK_EVENT_KEY, JSON.stringify({ topicId, at: Date.now() }));
  } catch {
    // The attachment itself is already safe; cross-tab refresh can wait for reload.
  }
}

export function subscribeToTopicImageChanges(callback: (topicId?: string) => void) {
  const onLocalChange = (event: Event) => {
    const detail = (event as CustomEvent<{ topicId?: string }>).detail;
    callback(detail?.topicId);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== FALLBACK_EVENT_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as { topicId?: unknown };
      callback(typeof message.topicId === 'string' ? message.topicId : undefined);
    } catch {
      callback();
    }
  };
  let channel: BroadcastChannel | null = null;

  window.addEventListener(CHANNEL_NAME, onLocalChange);
  window.addEventListener('storage', onStorage);
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<{ topicId?: unknown }>) => {
      callback(typeof event.data?.topicId === 'string' ? event.data.topicId : undefined);
    };
  }

  return () => {
    window.removeEventListener(CHANNEL_NAME, onLocalChange);
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}

export async function listTopicImages(topicId: string): Promise<TopicImageAttachment[]> {
  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readonly');
  const finished = transactionDone(transaction);
  const request = requestResult(
    transaction.objectStore(IMAGE_STORE).index(TOPIC_INDEX).getAll(IDBKeyRange.only(topicId)),
  ) as Promise<TopicImageAttachment[]>;
  const [images] = await Promise.all([request, finished]);
  return images.sort((left, right) => left.createdAt - right.createdAt);
}

async function listAllTopicImages(): Promise<TopicImageAttachment[]> {
  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readonly');
  const finished = transactionDone(transaction);
  const request = requestResult(transaction.objectStore(IMAGE_STORE).getAll()) as Promise<TopicImageAttachment[]>;
  const [images] = await Promise.all([request, finished]);
  return images.sort((left, right) => left.createdAt - right.createdAt);
}

export async function listTopicIdsWithImages(): Promise<Set<string>> {
  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readonly');
  const finished = transactionDone(transaction);
  const request = transaction.objectStore(IMAGE_STORE).index(TOPIC_INDEX).openKeyCursor(null, 'nextunique');
  const topicRequest = new Promise<Set<string>>((resolve, reject) => {
    const ids = new Set<string>();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(ids);
        return;
      }
      if (typeof cursor.key === 'string') ids.add(cursor.key);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Image topics could not be read'));
  });
  const [topicIds] = await Promise.all([topicRequest, finished]);
  return topicIds;
}

function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This image could not be prepared'));
    }, type, quality);
  });
}

function webpName(name: string) {
  const stem = name.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.webp`;
}

export function isSupportedImageFile(file: File) {
  return SUPPORTED_TYPES.has(file.type);
}

export async function prepareTopicImage(file: File): Promise<PreparedTopicImage> {
  if (!isSupportedImageFile(file)) throw new Error('Use a JPEG, PNG, or WEBP image');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Images must be smaller than 25 MB');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name || 'Image'} could not be read`);
  }

  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_LONG_EDGE && file.size <= RESIZE_THRESHOLD_BYTES) {
      return {
        name: file.name || 'image',
        mimeType: file.type,
        size: file.size,
        width,
        height,
        blob: file,
      };
    }

    const scale = Math.min(1, MAX_LONG_EDGE / longEdge);
    const resizedWidth = Math.max(1, Math.round(width * scale));
    const resizedHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = resizedWidth;
    canvas.height = resizedHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This image could not be prepared');
    context.drawImage(bitmap, 0, 0, resizedWidth, resizedHeight);
    const blob = await blobFromCanvas(canvas, 'image/webp', 0.9);

    return {
      name: webpName(file.name),
      mimeType: blob.type || 'image/webp',
      size: blob.size,
      width: resizedWidth,
      height: resizedHeight,
      blob,
    };
  } finally {
    bitmap.close();
  }
}

export async function addTopicImages(topicId: string, images: PreparedTopicImage[]) {
  if (images.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readwrite');
  const finished = transactionDone(transaction);
  const store = transaction.objectStore(IMAGE_STORE);
  let existingCount: number;
  try {
    existingCount = await requestResult(store.index(TOPIC_INDEX).count(IDBKeyRange.only(topicId)));
  } catch (error) {
    try {
      await finished;
    } catch {
      // The request error below is the useful failure to surface.
    }
    throw error;
  }
  if (existingCount + images.length > MAX_TOPIC_IMAGES) {
    transaction.abort();
    try {
      await finished;
    } catch {
      // The deliberate abort keeps the store unchanged.
    }
    throw new Error(`Maximum ${MAX_TOPIC_IMAGES} images per topic`);
  }
  const baseTime = Date.now();

  images.forEach((image, index) => {
    const record: TopicImageAttachment = {
      ...image,
      id: createId(),
      topicId,
      createdAt: baseTime + index,
    };
    store.put(record);
  });

  await finished;
  notifyTopicChange(topicId);
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is best-effort and never changes whether the image was saved.
  }
}

export async function removeTopicImage(topicId: string, imageId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readwrite');
  const finished = transactionDone(transaction);
  transaction.objectStore(IMAGE_STORE).delete(imageId);
  await finished;
  notifyTopicChange(topicId);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('An attachment could not be added to the backup'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match || !SUPPORTED_TYPES.has(match[1])) throw new Error('Invalid image data in backup');
  const binary = atob(match[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

export function isTopicImageBackup(value: unknown): value is TopicImageBackup[] {
  if (!Array.isArray(value)) return false;
  let encodedCharacters = 0;
  const imageIds = new Set<string>();
  const topicCounts = new Map<string, number>();
  return value.every((image) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) return false;
    const candidate = image as Partial<TopicImageBackup>;
    if (typeof candidate.id !== 'string' || imageIds.has(candidate.id)) return false;
    if (typeof candidate.topicId !== 'string') return false;
    imageIds.add(candidate.id);
    const topicCount = (topicCounts.get(candidate.topicId) ?? 0) + 1;
    topicCounts.set(candidate.topicId, topicCount);
    if (topicCount > MAX_TOPIC_IMAGES) return false;
    if (typeof candidate.dataUrl === 'string') encodedCharacters += candidate.dataUrl.length;

    return typeof candidate.id === 'string'
      && typeof candidate.topicId === 'string'
      && typeof candidate.name === 'string'
      && typeof candidate.mimeType === 'string'
      && SUPPORTED_TYPES.has(candidate.mimeType)
      && typeof candidate.size === 'number' && Number.isFinite(candidate.size) && candidate.size >= 0
      && typeof candidate.width === 'number' && Number.isFinite(candidate.width) && candidate.width > 0
      && typeof candidate.height === 'number' && Number.isFinite(candidate.height) && candidate.height > 0
      && typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
      && typeof candidate.dataUrl === 'string'
      && encodedCharacters <= Math.ceil(MAX_BACKUP_IMAGE_BYTES * 1.38)
      && candidate.dataUrl.startsWith(`data:${candidate.mimeType};base64,`);
  });
}

export async function exportTopicImagesForBackup(): Promise<TopicImageBackup[]> {
  const images = await listAllTopicImages();
  const totalBytes = images.reduce((total, image) => total + image.blob.size, 0);
  if (totalBytes > MAX_BACKUP_IMAGE_BYTES) {
    throw new Error('Images exceed the safe backup size');
  }
  const backup: TopicImageBackup[] = [];
  for (const image of images) {
    backup.push({
      id: image.id,
      topicId: image.topicId,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      dataUrl: await blobToDataUrl(image.blob),
    });
  }
  return backup;
}

export async function restoreTopicImagesFromBackup(value: TopicImageBackup[]) {
  const records = value.map((image) => {
    const blob = dataUrlToBlob(image.dataUrl);
    return {
      id: image.id,
      topicId: image.topicId,
      name: image.name,
      mimeType: image.mimeType,
      size: blob.size,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      blob,
    } satisfies TopicImageAttachment;
  });

  const database = await openDatabase();
  const transaction = database.transaction(IMAGE_STORE, 'readwrite');
  const finished = transactionDone(transaction);
  const store = transaction.objectStore(IMAGE_STORE);
  store.clear();
  records.forEach((record) => store.put(record));
  await finished;
  notifyTopicChange('*');
}
