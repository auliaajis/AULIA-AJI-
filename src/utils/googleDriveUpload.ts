import { getAccessToken, googleSignIn, clearExpiredGoogleToken } from './firebaseAuth';
import { getSchoolConfig } from './schoolConfig';

export interface DriveUploadOptions {
  category: 'sesi' | 'home_visit' | 'pelanggaran' | 'umum';
  studentName?: string;
  date?: string;
  customPrefix?: string;
}

export interface PdfDriveUploadOptions {
  category?: 'rekap' | 'layanan' | 'pelanggaran' | 'panggilan' | 'perjanjian' | 'kontrak' | 'jurnal' | 'rtl' | 'homevisit' | 'berita_acara' | 'umum';
  studentName?: string;
  nisn?: string;
  date?: string;
  customPrefix?: string;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailUrl?: string;
  directUrl?: string;
  folderId?: string;
  folderName?: string;
  folderViewUrl?: string;
  error?: string;
}

// Category folder names mapping for photo/image documentation
const FOLDER_NAMES: Record<string, string> = {
  sesi: 'Dokumentasi Sesi Konseling',
  home_visit: 'Dokumentasi Home Visit',
  pelanggaran: 'Dokumentasi Pelanggaran & Catatan',
  umum: 'Dokumentasi Kegiatan BK'
};

// Category folder names mapping for PDF archives (Struktur folder rapi: SIKAP-BK/<Kategori>)
export const PDF_FOLDER_NAMES: Record<string, string> = {
  rekap: 'Rekap_Analitik',
  layanan: 'Laporan_Layanan',
  pelanggaran: 'Pelanggaran',
  panggilan: 'Panggilan_Ortu',
  perjanjian: 'Perjanjian_Kontrak',
  kontrak: 'Perjanjian_Kontrak',
  jurnal: 'Jurnal',
  rtl: 'Perjanjian_Kontrak',
  homevisit: 'Home_Visit',
  berita_acara: 'Panggilan_Ortu',
  umum: 'Laporan_Layanan',
};

/**
 * Resolves root folder name: SIKAP-BK
 */
export const getRootFolderName = () => {
  return 'SIKAP-BK';
};

/**
 * Cache for folder IDs to prevent redundant API queries
 */
const folderCache: Record<string, { id: string; viewUrl?: string }> = {};

/**
 * Find or create a folder in Google Drive
 */
export async function getOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<{ id: string; viewUrl?: string }> {
  const cacheKey = `${parentId || 'root'}_${folderName}`;
  if (folderCache[cacheKey]) {
    return folderCache[cacheKey];
  }

  try {
    // 1. Search for existing folder
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (searchRes.status === 401) {
      clearExpiredGoogleToken();
      throw new Error('UNAUTHENTICATED_SESSION: Sesi Google Drive telah berakhir demi keamanan (kedaluwarsa otomatis per 1 jam). Silakan segarkan sesi akun Google Anda.');
    }

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const found = {
          id: searchData.files[0].id,
          viewUrl: searchData.files[0].webViewLink,
        };
        folderCache[cacheKey] = found;
        return found;
      }
    }

    // 2. Folder does not exist, create new folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    });

    if (!createRes.ok) {
      if (createRes.status === 401) {
        clearExpiredGoogleToken();
        throw new Error('UNAUTHENTICATED_SESSION: Sesi Google Drive telah berakhir demi keamanan (kedaluwarsa otomatis per 1 jam). Silakan segarkan sesi akun Google Anda.');
      }
      const errText = await createRes.text();
      let cleanMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        cleanMsg = parsed?.error?.message || errText;
      } catch (e) {}
      throw new Error(`Gagal membuat folder di Google Drive: ${cleanMsg}`);
    }

    const createdData = await createRes.json();
    const result = {
      id: createdData.id,
      viewUrl: createdData.webViewLink,
    };
    folderCache[cacheKey] = result;
    return result;
  } catch (error: any) {
    console.error('Error in getOrCreateDriveFolder:', error?.message || error);
    throw error;
  }
}

