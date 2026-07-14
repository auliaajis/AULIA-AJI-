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
  AlertCircle
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

  // Direct Google API OAuth state
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [directSyncStatus, setDirectSyncStatus] = useState<'idle' | 'connecting' | 'connected' | 'syncing' | 'success' | 'error'>('idle');
  const [directSyncMessage, setDirectSyncMessage] = useState('');
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
    
    const result = await getOrCreateSpreadsheet(token);
    if (result.success && result.spreadsheetId) {
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
      alert(`Gagal Masuk Google: ${error.message || error}`);
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
      setDirectSyncStatus('idle');
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

      const result = await pushDataDirect(token, spreadsheetId, {
        students,
        violations,
        services,
        attendance
      });

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
    const result = await pushDataToGoogle(url);
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
 * Tempelkan kode ini pada Google Apps Script Anda (Ekstensi > Apps Script).
 * Deploy sebagai Aplikasi Web (Web App), setel Akses ke "Siapa saja" (Anyone).
 */

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var output = "";
  
  // Set CORS headers
  if (action === "ping") {
    output = JSON.stringify({ 
      status: "success", 
      message: "Koneksi Google Apps Script Berhasil terhubung ke Spreadsheet: " + sheet.getName() 
    });
  } else if (action === "readAll") {
    output = JSON.stringify(readAllData(sheet));
  } else {
    output = JSON.stringify({ status: "error", message: "Action tidak dikenal" });
  }
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var output = "";
  
  if (data.action === "sync") {
    saveAllData(sheet, data);
    output = JSON.stringify({ 
      status: "success", 
      message: "Data berhasil disimpan ke Google Sheets! " + 
               "Siswa: " + (data.students ? data.students.length : 0) + ", " +
               "Pelanggaran: " + (data.violations ? data.violations.length : 0) + ", " +
               "Layanan: " + (data.services ? data.services.length : 0) + ", " +
               "Absensi: " + (data.attendance ? data.attendance.length : 0)
    });
  } else {
    output = JSON.stringify({ status: "error", message: "Action POST tidak dikenal" });
  }
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function readAllData(spreadsheet) {
  return {
    students: getSheetData(spreadsheet, "Siswa"),
    violations: getSheetData(spreadsheet, "Pelanggaran"),
    services: getSheetData(spreadsheet, "LayananBK"),
    attendance: getSheetData(spreadsheet, "Absensi")
  };
}

function getSheetData(spreadsheet, name) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      // Jika berisi array atau objek yang di-serialize, parse kembali
      if (typeof val === "string" && (val.indexOf("[") === 0 || val.indexOf("{") === 0)) {
        try {
          val = JSON.parse(val);
        } catch(e) {}
      }
      obj[headers[j]] = val;
    }
    result.push(obj);
  }
  return result;
}

function saveAllData(spreadsheet, data) {
  writeSheetData(spreadsheet, "Siswa", data.students, ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount"]);
  writeSheetData(spreadsheet, "Pelanggaran", data.violations, ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"]);
  writeSheetData(spreadsheet, "LayananBK", data.services, ["id", "serviceType", "problem", "description", "date", "startTime", "endTime", "status", "students", "notes"]);
  writeSheetData(spreadsheet, "Absensi", data.attendance, ["id", "date", "class", "studentId", "studentName", "status", "notes", "submittedBy"]);
}

function writeSheetData(spreadsheet, name, data, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (sheet) {
    spreadsheet.deleteSheet(sheet);
  }
  sheet = spreadsheet.insertSheet(name);
  sheet.appendRow(headers);
  if (!data || data.length === 0) return;
  
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      var val = item[headers[j]];
      if (typeof val === "object" && val !== null) {
        val = JSON.stringify(val);
      }
      row.push(val === undefined ? "" : val);
    }
    rows.push(row);
  }
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
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
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveUrl}
                    className="px-4.5 py-3 bg-[#0b1c30] hover:bg-[#142e4d] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Simpan URL
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    className="px-4.5 py-3 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connectionStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Uji Koneksi</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status Display Banner */}
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

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-1.5">
                <h4 className="font-extrabold text-amber-800 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Aturan Keamanan Data</span>
                </h4>
                <p className="text-gray-600 text-[11px]">
                  Proses ekspor dan impor bersifat <strong>menimpa data lama</strong>. Pastikan Anda melakukan ekspor terlebih dahulu sebelum memuat ulang aplikasi atau menyinkronkan data antar-perangkat guna mencegah hilangnya pembinaan kesiswaan Anda.
                </p>
              </div>
            </div>
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
