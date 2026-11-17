/**
 * Utility functions for direct Client-Side Google Drive & Google Sheets API Integration
 */

import { loadSchoolData } from './schoolConfig';

export interface GoogleSyncResult {
  success: boolean;
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

/**
 * Searches Google Drive for a spreadsheet named "Database BK Sekolah".
 * If not found, creates a brand new one and sets up the required tabs.
 */
export async function getOrCreateSpreadsheet(accessToken: string): Promise<GoogleSyncResult> {
  const spreadsheetName = 'Database BK Sekolah';
  
  try {
    // 1. Search for existing spreadsheet
    const query = encodeURIComponent(`name='${spreadsheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;
    
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        throw new Error("UNAUTHENTICATED_SESSION");
      }
      const errorText = await searchRes.text();
      throw new Error(`Gagal mencari file di Drive: ${errorText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const file = searchData.files[0];
      return {
        success: true,
        message: 'Spreadsheet ditemukan!',
        spreadsheetId: file.id,
        spreadsheetUrl: file.webViewLink
      };
    }

    // 2. Not found, create a brand new Spreadsheet
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: spreadsheetName
        }
      })
    });

    if (!createRes.ok) {
      if (createRes.status === 401) {
        throw new Error("UNAUTHENTICATED_SESSION");
      }
      const errorText = await createRes.text();
      throw new Error(`Gagal membuat Spreadsheet baru: ${errorText}`);
    }

    const createdSheet = await createRes.json();
    const spreadsheetId = createdSheet.spreadsheetId;
    const spreadsheetUrl = createdSheet.spreadsheetUrl;

    // 3. Initialize tabs in the spreadsheet
    await ensureTabsExist(accessToken, spreadsheetId);

    return {
      success: true,
      message: 'Berhasil membuat Spreadsheet database baru "Database BK Sekolah"!',
      spreadsheetId,
      spreadsheetUrl
    };
  } catch (error: any) {
    const isUnauthenticated = error && error.message && (
      error.message.includes('invalid authentication credentials') ||
      error.message.includes('UNAUTHENTICATED') ||
      error.message.includes('401') ||
      error.message === 'UNAUTHENTICATED_SESSION'
    );
    if (isUnauthenticated) {
      console.warn('getOrCreateSpreadsheet: Sesi Google Drive/Sheets kedaluwarsa atau tidak sah.', error.message || error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bk_google_access_token');
        window.dispatchEvent(new Event('storage'));
      }
      return {
        success: false,
        message: 'UNAUTHENTICATED_SESSION'
      };
    } else {
      console.error('getOrCreateSpreadsheet Error:', error);
    }
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat menyiapkan Google Spreadsheet.'
    };
  }
}

/**
 * Ensures all required sheets (Siswa, Pelanggaran, LayananBK, Absensi) exist in the spreadsheet.
 */
