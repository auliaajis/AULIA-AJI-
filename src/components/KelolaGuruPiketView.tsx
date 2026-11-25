import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  AlertCircle,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { ensureFirebaseAuth } from '../utils/firestoreSync';
import { Counselor } from '../types';
import { getActiveSchoolId, sanitizeSchoolId } from '../utils/schoolConfig';
import { showToast } from '../utils/toast';

interface TeacherItem {
  id: string;
  name: string;
  nip: string;
  subject: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  schoolId?: string;
}

interface ParsedCsvRow {
  rowNumber: number;
  name: string;
  nip: string;
  subject: string;
  phone: string;
  isDuplicate: boolean;
}

interface KelolaGuruPiketViewProps {
  activeCounselor?: Counselor;
  onBack?: () => void;
}

const TEMPLATE_CSV_CONTENT = [
  'nama,nip,mapel,telepon',
  'Aulia Aji Sasongko,198501012010011001,BK,081234567890',
  'Budi Santoso,198602022011022002,Matematika,081234567891',
  'Siti Aminah,198703032012033003,Bahasa Indonesia,081234567892',
].join('\r\n');

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeCsvCell(val: string): string {
  const str = String(val ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function KelolaGuruPiketView({
  activeCounselor,
  onBack,
}: KelolaGuruPiketViewProps) {
  const schoolId = sanitizeSchoolId(activeCounselor?.schoolId || getActiveSchoolId());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // CSV Upload & Preview state
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvParsedRows, setCsvParsedRows] = useState<ParsedCsvRow[] | null>(null);
  const [csvSaving, setCsvSaving] = useState(false);
  const [csvSuccessResult, setCsvSuccessResult] = useState<{
    addedCount: number;
    duplicateCount: number;
  } | null>(null);

  // Manual Add Form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNip, setManualNip] = useState('');
  const [manualSubject, setManualSubject] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // Inline delete confirmations (no window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Realtime subscription to Firestore `teachers` collection
  useEffect(() => {
    setLoading(true);
    const teachersCol = collection(db, 'teachers');
    const unsub = onSnapshot(
      teachersCol,
      (snapshot) => {
        const list: TeacherItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data || data.isDeleted === true) return;
          const docSchool = data.schoolId ? sanitizeSchoolId(data.schoolId) : '';
          if (docSchool && docSchool !== schoolId) return;
          const name = String(
            data.name || data.nama || data.fullName || data.displayName || ''
          ).trim();
          if (!name) return;
          list.push({
            id: docSnap.id,
            name,
            nip: String(data.nip || '').trim(),
            subject: String(data.subject || data.mapel || data.role || '').trim(),
            phone: String(data.phone || data.telepon || '').trim(),
            isActive: data.isActive !== false,
            createdAt: String(data.createdAt || ''),
            schoolId: docSchool || schoolId,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
        setTeachers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[KelolaGuruPiketView] Gagal memuat teachers:', err?.message || err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [schoolId]);

  const existingNameSet = useMemo(
    () => new Set(teachers.map((t) => t.name.trim().toLowerCase())),
    [teachers]
  );

  const filteredTeachers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q)
    );
  }, [teachers, searchTerm]);

  const activeCount = useMemo(
    () => teachers.filter((t) => t.isActive).length,
    [teachers]
  );

  const csvSummary = useMemo(() => {
    if (!csvParsedRows) return { toAdd: 0, duplicates: 0 };
    let toAdd = 0;
    let duplicates = 0;
    csvParsedRows.forEach((r) => {
      if (r.isDuplicate) duplicates++;
      else toAdd++;
    });
    return { toAdd, duplicates };
  }, [csvParsedRows]);

  const handleDownloadTemplate = () => {
    downloadCsvFile('template_guru_piket.csv', TEMPLATE_CSV_CONTENT);
    showToast('Template CSV guru piket berhasil diunduh.', 'success');
  };

  const handleExportCsv = () => {
    if (teachers.length === 0) {
      showToast('Belum ada data guru untuk diekspor.', 'warning');
      return;
    }
    const rows = [
      'nama,nip,mapel,telepon',
      ...teachers.map((t) =>
        [
          escapeCsvCell(t.name),
          escapeCsvCell(t.nip),
          escapeCsvCell(t.subject),
          escapeCsvCell(t.phone),
        ].join(',')
      ),
    ];
    downloadCsvFile('guru_piket_backup.csv', rows.join('\r\n'));
    showToast(`Berhasil mengekspor ${teachers.length} guru piket ke CSV.`, 'success');
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCsvError(null);
    setCsvSuccessResult(null);
    setCsvParsedRows(null);
    setCsvFileName(file.name);

    try {
      const rawText = await file.text();
      const cleanedText = rawText.replace(/^\uFEFF/, '');
      const lines = cleanedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setCsvError('Format CSV salah. Download template dulu.');
        return;
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
      const isValidHeader =
        headers.length === 4 &&
        headers[0] === 'nama' &&
        headers[1] === 'nip' &&
        headers[2] === 'mapel' &&
        headers[3] === 'telepon';

      if (!isValidHeader) {
        setCsvError('Format CSV salah. Download template dulu.');
        return;
      }

      const seenInFile = new Set<string>();
      const parsed: ParsedCsvRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = String(cols[0] || '').trim();
        if (!name) continue; // nama wajib; lewati baris kosong tanpa nama
        const nip = String(cols[1] || '').trim();
        const subject = String(cols[2] || '').trim();
        const phone = String(cols[3] || '').trim();

        const key = name.toLowerCase();
        const isDuplicate = existingNameSet.has(key) || seenInFile.has(key);
        seenInFile.add(key);

        parsed.push({
          rowNumber: i + 1,
          name,
          nip,
          subject,
          phone,
          isDuplicate,
        });
      }

      if (parsed.length === 0) {
        setCsvError('File CSV tidak memiliki baris guru yang valid. Isi minimal 1 nama guru.');
        return;
      }

      setCsvParsedRows(parsed);
    } catch {
      setCsvError('Format CSV salah. Download template dulu.');
    }
  };

  const handleSaveCsvAll = async () => {
    if (!csvParsedRows) return;
    const rowsToInsert = csvParsedRows.filter((r) => !r.isDuplicate);
    const duplicateCount = csvParsedRows.length - rowsToInsert.length;

    if (rowsToInsert.length === 0) {
      showToast(`${duplicateCount} nama duplikat dilewati. Tidak ada data baru.`, 'info');
      setCsvParsedRows(null);
      return;
    }

    setCsvSaving(true);
    try {
      await ensureFirebaseAuth();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const CHUNK_SIZE = 400;

      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((row, idx) => {
          const rand = Math.random().toString(36).slice(2, 7);
          const docId = `tch_${nowMs}_${i + idx}_${rand}`;
          batch.set(doc(db, 'teachers', docId), {
            id: docId,
            name: row.name,
            nip: row.nip,
            subject: row.subject,
            phone: row.phone,
            isActive: true,
            createdAt: nowIso,
            schoolId,
            isDeleted: false,
          });
        });
        await batch.commit();
      }

      setCsvParsedRows(null);
      setCsvSuccessResult({
        addedCount: rowsToInsert.length,
        duplicateCount,
      });
      showToast(
        duplicateCount > 0
          ? `Berhasil! ${rowsToInsert.length} guru ditambahkan. ${duplicateCount} nama duplikat dilewati.`
          : `Berhasil! ${rowsToInsert.length} guru ditambahkan.`,
        'success'
      );
    } catch (err: any) {
      setCsvError(`Gagal menyimpan ke cloud: ${err?.message || err}`);
      showToast('Gagal menyimpan daftar guru ke cloud.', 'error');
    } finally {
      setCsvSaving(false);
    }
  };

  const handleAddManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualName.trim();
    if (!cleanName) {
      showToast('Nama guru wajib diisi.', 'warning');
      return;
    }
    if (existingNameSet.has(cleanName.toLowerCase())) {
      showToast('Nama guru sudah ada di daftar (duplikat dilewati).', 'warning');
      return;
    }

    setManualSaving(true);
    try {
      await ensureFirebaseAuth();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const docId = `tch_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(db, 'teachers', docId), {
        id: docId,
        name: cleanName,
        nip: manualNip.trim(),
        subject: manualSubject.trim(),
        phone: manualPhone.trim(),
        isActive: true,
        createdAt: nowIso,
        schoolId,
        isDeleted: false,
      });
      setManualName('');
      setManualNip('');
      setManualSubject('');
      setManualPhone('');
      setShowManualForm(false);
      showToast(`Guru "${cleanName}" berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(`Gagal menambah guru: ${err?.message || err}`, 'error');
    } finally {
      setManualSaving(false);
    }
  };

  const handleToggleActive = async (teacher: TeacherItem) => {
    try {
      await ensureFirebaseAuth();
      await setDoc(
        doc(db, 'teachers', teacher.id),
        {
          isActive: !teacher.isActive,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      showToast(
        !teacher.isActive
          ? `${teacher.name} diaktifkan kembali untuk dropdown Piket.`
          : `${teacher.name} dinonaktifkan (disembunyikan dari dropdown Piket).`,
        'info'
      );
    } catch (err: any) {
      showToast(`Gagal mengubah status: ${err?.message || err}`, 'error');
    }
  };

  const handleDeleteOne = async (teacher: TeacherItem) => {
    try {
      await ensureFirebaseAuth();
      await deleteDoc(doc(db, 'teachers', teacher.id));
      setConfirmDeleteId(null);
      showToast(`${teacher.name} dihapus dari daftar guru piket.`, 'success');
    } catch (err: any) {
      showToast(`Gagal menghapus guru: ${err?.message || err}`, 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (teachers.length === 0) return;
    setBulkDeleting(true);
    try {
      await ensureFirebaseAuth();
      const CHUNK_SIZE = 400;
      for (let i = 0; i < teachers.length; i += CHUNK_SIZE) {
        const chunk = teachers.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((t) => {
          batch.delete(doc(db, 'teachers', t.id));
        });
        await batch.commit();
      }
      setConfirmDeleteAll(false);
      showToast('Semua data guru piket berhasil dihapus.', 'success');
    } catch (err: any) {
      showToast(`Gagal menghapus semua data guru: ${err?.message || err}`, 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Input file tersembunyi untuk Upload CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Tombol Kembali */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-xs sm:text-sm font-extrabold shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>
      )}

      {/* Header + 3 Tombol Utama */}
      <section className="bg-white rounded-2xl border border-[#bcc9c6]/45 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-lg border border-[#00685f]/20">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Direktori Guru Piket</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-1 tracking-tight">
              Kelola Guru Piket
            </h1>
            <p className="text-xs sm:text-sm text-[#3d4947] mt-0.5">
              Unggah daftar guru sekaligus via CSV agar dropdown di halaman <span className="font-bold text-[#00685f]">/piket</span> otomatis terisi dan bebas salah ketik.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 text-xs font-extrabold text-[#0b1c30] tabular-nums">
              {activeCount} Aktif / {teachers.length} Total
            </span>
          </div>
        </div>

        {/* 3 Tombol Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#f8faf9] hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 text-xs sm:text-sm font-extrabold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download Template CSV</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-extrabold shadow-2xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowManualForm((prev) => !prev);
              setCsvError(null);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-[#0b1c30] border border-[#bcc9c6]/70 text-xs sm:text-sm font-extrabold transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0 text-[#00685f]" />
            <span>+ Tambah Guru Manual</span>
          </button>
        </div>

        {/* Info Format Header CSV */}
        <div className="rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/40 px-3.5 py-2.5 text-[11px] sm:text-xs text-[#3d4947]">
          <span className="font-extrabold text-[#0b1c30]">Format Header CSV Wajib:</span>{' '}
          <code className="font-mono font-bold text-[#00685f] bg-[#e6f4f1] px-1.5 py-0.5 rounded">
            nama,nip,mapel,telepon
          </code>{' '}
          <span className="text-[#3d4947]">(nama wajib; nip, mapel, telepon boleh kosong).</span>
        </div>
      </section>

      {/* Pesan Error Format CSV Salah */}
      {csvError && (
        <div className="rounded-2xl bg-red-50 border border-red-300 px-4 py-3.5 flex items-start justify-between gap-3 text-red-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold">{csvError}</p>
              <p className="text-xs text-red-700 mt-0.5">
                Pastikan baris pertama file CSV persis: <code>nama,nip,mapel,telepon</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCsvError(null)}
            className="p-1 rounded-lg hover:bg-red-100 text-red-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pesan Sukses Setelah Simpan CSV */}
      {csvSuccessResult && (
        <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-black text-emerald-950">
                Berhasil! {csvSuccessResult.addedCount} guru ditambahkan.
              </h2>
              {csvSuccessResult.duplicateCount > 0 && (
                <p className="text-xs font-bold text-emerald-800 mt-0.5">
                  {csvSuccessResult.duplicateCount} nama duplikat dilewati.
                </p>
              )}
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setCsvSuccessResult(null)}
              className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-extrabold cursor-pointer"
            >
              Kembali ke Daftar Guru
            </button>
          </div>
        </section>
      )}

      {/* Preview Tabel Upload CSV (5 baris pertama + summary + Batal / Simpan Semua) */}
      {csvParsedRows && (
        <section className="bg-white rounded-2xl border-2 border-[#00685f]/40 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2 py-0.5 rounded">
                Pratinjau CSV: {csvFileName}
              </span>
              <h2 className="text-base sm:text-lg font-black text-[#0b1c30] mt-1">
                Akan ditambahkan: {csvSummary.toAdd} guru, Duplikat: {csvSummary.duplicates}
              </h2>
              {csvSummary.duplicates > 0 && (
                <p className="text-xs font-bold text-amber-700 mt-0.5">
                  {csvSummary.duplicates} nama duplikat dilewati otomatis agar tidak dobel.
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-[#bcc9c6]/40 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faf9] border-b border-[#bcc9c6]/40 text-[#3d4947] uppercase text-[10px] font-black">
                <tr>
                  <th className="px-3 py-2.5">Nama</th>
                  <th className="px-3 py-2.5">NIP</th>
                  <th className="px-3 py-2.5">Mapel</th>
                  <th className="px-3 py-2.5">Telepon</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {csvParsedRows.slice(0, 5).map((row) => (
                  <tr key={row.rowNumber} className={row.isDuplicate ? 'bg-amber-50/50' : ''}>
                    <td className="px-3 py-2.5 font-extrabold text-[#0b1c30]">{row.name}</td>
                    <td className="px-3 py-2.5 text-[#3d4947]">{row.nip || '-'}</td>
                    <td className="px-3 py-2.5 text-[#3d4947]">{row.subject || '-'}</td>
                    <td className="px-3 py-2.5 text-[#3d4947]">{row.phone || '-'}</td>
                    <td className="px-3 py-2.5">
                      {row.isDuplicate ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                          Duplikat dilewati
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          Siap simpan
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvParsedRows.length > 5 && (
            <p className="text-[11px] font-semibold text-[#3d4947]">
              Menampilkan 5 baris pertama dari total {csvParsedRows.length} baris dalam file CSV.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={csvSaving}
              onClick={() => {
                setCsvParsedRows(null);
                setCsvFileName('');
              }}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#3d4947] border border-gray-300 text-xs font-extrabold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={csvSaving || csvSummary.toAdd === 0}
              onClick={handleSaveCsvAll}
              className="px-5 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer shadow-2xs"
            >
              {csvSaving ? 'Menyimpan...' : `Simpan Semua (${csvSummary.toAdd})`}
            </button>
          </div>
        </section>
      )}

      {/* Form Tambah Guru Manual */}
      {showManualForm && (
        <form
          onSubmit={handleAddManualSubmit}
          className="bg-white rounded-2xl border border-[#bcc9c6]/50 p-5 shadow-2xs space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#0b1c30]">Tambah Guru Piket Manual</h2>
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold text-[#3d4947] mb-1">
                Nama Guru <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-[#3d4947] mb-1">
                NIP (Opsional)
              </label>
              <input
                type="text"
                value={manualNip}
                onChange={(e) => setManualNip(e.target.value)}
                placeholder="198602022011022002"
                className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-[#3d4947] mb-1">
                Mapel / Tugas (Opsional)
              </label>
              <input
                type="text"
                value={manualSubject}
                onChange={(e) => setManualSubject(e.target.value)}
                placeholder="Contoh: Matematika"
                className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-[#3d4947] mb-1">
                No. Telepon / WA (Opsional)
              </label>
              <input
                type="text"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="081234567891"
                className="w-full bg-[#f8faf9] border border-[#bcc9c6]/70 focus:border-[#00685f] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#3d4947] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={manualSaving}
              className="px-4 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
            >
              {manualSaving ? 'Menyimpan...' : 'Simpan Guru'}
            </button>
          </div>
        </form>
      )}

      {/* Daftar Guru dalam Tabel Ringkas: [Nama] [Mapel] [Aktif / Nonaktif] [Hapus] */}
      <section className="bg-white rounded-2xl border border-[#bcc9c6]/45 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#00685f] absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama guru atau mapel..."
              className="w-full bg-[#f8faf9] border border-[#bcc9c6]/60 focus:border-[#00685f] focus:bg-white rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={teachers.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/30 text-xs font-extrabold disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {teachers.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        {/* Konfirmasi Hapus Semua */}
        {confirmDeleteAll && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <p className="text-xs font-bold text-rose-900">
              Yakin hapus seluruh {teachers.length} guru dari daftar? Pastikan sudah Export CSV untuk cadangan jika perlu.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setConfirmDeleteAll(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-bold text-[#3d4947] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleDeleteAll}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
              >
                {bulkDeleting ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-[#3d4947]">
            Memuat daftar guru piket...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-extrabold text-[#0b1c30]">
              {searchTerm ? 'Guru tidak ditemukan' : 'Belum ada data guru piket'}
            </p>
            <p className="text-xs text-[#3d4947]">
              {searchTerm
                ? `Tidak ada nama yang cocok dengan "${searchTerm}".`
                : 'Klik Download Template CSV atau Upload CSV untuk mengisi daftar guru sekaligus.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#f8faf9] border-b border-slate-100 text-[10px] sm:text-[11px] font-black uppercase text-[#3d4947]">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Mapel</th>
                  <th className="px-4 py-3">Aktif / Nonaktif</th>
                  <th className="px-4 py-3 text-right">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((t) => (
                  <tr key={t.id} className={!t.isActive ? 'bg-gray-50/70 opacity-75' : 'hover:bg-[#f8faf9]/60'}>
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-[#0b1c30]">{t.name}</p>
                      {(t.nip || t.phone) && (
                        <p className="text-[11px] text-[#3d4947]">
                          {[t.nip ? `NIP ${t.nip}` : '', t.phone].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#3d4947]">
                      {t.subject || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-colors cursor-pointer ${
                          t.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                        }`}
                        title={t.isActive ? 'Klik untuk nonaktifkan dari dropdown Piket' : 'Klik untuk aktifkan kembali'}
                      >
                        {t.isActive ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Aktif • Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Nonaktif • Aktifkan</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeleteId === t.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-gray-100 text-[11px] font-bold text-[#3d4947] cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(t)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-extrabold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
