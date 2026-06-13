import type { ImageAspectRatio, ImageQuality } from './image-options';

export type HistoryItem = {
  id: string;
  jobId: string;
  prompt: string;
  modelId: string;
  modelName: string;
  quality: ImageQuality;
  aspectRatio: ImageAspectRatio;
  createdAt: string;
  isPriority: boolean;
  imageBlob: Blob;
  mimeType: string;
  sourceType: 'url' | 'b64';
};

const DB_NAME = 'aivro-image-history';
const STORE_NAME = 'history';
const DB_VERSION = 1;

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void> {
  return openHistoryDb().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);

        if (request) {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }

        transaction.oncomplete = () => {
          db.close();
          if (!request) resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      }),
  );
}

export async function saveHistoryItem(item: HistoryItem) {
  await withStore('readwrite', (store) => store.put(item));
}

export async function listHistoryItems(): Promise<HistoryItem[]> {
  const items = (await withStore('readonly', (store) => store.getAll())) as HistoryItem[] | undefined;
  return (items || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteHistoryItem(id: string) {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearHistoryItems() {
  await withStore('readwrite', (store) => store.clear());
}

export function base64ToBlob(base64: string, mimeType = 'image/png') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function imageUrlToBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('history_image_fetch_failed');
  const blob = await response.blob();
  return blob;
}
