/**
 * Utility functions for Google Apps Script & Google Forms/Sheets integration
 */
import { getAccessToken } from './firebaseAuth';
import { pushDataDirect, pullDataDirect } from './googleSheetsDirect';
import { mergeFullDatabase } from './dataMerger';
import { registerSyncedIds, cleanupSyncedIds } from './deletionTracker';
import { initialStudents, initialViolations, initialServices } from '../data/mockData';

export function getLocalDatabaseData() {
  const studentsRaw = localStorage.getItem('bk_students');
  const violationsRaw = localStorage.getItem('bk_violations');
  const servicesRaw = localStorage.getItem('bk_services');
  const attendanceRaw = localStorage.getItem('bk_attendance_history');
  const journalsRaw = localStorage.getItem('bk_daily_journals');
  const homeVisitsRaw = localStorage.getItem('bk_home_visits');
  const achievementsRaw = localStorage.getItem('bk_achievements');

  let students = studentsRaw ? JSON.parse(studentsRaw) : [];
  let violations = violationsRaw ? JSON.parse(violationsRaw) : [];
  let services = servicesRaw ? JSON.parse(servicesRaw) : [];
  const attendance = attendanceRaw ? JSON.parse(attendanceRaw) : [];
  const journals = journalsRaw ? JSON.parse(journalsRaw) : [];
  const homeVisits = homeVisitsRaw ? JSON.parse(homeVisitsRaw) : [];
  const achievements = achievementsRaw ? JSON.parse(achievementsRaw) : [];

  return { students, violations, services, attendance, journals, homeVisits, achievements };
}

export function getSavedScriptUrl(): string {
  return localStorage.getItem('bk_google_script_url') || '';
}

export function saveScriptUrl(url: string): void {
  localStorage.setItem('bk_google_script_url', url.trim());
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
 * Push all local data from localStorage to Google Sheets via Apps Script Web App
 */
export async function pushDataToGoogle(url: string, force: boolean = false): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
  }
  
  try {
    const localData = getLocalDatabaseData();
    let finalStudents = localData.students;
    let finalViolations = localData.violations;
    let finalServices = localData.services;
    let finalAttendance = localData.attendance;
    let finalJournals = localData.journals;
    let finalHomeVisits = localData.homeVisits;
    let finalAchievements = localData.achievements;

    // Safety check: Prevent overwriting remote database if this device hasn't been verified/synced
    if (!force && localStorage.getItem('bk_google_sync_verified') !== 'true') {
      try {
        const checkRes = await pullDataFromGoogle(url);
        if (checkRes.success && checkRes.data) {
          const d = checkRes.data;
          const remoteCount = (d.students?.length || 0) + (d.violations?.length || 0) + (d.services?.length || 0) + (d.achievements?.length || 0);
          if (remoteCount > 0) {
            return {
              success: false,
              message: 'OVERWRITE_PREVENTION: Sistem mendeteksi adanya data riwayat yang tersimpan di Google Sheets Anda, sementara perangkat ini belum melakukan impor data lama. Untuk mencegah terhapusnya data lama Anda di awan, sinkronisasi otomatis ditangguhkan.\n\nSilakan lakukan "Impor Data" (Tarik Data) terlebih dahulu di menu Integrasi Google.'
            };
          }
        }
      } catch (err) {
        console.warn('Gagal memverifikasi proteksi database:', err);
      }
    } else {
      // Smart Auto-Merge: Pull and merge first to keep both laptop & phone changes alive!
      try {
        const pullRes = await pullDataFromGoogle(url);
        if (pullRes.success && pullRes.data) {
          const d = pullRes.data;
          const merged = mergeFullDatabase(
            {
              students: finalStudents,
              violations: finalViolations,
              services: finalServices,
              attendance: finalAttendance,
              journals: finalJournals,
              homeVisits: finalHomeVisits,
              achievements: finalAchievements
            },
            {
              students: d.students || [],
              violations: d.violations || [],
              services: d.services || [],
              attendance: d.attendance || [],
              journals: d.journals || [],
              homeVisits: d.homeVisits || [],
              achievements: d.achievements || []
            }
          );
          finalStudents = merged.students;
          finalViolations = merged.violations;
          finalServices = merged.services;
          finalAttendance = merged.attendance;
          finalJournals = merged.journals;
          finalHomeVisits = merged.homeVisits;
          finalAchievements = merged.achievements;

          localStorage.setItem('bk_students', JSON.stringify(finalStudents));
          localStorage.setItem('bk_violations', JSON.stringify(finalViolations));
          localStorage.setItem('bk_services', JSON.stringify(finalServices));
          localStorage.setItem('bk_attendance_history', JSON.stringify(finalAttendance));
          localStorage.setItem('bk_daily_journals', JSON.stringify(finalJournals));
          localStorage.setItem('bk_home_visits', JSON.stringify(finalHomeVisits));
          localStorage.setItem('bk_achievements', JSON.stringify(finalAchievements));
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {
        console.warn('Gagal mengambil data remote sebelum push untuk digabungkan:', err);
      }
    }
    
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
      
      window.dispatchEvent(new Event('storage'));
      return { success: true, message: res.data?.message || res.message || 'Data berhasil diekspor ke Google Sheets!' };
    }
    
    return { success: false, message: res.message || 'Sinkronisasi gagal, periksa log Apps Script.' };
  } catch (error: any) {
    return { success: false, message: getDetailedGasErrorMessage(url, error) };
  }
}