/**
 * Upload an image (File, Blob, or Base64 Data URL) to Google Drive directly
 */
export async function uploadImageToGoogleDrive(
  imageSource: File | Blob | string,
  customFileName?: string,
  options?: DriveUploadOptions
): Promise<DriveUploadResult> {
  try {
    // 1. Ensure access token
    let token = await getAccessToken();
    if (!token) {
      const authResult = await googleSignIn();
      if (!authResult || !authResult.accessToken) {
        return {
          success: false,
          error: 'Belum terhubung ke Akun Google. Silakan klik tombol "Hubungkan Google" terlebih dahulu.',
        };
      }
      token = authResult.accessToken;
    }

    // 2. Prepare file blob, mimeType, and filename
    let blob: Blob;
    let mimeType = 'image/jpeg';
    let baseFileName = customFileName || `foto_bk_${Date.now()}.jpg`;

    if (typeof imageSource === 'string') {
      // Base64 data URL
      const matches = imageSource.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        const byteCharacters = atob(matches[2]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else {
        return { success: false, error: 'Format foto Base64 tidak valid.' };
      }
    } else if (imageSource instanceof File) {
      blob = imageSource;
      mimeType = imageSource.type || 'image/jpeg';
      baseFileName = imageSource.name || baseFileName;
    } else {
      blob = imageSource;
      mimeType = imageSource.type || 'image/jpeg';
    }

    // Clean up filename with context
    const cat = options?.category || 'umum';
    const folderLabel = FOLDER_NAMES[cat] || FOLDER_NAMES.umum;
    const dateStr = options?.date || new Date().toISOString().split('T')[0];
    const studentLabel = options?.studentName ? `_${options.studentName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const cleanFileName = `Dokumentasi_${cat.toUpperCase()}_${dateStr}${studentLabel}_${Date.now().toString().slice(-4)}.jpg`;

    // 3. Resolve destination Google Drive folders
    // 3a. Root Folder scoped to the school
    const rootFolderName = getRootFolderName();
    const rootFolder = await getOrCreateDriveFolder(token, rootFolderName);
    // 3b. Sub Folder
    const targetFolder = await getOrCreateDriveFolder(token, folderLabel, rootFolder.id);

    // 4. Multipart upload directly to Google Drive
    const boundary = '-------sikapbkdrive' + Math.random().toString(36).substring(2);
    const metadata = {
      name: cleanFileName,
      mimeType: mimeType,
      parents: [targetFolder.id],
      description: `Dokumentasi Bukti ${folderLabel} SIKAP-BK - Siswa: ${options?.studentName || '-'} (${dateStr})`,
    };

    // Construct multipart form body
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    
    // We construct the multipart body with FormData or unified ArrayBuffer
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', blob, cleanFileName);

    // Using Google Drive v3 upload endpoint
    // We do standard multipart related with custom fetch
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink,parents';

    // Create multipart payload
    const dashdash = '--';
    const crlf = '\r\n';

    const multipartHeader = `${dashdash}${boundary}${crlf}Content-Type: application/json; charset=UTF-8${crlf}${crlf}${JSON.stringify(metadata)}${crlf}${dashdash}${boundary}${crlf}Content-Type: ${mimeType}${crlf}${crlf}`;
    const multipartFooter = `${crlf}${dashdash}${boundary}${dashdash}${crlf}`;

    const headerBlob = new Blob([multipartHeader], { type: 'text/plain' });
    const footerBlob = new Blob([multipartFooter], { type: 'text/plain' });
    const fullBody = new Blob([headerBlob, blob, footerBlob], { type: `multipart/related; boundary=${boundary}` });

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    });

    if (!uploadRes.ok) {
      const errJson = await uploadRes.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Upload gagal dengan kode ${uploadRes.status}`);
    }

    const fileData = await uploadRes.json();
    const fileId = fileData.id;

    // 5. Make the uploaded file viewable with link so it displays directly in the app without auth blocks
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permErr) {
      console.warn('Could not set public reader permission on Drive file:', permErr);
    }

    // Direct embeddable thumbnail / display URLs
    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    const webViewLink = fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const thumbnailUrl = fileData.thumbnailLink || directUrl;

    return {
      success: true,
      fileId: fileId,
      fileName: cleanFileName,
      webViewLink: webViewLink,
      webContentLink: fileData.webContentLink,
      thumbnailUrl: thumbnailUrl,
      directUrl: directUrl,
      folderId: targetFolder.id,
      folderName: folderLabel,
      folderViewUrl: targetFolder.viewUrl,
    };
  } catch (error: any) {
    console.error('Upload to Google Drive Error:', error);
    return {
      success: false,
      error: error?.message || 'Terjadi kesalahan saat mengunggah foto ke Google Drive.',
    };
  }
}

