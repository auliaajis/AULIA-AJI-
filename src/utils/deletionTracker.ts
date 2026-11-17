/**
 * Utility to track deleted and synced record IDs for safe Google Sheets merge synchronization
 */

export function isProtectedCanonicalId(id: string): boolean {
  if (!id) return false;
  const str = String(id).trim();
  // Hanya lindungi ID akun sistem konselor, JANGAN lindungi data siswa/kasus/layanan/absensi
  // agar data yang sudah dihapus pengguna tetap permanen tersimpan sebagai terhapus.
  if (/^(c[0-9]+|admin|aulia|nona|tri|bina)$/i.test(str)) return true;
  return false;
}

/**
 * Completely clears the deletion tracker (only for manual total reset)
 */
export function clearAllDeletedIds(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('bk_deleted_ids');
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {}
}

/**
 * Registers an ID as explicitly deleted via the application
 */
export function registerDeletedId(id: string): void {
  try {
    if (!id) return;
    if (isProtectedCanonicalId(id)) {
      return; // Never register counselor system account IDs as deleted
    }
    const cleanId = String(id).trim();
    const deleted = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (Array.isArray(deleted) && !deleted.includes(cleanId)) {
      deleted.push(cleanId);
      localStorage.setItem('bk_deleted_ids', JSON.stringify(deleted));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {
    console.error('Error registering deleted ID:', e);
  }
}

/**
 * Removes an ID from the deletion tracker ONLY when user explicitly restores it from Sampah / Trash
 */
export function unregisterDeletedId(id: string): void {
  try {
    if (!id) return;
    const cleanId = String(id).trim();
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (Array.isArray(raw)) {
      const filtered = raw.filter((item: string) => String(item).trim() !== cleanId);
      localStorage.setItem('bk_deleted_ids', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (e) {
    console.error('Error unregistering deleted ID:', e);
  }
}

/**
 * Retrieves the list of IDs deleted via the application
 */
export function getDeletedIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((id: string) => String(id).trim()).filter((id: string) => Boolean(id) && !isProtectedCanonicalId(id));
  } catch (e) {
    return [];
  }
}

/**
 * DINONAKTIFKAN untuk mencegah data yang sudah dihapus muncul lagi saat refresh/login.
 * Hanya menyaring ID akun konselor jika ada.
 */
export function clearCanonicalDeletedIds(): void {
  try {
    const raw = JSON.parse(localStorage.getItem('bk_deleted_ids') || '[]');
    if (Array.isArray(raw)) {
      const filtered = raw.filter((id: string) => !isProtectedCanonicalId(id));
      localStorage.setItem('bk_deleted_ids', JSON.stringify(filtered));
    }
  } catch (e) {}
}

/**
 * DINONAKTIFKAN untuk data siswa yang dihapus pengguna agar tidak muncul kembali saat refresh/login.
 */
export function resetStudentDeletedIds(): void {
  // Sengaja dibiarkan no-op agar siswa yang sudah dihapus TIDAK muncul lagi saat refresh/login.
}

/**
 * Merges a remote list of deleted IDs with local deleted IDs
 */
export function mergeDeletedIds(remoteIds: string[]): string[] {
  const local = getDeletedIds();
  const cleanRemote = (remoteIds || []).map(id => String(id).trim()).filter(id => Boolean(id) && !isProtectedCanonicalId(id));
  const union = Array.from(new Set([...local, ...cleanRemote]));
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
