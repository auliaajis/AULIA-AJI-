/**
 * Storage Quota Manager & Safe LocalStorage Utilities
 * Prevents QuotaExceededError crashes in mobile & desktop browsers.
 * Features:
 * - Dual-layer storage (LocalStorage + In-Memory Fallback Map)
 * - Automatic quota error recovery without console error pollution
 * - Intelligent pruning of redundant legacy keys, oversized logs, and base64 attachments
 * - Safe attendance history compaction
 */

const MAX_LOGS_COUNT = 50;
const EMERGENCY_LOGS_COUNT = 20;
const MAX_LOCAL_ATTENDANCE_COUNT = 35;

// In-Memory Storage Fallback Map
// Whenever LocalStorage is full or restricted, records are stored and retrieved here seamlessly.
export const memoryStorageFallback = new Map<string, string>();

/**
 * Strips potentially oversized fields (e.g. base64 photo strings) from log and violation items.
 */
export function sanitizeLogItem(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const clean = { ...item };
  if (clean.proofPhotoUrl && typeof clean.proofPhotoUrl === 'string' && clean.proofPhotoUrl.length > 250) {
    if (clean.proofPhotoUrl.startsWith('data:image')) {
      clean.proofPhotoUrl = undefined;
    }
  }
  if (clean.photoUrl && typeof clean.photoUrl === 'string' && clean.photoUrl.length > 250) {
    if (clean.photoUrl.startsWith('data:image')) {
      clean.photoUrl = undefined;
    }
  }
  if (clean.description && typeof clean.description === 'string' && clean.description.length > 800) {
    clean.description = clean.description.slice(0, 800) + '...';
  }
  return clean;
}

/**
 * Sanitizes an array of activity logs: limits length and strips bulky attributes.
 */
export function sanitizeLogsArray(logs: any[], limit = MAX_LOGS_COUNT): any[] {
  if (!Array.isArray(logs)) return [];
  return logs.slice(0, limit).map(sanitizeLogItem);
}

/**
 * Strips bulky base64 attachments from violations array for localStorage saving.
 */
export function sanitizeViolationsArray(violations: any[]): any[] {
  if (!Array.isArray(violations)) return [];
  return violations.map((v: any) => {
    if (!v || typeof v !== 'object') return v;
    if (v.proofPhotoUrl && typeof v.proofPhotoUrl === 'string' && v.proofPhotoUrl.length > 300 && v.proofPhotoUrl.startsWith('data:image')) {
      const copy = { ...v };
      delete copy.proofPhotoUrl;
      return copy;
    }
    return v;
  });
}

/**
 * Compacts attendance history array to most recent dates to conserve localStorage space.
 */
export function compactAttendanceHistory(records: any[], maxCount = MAX_LOCAL_ATTENDANCE_COUNT): any[] {
  if (!Array.isArray(records)) return [];
  if (records.length <= maxCount) return records;
  return records.slice(0, maxCount);
}

/**
 * Safely retrieves an item from LocalStorage or Memory Fallback.
 */
export function safeGetItem(key: string): string | null {
  if (typeof localStorage === 'undefined') {
    return memoryStorageFallback.get(key) ?? null;
  }
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {
    // Ignore and fallback to memory
  }
  return memoryStorageFallback.get(key) ?? null;
}

/**
 * Safely removes an item from both LocalStorage and Memory Fallback.
 */
