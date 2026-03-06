import Dexie, { type Table } from "dexie";

export interface DraftRow {
  id?: number;
  key: string;
  payload: unknown;
  updatedAt: number;
}

export interface RetryQueueRow {
  id?: number;
  type: string;
  payload: unknown;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: number;
}

class OfflineDb extends Dexie {
  drafts!: Table<DraftRow, number>;
  retryQueue!: Table<RetryQueueRow, number>;

  constructor() {
    super("ezha-offline-db");
    this.version(1).stores({
      drafts: "++id,&key,updatedAt",
      retryQueue: "++id,type,nextRetryAt,attempts,createdAt"
    });
  }
}

export const offlineDb = new OfflineDb();

export const saveDraft = async (key: string, payload: unknown): Promise<void> => {
  await offlineDb.drafts.put({
    key,
    payload,
    updatedAt: Date.now()
  });
};

export const loadDraft = async <T>(key: string): Promise<T | null> => {
  const row = await offlineDb.drafts.where("key").equals(key).first();
  if (!row) return null;
  return row.payload as T;
};

export const clearDraft = async (key: string): Promise<void> => {
  const row = await offlineDb.drafts.where("key").equals(key).first();
  if (!row?.id) return;
  await offlineDb.drafts.delete(row.id);
};

export const enqueueRetry = async (type: string, payload: unknown): Promise<void> => {
  await offlineDb.retryQueue.add({
    type,
    payload,
    attempts: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now()
  });
};
