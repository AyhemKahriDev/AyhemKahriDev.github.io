import type { Storage } from './types';

/** Namespaced localStorage that survives private-mode failures. */
export function createStorage(namespace: string): Storage {
  const key = (k: string) => `${namespace}:${k}`;
  const mem = new Map<string, string>();

  const read = (k: string): string | null => {
    try {
      const v = localStorage.getItem(key(k));
      if (v !== null) return v;
    } catch {
      /* fall through to memory */
    }
    return mem.get(key(k)) ?? null;
  };

  const write = (k: string, v: string) => {
    mem.set(key(k), v);
    try {
      localStorage.setItem(key(k), v);
    } catch {
      /* memory only */
    }
  };

  return {
    get<T>(k: string, fallback: T): T {
      const raw = read(k);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(k: string, value: T) {
      write(k, JSON.stringify(value));
    },
    remove(k: string) {
      mem.delete(key(k));
      try {
        localStorage.removeItem(key(k));
      } catch {
        /* ignore */
      }
    },
    number(k: string, fallback: number): number {
      const raw = read(k);
      if (raw === null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    },
    inc(k: string, by: number): number {
      const next = this.number(k, 0) + by;
      write(k, JSON.stringify(next));
      return next;
    },
  };
}
