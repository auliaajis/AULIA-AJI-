/**
 * Utility to track deleted and synced record IDs for safe Google Sheets merge synchronization
 */

export function isProtectedCanonicalId(id: string): boolean {
  const str = String(id).trim();
  // Protect counselors c1..c99, system admin, and canonical student IDs
  if (/^(c[0-9]+|admin|aulia|nona|tri|bina)$/i.test(str)) return true;
  if (/^s([1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-5][0-9])$/i.test(str)) return true;
  return false;
}

/**
 * Registers an ID as explicitly deleted via the application
 */
export function registerDeletedId(id: string): void {
  try {
    if (isProtectedCanonicalId(id)) {
      return; // Never register protected canonical system data as deleted
    }
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
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (!Array.isArray(raw)) return [];
    // Protect canonical student, violation, service, home visit, log, and counselor IDs from accidental suppression
    return raw.filter((id: string) => !isProtectedCanonicalId(id));
  } catch (e) {
    return [];
  }
}

/**
 * Clears any accidental canonical IDs from deletion tracker
 */
export function clearCanonicalDeletedIds(): void {
  try {
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (Array.isArray(raw)) {
      const filtered = raw.filter((id: string) => !isProtectedCanonicalId(id));
      localStorage.setItem('bk_deleted_ids', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {}
}

/**
 * Unblocks all student IDs from the deletion tracker
 */
export function resetStudentDeletedIds(): void {
  try {
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (Array.isArray(raw)) {
      const filtered = raw.filter((id: string) => {
        const str = String(id).trim();
        // Remove student IDs (s1..s300 or digits)
        if (/^s[0-9]+/i.test(str) || /^[0-9]{5,}/.test(str)) return false;
        return !isProtectedCanonicalId(id);
      });
      localStorage.setItem('bk_deleted_ids', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {}
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
