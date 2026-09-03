/**
 * Utility to track deleted and synced record IDs for safe Google Sheets merge synchronization
 */

/**
 * Registers an ID as explicitly deleted via the application
 */
export function registerDeletedId(id: string): void {
  try {
    const deleted = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem('bk_deleted_ids', JSON.stringify(deleted));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {
    console.error('Error registering deleted ID:', e);
  }
}

/**
 * Retrieves the list of IDs deleted via the application
 */
export function getDeletedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Merges a remote list of deleted IDs with local deleted IDs
 */
export function mergeDeletedIds(remoteIds: string[]): string[] {
  const local = getDeletedIds();
  const union = Array.from(new Set([...local, ...remoteIds]));
  localStorage.setItem('bk_deleted_ids', JSON.stringify(union));
  return union;
}

/**
 * Registers a list of IDs as successfully synced to the Google Spreadsheet
 */
export function registerSyncedIds(ids: string[]): void {
  try {
    const synced = JSON.parse(localStorage.getItem('bk_synced_ids') || '[]');
    const updated = Array.from(new Set([...synced, ...ids]));
    localStorage.setItem('bk_synced_ids', JSON.stringify(updated));
  } catch (e) {
    console.error('Error registering synced IDs:', e);
  }
}

/**
 * Retrieves the list of IDs that have been previously synced
 */
export function getSyncedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('bk_synced_ids') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Clears synced IDs that are no longer present in the database to keep storage clean
 */
export function cleanupSyncedIds(activeIds: string[]): void {
  try {
    const synced = getSyncedIds();
    const activeSet = new Set(activeIds);
    const updated = synced.filter(id => activeSet.has(id));
    localStorage.setItem('bk_synced_ids', JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}
