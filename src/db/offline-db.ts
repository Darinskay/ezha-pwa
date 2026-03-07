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

const toIndexedDbCloneable = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
  if (value == null) return value;

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean" ||
    valueType === "bigint" ||
    valueType === "undefined"
  ) {
    return value;
  }

  if (valueType === "function" || valueType === "symbol") {
    return undefined;
  }

  if (valueType !== "object") {
    return value;
  }

  const isBlob = typeof Blob !== "undefined" && value instanceof Blob;
  const isFile = typeof File !== "undefined" && value instanceof File;

  if (value instanceof Date || value instanceof RegExp || isBlob || isFile || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) {
      clone.push(toIndexedDbCloneable(item, seen));
    }
    return clone;
  }

  if (value instanceof Map) {
    const clone = new Map<unknown, unknown>();
    seen.set(value, clone);
    for (const [key, nestedValue] of value.entries()) {
      clone.set(toIndexedDbCloneable(key, seen), toIndexedDbCloneable(nestedValue, seen));
    }
    return clone;
  }

  if (value instanceof Set) {
    const clone = new Set<unknown>();
    seen.set(value, clone);
    for (const item of value.values()) {
      clone.add(toIndexedDbCloneable(item, seen));
    }
    return clone;
  }

  const clone: Record<string, unknown> = {};
  seen.set(value as object, clone);
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const nestedClone = toIndexedDbCloneable(nestedValue, seen);
    if (nestedClone !== undefined) {
      clone[key] = nestedClone;
    }
  }

  return clone;
};

export const saveDraft = async (key: string, payload: unknown): Promise<void> => {
  const cloneablePayload = toIndexedDbCloneable(payload);
  const updatedAt = Date.now();

  await offlineDb.transaction("rw", offlineDb.drafts, async () => {
    const existing = await offlineDb.drafts.where("key").equals(key).first();
    if (existing?.id != null) {
      await offlineDb.drafts.update(existing.id, {
        payload: cloneablePayload,
        updatedAt
      });
      return;
    }

    await offlineDb.drafts.add({
      key,
      payload: cloneablePayload,
      updatedAt
    });
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
    payload: toIndexedDbCloneable(payload),
    attempts: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now()
  });
};