/**
 * Pull all data from Google Sheets via Apps Script Web App
 */
export async function pullDataFromGoogle(url: string): Promise<{ success: boolean; data?: any; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
  }
  
  const res = await callGasApi(url, 'GET', undefined, { action: 'readAll' });
  if (res.success && res.data) {
    const d = res.data;
    if (d.students || d.violations || d.services || d.attendance) {
      return {
        success: true,
        data: d,
        message: 'Data berhasil disinkronkan dari Google Sheets!'
      };
    }
  }
  
  return { success: false, message: res.message || 'Respons kosong atau format spreadsheet tidak cocok.' };
}

/**
 * Automatically triggers background synchronization of all database tables (Siswa, Pelanggaran, Layanan, Absensi)
 * to any configured active Google service (Direct Sync via Google Drive API or Google Apps Script URL).
 */
export async function triggerBackgroundAutoSync(): Promise<{ success: boolean; message: string }> {
  const spreadsheetId = localStorage.getItem('bk_google_spreadsheet_id');
  const scriptUrl = localStorage.getItem('bk_google_script_url');
  const hasIntegration = !!(spreadsheetId || scriptUrl);

  // Security guard: Skip automatic background sync if device hasn't pulled/verified yet
  if (hasIntegration && localStorage.getItem('bk_google_sync_verified') !== 'true') {
    console.warn('Auto-Sync: Sinkronisasi otomatis ditangguhkan demi melindungi data lama Anda di Google Sheets dari overwrite perangkat baru.');
    return { success: false, message: 'Sinkronisasi otomatis ditangguhkan demi perlindungan database.' };
  }

  const localData = getLocalDatabaseData();
  let finalStudents = localData.students;
  let finalViolations = localData.violations;
  let finalServices = localData.services;
  let finalAttendance = localData.attendance;
  let finalJournals = localData.journals;
  let finalHomeVisits = localData.homeVisits;
  let finalAchievements = localData.achievements;

  let directSyncSuccess = false;
  let gasSyncSuccess = false;
  if (spreadsheetId) {
    try {
      const token = await getAccessToken();
      if (token) {
        console.log('Auto-Sync: Memulai sinkronisasi langsung (OAuth) ke Spreadsheet...');
        
        // Smart Auto-Merge: Pull and merge first to keep both laptop & phone changes alive!
        try {
          const pullRes = await pullDataDirect(token, spreadsheetId);
          if (pullRes.success && pullRes.data) {
            const d = pullRes.data;
            const merged = mergeFullDatabase(
              {
                students: finalStudents,
                violations: finalViolations,
                services: finalServices,
                attendance: finalAttendance,
                journals: finalJournals,
                homeVisits: finalHomeVisits,
                achievements: finalAchievements
              },
              {
                students: d.students || [],
                violations: d.violations || [],
                services: d.services || [],
                attendance: d.attendance || [],
                journals: d.journals || [],
                homeVisits: d.homeVisits || [],
                achievements: d.achievements || []
              }
            );
            finalStudents = merged.students;
            finalViolations = merged.violations;
            finalServices = merged.services;
            finalAttendance = merged.attendance;
            finalJournals = merged.journals;
            finalHomeVisits = merged.homeVisits;
            finalAchievements = merged.achievements;

            localStorage.setItem('bk_students', JSON.stringify(finalStudents));
            localStorage.setItem('bk_violations', JSON.stringify(finalViolations));
            localStorage.setItem('bk_services', JSON.stringify(finalServices));
            localStorage.setItem('bk_attendance_history', JSON.stringify(finalAttendance));
            localStorage.setItem('bk_daily_journals', JSON.stringify(finalJournals));
            localStorage.setItem('bk_home_visits', JSON.stringify(finalHomeVisits));
            localStorage.setItem('bk_achievements', JSON.stringify(finalAchievements));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (err) {
          console.warn('Auto-Sync: Gagal menarik data untuk penggabungan langsung:', err);
        }

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
          console.log('Auto-Sync: Sinkronisasi langsung berhasil!');
          directSyncSuccess = true;
        }
      }
    } catch (err) {
      console.error('Auto-Sync: Gagal melakukan sinkronisasi langsung:', err);
    }
  }

  // 2. Try Apps Script Web App Sync (via Web App URL)
  if (scriptUrl) {
    console.log('Auto-Sync: Memulai sinkronisasi lewat Google Apps Script Web App...');
    try {
      const res = await pushDataToGoogle(scriptUrl);
      if (res.success) {
        console.log('Auto-Sync: Sinkronisasi Apps Script berhasil!');
        gasSyncSuccess = true;
      }
    } catch (err) {
      console.error('Auto-Sync: Gagal melakukan sinkronisasi Apps Script:', err);
    }
  }

  if (!hasIntegration) {
    return { success: false, message: 'Tidak ada koneksi Google Sheets yang aktif.' };
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
      message: `Database berhasil diperbarui secara otomatis di Google Sheets! (${directSyncSuccess ? 'Direct Sync' : ''} ${gasSyncSuccess ? 'Apps Script' : ''})` 
    };
  }

  return { success: false, message: 'Gagal menyinkronkan database secara otomatis ke Google Sheets.' };
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

