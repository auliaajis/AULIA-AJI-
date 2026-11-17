/**
 * Utility functions for Google Apps Script & Google Forms/Sheets integration
 */
import { getAccessToken } from './firebaseAuth';
import { pushDataDirect } from './googleSheetsDirect';
import { registerSyncedIds, cleanupSyncedIds } from './deletionTracker';
import { loadSchoolData, saveSchoolData, getActiveSchoolId } from './schoolConfig';
import { getOrCreateDriveFolder, getRootFolderName } from './googleDriveUpload';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firestoreSync';
import { formatTanggalIndonesia } from './dateFormatter';

export interface GoogleBackupStatus {
  lastPushAt: string | null;
  status: 'Berhasil' | 'Gagal' | 'Belum pernah dikirim';
  mode?: 'apps_script' | 'oauth';
  pushedBy?: string;
}

export function formatBackupTimestampId(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const tgl = formatTanggalIndonesia(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${tgl} ${hh}:${mm}`;
}

export function getGoogleBackupStatusLocal(customSchoolId?: string): GoogleBackupStatus {
  const schoolId = customSchoolId || getActiveSchoolId();
  const saved = loadSchoolData<GoogleBackupStatus | null>('bk_google_backup_status', null, schoolId);
  if (saved && typeof saved === 'object' && saved.status) {
    return saved;
  }
  return {
    lastPushAt: null,
    status: 'Belum pernah dikirim'
  };
}

export async function saveGoogleBackupStatusToFirestore(
  statusUpdate: {
    status: 'Berhasil' | 'Gagal';
    mode?: 'apps_script' | 'oauth';
    pushedBy?: string;
    lastPushAt?: string;
  },
  customSchoolId?: string
): Promise<GoogleBackupStatus> {
  const schoolId = customSchoolId || getActiveSchoolId();
  const prev = getGoogleBackupStatusLocal(schoolId);
  const record: GoogleBackupStatus = {
    lastPushAt: statusUpdate.lastPushAt || (statusUpdate.status === 'Berhasil' ? new Date().toISOString() : prev.lastPushAt),
    status: statusUpdate.status,
    mode: statusUpdate.mode || prev.mode,
    pushedBy: statusUpdate.pushedBy || prev.pushedBy
  };

  saveSchoolData('bk_google_backup_status', record, schoolId);

  try {
    await ensureFirebaseAuth();
    const schoolDocRef = doc(db, 'schools', schoolId);
    await setDoc(schoolDocRef, { googleBackupStatus: record }, { merge: true });
  } catch (err) {
    console.warn('[GoogleSync] Gagal menyimpan status backup ke Firestore:', err);
  }

  return record;
}

export async function loadGoogleBackupStatusFromFirestore(customSchoolId?: string): Promise<GoogleBackupStatus> {
  const schoolId = customSchoolId || getActiveSchoolId();
  const localStatus = getGoogleBackupStatusLocal(schoolId);
  try {
    await ensureFirebaseAuth();
    const schoolDocRef = doc(db, 'schools', schoolId);
    const snap = await getDoc(schoolDocRef);
    if (snap.exists()) {
      const remote = snap.data()?.googleBackupStatus as GoogleBackupStatus | undefined;
      if (remote && remote.status) {
        saveSchoolData('bk_google_backup_status', remote, schoolId);
        return remote;
      }
    }
  } catch (err) {
    console.warn('[GoogleSync] Gagal membaca status backup dari Firestore:', err);
  }
  return localStatus;
}

export function getLocalDatabaseData() {
  const schoolId = getActiveSchoolId();
  const students = loadSchoolData<any[]>('bk_students', [], schoolId);
  const violations = loadSchoolData<any[]>('bk_violations', [], schoolId);
  const services = loadSchoolData<any[]>('bk_services', [], schoolId);
  const attendance = loadSchoolData<any[]>('bk_attendance_history', [], schoolId);
  const journals = loadSchoolData<any[]>('bk_daily_journals', [], schoolId);
  const homeVisits = loadSchoolData<any[]>('bk_home_visits', [], schoolId);
  const achievements = loadSchoolData<any[]>('bk_achievements', [], schoolId);

  return { students, violations, services, attendance, journals, homeVisits, achievements };
}

export function getSavedScriptUrl(emailOrId?: string): string {
  if (emailOrId) {
    const cleanKey = emailOrId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const personalUrl = localStorage.getItem(`bk_google_script_url_${cleanKey}`);
    if (personalUrl) return personalUrl;
  }
  return localStorage.getItem('bk_google_script_url') || '';
}

export function saveScriptUrl(url: string, emailOrId?: string, isPersonal: boolean = true): void {
  const cleanUrl = url.trim();
  if (emailOrId && isPersonal) {
    const cleanKey = emailOrId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    localStorage.setItem(`bk_google_script_url_${cleanKey}`, cleanUrl);
  } else {
    localStorage.setItem('bk_google_script_url', cleanUrl);
  }
}

export function getSavedSpreadsheetConfig(emailOrId?: string): { id: string; url: string; isPersonal: boolean } {
  if (emailOrId) {
    const cleanKey = emailOrId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const mode = localStorage.getItem(`bk_google_spreadsheet_mode_${cleanKey}`);
    if (mode === 'shared') {
      return {
        id: localStorage.getItem('bk_google_spreadsheet_id') || '',
        url: localStorage.getItem('bk_google_spreadsheet_url') || '',
        isPersonal: false
      };
    }
    const pId = localStorage.getItem(`bk_google_spreadsheet_id_${cleanKey}`);
    const pUrl = localStorage.getItem(`bk_google_spreadsheet_url_${cleanKey}`);
    if (pId || pUrl) {
      return { id: pId || '', url: pUrl || '', isPersonal: true };
    }
  }
  return {
    id: localStorage.getItem('bk_google_spreadsheet_id') || '',
    url: localStorage.getItem('bk_google_spreadsheet_url') || '',
    isPersonal: false
  };
}

export function saveSpreadsheetConfig(
  id: string,
  url: string,
  emailOrId?: string,
  isPersonal: boolean = true
): void {
  if (emailOrId && isPersonal) {
    const cleanKey = emailOrId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (id) localStorage.setItem(`bk_google_spreadsheet_id_${cleanKey}`, id.trim());
    else localStorage.removeItem(`bk_google_spreadsheet_id_${cleanKey}`);

    if (url) localStorage.setItem(`bk_google_spreadsheet_url_${cleanKey}`, url.trim());
    else localStorage.removeItem(`bk_google_spreadsheet_url_${cleanKey}`);

    localStorage.setItem(`bk_google_spreadsheet_mode_${cleanKey}`, 'personal');
  } else {
    if (id) localStorage.setItem('bk_google_spreadsheet_id', id.trim());
    else localStorage.removeItem('bk_google_spreadsheet_id');

    if (url) localStorage.setItem('bk_google_spreadsheet_url', url.trim());
    else localStorage.removeItem('bk_google_spreadsheet_url');

    if (emailOrId) {
      const cleanKey = emailOrId.toLowerCase().replace(/[^a-z0-9]/g, '_');
      localStorage.setItem(`bk_google_spreadsheet_mode_${cleanKey}`, 'shared');
    }
  }
}

/**
 * Generate a detailed error message for GAS fetch failures
 */
function getDetailedGasErrorMessage(url: string, error: any): string {
  const isFailedToFetch = error && (
    error.message?.includes('Failed to fetch') || 
    error.message?.includes('failed to fetch') ||
    error.name === 'TypeError'
  );

  let msg = `Gagal terhubung dengan Google Apps Script (Error: ${error.message || error}).\n\n`;

  if (isFailedToFetch) {
    msg += `⚠️ KHUSUS PENGGUNA BARU (Masalah Koneksi / CORS):\n`;
    
    // Check if the URL doesn't look like a Web App Exec URL
    if (!url.includes('/macros/s/') || !url.includes('/exec')) {
      msg += `1. FORMAT URL SALAH: URL yang Anda masukkan tidak valid. URL Web App yang benar harus diawali dengan "https://script.google.com/macros/s/" dan diakhiri dengan "/exec".\n   * Pastikan Anda tidak memasukkan URL spreadsheet atau URL editor Apps Script.\n\n`;
    } else {
      msg += `1. SETUP DEPLOYMENT SALAH: Pastikan saat mendeploy (pilih "Terapkan" > "Penerapan Baru" > "Aplikasi Web") Anda menyetel:\n   * "Jalankan sebagai" (Execute as): setel ke "Saya" (Me / email Anda).\n   * "Siapa yang memiliki akses" (Who has access): setel ke "Siapa saja" (Anyone).\n\n`;
    }

    msg += `2. BELUM MEMBERI OTORISASI: Google meminta Anda mengizinkan akses ke spreadsheet saat mendeploy. Pastikan Anda sudah mengeklik "Izinkan Akses" (Authorize access) dan menyetujui peringatan keamanan (klik "Advanced" / "Lanjutan" lalu "Go to ... (unsafe)" lalu "Izinkan").\n\n`;
    msg += `3. BELUM TERDEPLOY: Jika baru saja mengubah kode Code.gs, Anda harus mendeploy ulang versi baru tersebut (klik Terapkan > Kelola Penerapan > Edit > Pilih Versi Baru, lalu simpan).\n\n`;
    msg += `Silakan buka menu "Integrasi Google" lagi dan ikuti panduan di panel kanan dengan teliti untuk memperbaiki masalah ini.`;
  } else {
    msg += `Pastikan jaringan internet Anda aktif, URL sudah benar, dan Google Apps Script sudah dideploy dengan benar.`;
  }

  return msg;
}

/**
 * Helper to call Google Apps Script Web App URL via Backend Proxy first (bypassing browser CORS & 302 redirects),
 * falling back to direct browser fetch if server proxy is unavailable.
 */
export async function callGasApi(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  payload?: any,
  queryParams?: Record<string, string>
): Promise<{ success: boolean; data?: any; message?: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script tidak dikonfigurasi.' };
  }

  // 1. Try server proxy first (/api/gas/proxy)
  try {
    const proxyRes = await fetch('/api/gas/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: url,
        method,
        payload,
        queryParams
      })
    });

    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      if (proxyData && (proxyData.status === 'success' || proxyData.success || proxyData.students || proxyData.violations || proxyData.services || proxyData.attendance)) {
        return {
          success: true,
          data: proxyData,
          message: proxyData.message || 'Respons berhasil dari Google Apps Script'
        };
      } else if (proxyData && proxyData.status === 'error') {
        return {
          success: false,
          data: proxyData,
          message: proxyData.message || 'Google Apps Script mengembalikan error'
        };
      } else if (proxyData) {
        return {
          success: true,
          data: proxyData,
          message: proxyData.message || 'Berhasil'
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy server GAS tidak merespons, mencoba direct browser fetch...', proxyErr);
  }

  // 2. Direct browser fetch fallback
  try {
    let finalUrl = url;
    if (queryParams) {
      const q = new URLSearchParams(queryParams).toString();
      finalUrl = `${url}${url.includes('?') ? '&' : '?'}${q}`;
    }

    const options: RequestInit = {
      method,
      mode: 'cors',
      credentials: 'omit'
    };

    if (method === 'POST') {
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }

    const response = await fetch(finalUrl, options);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const resData = await response.json();
    return {
      success: true,
      data: resData,
      message: resData?.message || 'Berhasil'
    };
  } catch (error: any) {
    return {
      success: false,
      message: getDetailedGasErrorMessage(url, error)
    };
  }
}

/**
 * Test connectivity with the Google Apps Script Web App
 */
export async function testConnection(url: string): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script kosong.' };
  }
  
  const res = await callGasApi(url, 'GET', undefined, { action: 'ping' });
  if (res.success) {
    return {
      success: true,
      message: res.data?.message || res.message || 'Koneksi ke Google Apps Script berhasil!'
    };
  }

  return {
    success: false,
    message: res.message || 'Gagal terhubung dengan Google Apps Script.'
  };
}

/**
 * Push all local/Firestore-synced data to Google Sheets via Apps Script Web App
 * // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
 */
export async function pushDataToGoogle(url: string, _force: boolean = false): Promise<{ success: boolean; message: string }> {
  // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
  }
  
  try {
    const localData = getLocalDatabaseData();
    const finalStudents = localData.students;
    const finalViolations = localData.violations;
    const finalServices = localData.services;
    const finalAttendance = localData.attendance;
    const finalJournals = localData.journals;
    const finalHomeVisits = localData.homeVisits;
    const finalAchievements = localData.achievements;
    
    const payload = {
      action: 'sync',
      students: finalStudents,
      violations: finalViolations,
      services: finalServices,
      attendance: finalAttendance,
      journals: finalJournals,
      homeVisits: finalHomeVisits,
      achievements: finalAchievements
    };
    
    const res = await callGasApi(url, 'POST', payload);
    if (res.success) {
      localStorage.setItem('bk_google_sync_verified', 'true');
      
      const allActiveIds = [
        ...finalStudents.map((s: any) => s.id),
        ...finalViolations.map((v: any) => v.id),
        ...finalServices.map((s: any) => s.id),
        ...finalAttendance.map((a: any) => a.id),
        ...finalJournals.map((j: any) => j.id),
        ...finalHomeVisits.map((h: any) => h.id),
        ...finalAchievements.map((ac: any) => ac.id)
      ].filter(Boolean);
      registerSyncedIds(allActiveIds);
      cleanupSyncedIds(allActiveIds);

      saveGoogleBackupStatusToFirestore({ status: 'Berhasil', mode: 'apps_script' }).catch(() => {});
      
      window.dispatchEvent(new Event('storage'));
      return { success: true, message: res.data?.message || res.message || 'Salinan backup berhasil dikirim ke Google Sheets!' };
    }
    
    saveGoogleBackupStatusToFirestore({ status: 'Gagal', mode: 'apps_script' }).catch(() => {});
    return { success: false, message: res.message || 'Gagal mengirim data backup, periksa log Apps Script.' };
  } catch (error: any) {
    saveGoogleBackupStatusToFirestore({ status: 'Gagal', mode: 'apps_script' }).catch(() => {});
    return { success: false, message: getDetailedGasErrorMessage(url, error) };
  }
}

// DINONAKTIFKAN: Dilarang tarik dari Sheet, Firestore adalah sumber kebenaran
export async function pullDataFromGoogle(_url: string): Promise<{ success: boolean; data?: any; message: string }> {
  return {
    success: false,
    message: 'DINONAKTIFKAN: Dilarang tarik dari Sheet, Firestore adalah sumber kebenaran.'
  };
}

/**
 * Automatically triggers one-way background backup of database tables
 * from App/Firestore to Google Sheets (NEVER pulls from Spreadsheet).
 * // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
 */
export async function triggerBackgroundAutoSync(): Promise<{ success: boolean; message: string }> {
  // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
  const spreadsheetId = localStorage.getItem('bk_google_spreadsheet_id');
  const scriptUrl = localStorage.getItem('bk_google_script_url');
  const hasIntegration = !!(spreadsheetId || scriptUrl);

  if (!hasIntegration) {
    return { success: false, message: 'Tidak ada koneksi Google Sheets yang aktif.' };
  }

  const localData = getLocalDatabaseData();
  const finalStudents = localData.students;
  const finalViolations = localData.violations;
  const finalServices = localData.services;
  const finalAttendance = localData.attendance;
  const finalJournals = localData.journals;
  const finalHomeVisits = localData.homeVisits;
  const finalAchievements = localData.achievements;

  const totalLocalRecords =
    finalStudents.length +
    finalViolations.length +
    finalServices.length +
    finalAttendance.length +
    finalJournals.length +
    finalHomeVisits.length +
    finalAchievements.length;

  if (totalLocalRecords === 0) {
    return { success: false, message: 'Belum ada data di aplikasi untuk dikirim ke backup.' };
  }

  let directSyncSuccess = false;
  let gasSyncSuccess = false;
  if (spreadsheetId) {
    try {
      const token = await getAccessToken();
      if (token) {
        const res = await pushDataDirect(token, spreadsheetId, {
          students: finalStudents,
          violations: finalViolations,
          services: finalServices,
          attendance: finalAttendance,
          journals: finalJournals,
          homeVisits: finalHomeVisits,
          achievements: finalAchievements
        });
        if (res.success) {
          directSyncSuccess = true;
          saveGoogleBackupStatusToFirestore({ status: 'Berhasil', mode: 'oauth' }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Auto-Sync: Gagal melakukan backup langsung:', err);
    }
  }

  // 2. Try Apps Script Web App Sync (via Web App URL)
  if (scriptUrl) {
    try {
      const res = await pushDataToGoogle(scriptUrl);
      if (res.success) {
        gasSyncSuccess = true;
      }
    } catch (err) {
      console.error('Auto-Sync: Gagal melakukan backup Apps Script:', err);
    }
  }

  if (directSyncSuccess || gasSyncSuccess) {
    const allActiveIds = [
      ...finalStudents.map((s: any) => s.id),
      ...finalViolations.map((v: any) => v.id),
      ...finalServices.map((s: any) => s.id),
      ...finalAttendance.map((a: any) => a.id),
      ...finalJournals.map((j: any) => j.id),
      ...finalHomeVisits.map((h: any) => h.id)
    ].filter(Boolean);
    registerSyncedIds(allActiveIds);
    cleanupSyncedIds(allActiveIds);
    window.dispatchEvent(new Event('storage'));

    return { 
      success: true, 
      message: `Backup satu arah berhasil dikirim ke Google Sheets! (${directSyncSuccess ? 'OAuth' : ''} ${gasSyncSuccess ? 'Apps Script' : ''})` 
    };
  }

  return { success: false, message: 'Gagal mengirim backup otomatis ke Google Sheets.' };
}

/**
 * Send an automated email to a class teacher (Wali Kelas)
 * Routes through Google Apps Script POST action or direct Gmail API if logged in via Google Auth.
 */
export async function sendAutomatedEmail(to: string, subject: string, body: string): Promise<{ success: boolean; message: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, message: 'Alamat email Wali Kelas tidak valid.' };
  }

  let appsScriptError = '';

  // 1. Try sending via Google Apps Script (runs as the database owner/Me)
  const scriptUrl = localStorage.getItem('bk_google_script_url');
  if (scriptUrl) {
    try {
      console.log('Mengirim email via Google Apps Script ke:', to);
      const payload = {
        action: 'sendEmail',
        to,
        subject,
        body
      };
      const gasRes = await callGasApi(scriptUrl, 'POST', payload);
      if (gasRes.success) {
        return { success: true, message: 'Email notifikasi otomatis berhasil dikirim ke Wali Kelas via Apps Script!' };
      } else {
        appsScriptError = gasRes.message || '';
        console.warn(`Apps Script Gagal: ${appsScriptError}. Mencoba fallback ke Gmail API...`);
      }
    } catch (err: any) {
      appsScriptError = err.message || err;
      console.warn('Gagal mengirim email via Google Apps Script, mencoba Gmail API jika tersedia:', err);
    }
  }

  // 2. Try sending via Gmail API (runs as the currently logged-in Google Auth user)
  try {
    const token = await getAccessToken();
    if (token) {
      console.log('Mengirim email via Gmail API ke:', to);
      // Build raw RFC 2822 message for Gmail API send endpoint
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const emailContent = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
      ].join('\r\n');
      
      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedEmail
        })
      });

      if (response.ok) {
        return { success: true, message: 'Email notifikasi otomatis berhasil dikirim ke Wali Kelas via Gmail API!' };
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'Gagal mengirim email';
        console.error('Gmail API send error:', errJson);
        return { success: false, message: `Gmail API Gagal: ${errMsg}` };
      }
    }
  } catch (err: any) {
    console.error('Gagal mengirim email via Gmail API:', err);
    return { success: false, message: `Terjadi kesalahan saat mengirim email: ${err.message || err}` };
  }

  return { 
    success: false, 
    message: `Otomatisasi pengiriman email gagal. ${appsScriptError ? `(Apps Script Gagal: ${appsScriptError}).` : ''} Silakan hubungkan akun Google Anda kembali di menu Integrasi dan pastikan mencentang izin pengelolaan Gmail.` 
  };
}

/**
 * Create a draft in Gmail (runs as the currently logged-in Google Auth user or via Apps Script)
 */
export async function createGmailDraft(to: string, subject: string, body: string): Promise<{ success: boolean; message: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, message: 'Alamat email Wali Kelas tidak valid.' };
  }

  let appsScriptError = '';

  // 1. Try creating draft via Google Apps Script (runs as the database owner/Me)
  const scriptUrl = localStorage.getItem('bk_google_script_url');
  if (scriptUrl) {
    try {
      console.log('Membuat draf via Google Apps Script ke:', to);
      const payload = {
        action: 'createDraft',
        to,
        subject,
        body
      };
      const gasRes = await callGasApi(scriptUrl, 'POST', payload);
      if (gasRes.success) {
        return { success: true, message: 'Draf email berhasil disimpan di folder Draf (Drafts) Gmail Anda via Apps Script!' };
      } else {
        appsScriptError = gasRes.message || '';
        console.warn(`Apps Script Gagal: ${appsScriptError}. Mencoba fallback ke Gmail API...`);
      }
    } catch (err: any) {
      appsScriptError = err.message || err;
      console.warn('Gagal membuat draf via Google Apps Script, mencoba Gmail API jika tersedia:', err);
    }
  }

  // 2. Try creating draft via Gmail API (runs as the currently logged-in Google Auth user)
  try {
    const token = await getAccessToken();
    if (token) {
      console.log('Membuat draf via Gmail API ke:', to);
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const emailContent = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
      ].join('\r\n');
      
      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            raw: encodedEmail
          }
        })
      });

      if (response.ok) {
        return { success: true, message: 'Draf email berhasil disimpan di folder Draf (Drafts) Gmail Anda via Gmail API!' };
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'Gagal membuat draf';
        console.error('Gmail API draft error:', errJson);
        return { success: false, message: `Gmail API Gagal: ${errMsg}` };
      }
    }
  } catch (err: any) {
    console.error('Gagal membuat draf via Gmail API:', err);
    return { success: false, message: `Terjadi kesalahan saat membuat draf: ${err.message || err}` };
  }

  return { 
    success: false, 
    message: `Gagal membuat draf email otomatis. ${appsScriptError ? `(Apps Script Gagal: ${appsScriptError}).` : ''} Silakan hubungkan akun Google Anda kembali di menu Integrasi dan pastikan mencentang izin pengelolaan Gmail.` 
  };
}

export interface DriveFolderItem {
  id: string;
  name: string;
  viewUrl?: string;
}

export interface DriveFolderStructureResult {
  success: boolean;
  rootFolderId?: string;
  rootFolderName?: string;
  subfolders?: Record<string, DriveFolderItem>;
  message?: string;
  error?: string;
}

export const SIKAP_BK_DEFAULT_SUBFOLDERS = [
  { key: 'Laporan_Layanan', path: 'SIKAP-BK/Laporan_Layanan', description: 'Folder otomatis PDF Dokumen & Bukti Layanan BK' },
  { key: 'Pelanggaran', path: 'SIKAP-BK/Pelanggaran', description: 'Folder otomatis PDF Bukti & Catatan Pelanggaran Siswa' },
  { key: 'Jurnal', path: 'SIKAP-BK/Jurnal', description: 'Folder otomatis PDF Jurnal Harian Konseling & Disiplin' },
  { key: 'Panggilan_Ortu', path: 'SIKAP-BK/Panggilan_Ortu', description: 'Folder otomatis PDF Surat Panggilan & Berita Acara Kehadiran Orang Tua' },
  { key: 'Home_Visit', path: 'SIKAP-BK/Home_Visit', description: 'Folder otomatis PDF Laporan Kunjungan Rumah (Home Visit)' },
  { key: 'Perjanjian_Kontrak', path: 'SIKAP-BK/Perjanjian_Kontrak', description: 'Folder otomatis PDF Surat Perjanjian & Kontrak Perilaku' },
  { key: 'Rekap_Analitik', path: 'SIKAP-BK/Rekap_Analitik', description: 'Folder otomatis PDF Laporan Rekapitulasi & Analitik' },
] as const;

/**
 * Utilitas untuk membuat & memverifikasi struktur folder otomatis di Google Drive
 * ('SIKAP-BK/Laporan_Layanan', 'SIKAP-BK/Pelanggaran', 'SIKAP-BK/Jurnal', dst.)
 * saat aplikasi pertama kali dimuat untuk memastikan semua ekspor PDF tersimpan secara terorganisir.
 * Mendukung dual-engine: Direct Google Drive API (OAuth) & Google Apps Script Web App.
 */
export async function ensureDriveFolderStructure(
  accessToken?: string,
  force: boolean = false
): Promise<DriveFolderStructureResult> {
  // 1. Caching check: avoid redundant network storms if verified in last 30 min
  if (!force && typeof localStorage !== 'undefined') {
    const lastVerified = localStorage.getItem('bk_drive_folders_verified_at');
    const cachedSubfolders = localStorage.getItem('bk_drive_subfolders_cache');
    const rootFolderId = localStorage.getItem('bk_drive_root_folder_id');
    if (lastVerified && cachedSubfolders) {
      const elapsedMs = Date.now() - new Date(lastVerified).getTime();
      if (elapsedMs < 30 * 60 * 1000) {
        try {
          const parsed = JSON.parse(cachedSubfolders);
          return {
            success: true,
            rootFolderId: rootFolderId || undefined,
            rootFolderName: getRootFolderName(),
            subfolders: parsed,
            message: 'Struktur folder Google Drive sudah terverifikasi dan siap digunakan.',
          };
        } catch (e) {}
      }
    }
  }

  // 2. Engine A: Direct Google Drive REST API (OAuth)
  try {
    let token = accessToken;
    if (!token) {
      token = (await getAccessToken()) || undefined;
    }

    if (token) {
      const rootFolderName = getRootFolderName(); // 'SIKAP-BK'
      const rootFolder = await getOrCreateDriveFolder(token, rootFolderName);
      const subfolders: Record<string, DriveFolderItem> = {};

      for (const item of SIKAP_BK_DEFAULT_SUBFOLDERS) {
        try {
          const folder = await getOrCreateDriveFolder(token, item.key, rootFolder.id);
          subfolders[item.key] = {
            id: folder.id,
            name: item.key,
            viewUrl: folder.viewUrl,
          };
        } catch (err: any) {
          console.warn(`[Drive Folder Init] Gagal membuat subfolder ${item.key}:`, err);
        }
      }

      // Persist folder initialization state
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bk_drive_folders_initialized', 'true');
        localStorage.setItem('bk_drive_folders_verified_at', new Date().toISOString());
        localStorage.setItem('bk_drive_folder_mode', 'direct_oauth');
        localStorage.setItem('bk_drive_root_folder_id', rootFolder.id);
        localStorage.setItem('bk_drive_subfolders_cache', JSON.stringify(subfolders));
        window.dispatchEvent(new CustomEvent('bk_drive_folders_updated', {
          detail: { mode: 'direct_oauth', rootFolderId: rootFolder.id, subfolders }
        }));
      }

      console.log('✅ Struktur folder Google Drive SIKAP-BK terverifikasi (OAuth Direct):', {
        root: rootFolderName,
        subfolders: Object.keys(subfolders),
      });

      return {
        success: true,
        rootFolderId: rootFolder.id,
        rootFolderName,
        subfolders,
        message: `Struktur folder Google Drive ${rootFolderName} berhasil disiapkan & diverifikasi.`,
      };
    }
  } catch (error: any) {
    console.warn('Direct OAuth folder initialization warning:', error);
    const rawMsg = String(error?.message || error || '');
    if (rawMsg.includes('UNAUTHENTICATED') || rawMsg.includes('401') || rawMsg.includes('invalid authentication')) {
      // Token expired or invalid: will attempt Apps Script fallback below
    }
  }

  // 3. Engine B: Google Apps Script Web App fallback
  try {
    const scriptUrl = getSavedScriptUrl();
    if (scriptUrl) {
      const res = await callGasApi(scriptUrl, 'POST', { action: 'ensureFolders' });
      if (res.success && res.data) {
        const subfolders = res.data.subfolders || {};
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('bk_drive_folders_initialized', 'true');
          localStorage.setItem('bk_drive_folders_verified_at', new Date().toISOString());
          localStorage.setItem('bk_drive_folder_mode', 'apps_script');
          if (res.data.rootFolderId) {
            localStorage.setItem('bk_drive_root_folder_id', res.data.rootFolderId);
          }
          localStorage.setItem('bk_drive_subfolders_cache', JSON.stringify(subfolders));
          window.dispatchEvent(new CustomEvent('bk_drive_folders_updated', {
            detail: { mode: 'apps_script', rootFolderId: res.data.rootFolderId, subfolders }
          }));
        }

        console.log('✅ Struktur folder Google Drive SIKAP-BK terverifikasi (Apps Script Web App):', {
          root: res.data.rootFolderName || 'SIKAP-BK',
          subfolders: Object.keys(subfolders),
        });

        return {
          success: true,
          rootFolderId: res.data.rootFolderId,
          rootFolderName: res.data.rootFolderName || 'SIKAP-BK',
          subfolders,
          message: res.data.message || 'Struktur folder Google Drive berhasil disiapkan via Apps Script.',
        };
      }
    }
  } catch (gasErr: any) {
    console.warn('Apps Script folder verification error:', gasErr);
  }

  // 4. If neither authenticated nor Apps Script is connected, return safe state (do not crash app)
  return {
    success: false,
    error: 'Akun Google atau Google Apps Script belum terhubung di menu Integrasi Google.',
  };
}