/**
 * Converts a Blob to a base64 encoded string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves a PDF to Google Drive via the Google Apps Script Web App
 * Runs server-side as the Apps Script owner without 1-hour client OAuth token expiration
 */
export async function savePdfViaAppsScript(
  pdfBlob: Blob,
  fileName: string,
  folderName: string
): Promise<DriveUploadResult> {
  try {
    const scriptUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_google_script_url') : null;
    if (!scriptUrl) {
      return {
        success: false,
        error: 'URL Google Apps Script belum dikonfigurasi.',
      };
    }

    const base64Data = await blobToBase64(pdfBlob);
    const payload = {
      action: 'savePdf',
      fileName,
      folderName,
      fileBase64: base64Data,
      mimeType: 'application/pdf',
    };

    let resultData: any = null;

    // 1. Try server proxy first to bypass CORS
    try {
      const proxyRes = await fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: scriptUrl,
          method: 'POST',
          payload,
        }),
      });
      if (proxyRes.ok) {
        resultData = await proxyRes.json();
      }
    } catch (proxyErr) {
      console.warn('Proxy Apps Script tidak merespons, mencoba direct browser fetch...', proxyErr);
    }

    // 2. Direct browser fetch fallback
    if (!resultData) {
      const directRes = await fetch(scriptUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (directRes.ok) {
        resultData = await directRes.json();
      }
    }

    if (resultData && (resultData.status === 'success' || resultData.success)) {
      const fileId = resultData.fileId;
      const webViewLink = resultData.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');
      return {
        success: true,
        fileId,
        fileName,
        webViewLink,
        folderName,
      };
    }

    return {
      success: false,
      error: resultData?.message || 'Gagal menyimpan PDF via Google Apps Script',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Gagal memproses unggahan PDF ke Google Apps Script',
    };
  }
}

/**
 * Automatically upload a generated PDF document to the user's isolated Google Drive folder.
 * Uses Direct Google Drive API v3 when OAuth token is active, with seamless fallback to Google Apps Script.
 */
