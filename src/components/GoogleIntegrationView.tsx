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
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import { 
  getSavedScriptUrl, 
  saveScriptUrl, 
  testConnection, 
  pushDataToGoogle, 
  pullDataFromGoogle,
  getLocalDatabaseData
} from '../utils/googleSync';
import {
  initAuth,
  googleSignIn,
  googleSignInRedirect,
  logout,
  getAccessToken
} from '../utils/firebaseAuth';
import {
  getOrCreateSpreadsheet,
  pushDataDirect,
  pullDataDirect
} from '../utils/googleSheetsDirect';
import { mergeFullDatabase } from '../utils/dataMerger';

interface GoogleIntegrationViewProps {
  onDataImported: (data: {
    students?: any[];
    violations?: any[];
    services?: any[];
    attendance?: any[];
    journals?: any[];
    homeVisits?: any[];
    achievements?: any[];
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
  const [showAccessBlockedModal, setShowAccessBlockedModal] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [directSyncStatus, setDirectSyncStatus] = useState<'idle' | 'connecting' | 'connected' | 'syncing' | 'success' | 'error'>('idle');
  const [directSyncMessage, setDirectSyncMessage] = useState('');
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [activeTab, setActiveTab] = useState<'webapp' | 'oauth' | 'custom_id'>('webapp');
  const [syncHistory, setSyncHistory] = useState<{ type: 'push' | 'pull'; time: string; status: 'success' | 'failed' }[]>(() => {
    const saved = localStorage.getItem('bk_google_direct_history');
    return saved ? JSON.parse(saved) : [];
  });

  const handleShareDatabaseLink = () => {
    const url = scriptUrl || spreadsheetUrl || '';
    const id = spreadsheetId || '';
    const text = `📌 LINK SINKRONISASI DATABASE BK SMPN 2 SUSUKAN\n\nHalo Bapak/Ibu Guru BK & Staf,\n\nBerikut link basis data Google Apps Script yang dapat Anda gunakan bersama untuk sinkronisasi data siswa, rekam pelanggaran, layanan BK, dan absensi di HP/Laptop masing-masing:\n\n🔗 Web App URL Database:\n${url || '(Belum diset - silakan buka menu Integrasi Google)'}\n\n📄 ID Spreadsheet (Opsional):\n${id || '-'}\n\nCARA PENGGUNAAN PADA HP / LAPTOP ANDA:\n1. Buka Portal BK SMPN 2 Susukan.\n2. Buka menu "Integrasi Google".\n3. Pilih "Mode 1: Apps Script (Multi-Guru / Beda Email)".\n4. Tempelkan Web App URL di atas, lalu klik "Simpan URL" & "Tarik via Apps Script".\n\nSeluruh data akan tersambung dan tersinkronisasi secara otomatis tanpa kendala otorisasi email!`;

    navigator.clipboard.writeText(text);
    alert('Pesan informasi Database berhasil disalin!\n\nSilakan tempel (paste) dan kirim pesan ini melalui WhatsApp ke rekan guru lain.');
  };

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

      // AUTO-PULL FOR MULTI-DEVICE PROTECTION:
      // If this device hasn't been verified/synced yet, try to pull the data from Google Sheets automatically.
      // This protects the user from overwriting their cloud data with local empty/mock data when logging in from a different device.
      if (localStorage.getItem('bk_google_sync_verified') !== 'true') {
        setDirectSyncStatus('syncing');
        setDirectSyncMessage('Mendeteksi data di Google Sheets Anda. Sedang sinkronisasi data riwayat...');
        try {
          const pullResult = await pullDataDirect(token, result.spreadsheetId);
          if (pullResult.success && pullResult.data) {
            const d = pullResult.data;
            const remoteStudentCount = d.students?.length || 0;
            const remoteViolationCount = d.violations?.length || 0;
            const remoteServiceCount = d.services?.length || 0;
            const hasRemoteData = remoteStudentCount > 0 || remoteViolationCount > 0 || remoteServiceCount > 0;

            if (hasRemoteData) {
              onDataImported(d);
              localStorage.setItem('bk_google_sync_verified', 'true');
              window.dispatchEvent(new Event('storage'));
              setDirectSyncStatus('success');
              setDirectSyncMessage('Berhasil menyinkronkan data riwayat dari Google Sheets secara otomatis!');
              alert('Koneksi Berhasil!\n\nKami mendeteksi adanya data riwayat Anda di Google Sheets. Data tersebut telah berhasil diunduh secara otomatis ke perangkat ini agar aman dan tidak tertimpa.');
              return;
            } else {
              localStorage.setItem('bk_google_sync_verified', 'true');
              window.dispatchEvent(new Event('storage'));
              
              const localData = getLocalDatabaseData();
              await pushDataDirect(token, result.spreadsheetId, {
                students: localData.students,
                violations: localData.violations,
                services: localData.services,
                attendance: localData.attendance,
                journals: localData.journals,
                homeVisits: localData.homeVisits
              }, true);
            }
          }
        } catch (pullErr) {
          console.error('Auto-pull error during setup:', pullErr);
        }
      }

      setDirectSyncStatus('connected');
      setDirectSyncMessage('Basis Data Terhubung langsung dengan Google Sheets!');
    } else {
      setDirectSyncStatus('error');
      setDirectSyncMessage(result.message || 'Gagal menyambungkan basis data Google Sheets.');
    }
  };

