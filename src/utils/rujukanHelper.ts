import { ViolationRecord } from '../types';
import {
  getViolationRestitutionStatus,
  isAttendanceViolation,
  isPiketReferralViolation,
} from '../components/CatatPelanggaranForm';

export const RUJUKAN_CATEGORIES = [
  'Perundungan',
  'Kekerasan Fisik',
  'Kekerasan Seksual',
  'Diskriminasi',
  'Kedisiplinan',
  'Integritas Akademik',
] as const;

export type RujukanStatusTab =
  | 'Semua'
  | 'Baru'
  | 'Sudah Ditindaklanjuti'
  | 'Selesai'
  | 'Data Lama';

export type RujukanItemStatus = 'Baru' | 'Sudah Ditindaklanjuti' | 'Selesai';

export function isAbsensiHarianViolation(v: ViolationRecord | any): boolean {
  if (!v) return false;
  const rep = String(v.reportedBy || '').toLowerCase();
  const via = String(v.reportedVia || '').toLowerCase();
  const src = String(v.source || '').toLowerCase();
  const loc = String(v.location || '').toLowerCase();
  const notes = String(v.notes || '').toLowerCase();
  const prog = String(v.handlingProgress || '').toLowerCase();
  return (
    rep.includes('absensi') ||
    via.includes('absensi') ||
    src.includes('absensi') ||
    loc.includes('absensi') ||
    notes.includes('absensi harian') ||
    prog.includes('absensi harian') ||
    (isAttendanceViolation(v) && !isPiketReferralViolation(v))
  );
}

export function isDataLamaViolation(v: ViolationRecord | any): boolean {
  if (!v) return false;
  if (isAbsensiHarianViolation(v)) return true;
  if (!isPiketReferralViolation(v)) return true;
  if (v.isLegacyUnmigrated === true) return true;
  return false;
}

export function isRujukanBaruPiket(v: ViolationRecord | any): boolean {
  return isPiketReferralViolation(v) && !isDataLamaViolation(v);
}

export function formatCompactRujukanTime(v: ViolationRecord | any): string {
  const rawTime = String(v?.time || '').trim();
  const match = rawTime.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}.${match[2]}`;
  }
  const ca = v?.createdAt;
  if (typeof ca === 'string' && ca.includes('T')) {
    const d = new Date(ca);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return '-';
}

export function formatCompactRujukanDate(dateStr?: string): string {
  const raw = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '-';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()] || ''}`.trim();
}

export function getRujukanItemStatus(v: ViolationRecord): RujukanItemStatus {
  const restStatus = getViolationRestitutionStatus(v);
  if (restStatus === 'Selesai / Dipantau' || v.pembinaanStatus === 'Selesai') {
    return 'Selesai';
  }
  if (
    v.pembinaanStatus === 'Proses' ||
    restStatus === 'Sudah Konseling' ||
    restStatus === 'Proses Restitusi' ||
    (v.handledBy && v.handledBy !== 'Belum Ditangani')
  ) {
    return 'Sudah Ditindaklanjuti';
  }
  return 'Baru';
}

export function getRujukanCategoryLabel(v: ViolationRecord): string {
  const hay = `${v.category || ''} ${v.notes || ''}`.toLowerCase();
  if (/perundung|bully|bullying|ejek|intimid|olok|ancam|malak/.test(hay)) {
    return 'Perundungan';
  }
  if (/fisik|kelahi|berkelahi|pukul|tampar|tendang|tawur|dorong|serang|senjata/.test(hay)) {
    return 'Kekerasan Fisik';
  }
  if (/seksual|asusila|peleceh|cabu|mesum|pornografi/.test(hay)) {
    return 'Kekerasan Seksual';
  }
  if (/diskrimin|sara|rasis|intoleran|kucil|beda-beda/.test(hay)) {
    return 'Diskriminasi';
  }
  if (/akademik|contek|nyontek|mencontek|plagiat|ujian|ulangan|tugas|bohong|jujur|titip absen/.test(hay)) {
    return 'Integritas Akademik';
  }
  return 'Kedisiplinan';
}

export function getRujukanSpecificBehaviors(v: ViolationRecord): string[] {
  const raw =
    v.specificBehaviors ??
    v.perilakuSpesifik ??
    v.behaviorChips ??
    v.selectedBehaviors ??
    v.behaviors;

  const chips: string[] = [];
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      const s = String(item || '').trim();
      if (s && !chips.includes(s)) chips.push(s);
    });
  } else if (typeof raw === 'string' && raw.trim()) {
    raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!chips.includes(s)) chips.push(s);
      });
  }

  if (chips.length > 0) return chips;

  // Fallback: extract detail after colon in category (e.g., "Kedisiplinan & Ketertiban: Terlambat masuk sekolah")
  const cat = String(v.category || '').trim();
  const colonIdx = cat.indexOf(':');
  if (colonIdx !== -1) {
    const afterColon = cat.slice(colonIdx + 1).trim();
    if (afterColon) return [afterColon];
  }

  if (cat) return [cat];
  return ['Perlu Pembinaan'];
}

export function getRujukanReporterName(v: ViolationRecord): string {
  const raw = String(v.reportedBy || '').trim();
  if (!raw) return isPiketReferralViolation(v) ? 'Guru Piket' : 'Guru BK / Wali Kelas';
  return raw;
}

export function getRujukanPiketNotes(v: ViolationRecord): string {
  const n = String(v.piketNotes || v.notes || '').trim();
  return n || '-';
}

export function getViolationSortMs(v: ViolationRecord): number {
  const datePart = String(v.date || '').slice(0, 10);
  const timePart = String(v.time || '00:00').replace('.', ':').slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsed = new Date(`${datePart}T${/^\d{2}:\d{2}$/.test(timePart) ? timePart : '00:00'}:00`).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const ca = v.updatedAt || v.createdAt || (v as any)._updatedAt;
  if (typeof ca === 'number') return ca;
  if (typeof ca === 'string') {
    const t = new Date(ca).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export function sortRujukanList(list: ViolationRecord[]): ViolationRecord[] {
  const statusRank: Record<RujukanItemStatus, number> = {
    Baru: 0,
    SudahDitindaklanjuti: 1,
    Selesai: 2,
  } as any;

  const getRank = (st: RujukanItemStatus) => {
    if (st === 'Baru') return 0;
    if (st === 'Sudah Ditindaklanjuti') return 1;
    return 2;
  };

  return list
    .slice()
    .sort((a, b) => {
      const rankA = getRank(getRujukanItemStatus(a));
      const rankB = getRank(getRujukanItemStatus(b));
      if (rankA !== rankB) return rankA - rankB;

      const piketA = isPiketReferralViolation(a) ? 0 : 1;
      const piketB = isPiketReferralViolation(b) ? 0 : 1;
      if (piketA !== piketB) return piketA - piketB;

      return getViolationSortMs(b) - getViolationSortMs(a);
    });
}

export function getPiketLinkUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/piket`;
  }
  return 'https://bk-gridasus.vercel.app/piket';
}