export async function uploadPdfToGoogleDrive(
  pdfBlobOrDoc: Blob | ArrayBuffer | any,
  fileName: string,
  options?: PdfDriveUploadOptions
): Promise<DriveUploadResult> {
  const cat = options?.category || 'umum';
  const folderLabel = PDF_FOLDER_NAMES[cat] || PDF_FOLDER_NAMES.umum;
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // 1. Prepare PDF Blob
  let blob: Blob;
  try {
    if (pdfBlobOrDoc instanceof Blob) {
      blob = pdfBlobOrDoc;
    } else if (pdfBlobOrDoc instanceof ArrayBuffer) {
      blob = new Blob([pdfBlobOrDoc], { type: 'application/pdf' });
    } else if (typeof pdfBlobOrDoc?.output === 'function') {
      blob = pdfBlobOrDoc.output('blob');
    } else {
      return {
        success: false,
        error: 'Objek PDF tidak valid untuk diunggah.',
      };
    }
  } catch (blobErr: any) {
    return {
      success: false,
      error: `Gagal menyiapkan data PDF: ${blobErr?.message || blobErr}`,
    };
  }

  // 2. Attempt Direct Google Drive API v3 if active OAuth token is present
  const token = await getAccessToken();
  if (token) {
    try {
      const rootFolderName = getRootFolderName();
      const rootFolder = await getOrCreateDriveFolder(token, rootFolderName);
      const targetFolder = await getOrCreateDriveFolder(token, folderLabel, rootFolder.id);

      const boundary = '-------sikapbkpdfdrive' + Math.random().toString(36).substring(2);
      const metadata = {
        name: cleanFileName,
        mimeType: 'application/pdf',
        parents: [targetFolder.id],
        description: `Dokumen Arsip ${folderLabel} SIKAP-BK - Siswa/Agenda: ${options?.studentName || '-'} (Dicetak: ${options?.date || new Date().toLocaleDateString('id-ID')})`,
      };

      const dashdash = '--';
      const crlf = '\r\n';
      const multipartHeader = `${dashdash}${boundary}${crlf}Content-Type: application/json; charset=UTF-8${crlf}${crlf}${JSON.stringify(metadata)}${crlf}${dashdash}${boundary}${crlf}Content-Type: application/pdf${crlf}${crlf}`;
      const multipartFooter = `${crlf}${dashdash}${boundary}${dashdash}${crlf}`;

      const headerBlob = new Blob([multipartHeader], { type: 'text/plain' });
      const footerBlob = new Blob([multipartFooter], { type: 'text/plain' });
      const fullBody = new Blob([headerBlob, blob, footerBlob], { type: `multipart/related; boundary=${boundary}` });

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,parents';
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: fullBody,
      });

      if (uploadRes.status === 401) {
        clearExpiredGoogleToken();
        console.warn('OAuth token expired during PDF upload, falling back to Apps Script if configured.');
      } else if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Upload PDF gagal dengan status ${uploadRes.status}`);
      } else {
        const fileData = await uploadRes.json();
        const fileId = fileData.id;

        // Optional: grant anyone with link read access for instant viewing
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone',
            }),
          });
        } catch {
          // Ignore permission warnings
        }

        const webViewLink = fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

        window.dispatchEvent(
          new CustomEvent('bk_pdf_uploaded_to_drive', {
            detail: {
              fileId,
              fileName: cleanFileName,
              webViewLink,
              folderName: folderLabel,
              folderViewUrl: targetFolder.viewUrl,
              studentName: options?.studentName,
              category: cat,
              timestamp: new Date().toISOString(),
            },
          })
        );

        return {
          success: true,
          fileId: fileId,
          fileName: cleanFileName,
          webViewLink: webViewLink,
          webContentLink: fileData.webContentLink,
          folderId: targetFolder.id,
          folderName: folderLabel,
          folderViewUrl: targetFolder.viewUrl,
        };
      }
    } catch (directErr: any) {
      if (directErr?.message?.includes('UNAUTHENTICATED_SESSION') || directErr?.message?.includes('401')) {
        clearExpiredGoogleToken();
      } else {
        console.warn('Direct Google Drive upload error, trying Apps Script fallback:', directErr?.message || directErr);
      }
    }
  }

  // 3. Fallback: Google Apps Script Web App (runs permanently without 1-hour token expiration)
  const scriptUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('bk_google_script_url') : null;
  if (scriptUrl) {
    try {
      const gasRes = await savePdfViaAppsScript(blob, cleanFileName, folderLabel);
      if (gasRes.success) {
        window.dispatchEvent(
          new CustomEvent('bk_pdf_uploaded_to_drive', {
            detail: {
              fileId: gasRes.fileId,
              fileName: cleanFileName,
              webViewLink: gasRes.webViewLink,
              folderName: folderLabel,
              studentName: options?.studentName,
              category: cat,
              source: 'apps_script',
              timestamp: new Date().toISOString(),
            },
          })
        );
        return gasRes;
      }
    } catch (gasErr) {
      console.warn('Apps Script PDF upload fallback note:', gasErr);
    }
  }

  // 4. Return non-blocking notification if neither sync channel is currently connected
  return {
    success: false,
    error: 'Google Drive belum terhubung atau sesi 1 jam telah berakhir. File tetap aman diunduh ke komputer/HP Anda.',
  };
}