  const handleSaveSpreadsheetCustomId = () => {
    const input = prompt('Masukkan ID Spreadsheet Google Drive Anda (contoh: 1a2b3c4d5e...):\n\nAnda dapat menemukan ID ini di URL Google Spreadsheet di antara /d/ dan /edit.', spreadsheetId || '');
    if (input && input.trim()) {
      const cleanId = input.trim();
      setSpreadsheetId(cleanId);
      localStorage.setItem('bk_google_spreadsheet_id', cleanId);
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
      setSpreadsheetUrl(url);
      localStorage.setItem('bk_google_spreadsheet_url', url);
      alert('ID Spreadsheet Custom berhasil disimpan!');
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
      const errMsg = error?.message || String(error);
      if (
        errMsg.includes('403') || 
        errMsg.includes('access_denied') || 
        errMsg.includes('verification process') || 
        errMsg.includes('developer-approved')
      ) {
        setShowAccessBlockedModal(true);
      } else if (
        errMsg.includes('popup-closed-by-user') || 
        errMsg.includes('auth/popup-closed-by-user') || 
        errMsg.includes('popup-blocked') || 
        errMsg.includes('auth/popup-blocked') ||
        errMsg.includes('cancelled-popup-request')
      ) {
        if (confirm('Jendela Pop-up ditutup atau diblokir oleh browser / HP Anda.\n\nIngin beralih ke mode "Login Redirect (Halaman Penuh)" yang pasti berhasil di semua perangkat?')) {
          await handleGoogleRedirectLogin();
          return;
        }
      } else {
        alert(`Gagal Masuk Google: ${errMsg}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setIsLoggingIn(true);
    try {
      await googleSignInRedirect();
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      if (
        errMsg.includes('403') || 
        errMsg.includes('access_denied') || 
        errMsg.includes('verification process') || 
        errMsg.includes('developer-approved')
      ) {
        setShowAccessBlockedModal(true);
      } else {
        alert(`Gagal Masuk via Redirect: ${errMsg}`);
      }
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

    if (!confirm('Apakah Anda yakin ingin mengekspor data aplikasi ini? Sistem akan menyinkronkan data awan saat ini dengan data lokal Anda terlebih dahulu, lalu mengunggah hasil penggabungan yang aman (tanpa menghapus catatan dari perangkat lain).')) {
      return;
    }

    setDirectSyncStatus('syncing');
    setDirectSyncMessage('Sedang mengunduh data awan untuk digabungkan secara aman...');

    const localData = getLocalDatabaseData();
    let finalStudents = localData.students;
    let finalViolations = localData.violations;
    let finalServices = localData.services;
    let finalAttendance = localData.attendance;
    let finalJournals = localData.journals;
    let finalHomeVisits = localData.homeVisits;
    let finalAchievements = localData.achievements;

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

        // Save merged data locally
        localStorage.setItem('bk_students', JSON.stringify(finalStudents));
        localStorage.setItem('bk_violations', JSON.stringify(finalViolations));
        localStorage.setItem('bk_services', JSON.stringify(finalServices));
        localStorage.setItem('bk_attendance_history', JSON.stringify(finalAttendance));
        localStorage.setItem('bk_daily_journals', JSON.stringify(finalJournals));
        localStorage.setItem('bk_home_visits', JSON.stringify(finalHomeVisits));
        localStorage.setItem('bk_achievements', JSON.stringify(finalAchievements));
        
        // Pass merged data to App state
        onDataImported({
          students: finalStudents,
          violations: finalViolations,
          services: finalServices,
          attendance: finalAttendance,
          journals: finalJournals,
          homeVisits: finalHomeVisits,
          achievements: finalAchievements
        });
      }
    } catch (err) {
      console.warn('Ekspor: Gagal menarik data untuk penggabungan langsung:', err);
    }

    setDirectSyncMessage('Sedang menyinkronkan dan mengekspor data tergabung ke Google Sheets...');

    try {
      let result = await pushDataDirect(token, spreadsheetId, {
        students: finalStudents,
        violations: finalViolations,
        services: finalServices,
        attendance: finalAttendance,
        journals: finalJournals,
        homeVisits: finalHomeVisits,
        achievements: finalAchievements
      });

      if (!result.success && result.message.includes('OVERWRITE_PREVENTION')) {
        const confirmationWord = prompt(
          "⚠️ PERINGATAN KERAS: OVERWRITE DATABASE!\n\n" +
          "Sistem mendeteksi ada data riwayat tersimpan di Google Sheets Anda, sementara perangkat ini belum disinkronisasi (belum mengimpor data).\n\n" +
          "Jika Anda melanjutkan, SEMUA DATA LAMA DI GOOGLE SHEETS AKAN TERHAPUS DAN DIGANTI data di perangkat ini.\n\n" +
          "Kami SANGAT MENYARANKAN untuk membatalkan dan melakukan 'Tarik Data dari Google Sheets' terlebih dahulu.\n\n" +
          "Jika Anda tetap ingin memaksa menimpa data awan, ketik kata 'TIMPA' di bawah ini untuk mengonfirmasi:"
        );
        if (confirmationWord === 'TIMPA') {
          setDirectSyncStatus('syncing');
          setDirectSyncMessage('Memaksa menulis data ke Google Sheets...');
          result = await pushDataDirect(token, spreadsheetId, {
            students: finalStudents,
            violations: finalViolations,
            services: finalServices,
            attendance: finalAttendance,
            journals: finalJournals,
            homeVisits: finalHomeVisits,
            achievements: finalAchievements
          }, true);
        } else {
          setDirectSyncStatus('idle');
          setDirectSyncMessage('Sinkronisasi dibatalkan demi perlindungan basis data.');
          alert('Proses dibatalkan. Data awan Anda aman.');
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
      if (err.message === 'UNAUTHENTICATED_SESSION') {
        alert('Sesi Google Anda telah berakhir demi keamanan (kedaluwarsa otomatis setiap 1 jam). Silakan klik tombol "Hubungkan Kembali & Segarkan Sesi" yang muncul di layar untuk memperbarui koneksi.');
      } else {
        alert(`Ekspor Gagal: ${err.message}`);
      }
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

    if (!confirm('Peringatan Keras: Ini akan menimpa seluruh data lokal Siswa, Pelanggaran, Jurnal Layanan BK, Absensi, Jurnal Harian, dan Dokumentasi Home Visit di browser Anda dengan data yang ada di Google Spreadsheet. Lanjutkan?')) {
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
      if (err.message === 'UNAUTHENTICATED_SESSION') {
        alert('Sesi Google Anda telah berakhir demi keamanan (kedaluwarsa otomatis setiap 1 jam). Silakan klik tombol "Hubungkan Kembali & Segarkan Sesi" yang muncul di layar untuk memperbarui koneksi.');
      } else {
        alert(`Impor Gagal: ${err.message}`);
      }
    }
  };

  // Traditional Apps Script Handlers (Fallback)
  const handleSaveUrl = async () => {
    const url = scriptUrl.trim();
    if (!url) {
      alert('Silakan masukkan URL Apps Script terlebih dahulu.');
      return;
    }
    saveScriptUrl(url);
    
    // Auto-pull check for Apps Script URL
    if (localStorage.getItem('bk_google_sync_verified') !== 'true') {
      setConnectionStatus('testing');
      setStatusMessage('Menguji koneksi dan mendeteksi data lama di Google Sheets Anda...');
      const result = await testConnection(url);
      if (result.success) {
        const pullResult = await pullDataFromGoogle(url);
        if (pullResult.success && pullResult.data) {
          const d = pullResult.data;
          const remoteStudentCount = d.students?.length || 0;
          const remoteViolationCount = d.violations?.length || 0;
          const remoteServiceCount = d.services?.length || 0;
          const hasRemoteData = remoteStudentCount > 0 || remoteViolationCount > 0 || remoteServiceCount > 0;
          
          if (hasRemoteData) {
            onDataImported(d);
            localStorage.setItem('bk_google_sync_verified', 'true');
            window.dispatchEvent(new Event('storage'));
            setConnectionStatus('success');
            setStatusMessage('Data berhasil disinkronkan secara otomatis!');
            alert('Koneksi & Sinkronisasi Berhasil!\n\nKami mendeteksi adanya data riwayat Anda di Google Sheets. Data tersebut telah berhasil diunduh secara otomatis ke perangkat ini agar aman dan tidak tertimpa.');
            return;
          }
        }
      }
    }
    
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
      const confirmationWord = prompt(
        "⚠️ PERINGATAN KERAS: OVERWRITE DATABASE!\n\n" +
        "Sistem mendeteksi ada data riwayat tersimpan di Google Sheets Anda, sementara perangkat ini belum disinkronisasi (belum mengimpor data).\n\n" +
        "Jika Anda melanjutkan, SEMUA DATA LAMA DI GOOGLE SHEETS AKAN TERHAPUS DAN DIGANTI data di perangkat ini.\n\n" +
        "Kami SANGAT MENYARANKAN untuk membatalkan dan melakukan 'Tarik via Apps Script' terlebih dahulu.\n\n" +
        "Jika Anda tetap ingin memaksa menimpa data awan, ketik kata 'TIMPA' di bawah ini untuk mengonfirmasi:"
      );
      if (confirmationWord === 'TIMPA') {
        setIsSyncing(true);
        result = await pushDataToGoogle(url, true);
      } else {
        alert('Ekspor dibatalkan. Data awan Anda aman.');
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
        attendance: readTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"]),
        journals: readTab(ss, "JurnalHarian", ["id", "date", "startTime", "endTime", "activityType", "title", "description", "target", "status", "counselorId", "createdAt", "proofPhotoUrl", "proofPhotoName", "absentStudents"]),
        homeVisits: readTab(ss, "HomeVisit", ["id", "reportNumber", "date", "studentId", "studentName", "studentClass", "studentNis", "parentNameMet", "address", "purpose", "result", "agreement", "photoUrl", "photoName", "parentSignature", "counselorSignature", "counselorName", "counselorId", "createdAt"]),
        achievements: readTab(ss, "Apresiasi_Prestasi", ["id", "studentId", "studentName", "studentClass", "nis", "category", "achievementName", "pointsReward", "date", "time", "location", "recordedBy", "notes"])
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
      var pembinaanList = (payload.violations || []).filter(function(v) { return !v.handledBy || v.handledBy === "Belum Ditangani"; });
      var restitusiList = (payload.violations || []).filter(function(v) { return (v.handledBy && v.handledBy !== "Belum Ditangani") || (v.handlingProgress && String(v.handlingProgress).trim() !== ""); });

      syncTab(ss, "Siswa", ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount", "initials"], payload.students || []);
      syncTab(ss, "Pelanggaran", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"], pembinaanList);
      syncTab(ss, "Restitusi", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"], restitusiList);
      syncTab(ss, "LayananBK", ["id", "serviceType", "problem", "description", "output", "followUp", "status", "date", "startTime", "endTime", "students", "attachments", "notes"], payload.services || []);
      syncTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"], payload.attendance || []);
      syncTab(ss, "JurnalHarian", ["id", "date", "startTime", "endTime", "activityType", "title", "description", "target", "status", "counselorId", "createdAt", "proofPhotoUrl", "proofPhotoName", "absentStudents"], payload.journals || []);
      syncTab(ss, "HomeVisit", ["id", "reportNumber", "date", "studentId", "studentName", "studentClass", "studentNis", "parentNameMet", "address", "purpose", "result", "agreement", "photoUrl", "photoName", "parentSignature", "counselorSignature", "counselorName", "counselorId", "createdAt"], payload.homeVisits || []);
      syncTab(ss, "Apresiasi_Prestasi", ["id", "studentId", "studentName", "studentClass", "nis", "category", "achievementName", "pointsReward", "date", "time", "location", "recordedBy", "notes"], payload.achievements || []);
      
      output = JSON.stringify({ 
        status: "success", 
        message: "Sinkronisasi berhasil! Spreadsheet telah diperbarui." 
      });
    } else if (payload.action === "sendEmail") {
      MailApp.sendEmail({
        to: payload.to,
        subject: payload.subject,
        body: payload.body
      });
      output = JSON.stringify({ 
        status: "success", 
        message: "Email berhasil dikirim ke " + payload.to 
      });
    } else if (payload.action === "createDraft") {
      GmailApp.createDraft(payload.to, payload.subject, payload.body);
      output = JSON.stringify({ 
        status: "success", 
        message: "Draf email berhasil dibuat di folder Draf Gmail Anda!" 
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

      {/* Multi-Guru & Beda Email Mode Switcher Tabs */}
      <div className="bg-[#f0f4f8] p-1.5 rounded-2xl border border-gray-200 flex flex-col md:flex-row items-stretch gap-2 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('webapp')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'webapp'
              ? 'bg-[#00685f] text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <CloudLightning className="w-4 h-4 text-amber-300" />
          <span>Mode 1: Apps Script (Beda Email / Bebas 403)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('oauth')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'oauth'
              ? 'bg-[#00685f] text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Database className="w-4 h-4 text-teal-300" />
          <span>Mode 2: Login OAuth Google (Drive Per-Akun)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('custom_id')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'custom_id'
              ? 'bg-[#00685f] text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
          <span>Mode 3: ID Spreadsheet Custom</span>
        </button>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN (COLUMN 1 & 2 SPAN) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TAB 1: MODE APPS SCRIPT WEB APP (SOLUSI BEDA EMAIL) */}
          {activeTab === 'webapp' && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#00685f]/30 shadow-md space-y-6 relative overflow-hidden animate-in fade-in duration-200">
              <div className="absolute top-0 right-0 bg-[#00685f] text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span>Disarankan untuk Multi-Guru & Beda Email</span>
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-[#bcc9c6]/20">
                  <CloudLightning className="w-5 h-5 text-amber-500" />
                  <span>Mode 1: Database Shared Apps Script (Multi-Guru / Beda Email)</span>
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed pt-1">
                  Metode ini menggunakan 1 URL Web App Google Apps Script. Cukup dikonfigurasi 1x oleh Admin BK Sekolah, lalu URL-nya dipakai oleh <strong>seluruh guru dengan email berbeda</strong> (guru.smp.belajar.id, gmail, dll.) tanpa dibatasi Otorisasi Google Cloud!
                </p>
              </div>

              {/* URL Input Form */}
              <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <label className="text-xs font-extrabold text-[#0b1c30] block">
                  URL Aplikasi Web Apps Script Database Sekolah:
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="url"
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-white border border-[#bcc9c6]/50 rounded-xl px-4 py-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-1 focus:ring-[#00685f]/50 font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveUrl}
                      className="px-4 py-3 bg-[#0b1c30] hover:bg-[#142e4d] text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      Simpan URL
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckConnection}
                      disabled={checkStatus === 'checking'}
                      className="px-4 py-3 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {checkStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Uji Diagnostik</span>
                    </button>
                  </div>
                </div>

                {/* Quick Share WhatsApp Button */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-200/80">
                  <span className="text-[11px] font-semibold text-gray-500">
                    Ingin mengirimkan koneksi database ini ke HP/Laptop guru lain?
                  </span>
                  <button
                    type="button"
                    onClick={handleShareDatabaseLink}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Bagikan Pesan ke WhatsApp Guru</span>
                  </button>
                </div>
              </div>

              {/* Push & Pull Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-teal-100 bg-teal-50/50 rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold bg-[#00685f] text-white px-2 py-0.5 rounded uppercase tracking-wider">Kirim</span>
                    <h4 className="font-extrabold text-sm text-[#0b1c30] mt-1">Kirim Data ke Apps Script</h4>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      Unggah seluruh data lokal dari browser ini ke Google Spreadsheet sekolah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    <span>Kirim Data Ke Spreadsheet</span>
                  </button>
                </div>

                <div className="p-4 border border-purple-100 bg-purple-50/50 rounded-2xl flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold bg-purple-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Tarik</span>
                    <h4 className="font-extrabold text-sm text-[#0b1c30] mt-1">Tarik Data dari Apps Script</h4>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      Unduh dan sinkronkan data terbaru dari Google Spreadsheet sekolah ke browser ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Tarik Data Dari Spreadsheet</span>
                  </button>
                </div>
              </div>

              {/* Diagnostics Results */}
              {checkStatus !== 'idle' && (
                <div className="p-5 rounded-2xl border bg-[#fbfdff] border-[#bcc9c6]/30 space-y-4 animate-in slide-in-from-top-3">
                  <div className="flex items-center justify-between border-b border-[#bcc9c6]/20 pb-3">
                    <h4 className="font-extrabold text-sm text-[#0b1c30] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00685f]" />
                      <span>Hasil Diagnostik Koneksi Apps Script</span>
                    </h4>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      diagnostics?.codeMatched ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {diagnostics?.codeMatched ? 'TERHUBUNG DENGAN BAIK' : 'PERLU PERBAIKAN'}
                    </span>
                  </div>

                  {diagnostics && (
                    <div className="space-y-3 text-xs">
                      <p className="text-gray-700 font-semibold leading-relaxed">{diagnostics.details}</p>
                      
                      {diagnostics.actionItems.length > 0 && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                          <p className="font-extrabold text-amber-900 text-[11px] uppercase tracking-wider">Rekomendasi Langkah:</p>
                          <ul className="list-disc list-inside space-y-1 text-amber-900/90 font-medium text-[11px] leading-relaxed">
                            {diagnostics.actionItems.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODE OAUTH DIRECT DRIVE */}
          {activeTab === 'oauth' && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#00685f]/30 shadow-md space-y-6 relative overflow-hidden animate-in fade-in duration-200">
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
                <Database className="w-5 h-5 text-[#00685f]" />
                <span>Mode 2: Sinkronisasi Google Drive Per-Akun (OAuth 2.0)</span>
              </h3>

              {!user ? (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-5">
                  <div className="p-4 bg-teal-50 rounded-full border border-teal-100">
                    <FileSpreadsheet className="w-12 h-12 text-[#00685f]" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h4 className="font-extrabold text-sm text-[#0b1c30]">Sambungkan Akun Google Anda</h4>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Hubungkan portal BK ini secara langsung dengan Google Drive pribadi Anda. Kami akan secara otomatis mengelola file <strong className="text-gray-700">"Database BK Sekolah"</strong> di Drive Anda.
                    </p>
                  </div>

                  {/* Dual Google Sign In Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-2">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 shadow-xs transition-all duration-150 cursor-pointer text-[#3c4043] font-extrabold text-xs select-none disabled:opacity-50 active:scale-98"
                    >
                      {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin text-gray-400" /> : <LogIn className="w-4 h-4 text-emerald-600" />}
                      <span>Masuk (Mode Pop-up)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGoogleRedirectLogin}
                      disabled={isLoggingIn}
                      className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl px-4 py-3 shadow-xs transition-all duration-150 cursor-pointer font-extrabold text-xs select-none disabled:opacity-50 active:scale-98"
                    >
                      <LogIn className="w-4 h-4 text-amber-300" />
                      <span>Masuk Redirect (HP / Mobil)</span>
                    </button>
                  </div>

                  {/* Access Blocked Warning Box */}
                  <div className="w-full max-w-xl mt-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-left space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-700 text-[11px]">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Email Teman/Rekan Guru Belum Terdaftar?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAccessBlockedModal(true)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg text-[11px] cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        Solusi "Error 403: access_denied"
                      </button>
                    </div>
                    <p className="text-amber-900/90 font-medium text-[11px] leading-relaxed">
                      Atau gunakan <strong>"Mode 1: Apps Script"</strong> di tab atas yang dapat dipakai oleh semua email guru tanpa memerlukan izin Google Cloud Console!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Connected Profile */}
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
                      type="button"
                      onClick={handleGoogleLogout}
                      className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-100 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>

                  {/* Sync Status Notice */}
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
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#00685f]" />
                      )}
                      <div className="space-y-0.5 flex-1">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider">
                          {directSyncStatus === 'connecting' ? 'Menghubungkan Drive...' :
                           directSyncStatus === 'syncing' ? 'Sedang Sinkronisasi...' :
                           directSyncStatus === 'connected' ? 'Basis Data Terkoneksi' : 'Koneksi Berhasil'}
                        </h4>
                        <p className="text-xs font-semibold leading-relaxed opacity-95">{directSyncMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Active Spreadsheet Details */}
                  {spreadsheetId && (
                    <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <h5 className="font-extrabold text-[#0b1c30] text-xs uppercase tracking-wider">File Spreadsheet Terbuka:</h5>
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

                  {/* Push & Pull Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <button
                      type="button"
                      onClick={handleDirectExport}
                      disabled={directSyncStatus === 'syncing' || !spreadsheetId}
                      className="py-3 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Database className="w-4 h-4" />
                      <span>Ekspor & Cadangkan Data</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectImport}
                      disabled={directSyncStatus === 'syncing' || !spreadsheetId}
                      className="py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Impor & Timpa Data Lokal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM SPREADSHEET ID */}
          {activeTab === 'custom_id' && (
            <div className="bg-white rounded-2xl p-6 border-2 border-[#00685f]/30 shadow-md space-y-6 relative overflow-hidden animate-in fade-in duration-200">
              <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Mode 3: Pengaturan ID Google Spreadsheet Custom</span>
              </h3>

              <div className="space-y-4 text-xs text-gray-700 leading-relaxed font-medium">
                <p>
                  Jika Anda memiliki file Google Spreadsheet lain yang ingin dijadikan acuan basis data khusus, Anda dapat menyimpan ID Spreadsheet-nya di sini.
                </p>

                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950 text-xs">ID Spreadsheet Terpasang Saat Ini:</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">CUSTOM</span>
                  </div>
                  <p className="font-mono bg-white p-2.5 rounded-xl border border-emerald-200 text-gray-800 break-all select-all font-bold">
                    {spreadsheetId || '(Belum ada ID diset)'}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSpreadsheetCustomId}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
                    >
                      Ubah / Masukkan ID Spreadsheet Baru
                    </button>

                    {spreadsheetUrl && (
                      <a
                        href={spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Spreadsheet di Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* INSTRUCTIONS COLUMN (SPAN 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Guide steps */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <HelpCircle className="w-5 h-5 text-[#00685f]" />
              <span>Panduan & Informasi</span>
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
                  Siswa, Pelanggaran, Jurnal Layanan BK, Absensi, Jurnal Harian, dan Home Visit akan langsung diorganisasikan ke dalam tab-tab spreadsheet bersangkutan secara otomatis!
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

      {/* Modal Panduan Solusi Access Blocked / Error 403 */}
      {showAccessBlockedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-100 text-left">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">Solusi "Access blocked: Error 403: access_denied"</h3>
                  <p className="text-xs text-gray-500 font-medium">Panduan Mendaftarkan Email Guru / Staf di Google Cloud Console</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccessBlockedModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-gray-700">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 space-y-1.5 font-medium">
                <p className="font-bold text-sm">Mengapa Pesan Ini Muncul?</p>
                <p>
                  Google memblokir login karena project Google Cloud (<code>gen-lang-client-0064829073</code>) masih berstatus <strong>"Testing" (Pengujian)</strong>. Dalam status ini, Google hanya mengizinkan email yang sudah didaftarkan secara khusus di daftar <strong>Test Users</strong>.
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-1 text-[11px] font-medium">
                <p className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mengapa Tombol "+ Add User" di Identity Platform (Layar Anda) Tidak Bisa Diklik?</span>
                </p>
                <p>
                  Menu <em>Identity Platform / Users</em> di Google Cloud Console digunakan untuk registrasi email/password manual bawaan Firebase. Tombol tersebut mati/disabled untuk Google Sign-In.
                </p>
                <p className="font-bold text-amber-950">
                  Tombol yang benar untuk menambah Test User Google OAuth ada di menu: <strong>APIs & Services &rarr; OAuth consent screen &rarr; Test users &rarr; + ADD USERS</strong>.
                </p>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h4 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider text-[#00685f]">
                  Langkah Tepat Membuka Akses (Step-by-Step):
                </h4>
                
                <ol className="space-y-2.5 list-decimal list-inside font-medium text-gray-800 leading-relaxed">
                  <li className="pl-1">
                    Klik atau buka link berikut: <a href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0064829073" target="_blank" rel="noreferrer" className="text-teal-700 underline font-bold">Google Cloud Console - OAuth Consent Screen</a>.
                  </li>
                  <li className="pl-1">
                    Pastikan nama project di bagian atas layar menunjukkan: <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">Default Gemini Project (gen-lang-client-0064829073)</code>.
                  </li>
                  <li className="pl-1">
                    Scroll ke bawah sampai menemukan bagian berlabel <strong>Test users</strong>.
                  </li>
                  <li className="pl-1">
                    Klik tombol biru <strong className="text-teal-800 bg-teal-100 px-2 py-0.5 rounded">+ ADD USERS</strong> yang aktif di bagian Test users tersebut.
                  </li>
                  <li className="pl-1">
                    Ketikkan alamat email: <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">binasaptarina58@guru.sma.belajar.id</code> lalu klik <strong>SAVE</strong>.
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-2 text-teal-950">
                <div className="flex items-center gap-2 font-extrabold text-teal-900">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Aplikasi Tetap Bisa Digunakan Tanpa Login Google!</span>
                </div>
                <p className="font-medium text-[11px] leading-relaxed">
                  Jika belum sempat menambah email di Google Cloud Console, teman Anda <strong>tetap dapat langsung menggunakan seluruh fitur portal BK SMPN 2 Susukan</strong> (input konseling, catat pelanggaran, survey AKPD, cetak laporan PDF) karena data aplikasi tersimpan otomatis di memori lokal browser.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('webapp');
                  setShowAccessBlockedModal(false);
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
              >
                <CloudLightning className="w-4 h-4" />
                <span>Beralih ke Mode Apps Script (Beda Email)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAccessBlockedModal(false)}
                className="px-5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
