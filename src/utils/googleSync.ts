/**
 * Utility functions for Google Apps Script & Google Forms/Sheets integration
 */

export function getSavedScriptUrl(): string {
  return localStorage.getItem('bk_google_script_url') || '';
}

export function saveScriptUrl(url: string): void {
  localStorage.setItem('bk_google_script_url', url.trim());
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
      message: `Gagal terhubung. Pastikan URL benar, sudah dideploy sebagai 'Anyone' (Siapa saja), dan mendukung CORS. (Error: ${error.message})` 
    };
  }
}

/**
 * Push all local data from localStorage to Google Sheets via Apps Script Web App
 */
export async function pushDataToGoogle(url: string): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: 'URL Google Apps Script belum dikonfigurasi.' };
  }
  
  try {
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
      return { success: true, message: resData.message || 'Data berhasil diekspor ke Google Sheets!' };
    }
    
    return { success: false, message: resData.message || 'Sinkronisasi gagal, periksa log Apps Script.' };
  } catch (error: any) {
    console.error('GAS push error:', error);
    return { success: false, message: `Gagal mengirim data: ${error.message}` };
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
    return { success: false, message: `Gagal menarik data: ${error.message}` };
  }
}