export async function ensureTabsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    let detailMsg = '';
    let isUnauthorized = res.status === 401;
    try {
      const errJson = await res.json().catch(() => ({}));
      detailMsg = errJson?.error?.message || '';
      if (errJson?.error?.status === 'UNAUTHENTICATED' || errJson?.error?.code === 401) {
        isUnauthorized = true;
      }
    } catch (e) {}

    if (isUnauthorized) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bk_google_access_token');
        window.dispatchEvent(new Event('storage'));
      }
      throw new Error("UNAUTHENTICATED_SESSION");
    }

    throw new Error(`Gagal memeriksa tab spreadsheet. ${detailMsg ? `Detail: ${detailMsg}.` : `Status: ${res.statusText || res.status}.`} Pastikan Anda telah keluar akun (Log Out), masuk kembali (Log In) dengan Google, dan pastikan mencentang/menyetujui seluruh izin Google Sheets dan Google Drive yang diminta.`);
  }

  const sheetInfo = await res.json();
  const currentTabs: string[] = sheetInfo.sheets.map((s: any) => s.properties.title);
  const requiredTabs = ['Siswa', 'Pelanggaran', 'Restitusi', 'LayananBK', 'Absensi', 'JurnalHarian', 'HomeVisit', 'Apresiasi_Prestasi'];
  const missingTabs = requiredTabs.filter(tab => !currentTabs.includes(tab));

  if (missingTabs.length === 0) return;

  // Create requests to add missing tabs
  const requests = missingTabs.map(tab => ({
    addSheet: {
      properties: {
        title: tab
      }
    }
  }));

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const updateRes = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Gagal membuat tab baru di spreadsheet: ${errText}`);
  }
}

/**
 * Direct push (export) data into Google Sheets
 * // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
 */
export async function pushDataDirect(
  accessToken: string,
  spreadsheetId: string,
  data: {
    students: any[];
    violations: any[];
    services: any[];
    attendance: any[];
    journals?: any[];
    homeVisits?: any[];
    achievements?: any[];
  },
  _force: boolean = false
): Promise<{ success: boolean; message: string }> {
  // SATU ARAH: Hanya Kirim ke Sheet. Dilarang Tarik dari Sheet.
  try {
    // 1. Ensure required tabs exist
    await ensureTabsExist(accessToken, spreadsheetId);

    let students = data.students || [];
    let violations = data.violations || [];
    let services = data.services || [];
    let attendance = data.attendance || [];
    let journals = data.journals || [];
    let homeVisits = data.homeVisits || [];
    let achievements = data.achievements || [];

    if ((!students || students.length === 0)) {
      students = loadSchoolData('bk_students', []);
    }
    if ((!violations || violations.length === 0)) {
      violations = loadSchoolData('bk_violations', []);
    }
    if ((!services || services.length === 0)) {
      services = loadSchoolData('bk_services', []);
    }
    if ((!achievements || achievements.length === 0)) {
      achievements = loadSchoolData('bk_achievements', []);
    }

    // Filter data pembinaan (pelanggaran belum/perlu ditangani) dan data restitusi (telah ditangani/dalam proses restitusi)
    const pembinaanItems = (violations || []).filter((v: any) => !v.handledBy || v.handledBy === 'Belum Ditangani');
    const restitusiItems = (violations || []).filter((v: any) => (v.handledBy && v.handledBy !== 'Belum Ditangani') || (v.handlingProgress && v.handlingProgress.trim() !== ''));

    // 2. Define structures & headers
    const structures = [
      {
        tab: 'Siswa',
        headers: ['id', 'nis', 'name', 'class', 'gender', 'violationPoints', 'bkServicesCount', 'initials'],
        items: students
      },
      {
        tab: 'Pelanggaran',
        headers: ['id', 'ticketId', 'studentId', 'studentName', 'studentClass', 'category', 'pointsAdded', 'date', 'time', 'location', 'notes', 'reportedBy', 'handledBy', 'handlingProgress'],
        items: pembinaanItems
      },
      {
        tab: 'Restitusi',
        headers: ['id', 'ticketId', 'studentId', 'studentName', 'studentClass', 'category', 'pointsAdded', 'date', 'time', 'location', 'notes', 'reportedBy', 'handledBy', 'handlingProgress'],
        items: restitusiItems
      },
      {
        tab: 'LayananBK',
        headers: ['id', 'serviceType', 'problem', 'description', 'output', 'followUp', 'status', 'date', 'startTime', 'endTime', 'students', 'attachments', 'notes'],
        items: services
      },
      {
        tab: 'Absensi',
        headers: ['id', 'class', 'date', 'records', 'updatedAt', 'submittedBy'],
        items: attendance
      },
      {
        tab: 'JurnalHarian',
        headers: ['id', 'date', 'startTime', 'endTime', 'activityType', 'title', 'description', 'target', 'status', 'counselorId', 'createdAt', 'proofPhotoUrl', 'proofPhotoName', 'absentStudents'],
        items: journals
      },
      {
        tab: 'HomeVisit',
        headers: [
          'id', 'reportNumber', 'date', 'studentId', 'studentName', 'studentClass', 'studentNis', 
          'parentNameMet', 'address', 'purpose', 'result', 'agreement', 'photoUrl', 'photoName', 
          'parentSignature', 'counselorSignature', 'counselorName', 'counselorId', 'createdAt'
        ],
        items: homeVisits
      },
      {
        tab: 'Apresiasi_Prestasi',
        headers: ['id', 'studentId', 'studentName', 'studentClass', 'nis', 'category', 'achievementName', 'pointsReward', 'date', 'time', 'location', 'recordedBy', 'notes'],
        items: achievements
      }
    ];

    // 3. Clear existing values for all targets to avoid leftover trailing rows
    const rangesToClear = structures.map(s => `${s.tab}!A:Z`);
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
    
    const clearRes = await fetch(clearUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ranges: rangesToClear })
    });

    if (!clearRes.ok) {
      if (clearRes.status === 401) {
        throw new Error("UNAUTHENTICATED_SESSION");
      }
      const errText = await clearRes.text();
      throw new Error(`Gagal membersihkan lembar spreadsheet lama: ${errText}`);
    }

    // 4. Form values payload for batch update
    const dataPayloads = structures.map(s => {
      const rows: any[][] = [s.headers];
      
      if (s.items && s.items.length > 0) {
        s.items.forEach(item => {
          const row = s.headers.map(header => {
            let val = item[header];
            if (val === undefined || val === null) return '';
            
            // Serialize complex objects or arrays as JSON strings
            if (typeof val === 'object') {
              try {
                val = JSON.stringify(val);
              } catch (e) {
                return '';
              }
            }

            // Safe guard against Google Sheets 50,000 character limit per cell
            if (typeof val === 'string' && val.length > 45000) {
              if (val.startsWith('data:')) {
                // It's a base64 resource (image/signature/file)
                return `[Data Base64 terlalu besar untuk Google Sheets (Ukuran: ${(val.length / 1024).toFixed(1)} KB)]`;
              } else {
                return val.slice(0, 44000) + '... [Teks dipotong karena melebihi batas 50.000 karakter Google Sheets]';
              }
            }

            return val;
          });
          rows.push(row);
        });
      }

      return {
        range: `${s.tab}!A1`,
        majorDimension: 'ROWS',
        values: rows
      };
    });

    // 5. Update values in batch
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataPayloads
      })
    });

    if (!updateRes.ok) {
      if (updateRes.status === 401) {
        throw new Error("UNAUTHENTICATED_SESSION");
      }
      const errText = await updateRes.text();
      throw new Error(`Gagal menulis data ke Spreadsheet: ${errText}`);
    }

    localStorage.setItem('bk_google_sync_verified', 'true');
    window.dispatchEvent(new Event('storage'));

    return {
      success: true,
      message: `Data berhasil diekspor langsung ke Google Sheets!\nSiswa: ${data.students.length}, Pelanggaran: ${data.violations.length}, Layanan: ${data.services.length}, Absensi: ${data.attendance.length}`
    };
  } catch (error: any) {
    const isUnauthenticated = error && error.message && (
      error.message.includes('invalid authentication credentials') ||
      error.message.includes('UNAUTHENTICATED') ||
      error.message.includes('401') ||
      error.message === 'UNAUTHENTICATED_SESSION'
    );
    if (isUnauthenticated) {
      console.warn('pushDataDirect: Sesi Google Sheets kedaluwarsa atau belum login.', error.message || error);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bk_google_access_token');
        window.dispatchEvent(new Event('storage'));
      }
      return {
        success: false,
        message: 'UNAUTHENTICATED_SESSION'
      };
    } else {
      console.error('pushDataDirect Error:', error);
    }
    return {
      success: false,
      message: error.message || 'Gagal mengekspor data secara langsung ke Google Sheets.'
    };
  }
}

// DINONAKTIFKAN: Dilarang tarik dari Sheet, Firestore adalah sumber kebenaran
export async function pullDataDirect(
  _accessToken: string,
  _spreadsheetId: string
): Promise<{ success: boolean; data?: any; message: string }> {
  return {
    success: false,
    message: 'DINONAKTIFKAN: Dilarang tarik dari Sheet, Firestore adalah sumber kebenaran.'
  };
}
