import { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CloudLightning, 
  Copy, 
  Check, 
  ExternalLink, 
  FileSpreadsheet, 
  HelpCircle, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  LogIn,
  LogOut,
  User,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldCheck
} from 'lucide-react';
import { 
  getSavedScriptUrl, 
  saveScriptUrl, 
  testConnection, 
  pushDataToGoogle, 
  pullDataFromGoogle 
} from '../utils/googleSync';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken
} from '../utils/firebaseAuth';
import {
  getOrCreateSpreadsheet,
  pushDataDirect,
  pullDataDirect
} from '../utils/googleSheetsDirect';

interface GoogleIntegrationViewProps {
  onDataImported: (data: {
    students?: any[];
    violations?: any[];
    services?: any[];
    attendance?: any[];
  }) => void;
}

export default function GoogleIntegrationView({ onDataImported }: GoogleIntegrationViewProps) {
  // Traditional Apps Script state
  const [scriptUrl, setScriptUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Connection Diagnostics State
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'completed'>('idle');
  const [diagnostics, setDiagnostics] = useState<{
    urlValid: boolean;
    reachable: boolean;
    corsPassed: boolean;
    codeMatched: boolean;
    details: string;
    actionItems: string[];
  } | null>(null);

  // Direct Google API OAuth state
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [directSyncStatus, setDirectSyncStatus] = useState<'idle' | 'connecting' | 'connected' | 'syncing' | 'success' | 'error'>('idle');
  const [directSyncMessage, setDirectSyncMessage] = useState('');
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [syncHistory, setSyncHistory] = useState<{ type: 'push' | 'pull'; time: string; status: 'success' | 'failed' }[]>(() => {
    const saved = localStorage.getItem('bk_google_direct_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Load configuration on mount
  useEffect(() => {
    setScriptUrl(getSavedScriptUrl());
    
    // Load spreadsheet details if saved
    const savedId = localStorage.getItem('bk_google_spreadsheet_id');
    const savedUrl = localStorage.getItem('bk_google_spreadsheet_url');
    if (savedId) setSpreadsheetId(savedId);
    if (savedUrl) setSpreadsheetUrl(savedUrl);

    // Unsubscribe listener for Firebase Auth
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        // Automatically check/create spreadsheet once logged in
        if (token) {
          handleAutoSetupSpreadsheet(token);
        }
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setDirectSyncStatus('idle');
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleAutoSetupSpreadsheet = async (token: string) => {
    setDirectSyncStatus('connecting');
    setDirectSyncMessage('Mencari atau membuat file basis data "Database BK Sekolah" di Google Drive Anda...');
    
    const oldId = localStorage.getItem('bk_google_spreadsheet_id');
    const result = await getOrCreateSpreadsheet(token);
    if (result.success && result.spreadsheetId) {
      if (oldId !== result.spreadsheetId) {
        localStorage.removeItem('bk_google_sync_verified');
        window.dispatchEvent(new Event('storage'));
      }
      setSpreadsheetId(result.spreadsheetId);
      setSpreadsheetUrl(result.spreadsheetUrl || null);
      localStorage.setItem('bk_google_spreadsheet_id', result.spreadsheetId);
      if (result.spreadsheetUrl) {
        localStorage.setItem('bk_google_spreadsheet_url', result.spreadsheetUrl);
      }
      setDirectSyncStatus('connected');
      setDirectSyncMessage('Basis Data Terhubung langsung dengan Google Sheets!');
    } else {
      setDirectSyncStatus('error');
      setDirectSyncMessage(result.message || 'Gagal menyambungkan basis data Google Sheets.');
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        await handleAutoSetupSpreadsheet(result.accessToken);
      }
    } catch (error: any) {
      if (error && error.message && (error.message.includes('popup-closed-by-user') || error.message.includes('auth/popup-closed-by-user'))) {
        alert('Proses masuk dibatalkan karena jendela masuk Google ditutup sebelum selesai. Silakan coba klik masuk kembali dan selesaikan verifikasi.');
      } else {
        alert(`Gagal Masuk Google: ${error.message || error}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin mematikan sinkronisasi dan keluar dari akun Google?')) {
      await logout();
      setUser(null);
      setAccessToken(null);
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
      localStorage.removeItem('bk_google_spreadsheet_id');
      localStorage.removeItem('bk_google_spreadsheet_url');
      localStorage.removeItem('bk_google_sync_verified');
      window.dispatchEvent(new Event('storage'));
      setDirectSyncStatus('idle');
    }
  };

  const handleDownloadAppHtml = async () => {
    setDownloadingHtml(true);
    try {
      // Coba unduh file HTML yang sudah dikompilasi (inlined) dari endpoint server dev terlebih dahulu
      let response = await fetch('/api/get-compiled-html');
      let htmlText = '';
      
      if (response.ok) {
        htmlText = await response.text();
      } else {
        // Jika gagal atau sedang di production, coba langsung ambil /single.html (yang sudah dikompilasi di server produksi)
        response = await fetch('/single.html');
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }
        htmlText = await response.text();
      }
      
      // Deteksi apakah file HTML yang diunduh masih versi mentah/belum dikompilasi
      if (htmlText.includes('/src/main.tsx') || htmlText.includes('@vite/client')) {
        alert("PERINGATAN SISTEM:\n\nFile yang terunduh terdeteksi masih versi pengembangan (belum dikompilasi).\n\nSilakan tunggu sekitar 5 detik lalu coba klik 'Unduh File Aplikasi' lagi agar sistem dapat melakukan build produksi otomatis terlebih dahulu.");
      } else {
        alert("BERHASIL:\n\nFile tunggal 'Index.html' yang terkompilasi penuh siap diunduh! Silakan unggah file ini ke Google Apps Script Anda sebagai file HTML bernama 'Index'.");
      }
      
      const blob = new Blob([htmlText], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Index.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Gagal mengunduh file: ${err.message}`);
    } finally {
      setDownloadingHtml(false);
    }
  };

  const handleDirectExport = async () => {
    const token = accessToken || await getAccessToken();
    if (!token) {
      alert('Sesi Google Anda kedaluwarsa. Silakan masuk kembali.');
      handleGoogleLogin();
      return;
    }
    if (!spreadsheetId) {
      alert('ID Spreadsheet tidak ditemukan. Sistem akan mencoba menyetel ulang.');
      await handleAutoSetupSpreadsheet(token);
      return;
    }

    if (!confirm('Apakah Anda yakin ingin mengekspor seluruh data lokal aplikasi ini ke Google Spreadsheet? Semua data lama di lembar "Siswa", "Pelanggaran", "LayananBK", dan "Absensi" akan ditimpa.')) {
      return;
    }

    setDirectSyncStatus('syncing');
    setDirectSyncMessage('Sedang menyinkronkan dan mengekspor data ke Google Sheets...');

    try {
      const students = JSON.parse(localStorage.getItem('bk_students') || '[]');
      const violations = JSON.parse(localStorage.getItem('bk_violations') || '[]');
      const services = JSON.parse(localStorage.getItem('bk_services') || '[]');
      const attendance = JSON.parse(localStorage.getItem('bk_attendance_history') || '[]');

      let result = await pushDataDirect(token, spreadsheetId, {
        students,
        violations,
        services,
        attendance
      });

      if (!result.success && result.message.includes('OVERWRITE_PREVENTION')) {
        const forceExport = confirm(
          "⚠️ PERINGATAN OVERWRITE (PENIMPAAN DATA):\n\n" +
          "Sistem mendeteksi ada data riwayat tersimpan di Google Sheets Anda, sementara perangkat ini belum di-sinkronisasi (belum pernah mengimpor data).\n\n" +
          "SANGAT DIREKOMENDASIKAN: Klik 'Batal', lalu klik tombol 'Tarik Data dari Google Sheets' terlebih dahulu demi keamanan.\n\n" +
          "Klik 'OK' HANYA jika Anda ingin memaksa menimpa data Google Sheets dengan data baru di perangkat ini (menghapus data lama di awan)."
        );
        if (forceExport) {
          setDirectSyncStatus('syncing');
          setDirectSyncMessage('Memaksa menulis data ke Google Sheets...');
          result = await pushDataDirect(token, spreadsheetId, {
            students,
            violations,
            services,
            attendance
          }, true);
        } else {
          setDirectSyncStatus('idle');
          setDirectSyncMessage('Sinkronisasi ditangguhkan demi perlindungan basis data.');
          return;
        }
      }

      if (result.success) {
        setDirectSyncStatus('success');
        setDirectSyncMessage(result.message);
        
        const newHistoryItem = {
          type: 'push' as const,
          time: new Date().toLocaleString('id-ID'),
          status: 'success' as const
        };
        const updatedHistory = [newHistoryItem, ...syncHistory].slice(0, 10);
        setSyncHistory(updatedHistory);
        localStorage.setItem('bk_google_direct_history', JSON.stringify(updatedHistory));
        alert('Ekspor Berhasil! Data di Google Sheets Anda kini sudah up-to-date.');
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      setDirectSyncStatus('error');
      setDirectSyncMessage(err.message || 'Terjadi kesalahan ekspor.');
      const newHistoryItem = {
        type: 'push' as const,
        time: new Date().toLocaleString('id-ID'),
        status: 'failed' as const
      };
      const updatedHistory = [newHistoryItem, ...syncHistory].slice(0, 10);
      setSyncHistory(updatedHistory);
      localStorage.setItem('bk_google_direct_history', JSON.stringify(updatedHistory));
      alert(`Ekspor Gagal: ${err.message}`);
    }
  };

  const handleDirectImport = async () => {
    const token = accessToken || await getAccessToken();
    if (!token) {
      alert('Sesi Google Anda kedaluwarsa. Silakan masuk kembali.');
      handleGoogleLogin();
      return;
    }
    if (!spreadsheetId) {
      alert('ID Spreadsheet tidak ditemukan. Sistem akan mencoba menyetel ulang.');
      await handleAutoSetupSpreadsheet(token);
      return;
    }

    if (!confirm('Peringatan Keras: Ini akan menimpa seluruh data lokal Siswa, Pelanggaran, Jurnal Layanan BK, dan Absensi di browser Anda dengan data yang ada di Google Spreadsheet. Lanjutkan?')) {
      return;
    }

    setDirectSyncStatus('syncing');
    setDirectSyncMessage('Sedang membaca dan mengunduh data terbaru dari Google Sheets...');

    try {
      const result = await pullDataDirect(token, spreadsheetId);
      if (result.success && result.data) {
        onDataImported(result.data);
        setDirectSyncStatus('success');
        setDirectSyncMessage('Database lokal berhasil disinkronkan dari Google Sheets!');

        const newHistoryItem = {
          type: 'pull' as const,
          time: new Date().toLocaleString('id-ID'),
          status: 'success' as const
        };
        const updatedHistory = [newHistoryItem, ...syncHistory].slice(0, 10);
        setSyncHistory(updatedHistory);
        localStorage.setItem('bk_google_direct_history', JSON.stringify(updatedHistory));
        alert('Impor Berhasil! Seluruh database lokal browser Anda telah diperbarui dari Google Sheets.');
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      setDirectSyncStatus('error');
      setDirectSyncMessage(err.message || 'Terjadi kesalahan impor.');
      const newHistoryItem = {
        type: 'pull' as const,
        time: new Date().toLocaleString('id-ID'),
        status: 'failed' as const
      };
      const updatedHistory = [newHistoryItem, ...syncHistory].slice(0, 10);
      setSyncHistory(updatedHistory);
      localStorage.setItem('bk_google_direct_history', JSON.stringify(updatedHistory));
      alert(`Impor Gagal: ${err.message}`);
    }
  };

  // Traditional Apps Script Handlers (Fallback)
  const handleSaveUrl = () => {
    saveScriptUrl(scriptUrl);
    alert('URL Google Apps Script berhasil disimpan secara lokal!');
    setConnectionStatus('idle');
    setStatusMessage('');
  };

  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      alert('Silakan masukkan URL Apps Script terlebih dahulu.');
      return;
    }
    setConnectionStatus('testing');
    setStatusMessage('Sedang menguji koneksi...');
    
    const result = await testConnection(scriptUrl);
    if (result.success) {
      setConnectionStatus('success');
      setStatusMessage(result.message);
    } else {
      setConnectionStatus('failed');
      setStatusMessage(result.message);
    }
  };

  const handleCheckConnection = async () => {
    const url = scriptUrl.trim();
    if (!url) {
      alert('Silakan masukkan URL Apps Script terlebih dahulu.');
      return;
    }

    setCheckStatus('checking');
    setDiagnostics(null);

    const isFormatValid = url.startsWith('https://script.google.com/') && url.includes('/exec');
    
    let isReachable = false;
    let isCorsPassed = false;
    let isCodeMatched = false;
    let details = '';
    const actionItems: string[] = [];

    if (!isFormatValid) {
      setCheckStatus('completed');
      setDiagnostics({
        urlValid: false,
        reachable: false,
        corsPassed: false,
        codeMatched: false,
        details: 'Format URL tidak valid. URL Google Apps Script Web App resmi harus dimulai dengan "https://script.google.com/" dan diakhiri dengan "/exec".',
        actionItems: [
          'Periksa kembali URL yang Anda tempel di kolom input.',
          'Pastikan Anda tidak memasukkan URL Spreadsheet Google atau URL editor Apps Script.',
          'Ikuti petunjuk penyalinan URL Aplikasi Web di panel kanan.'
        ]
      });
      return;
    }

    // Step 1: Reachable Test (no-cors fetch to bypass CORS check on whether domain can be reached)
    const testUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping`;
    try {
      await fetch(testUrl, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit'
      });
      isReachable = true;
    } catch (e: any) {
      isReachable = false;
      details = `Gagal menjangkau server Google Apps Script (${e.message}). Jaringan atau domain tidak dapat dihubungi.`;
      actionItems.push(
        'Pastikan koneksi internet Anda aktif dan stabil.',
        'Periksa kembali apakah ada kesalahan ketik (typo) pada URL Apps Script Anda.',
        'Pastikan URL tersebut belum dihapus di proyek Google Apps Script.'
      );
    }

    if (isReachable) {
      // Step 2: CORS and JSON Parse Test
      try {
        const responseCors = await fetch(testUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        });

        if (!responseCors.ok) {
          throw new Error(`HTTP Error ${responseCors.status}`);
        }

        isCorsPassed = true;
        const text = await responseCors.text();
        
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch (jsonErr) {
          details = `Browser berhasil menjangkau URL dan melewati batas CORS, namun respons dari script Anda bukan dalam format JSON. Respons yang diterima: "${text.substring(0, 120)}${text.length > 120 ? '...' : ''}"`;
          actionItems.push(
            'Salin seluruh kode Google Apps Script secara UTUH dari tab di panel kiri.',
            'Kemungkinan Anda salah mendeploy atau file Apps Script Anda mengembalikan halaman HTML/Error bawaan Google.',
            'Lakukan deployment baru (Terapkan > Penerapan Baru > Aplikasi Web) di editor Apps Script Anda.'
          );
        }

        if (json) {
          if (json.status === 'success' || (json.message && (json.message.includes('Koneksi berhasil') || json.message.includes('Terhubung ke Spreadsheet')))) {
            isCodeMatched = true;
            details = `Selamat! Koneksi browser ke Google Apps Script berjalan dengan sempurna. Apps Script Anda aktif dan siap menerima ekspor/impor data.`;
            actionItems.push(
              'Aplikasi Web Apps Script Anda siap digunakan untuk ekspor/impor!',
              'Anda bisa mulai melakukan "Kirim via Apps Script" atau "Tarik via Apps Script" untuk mencadangkan data.'
            );
          } else if (json.status === 'error' || (json.message && (json.message.includes('Action tidak dikenali') || json.message.includes('tidak dikenal') || json.message.includes('tidak dikenali')))) {
            isCodeMatched = false;
            details = `URL valid dan terjangkau, namun proyek Google Apps Script Anda mengembalikan pesan error: "${json.message || 'Action tidak dikenali.'}". Ini berarti kode di Google Apps Script Anda belum diperbarui ke versi terbaru yang mendukung fitur "ping".`;
            actionItems.push(
              'Salin kode Google Apps Script terbaru di tab sebelah kiri secara UTUH.',
              'Buka editor Google Apps Script Anda, hapus seluruh kode lama, lalu tempel kode baru tersebut.',
              'PENTING: Anda harus mendeploy ulang sebagai VERSI BARU. Klik Terapkan (Deploy) > Kelola Penerapan (Manage deployments) > Klik ikon pensil (Edit) > Pada kolom Versi pilih "Versi Baru" (New Version) > Klik Terapkan.'
            );
          } else {
            isCodeMatched = false;
            details = `Respons JSON diterima dari Apps Script, namun isinya tidak sesuai dengan format yang diharapkan. Respons: ${JSON.stringify(json)}`;
            actionItems.push(
              'Pastikan Anda telah menyalin kode Google Apps Script (Code.gs) yang tepat.',
              'Lakukan deployment ulang dengan memilih "Versi Baru" (New Version) agar perubahan kode diterapkan secara publik.'
            );
          }
        }
      } catch (corsErr: any) {
        isCorsPassed = false;
        details = `Browser berhasil menjangkau server Google secara fisik, tetapi koneksi diblokir oleh kebijakan keamanan CORS browser (Error: ${corsErr.message}). Hal ini biasanya terjadi jika Google Apps Script meminta login akun Google (tidak diakses secara bebas).`;
        actionItems.push(
          'Pastikan saat mendeploy (Terapkan > Penerapan baru > Aplikasi Web) Anda menyetel "Siapa yang memiliki akses" (Who has access) ke "Siapa saja" (Anyone), bukan "Hanya saya" atau akun institusi.',
          'Pastikan Anda memilih "Jalankan sebagai" (Execute as) ke "Saya" (Me / email Anda).',
          'Pastikan Anda telah mengeklik tombol "Izinkan Akses" (Authorize access) saat mempublikasikan deployment Google Apps Script Anda.',
          'PENTING: Setelah mengubah setelan di atas, lakukan deployment sebagai versi baru (Kelola Penerapan > Edit > Pilih Versi Baru > Terapkan).'
        );
      }
    }

    setCheckStatus('completed');
    setDiagnostics({
      urlValid: isFormatValid,
      reachable: isReachable,
      corsPassed: isCorsPassed,
      codeMatched: isCodeMatched,
      details,
      actionItems
    });
  };

  const handleExportData = async () => {
    const url = scriptUrl.trim() || getSavedScriptUrl();
    if (!url) {
      alert('Silakan simpan URL Apps Script Anda terlebih dahulu.');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin mengekspor seluruh data lokal aplikasi ini ke Google Spreadsheet via Apps Script?')) {
      return;
    }

    setIsSyncing(true);
    let result = await pushDataToGoogle(url);
    
    if (!result.success && result.message.includes('OVERWRITE_PREVENTION')) {
      setIsSyncing(false);
      const forceExport = confirm(
        "⚠️ PERINGATAN OVERWRITE (PENIMPAAN DATA):\n\n" +
        "Sistem mendeteksi ada data riwayat tersimpan di Google Sheets Anda, sementara perangkat ini belum di-sinkronisasi (belum pernah mengimpor data).\n\n" +
        "SANGAT DIREKOMENDASIKAN: Klik 'Batal', lalu klik tombol 'Tarik via Apps Script' terlebih dahulu demi keamanan.\n\n" +
        "Klik 'OK' HANYA jika Anda ingin memaksa menimpa data Google Sheets dengan data baru di perangkat ini (menghapus data lama di awan)."
      );
      if (forceExport) {
        setIsSyncing(true);
        result = await pushDataToGoogle(url, true);
      } else {
        alert('Ekspor ditangguhkan demi perlindungan basis data.');
        return;
      }
    }
    
    setIsSyncing(false);
    
    if (result.success) {
      alert('Ekspor Berhasil! ' + result.message);
    } else {
      alert('Ekspor Gagal: ' + result.message);
    }
  };

  const handleImportData = async () => {
    const url = scriptUrl.trim() || getSavedScriptUrl();
    if (!url) {
      alert('Silakan simpan URL Apps Script Anda terlebih dahulu.');
      return;
    }

    if (!confirm('Peringatan: Ini akan menimpa data siswa, pelanggaran, rekam layanan, dan absensi di browser Anda dengan data dari Google Spreadsheet via Apps Script. Lanjutkan?')) {
      return;
    }

    setIsSyncing(true);
    const result = await pullDataFromGoogle(url);
    setIsSyncing(false);

    if (result.success && result.data) {
      onDataImported(result.data);
      alert('Impor Berhasil! Seluruh database lokal Anda telah diperbarui.');
    } else {
      alert('Impor Gagal: ' + result.message);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleAppsScriptCode = `/**
 * GOOGLE APPS SCRIPT DATABASE ENDPOINT FOR BK PORTAL
 * --------------------------------------------------
 * Tempelkan kode ini secara utuh pada Google Apps Script Anda (Ekstensi > Apps Script).
 * Deploy sebagai Aplikasi Web (Web App), setel "Jalankan sebagai: Saya", dan "Akses: Siapa saja".
 */

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Koneksi berhasil! Terhubung ke Spreadsheet: " + ss.getName() 
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "readAll") {
      var output = JSON.stringify({
        students: readTab(ss, "Siswa", ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount", "initials"]),
        violations: readTab(ss, "Pelanggaran", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"]),
        services: readTab(ss, "LayananBK", ["id", "serviceType", "problem", "description", "output", "followUp", "status", "date", "startTime", "endTime", "students", "attachments", "notes"]),
        attendance: readTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"])
      });
      return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
    } else {
      // DEFAULT: Jika diakses langsung tanpa action di web browser, tampilkan UI Aplikasi BK (Index.html)
      try {
        var htmlOutput = HtmlService.createHtmlOutputFromFile("Index");
        htmlOutput.setTitle("Sistem BK SMPN 2 Susukan")
                  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                  .addMetaTag('viewport', 'width=device-width, initial-scale=1');
        return htmlOutput;
      } catch(htmlErr) {
        // Jika file "Index" belum diupload atau gagal diload, tampilkan halaman panduan ramah
        var errDetail = htmlErr ? htmlErr.toString() : "File 'Index' tidak ditemukan di Apps Script Anda.";
        return HtmlService.createHtmlOutput(
          "<div style='font-family: sans-serif; padding: 25px; max-width: 600px; margin: 40px auto; border: 1px solid #cce8e5; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background-color: #fcfefe;'>" +
          "<h2 style='color: #00685f; margin-top: 0;'>Sistem Database BK SMPN 2 Susukan Aktif!</h2>" +
          "<p style='color: #4a5568; line-height: 1.6;'>Database Google Apps Script Anda <strong>berhasil dikoneksikan</strong> ke Spreadsheet: <strong style='color: #00685f;'>" + ss.getName() + "</strong>.</p>" +
          "<div style='background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 12px; margin: 15px 0; border-radius: 4px; color: #115e59; font-size: 14px; font-weight: bold;'>" +
          "Langkah berikutnya: Hubungkan URL ini di aplikasi BK Anda!" +
          "</div>" +
          "<div style='background-color: #fef2f2; border-left: 4px solid #f87171; padding: 15px; margin: 15px 0; border-radius: 6px; color: #991b1b; font-size: 13px;'>" +
          "<strong style='font-size: 14px;'>⚠️ Detail Status Hosting Aplikasi:</strong><br>" +
          "<code style='background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-family: monospace; display: block; margin-top: 5px; word-break: break-all;'>" + errDetail + "</code>" +
          "<p style='margin: 8px 0 0 0; font-size: 12px;'>Jika status di atas adalah <strong>'Exception: Inside Sidebar/Dialog...'</strong> atau <strong>'ScriptError...'</strong> atau <strong>'Page not found'</strong>, itu artinya file 'Index' belum ditambahkan dengan benar atau deployment belum diperbarui ke Versi Baru.</p>" +
          "</div>" +
          "<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>" +
          "<h4 style='color: #2d3748; margin-bottom: 8px;'>Panduan Tambahan: Cara Menghosting Aplikasi Langsung di Sini</h4>" +
          "<p style='color: #718096; font-size: 13px; margin-top: 0;'>Anda juga dapat membuka aplikasi BK secara penuh lewat link ini dengan mengupload file Index.html:</p>" +
          "<ol style='color: #4a5568; line-height: 1.6; padding-left: 20px; font-size: 13.5px;'>" +
          "<li>Buka aplikasi BK Anda, pergi menu <strong>Integrasi Google</strong>.</li>" +
          "<li>Di panel kanan bawah, klik <strong>'Unduh File Aplikasi'</strong> untuk mendownload file <strong>Index.html</strong>.</li>" +
          "<li>Pada editor Apps Script ini, di sebelah kiri (bagian File), klik ikon <strong>+</strong> > pilih <strong>HTML</strong>.</li>" +
          "<li>Beri nama file tersebut <strong>Index</strong> (tanpa .html).</li>" +
          "<li>Buka file Index.html yang terunduh tadi, salin semua kodenya, dan paste ke file Index di editor Apps Script ini.</li>" +
          "<li>Klik Simpan (disket), lalu klik <strong>Terapkan (Deploy)</strong> > <strong>Kelola Penerapan (Manage deployments)</strong> > Edit > Pilih Versi Baru, lalu simpan.</li>" +
          "</ol>" +
          "</div>"
        );
      }
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var output = "";
  
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === "sync") {
      syncTab(ss, "Siswa", ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount", "initials"], payload.students || []);
      syncTab(ss, "Pelanggaran", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"], payload.violations || []);
      syncTab(ss, "LayananBK", ["id", "serviceType", "problem", "description", "output", "followUp", "status", "date", "startTime", "endTime", "students", "attachments", "notes"], payload.services || []);
      syncTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"], payload.attendance || []);
      
      output = JSON.stringify({ 
        status: "success", 
        message: "Sinkronisasi berhasil! Spreadsheet telah diperbarui." 
      });
    } else {
      output = JSON.stringify({ status: "error", message: "Aksi POST tidak dikenal." });
    }
  } catch (err) {
    output = JSON.stringify({ status: "error", message: err.message });
  }
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function syncTab(ss, tabName, headers, items) {
  var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  sheet.clear();
  
  var rows = [headers];
  if (items && items.length > 0) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = headers.map(function(h) {
        var val = item[h];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
      rows.push(row);
    }
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

function readTab(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];
  
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  var sheetHeaders = values[0];
  var result = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    headers.forEach(function(h) {
      var idx = sheetHeaders.indexOf(h);
      var val = idx !== -1 ? row[idx] : "";
      
      if (typeof val === "string" && (val.indexOf("[") === 0 || val.indexOf("{") === 0)) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      
      if (h === "violationPoints" || h === "bkServicesCount" || h === "pointsAdded") {
        var num = Number(val);
        if (!isNaN(num)) val = num;
      }
      
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}
`;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0b1c30] flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-[#00685f]" />
            <span>Integrasi Google Sheets</span>
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Cadangkan dan sinkronisasikan seluruh database BK (Siswa, Pelanggaran, Layanan, Absensi) dengan Google Spreadsheet secara aman.
          </p>
        </div>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RECOMMENDED DIRECT SYNC METHOD (COLUMN 1 & 2 SPAN) */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white rounded-2xl p-6 border-2 border-[#00685f]/30 shadow-md space-y-6 relative overflow-hidden">
            {/* Recommendation badge */}
            <div className="absolute top-0 right-0 bg-[#00685f] text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>Rekomendasi Utama</span>
            </div>

            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <Database className="w-5 h-5 text-[#00685f]" />
              <span>Sinkronisasi Otomatis Google Sheets (OAuth 2.0)</span>
            </h3>

            {/* Auth check render */}
            {!user ? (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-teal-50 rounded-full border border-teal-100">
                  <FileSpreadsheet className="w-12 h-12 text-[#00685f]" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="font-extrabold text-sm text-[#0b1c30]">Sambungkan Akun Google Anda</h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    Hubungkan portal BK SMP Negeri 2 Susukan ini secara langsung dengan Google Drive Anda. Kami akan secara otomatis mengelola spreadsheet <strong className="text-gray-700">"Database BK Sekolah"</strong> secara langsung dan instan tanpa perlu repot mengatur kode skrip!
                  </p>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="mt-2 flex items-center gap-3 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl px-6 py-3 shadow-sm transition-all duration-150 cursor-pointer text-[#3c4043] font-bold text-sm select-none disabled:opacity-50 active:scale-98"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                  ) : (
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  )}
                  <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Active Connection Profile */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4.5 bg-gray-50 border border-gray-200 rounded-2xl">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-11 h-11 rounded-full border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Terhubung Sebagai:</h4>
                      <p className="font-bold text-[#0b1c30] text-sm leading-tight mt-0.5">{user.displayName || 'Akun Google Sekolah'}</p>
                      <p className="text-xs text-gray-500 font-semibold">{user.email}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleGoogleLogout}
                    className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-100 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>

                {/* Status Notice Indicator */}
                {directSyncStatus !== 'idle' && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in slide-in-from-top-3 ${
                    directSyncStatus === 'connecting' || directSyncStatus === 'syncing' 
                      ? 'bg-blue-50/70 border-blue-200 text-blue-800' :
                    directSyncStatus === 'connected' || directSyncStatus === 'success' 
                      ? 'bg-[#e6fcf5] border-[#00685f]/20 text-[#00685f]' :
                    'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {directSyncStatus === 'connecting' || directSyncStatus === 'syncing' ? (
                      <RefreshCw className="w-5 h-5 animate-spin mt-0.5 text-blue-600" />
                    ) : directSyncStatus === 'connected' || directSyncStatus === 'success' ? (
                      <div className="p-1 bg-[#00685f]/10 rounded-full shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#00685f]" />
                      </div>
                    ) : (
                      <div className="p-1 bg-red-100 rounded-full shrink-0">
                        <AlertCircle className="w-4 h-4 text-red-700" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider">
                        {directSyncStatus === 'connecting' ? 'Menghubungkan Drive...' :
                         directSyncStatus === 'syncing' ? 'Sedang Sinkronisasi...' :
                         directSyncStatus === 'connected' ? 'Basis Data Terkoneksi' :
                         directSyncStatus === 'success' ? 'Sinkronisasi Berhasil' : 'Koneksi Gagal'}
                      </h4>
                      <p className="text-xs font-semibold leading-relaxed opacity-95">{directSyncMessage}</p>
                    </div>
                  </div>
                )}

                {/* Active Spreadsheet Details */}
                {spreadsheetId && (
                  <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00685f] inline-block"></span>
                        <h5 className="font-extrabold text-[#0b1c30] text-xs uppercase tracking-wider">File Spreadsheet Terbuka:</h5>
                      </div>
                      <p className="text-sm font-bold text-emerald-800">Database BK Sekolah</p>
                      <p className="text-[10px] text-gray-400 font-mono">ID: {spreadsheetId.substring(0, 24)}...</p>
                    </div>

                    {spreadsheetUrl && (
                      <a
                        href={spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Spreadsheet di Drive</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Action Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 pt-4 border-t border-[#bcc9c6]/20">
                  {/* Export */}
                  <div className="p-4 border border-[#bcc9c6]/30 bg-[#fbfdff] rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold bg-[#00685f]/15 text-[#00685f] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Cadangkan</span>
                      <h4 className="font-extrabold text-sm text-[#0b1c30] mt-1">Ekspor Instan ke Google Sheets</h4>
                      <p className="text-xs text-[#3d4947]/75 font-semibold leading-relaxed">
                        Kirim data lokal browser saat ini (Siswa, Pelanggaran, Jurnal Layanan, Absensi) langsung ke sheet bersangkutan di awan.
                      </p>
                    </div>
                    <button
                      onClick={handleDirectExport}
                      disabled={directSyncStatus === 'syncing' || !spreadsheetId}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {directSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      <span>Ekspor &amp; Cadangkan Data</span>
                    </button>
                  </div>

                  {/* Import */}
                  <div className="p-4 border border-[#bcc9c6]/30 bg-[#fbfdff] rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Unduh</span>
                      <h4 className="font-extrabold text-sm text-[#0b1c30] mt-1">Impor Instan dari Google Sheets</h4>
                      <p className="text-xs text-[#3d4947]/75 font-semibold leading-relaxed">
                        Tarik data awan Google Spreadsheet Anda saat ini untuk menggantikan seluruh data lokal browser secara keseluruhan.
                      </p>
                    </div>
                    <button
                      onClick={handleDirectImport}
                      disabled={directSyncStatus === 'syncing' || !spreadsheetId}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {directSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Impor &amp; Timpa Data Lokal</span>
                    </button>
                  </div>
                </div>

                {/* Local direct sync logs */}
                {syncHistory.length > 0 && (
                  <div className="pt-4 border-t border-[#bcc9c6]/10">
                    <h4 className="text-[10px] font-extrabold text-[#0b1c30] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span>Log Aktivitas Sinkronisasi Langsung Terakhir</span>
                    </h4>
                    <div className="bg-[#f8f9ff] border border-gray-100 rounded-xl divide-y divide-gray-100 text-[11px] font-semibold">
                      {syncHistory.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'push' ? 'bg-[#00685f]' : 'bg-purple-500'}`}></span>
                            <span className="text-gray-700">
                              {item.type === 'push' ? 'Ekspor Data (Push)' : 'Impor Data (Pull)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500 font-medium">
                            <span>{item.time}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase ${
                              item.status === 'success' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {item.status === 'success' ? 'Sukses' : 'Gagal'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ADVANCED METHOD: MANUAL APPS SCRIPT WEB APP */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#bcc9c6]/20 pb-3">
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2">
                <CloudLightning className="w-5 h-5 text-gray-500" />
                <span>Metode Aplikasi Web Apps Script (Alternatif/Lanjutan)</span>
              </h3>
              <span className="text-[9px] font-extrabold bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded">OPSIONAL</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Anda juga bisa menyambungkan data via webhook deployment Google Apps Script (GAS) jika ingin mengizinkan API eksternal pihak ketiga memanggil basis data secara otonom.
            </p>

            {/* URL Input Form */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[#0b1c30] block">
                URL Aplikasi Web Google Apps Script (GAS)
              </label>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="url"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 bg-[#f8f9ff] border border-[#bcc9c6]/40 rounded-xl px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveUrl}
                    className="px-4 py-3 bg-[#0b1c30] hover:bg-[#142e4d] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Simpan URL
                  </button>
                  <button
                    onClick={handleCheckConnection}
                    disabled={checkStatus === 'checking'}
                    className="px-4 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {checkStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Check Connection</span>
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connectionStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Uji Koneksi Singkat</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Connection Diagnostics Display */}
            {checkStatus !== 'idle' && (
              <div className="p-5 rounded-2xl border bg-[#fbfdff] border-[#bcc9c6]/30 space-y-4 animate-in slide-in-from-top-3">
                <div className="flex items-center justify-between border-b border-[#bcc9c6]/10 pb-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <CloudLightning className="w-4 h-4 text-[#00685f] animate-pulse" />
                    <span>Hasil Diagnostik Koneksi Browser</span>
                  </h4>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                    checkStatus === 'checking' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    (diagnostics?.codeMatched ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100')
                  }`}>
                    {checkStatus === 'checking' ? 'Menganalisis...' : (diagnostics?.codeMatched ? 'Sempurna' : 'Perlu Tindakan')}
                  </span>
                </div>

                {/* Steps checklist */}
                <div className="space-y-2.5 text-xs">
                  {/* Step 1: URL Format */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                    <span className="font-semibold text-gray-700">1. Validasi Format URL</span>
                    {checkStatus === 'checking' ? (
                      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : diagnostics?.urlValid ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">✔ Benar</span>
                    ) : (
                      <span className="text-red-500 font-extrabold flex items-center gap-1">❌ Salah</span>
                    )}
                  </div>

                  {/* Step 2: Reachability */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                    <span className="font-semibold text-gray-700">2. Jangkauan Server (Ping Jaringan)</span>
                    {checkStatus === 'checking' ? (
                      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : diagnostics?.reachable ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">✔ Terhubung</span>
                    ) : (
                      <span className="text-red-500 font-extrabold flex items-center gap-1">❌ Terputus</span>
                    )}
                  </div>

                  {/* Step 3: CORS security */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                    <span className="font-semibold text-gray-700">3. Izin Keamanan CORS Browser</span>
                    {checkStatus === 'checking' ? (
                      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : diagnostics?.corsPassed ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">✔ Lolos</span>
                    ) : diagnostics?.reachable ? (
                      <span className="text-amber-500 font-extrabold flex items-center gap-1">⚠️ Terblokir</span>
                    ) : (
                      <span className="text-gray-400 font-extrabold flex items-center gap-1">-</span>
                    )}
                  </div>

                  {/* Step 4: Code matching */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                    <span className="font-semibold text-gray-700">4. Kesesuaian Versi Kode Apps Script</span>
                    {checkStatus === 'checking' ? (
                      <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : diagnostics?.codeMatched ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">✔ Sesuai (Aktif)</span>
                    ) : diagnostics?.corsPassed ? (
                      <span className="text-red-500 font-extrabold flex items-center gap-1">❌ Outdated / Salah</span>
                    ) : (
                      <span className="text-gray-400 font-extrabold flex items-center gap-1">-</span>
                    )}
                  </div>
                </div>

                {/* Narrative Diagnostic Message */}
                {checkStatus === 'completed' && diagnostics && (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs leading-relaxed space-y-3">
                    <div>
                      <h5 className="font-extrabold text-gray-800 mb-1">Hasil Analisis:</h5>
                      <p className="text-gray-600 font-semibold">{diagnostics.details}</p>
                    </div>

                    {diagnostics.actionItems.length > 0 && (
                      <div className="pt-2.5 border-t border-gray-200/50">
                        <h5 className="font-extrabold text-[#00685f] mb-1.5">Langkah Penyelesaian:</h5>
                        <ul className="list-disc pl-4.5 space-y-1.5 text-gray-600 font-medium">
                          {diagnostics.actionItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Traditional Status Display Banner */}
            {connectionStatus !== 'idle' && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in slide-in-from-top-3 ${
                connectionStatus === 'testing' ? 'bg-[#f8f9ff] border-blue-200 text-blue-700' :
                connectionStatus === 'success' ? 'bg-[#e6fcf5] border-[#00685f]/20 text-[#00685f]' :
                'bg-red-50 border-red-200 text-red-700'
              }`}>
                {connectionStatus === 'testing' ? (
                  <RefreshCw className="w-5 h-5 animate-spin mt-0.5" />
                ) : connectionStatus === 'success' ? (
                  <div className="p-1 bg-[#00685f]/10 rounded-full shrink-0">
                    <Check className="w-4 h-4 text-[#00685f]" />
                  </div>
                ) : (
                  <div className="p-1 bg-red-100 rounded-full shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-700" />
                  </div>
                )}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {connectionStatus === 'testing' ? 'Menguji Koneksi' :
                     connectionStatus === 'success' ? 'Koneksi Berhasil' : 'Koneksi Gagal'}
                  </h4>
                  <p className="text-xs font-medium leading-relaxed opacity-90">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Sync Trigger Panel */}
            <div className="pt-4 border-t border-[#bcc9c6]/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Push Box */}
                <div className="p-4 bg-[#f8f9ff] border border-[#bcc9c6]/20 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kirim via GAS</span>
                    <h5 className="font-bold text-[#0b1c30] text-sm mt-1">Ekspor ke Spreadsheet</h5>
                    <p className="text-xs text-[#3d4947]/75 font-medium leading-relaxed">
                      Kirim data lokal browser ke Web App Apps Script Anda.
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>Kirim via Apps Script</span>
                  </button>
                </div>

                {/* Pull Box */}
                <div className="p-4 bg-[#f8f9ff] border border-[#bcc9c6]/20 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full uppercase">Tarik via GAS</span>
                    <h5 className="font-bold text-[#0b1c30] text-sm mt-1">Impor dari Spreadsheet</h5>
                    <p className="text-xs text-[#3d4947]/75 font-medium leading-relaxed">
                      Tarik data terbaru dari Spreadsheet via Web App Apps Script.
                    </p>
                  </div>
                  <button
                    onClick={handleImportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>Tarik via Apps Script</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* INSTRUCTIONS COLUMN (SPAN 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Guide steps */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <HelpCircle className="w-5 h-5 text-[#00685f]" />
              <span>Panduan &amp; Informasi</span>
            </h3>

            <div className="space-y-5 text-xs text-[#3d4947] font-semibold leading-relaxed">
              <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl space-y-1.5">
                <h4 className="font-extrabold text-[#00685f] text-xs flex items-center gap-1">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Koneksi Otomatis (Direkomendasikan)</span>
                </h4>
                <p className="text-[#3d4947]/90 text-[11px]">
                  Cukup masuk menggunakan akun Google Anda. Sistem akan mencari file bernama <strong>"Database BK Sekolah"</strong> di Drive Anda atau membuatnya secara otomatis jika belum ada.
                </p>
                <p className="text-[#3d4947]/90 text-[11px] font-bold">
                  Siswa, Pelanggaran, Jurnal Layanan BK, dan Absensi akan langsung diorganisasikan ke dalam tab-tab spreadsheet bersangkutan secara otomatis!
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1.5">
                <h4 className="font-extrabold text-emerald-800 text-xs flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sistem Proteksi Anti-Overwrite Aktif</span>
                </h4>
                <p className="text-[#3d4947]/90 text-[11px] leading-relaxed">
                  Sistem keamanan pintar kami mendeteksi pergantian perangkat secara otomatis. Jika Anda masuk dengan perangkat baru yang datanya kosong, sistem akan memblokir ekspor otomatis agar data lama Anda di Google Sheets tidak terhapus secara tidak sengaja.
                </p>
                <p className="text-[#3d4947]/90 text-[11px] font-bold">
                  Silakan lakukan <strong>"Tarik Data" (Impor)</strong> satu kali pada perangkat baru untuk mengaktifkan kembali fungsi ekspor secara aman!
                </p>
              </div>
            </div>
          </div>

          {/* Download HTML Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#00685f]/20 shadow-md space-y-4">
            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <Download className="w-5 h-5 text-[#00685f]" />
              <span>File Aplikasi (Index.html)</span>
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Unduh versi file tunggal dari aplikasi ini untuk dimasukkan langsung ke file <strong className="text-gray-700">Index.html</strong> di Google Apps Script Anda.
            </p>
            <button
              onClick={handleDownloadAppHtml}
              disabled={downloadingHtml}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
            >
              {downloadingHtml ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Unduh File Aplikasi</span>
            </button>
          </div>

          {/* Script Display Code Container Column */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden text-slate-100 flex flex-col justify-between">
            <div>
              <div className="px-5 py-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-xs font-bold font-mono text-slate-400 ml-2">DatabaseScript.js</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-extrabold cursor-pointer"
                  title="Salin Kode Sumber"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-50" />
                      <span className="text-emerald-400">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className="p-4 font-mono text-[9px] leading-relaxed overflow-y-auto max-h-[250px] text-slate-300">
                <p className="text-slate-500 font-semibold mb-2">
                  {"// Kode Apps Script opsional\n// untuk metode Web App Lanjutan"}
                </p>
                <pre className="whitespace-pre overflow-x-auto select-all">
                  {googleAppsScriptCode}
                </pre>
              </div>
            </div>

            <div className="p-3 bg-slate-800 border-t border-slate-700 text-[10px] font-semibold text-slate-400 leading-normal">
              <p>Apps Script di atas hanya digunakan jika Anda mengaktifkan opsi alternatif Web App.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
