/**
 * Utility functions for Google Apps Script & Google Forms/Sheets integration
 */
import { getAccessToken } from './firebaseAuth';
import { pushDataDirect } from './googleSheetsDirect';

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
 * Test connectivity with the Google Apps Script Web App
 */
export async function testConnection(url: string): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script kosong.' };
  }
  
  try {
    // Add ping parameter. Google Apps Script requires CORS-friendly GET.
    const testUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    
    const resData = await response.json();
    if (resData && (resData.status === 'success' || resData.message)) {
      return { 
        success: true, 
        message: resData.message || 'Koneksi ke Google Apps Script berhasil!' 
      };
    }
    
    return { success: false, message: 'Respons tidak sesuai format yang diharapkan.' };
  } catch (error: any) {
    console.error('GAS connection error:', error);
    return { 
      success: false, 
      message: getDetailedGasErrorMessage(url, error)
    };
  }
}

/**
 * Push all local data from localStorage to Google Sheets via Apps Script Web App
 */
export async function pushDataToGoogle(url: string, force: boolean = false): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
  }
  
  try {
    // Safety check: Prevent overwriting remote database if this device hasn't been verified/synced
    if (!force && localStorage.getItem('bk_google_sync_verified') !== 'true') {
      try {
        const checkRes = await pullDataFromGoogle(url);
        if (checkRes.success && checkRes.data) {
          const d = checkRes.data;
          const remoteCount = (d.students?.length || 0) + (d.violations?.length || 0) + (d.services?.length || 0);
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
    }

    const students = JSON.parse(localStorage.getItem('bk_students') || '[]');
    const violations = JSON.parse(localStorage.getItem('bk_violations') || '[]');
    const services = JSON.parse(localStorage.getItem('bk_services') || '[]');
    const attendance = JSON.parse(localStorage.getItem('bk_attendance_history') || '[]');
    
    const payload = {
      action: 'sync',
      students,
      violations,
      services,
      attendance
    };
    
    // We send Content-Type text/plain to avoid triggering CORS preflight OPTIONS pre-check
    // Google Apps Script is able to read the raw body content in doPost via e.postData.contents
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    
    const resData = await response.json();
    if (resData && resData.status === 'success') {
      localStorage.setItem('bk_google_sync_verified', 'true');
      window.dispatchEvent(new Event('storage'));
      return { success: true, message: resData.message || 'Data berhasil diekspor ke Google Sheets!' };
    }
    
    return { success: false, message: resData.message || 'Sinkronisasi gagal, periksa log Apps Script.' };
  } catch (error: any) {
    console.error('GAS push error:', error);
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
  
  try {
    const readUrl = `${url}${url.includes('?') ? '&' : '?'}action=readAll`;
    
    const response = await fetch(readUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
    
    const resData = await response.json();
    if (resData && (resData.students || resData.violations || resData.services || resData.attendance)) {
      return {
        success: true,
        data: resData,
        message: 'Data berhasil disinkronkan dari Google Sheets!'
      };
    }
    
    return { success: false, message: 'Respons kosong atau format spreadsheet tidak cocok.' };
  } catch (error: any) {
    console.error('GAS pull error:', error);
    return { success: false, message: getDetailedGasErrorMessage(url, error) };
  }
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

  const students = JSON.parse(localStorage.getItem('bk_students') || '[]');
  const violations = JSON.parse(localStorage.getItem('bk_violations') || '[]');
  const services = JSON.parse(localStorage.getItem('bk_services') || '[]');
  const attendance = JSON.parse(localStorage.getItem('bk_attendance_history') || '[]');

  let directSyncSuccess = false;
  let gasSyncSuccess = false;
  if (spreadsheetId) {
    try {
      const token = await getAccessToken();
      if (token) {
        console.log('Auto-Sync: Memulai sinkronisasi langsung (OAuth) ke Spreadsheet...');
        const res = await pushDataDirect(token, spreadsheetId, {
          students,
          violations,
          services,
          attendance
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
    return { 
      success: true, 
      message: `Database berhasil diperbarui secara otomatis di Google Sheets! (${directSyncSuccess ? 'Direct Sync' : ''} ${gasSyncSuccess ? 'Apps Script' : ''})` 
    };
  }

  return { success: false, message: 'Gagal menyinkronkan database secara otomatis ke Google Sheets.' };
}

