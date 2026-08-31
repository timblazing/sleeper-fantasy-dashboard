export const REQUEST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const REQUEST_RATE_LIMIT_MAX_REQUESTS = 20;
export const REQUEST_RATE_LIMIT_MAX_KEYS = 1024;

const requestTimestamps = new Map<string, number[]>();

function removeStaleEntries(now: number) {
  const cutoff = now - REQUEST_RATE_LIMIT_WINDOW_MS;

  for (const [key, timestamps] of requestTimestamps) {
    const recent = timestamps.filter((timestamp) => timestamp > cutoff);
    if (recent.length === 0) {
      requestTimestamps.delete(key);
    } else if (recent.length !== timestamps.length) {
      requestTimestamps.set(key, recent);
    }
  }
}

function removeOldestEntry() {
  let oldestKey: string | undefined;
  let oldestTimestamp = Number.POSITIVE_INFINITY;

  for (const [key, timestamps] of requestTimestamps) {
    const lastRequest = timestamps[timestamps.length - 1];
    if (lastRequest !== undefined && lastRequest < oldestTimestamp) {
      oldestKey = key;
      oldestTimestamp = lastRequest;
    }
  }

  if (oldestKey !== undefined) {
    requestTimestamps.delete(oldestKey);
  }
}

export function isRequestAllowed(requestKey: string, now = Date.now()): boolean {
  removeStaleEntries(now);

  const cutoff = now - REQUEST_RATE_LIMIT_WINDOW_MS;
  const timestamps = requestTimestamps.get(requestKey)?.filter((timestamp) => timestamp > cutoff) ?? [];
  if (timestamps.length >= REQUEST_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  if (!requestTimestamps.has(requestKey) && requestTimestamps.size >= REQUEST_RATE_LIMIT_MAX_KEYS) {
    removeOldestEntry();
  }

  timestamps.push(now);
  requestTimestamps.set(requestKey, timestamps);
  return true;
}

export function resetRequestRateLimitForTests() {
  requestTimestamps.clear();
}
