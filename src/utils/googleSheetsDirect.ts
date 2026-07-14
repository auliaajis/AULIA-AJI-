/**
 * Utility functions for direct Client-Side Google Drive & Google Sheets API Integration
 */

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
    console.error('getOrCreateSpreadsheet Error:', error);
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
    throw new Error('Gagal memeriksa tab spreadsheet.');
  }

  const sheetInfo = await res.json();
  const currentTabs: string[] = sheetInfo.sheets.map((s: any) => s.properties.title);
  const requiredTabs = ['Siswa', 'Pelanggaran', 'LayananBK', 'Absensi'];
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
 */
export async function pushDataDirect(
  accessToken: string,
  spreadsheetId: string,
  data: {
    students: any[];
    violations: any[];
    services: any[];
    attendance: any[];
  }
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Ensure required tabs exist
    await ensureTabsExist(accessToken, spreadsheetId);

    // 2. Define structures & headers
    const structures = [
      {
        tab: 'Siswa',
        headers: ['id', 'nis', 'name', 'class', 'gender', 'violationPoints', 'bkServicesCount', 'initials'],
        items: data.students
      },
      {
        tab: 'Pelanggaran',
        headers: ['id', 'ticketId', 'studentId', 'studentName', 'studentClass', 'category', 'pointsAdded', 'date', 'time', 'location', 'notes', 'reportedBy', 'handledBy', 'handlingProgress'],
        items: data.violations
      },
      {
        tab: 'LayananBK',
        headers: ['id', 'serviceType', 'problem', 'description', 'output', 'followUp', 'status', 'date', 'startTime', 'endTime', 'students', 'attachments', 'notes'],
        items: data.services
      },
      {
        tab: 'Absensi',
        headers: ['id', 'class', 'date', 'records', 'updatedAt', 'submittedBy'],
        items: data.attendance
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
                return JSON.stringify(val);
              } catch (e) {
                return '';
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
      const errText = await updateRes.text();
      throw new Error(`Gagal menulis data ke Spreadsheet: ${errText}`);
    }

    return {
      success: true,
      message: `Data berhasil diekspor langsung ke Google Sheets!\nSiswa: ${data.students.length}, Pelanggaran: ${data.violations.length}, Layanan: ${data.services.length}, Absensi: ${data.attendance.length}`
    };
  } catch (error: any) {
    console.error('pushDataDirect Error:', error);
    return {
      success: false,
      message: error.message || 'Gagal mengekspor data secara langsung ke Google Sheets.'
    };
  }
}

/**
 * Direct pull (import) data from Google Sheets
 */
export async function pullDataDirect(
  accessToken: string,
  spreadsheetId: string
): Promise<{ success: boolean; data?: any; message: string }> {
  try {
    // 1. Ensure sheets exist before trying to read them
    await ensureTabsExist(accessToken, spreadsheetId);

    const tabs = ['Siswa', 'Pelanggaran', 'LayananBK', 'Absensi'];
    const ranges = tabs.map(tab => `${tab}!A:Z`);
    
    // Create query parameters for multiple ranges
    const queryRanges = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryRanges}&majorDimension=ROWS`;

    const getRes = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      throw new Error(`Gagal membaca data dari spreadsheet: ${errText}`);
    }

    const resData = await getRes.json();
    const valueRanges = resData.valueRanges || [];

    const result: any = {
      students: [],
      violations: [],
      services: [],
      attendance: []
    };

    // Helper to parse Sheet values to JSON arrays
    const parseValueRange = (values: any[][] | undefined, headersList: string[]) => {
      if (!values || values.length <= 1) return [];
      const headers = values[0];
      const items: any[] = [];

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const obj: any = {};
        headersList.forEach((header, index) => {
          let val = row[index];
          if (val === undefined || val === null) {
            val = '';
          }
          
          // Auto-convert stringified JSON arrays or objects
          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
            try {
              val = JSON.parse(val);
            } catch (e) {
              // Leave as string if not parseable
            }
          }
          
          // Cast numbers where appropriate
          if (header === 'violationPoints' || header === 'bkServicesCount' || header === 'pointsAdded') {
            const num = Number(val);
            if (!isNaN(num)) val = num;
          }

          obj[header] = val;
        });
        items.push(obj);
      }
      return items;
    };

    valueRanges.forEach((vr: any) => {
      const range: string = vr.range || '';
      const values: any[][] = vr.values;

      if (range.includes('Siswa')) {
        result.students = parseValueRange(values, ['id', 'nis', 'name', 'class', 'gender', 'violationPoints', 'bkServicesCount', 'initials']);
      } else if (range.includes('Pelanggaran')) {
        result.violations = parseValueRange(values, ['id', 'ticketId', 'studentId', 'studentName', 'studentClass', 'category', 'pointsAdded', 'date', 'time', 'location', 'notes', 'reportedBy', 'handledBy', 'handlingProgress']);
      } else if (range.includes('LayananBK')) {
        result.services = parseValueRange(values, ['id', 'serviceType', 'problem', 'description', 'output', 'followUp', 'status', 'date', 'startTime', 'endTime', 'students', 'attachments', 'notes']);
      } else if (range.includes('Absensi')) {
        result.attendance = parseValueRange(values, ['id', 'class', 'date', 'records', 'updatedAt', 'submittedBy']);
      }
    });

    return {
      success: true,
      data: result,
      message: 'Sinkronisasi dari Google Sheets berhasil!'
    };
  } catch (error: any) {
    console.error('pullDataDirect Error:', error);
    return {
      success: false,
      message: error.message || 'Gagal menarik data dari Google Sheets.'
    };
  }
}
