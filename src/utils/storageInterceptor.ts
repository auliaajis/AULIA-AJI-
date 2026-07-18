// storageInterceptor.ts - Interceptor prototype untuk mendukung database terpisah (multi-tenant)
// jika diaktifkan di pengaturan sistem.

const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;

const isolatedKeys = [
  'bk_students',
  'bk_violations',
  'bk_services',
  'bk_logs',
  'bk_google_spreadsheet_id',
  'bk_google_spreadsheet_url',
  'bk_google_script_url',
  'bk_google_sync_verified',
  'bk_google_direct_history',
  'bk_attendance_history',
  'bk_parent_summons',
  'bk_daily_journals'
];

Storage.prototype.getItem = function(this: Storage, key: string): string | null {
  // Hanya jalankan isolasi untuk localStorage, abaikan sessionStorage jika ada
  if (this === window.localStorage) {
    const isIsolated = originalGetItem.call(this, 'bk_database_mode') === 'isolated';
    if (isIsolated && isolatedKeys.includes(key)) {
      const activeCounselorId = originalGetItem.call(this, 'bk_active_counselor_id') || 'admin';
      const isolatedKey = `${key}_${activeCounselorId}`;
      let value = originalGetItem.call(this, isolatedKey);
      
      // Jika key terisolasi belum ada nilainya, cari dari key original global
      if (value === null) {
        const originalValue = originalGetItem.call(this, key);
        if (originalValue !== null) {
          // Salin ke key terisolasi agar ke depannya perubahan tersimpan secara mandiri
          originalSetItem.call(this, isolatedKey, originalValue);
          value = originalValue;
        }
      }
      return value;
    }
  }
  return originalGetItem.call(this, key);
};

Storage.prototype.setItem = function(this: Storage, key: string, value: string): void {
  if (this === window.localStorage) {
    const isIsolated = originalGetItem.call(this, 'bk_database_mode') === 'isolated';
    if (isIsolated && isolatedKeys.includes(key)) {
      const activeCounselorId = originalGetItem.call(this, 'bk_active_counselor_id') || 'admin';
      originalSetItem.call(this, `${key}_${activeCounselorId}`, value);
      return;
    }
  }
  originalSetItem.call(this, key, value);
};

Storage.prototype.removeItem = function(this: Storage, key: string): void {
  if (this === window.localStorage) {
    const isIsolated = originalGetItem.call(this, 'bk_database_mode') === 'isolated';
    if (isIsolated && isolatedKeys.includes(key)) {
      const activeCounselorId = originalGetItem.call(this, 'bk_active_counselor_id') || 'admin';
      originalRemoveItem.call(this, `${key}_${activeCounselorId}`);
      return;
    }
  }
  originalRemoveItem.call(this, key);
};

export {};
