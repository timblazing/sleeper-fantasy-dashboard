/**
 * A tiny in-process memo: TTL, single-flight dedupe, and serve-stale-on-error.
 *
 * This exists for payloads too large for Next's data cache (the ~15MB Sleeper player map, the
 * weekly projection feed), which have to live in module memory instead. Both current callers are
 * effectively single-key, so entries are retained per key and never evicted — if a caller ever
 * uses an unbounded key space, that is the point to add an eviction policy.
 */
export type MemoOptions<K extends string, V> = {
  load: (key: K) => Promise<V>;
  ttlMs: number;
  /** "throw" rethrows when there is no usable cached value; otherwise this factory supplies a fallback. */
  onError: "throw" | (() => V);
};

export type Memo<K extends string, V> = {
  get(key: K): Promise<V>;
  /** Test hook — drops cache and inflight state. */
  reset(): void;
};

export function createMemo<K extends string, V>(options: MemoOptions<K, V>): Memo<K, V> {
  const cache = new Map<K, { at: number; value: V }>();
  const inflight = new Map<K, Promise<V>>();

  return {
    async get(key: K): Promise<V> {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < options.ttlMs) return cached.value;

      let promise = inflight.get(key);
      if (!promise) {
        promise = options
          .load(key)
          .then((value) => { cache.set(key, { at: Date.now(), value }); return value; })
          // Guarded by identity so a slow loser cannot clear a newer inflight entry for the same key.
          .finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
        inflight.set(key, promise);
      }

      try {
        return await promise;
      } catch (error) {
        // A stale value beats nothing when the upstream is briefly unavailable.
        const stale = cache.get(key);
        if (stale) return stale.value;
        if (options.onError === "throw") throw error;
        return options.onError();
      }
    },
    reset() {
      cache.clear();
      inflight.clear();
    },
  };
}
