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
  Sparkles
} from 'lucide-react';
import { 
  getSavedScriptUrl, 
  saveScriptUrl, 
  testConnection, 
  pushDataToGoogle, 
  pullDataFromGoogle 
} from '../utils/googleSync';

interface GoogleIntegrationViewProps {
  onDataImported: (data: {
    students?: any[];
    violations?: any[];
    services?: any[];
    attendance?: any[];
  }) => void;
}

export default function GoogleIntegrationView({ onDataImported }: GoogleIntegrationViewProps) {
  const [scriptUrl, setScriptUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load URL on mount
  useEffect(() => {
    setScriptUrl(getSavedScriptUrl());
  }, []);

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

    if (!confirm('Apakah Anda yakin ingin mengekspor seluruh data lokal aplikasi ini ke Google Spreadsheet? Data lama di Spreadsheet Anda akan diperbarui.')) {
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

    if (!confirm('Peringatan: Ini akan menimpa data siswa, pelanggaran, rekam layanan, dan absensi di browser Anda dengan data dari Google Spreadsheet. Lanjutkan?')) {
      return;
    }

    setIsSyncing(true);
    const result = await pullDataFromGoogle(url);
    setIsSyncing(false);

    if (result.success && result.data) {
      // Pass data to parent to reload states
      onDataImported(result.data);
      alert('Impor Berhasil! Seluruh database lokal Anda telah diperbarui dari Google Sheets.');
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
            <Database className="w-7 h-7 text-[#00685f]" />
            <span>Integrasi Google Sheets & Apps Script</span>
          </h2>
          <p className="text-sm text-[#3d4947]/70 font-semibold mt-0.5">
            Gunakan Google Sheets Anda sebagai basis data awan untuk menyimpan, memulihkan, dan menyinkronkan seluruh data BK.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Connection Setup Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <CloudLightning className="w-5 h-5 text-[#00685f]" />
              <span>Konfigurasi Endpoint Basis Data</span>
            </h3>

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
              <p className="text-[10px] text-gray-500 font-semibold">
                * URL didapatkan setelah Anda mendeploy skrip Apps Script sebagai Aplikasi Web (Web App).
              </p>
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
                  <div className="p-1 bg-[#00685f]/10 rounded-full">
                    <Check className="w-4 h-4 text-[#00685f]" />
                  </div>
                ) : (
                  <div className="p-1 bg-red-100 rounded-full">
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
            <div className="pt-6 border-t border-[#bcc9c6]/20">
              <h4 className="text-xs font-extrabold text-[#0b1c30] uppercase tracking-wider mb-4">
                Sinkronisasi Basis Data
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Push Box */}
                <div className="p-4 bg-[#f8f9ff] border border-[#bcc9c6]/20 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold bg-[#00685f]/10 text-[#00685f] px-2 py-0.5 rounded-full uppercase">Kirim (Push)</span>
                    <h5 className="font-bold text-[#0b1c30] text-sm mt-1">Ekspor ke Google Sheets</h5>
                    <p className="text-xs text-[#3d4947]/75 font-medium leading-relaxed">
                      Kirim data lokal dari browser ini (siswa, pelanggaran, rekam layanan, absensi) ke spreadsheet awan Anda.
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>Kirim & Cadangkan Data</span>
                  </button>
                </div>

                {/* Pull Box */}
                <div className="p-4 bg-[#f8f9ff] border border-[#bcc9c6]/20 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold bg-[#6b38d4]/10 text-[#6b38d4] px-2 py-0.5 rounded-full uppercase">Tarik (Pull)</span>
                    <h5 className="font-bold text-[#0b1c30] text-sm mt-1">Impor dari Google Sheets</h5>
                    <p className="text-xs text-[#3d4947]/75 font-medium leading-relaxed">
                      Tarik data terbaru dari Google Sheets Anda untuk menggantikan basis data lokal browser ini secara keseluruhan.
                    </p>
                  </div>
                  <button
                    onClick={handleImportData}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#6b38d4] hover:bg-[#6b38d4]/90 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-97 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>Tarik & Sinkronisasi</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Guide steps */}
          <div className="bg-white rounded-2xl p-6 border border-[#bcc9c6]/30 shadow-sm space-y-6">
            <h3 className="font-extrabold text-base text-[#0b1c30] flex items-center gap-2 pb-3 border-b border-[#bcc9c6]/20">
              <HelpCircle className="w-5 h-5 text-[#00685f]" />
              <span>Langkah Panduan Pemasangan</span>
            </h3>

            <div className="relative border-l border-gray-200 ml-3.5 space-y-6 text-sm text-[#3d4947] font-semibold">
              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  1
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Buat Google Spreadsheet</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Buat sebuah spreadsheet kosong baru di Google Drive Anda. Beri nama bebas, misal: <strong className="text-[#0b1c30]">Database BK Sekolah</strong>.
                </p>
              </div>

              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  2
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Buka Google Apps Script</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Di dalam spreadsheet tersebut, klik menu <strong className="text-[#0b1c30]">Ekstensi</strong> pada toolbar atas, lalu pilih <strong className="text-[#0b1c30]">Apps Script</strong>. Halaman editor kode Apps Script akan terbuka.
                </p>
              </div>

              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  3
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Salin dan Tempelkan Kode GAS</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Hapus seluruh kode default bawaan (<code className="font-mono">myFunction</code>), lalu salin seluruh kode dari kotak <strong className="text-[#00685f]">Kode Apps Script</strong> di panel samping kanan ini, dan tempelkan ke dalam editor Apps Script. Jangan lupa klik ikon Simpan (disket).
                </p>
              </div>

              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  4
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Terapkan Sebagai Aplikasi Web (Deploy)</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Klik tombol <strong className="text-[#0b1c30]">Terapkan</strong> (Deploy) &gt; <strong className="text-[#0b1c30]">Terapkan Baru</strong> (New Deployment). Ubah jenis penerapan dengan mengklik roda gigi dan pilih <strong className="text-[#0b1c30]">Aplikasi Web</strong> (Web App).
                </p>
              </div>

              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  5
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Setel Akses Aplikasi Web</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Isi deskripsi penerapan bebas. Ubah pengaturan <strong className="text-[#ba1a1a]">"Siapa yang memiliki akses" (Who has access)</strong> menjadi <strong className="text-[#ba1a1a]">"Siapa saja" (Anyone)</strong>. Ini wajib agar aplikasi web portal BK dapat berkomunikasi secara langsung tanpa kendala otentikasi REST API.
                </p>
              </div>

              <div className="relative pl-6">
                <span className="absolute -left-3.5 top-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#00685f] text-white text-xs font-extrabold">
                  6
                </span>
                <h4 className="font-extrabold text-[#0b1c30] text-sm">Otorisasi & Dapatkan URL</h4>
                <p className="text-xs mt-1 leading-relaxed text-[#3d4947]/80">
                  Klik <strong className="text-[#00685f]">Deploy</strong>. Berikan izin akses (Authorize access) ke akun Google Anda apabila diminta. Setelah proses selesai, salin <strong className="text-[#00685f]">URL Aplikasi Web</strong> yang ditampilkan, tempelkan pada kolom URL di atas halaman ini, lalu klik <strong className="text-[#0b1c30]">Simpan URL</strong>!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Script Display Code Container Column */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden text-slate-100 flex flex-col justify-between h-full">
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
              
              <div className="p-5 font-mono text-[10.5px] leading-relaxed overflow-y-auto max-h-[640px] text-slate-300">
                <p className="text-slate-500 font-semibold mb-3">
                  {"// 1. Salin seluruh kode di bawah ini\n// 2. Tempelkan ke Apps Script Google Spreadsheet Anda"}
                </p>
                <pre className="whitespace-pre overflow-x-auto select-all selection:bg-slate-700">
                  {googleAppsScriptCode}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-800 border-t border-slate-700 text-xs font-semibold text-slate-400 leading-normal space-y-2">
              <div className="flex gap-2 text-indigo-400 items-start">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Apps Script ini otomatis mendeteksi dan membuat tabel <strong>Siswa</strong>, <strong>Pelanggaran</strong>, <strong>LayananBK</strong>, dan <strong>Absensi</strong> secara otomatis.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