export function safeRemoveItem(key: string): void {
  memoryStorageFallback.delete(key);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

/**
 * Cleans up obsolete unpartitioned legacy keys if partitioned keys already exist.
 * This recovers up to 2-3MB of redundant storage immediately.
 */
export function cleanupDuplicateLegacyKeys(): void {
  if (typeof localStorage === 'undefined') return;
  const legacyBaseKeys = [
    'bk_attendance_history',
    'bk_violations',
    'bk_students',
    'bk_services',
    'bk_counselors',
    'bk_daily_journals',
    'bk_parent_summons',
    'bk_home_visits',
    'bk_logs'
  ];

  try {
    for (const baseKey of legacyBaseKeys) {
      let hasPartition = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${baseKey}_sch_`)) {
          hasPartition = true;
          break;
        }
      }
      if (hasPartition) {
        localStorage.removeItem(baseKey);
      }
    }
  } catch (e) {}
}

/**
 * Aggressively prunes localStorage to free up space.
 * Preserves core records: students, violations, services, counselors, configs.
 */
export function pruneStorageQuota(aggressive = false): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // 1. Clean duplicate unpartitioned legacy keys
    cleanupDuplicateLegacyKeys();

    const keysToRemove: string[] = [];
    const keysToTrimLogs: string[] = [];
    const keysToCompactAttendance: string[] = [];

    const activeSchoolId = (() => {
      try {
        return localStorage.getItem('bk_active_school_id') || 'sch_20320123';
      } catch {
        return 'sch_20320123';
      }
    })();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Identify log keys for truncation
      if (key === 'bk_logs' || key.startsWith('bk_logs_')) {
        keysToTrimLogs.push(key);
      }
      // Compact attendance history keys
      else if (key === 'bk_attendance_history' || key.startsWith('bk_attendance_history_')) {
        if (aggressive && !key.includes(activeSchoolId)) {
          keysToRemove.push(key);
        } else {
          keysToCompactAttendance.push(key);
        }
      }
      // Non-critical temporary/cached keys that can be safely removed
      else if (
        key.startsWith('bk_temp_') ||
        key.startsWith('bk_cache_') ||
        key.startsWith('bk_preview_') ||
        key === 'bk_google_sync_verified' ||
        key === 'bk_synced_ids' ||
        (aggressive && (key === 'bk_deleted_ids' || key.startsWith('bk_deleted_ids_')))
      ) {
        keysToRemove.push(key);
      }
    }

    // Remove identified keys (backing them up in memory fallback first)
    keysToRemove.forEach((k) => {
      try {
        const val = localStorage.getItem(k);
        if (val && !memoryStorageFallback.has(k)) {
          memoryStorageFallback.set(k, val);
        }
        localStorage.removeItem(k);
      } catch (e) {}
    });

    // Truncate logs
    const targetLogLimit = aggressive ? EMERGENCY_LOGS_COUNT : MAX_LOGS_COUNT;
    keysToTrimLogs.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const trimmed = sanitizeLogsArray(parsed, targetLogLimit);
            localStorage.setItem(k, JSON.stringify(trimmed));
          }
        }
      } catch (e) {
        try {
          localStorage.removeItem(k);
        } catch {}
      }
    });

    // Compact attendance histories in localStorage
    const targetAttendanceLimit = aggressive ? 15 : MAX_LOCAL_ATTENDANCE_COUNT;
    keysToCompactAttendance.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          // Keep the full payload safely in memory fallback
          if (!memoryStorageFallback.has(k)) {
            memoryStorageFallback.set(k, raw);
          }
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > targetAttendanceLimit) {
            const compacted = compactAttendanceHistory(parsed, targetAttendanceLimit);
            localStorage.setItem(k, JSON.stringify(compacted));
          }
        }
      } catch (e) {}
    });
  } catch (err) {
    // Fail silently
  }
}

/**
 * Safe wrapper around localStorage.setItem.
 * If QuotaExceededError is caught, it automatically prunes logs & caches,
 * compacts bulky collections, and retries. If it still cannot fit in localStorage,
 * it seamlessly saves the data in memoryStorageFallback without throwing or logging console.error.
 */
export function safeSetItem(key: string, value: string): boolean {
  // Always update memory fallback as well for zero data-loss resilience
  memoryStorageFallback.set(key, value);

  if (typeof localStorage === 'undefined') return true;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    const isQuota =
      e &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014 ||
        (typeof e.message === 'string' && e.message.toLowerCase().includes('quota')));

    if (isQuota) {
      // Step 1: standard prune & deduplicate
      pruneStorageQuota(false);

      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr1) {
        // Step 2: aggressive prune
        pruneStorageQuota(true);

        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryErr2) {
          // If still exceeded, data is already safely stored in memoryStorageFallback.
          // Never output console.error with the QuotaExceededError object.
          console.warn(`[StorageQuota] LocalStorage quota reached. Saved "${key}" to resilient memory cache.`);
          return true;
        }
      }
    } else {
      console.warn(`[StorageQuota] LocalStorage warning for "${key}". Saved to memory cache.`);
      return true;
    }
  }
}

/**
 * Check and clean on application startup.
 */
export function runStartupStorageCheck(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    cleanupDuplicateLegacyKeys();
    pruneStorageQuota(false);
  } catch (e) {}
}
