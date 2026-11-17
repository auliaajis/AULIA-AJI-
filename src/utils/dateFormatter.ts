/**
 * Utility pemformatan tanggal dan jam standar Indonesia:
 * Format konsisten di seluruh kartu: DD Mon YYYY • HH:MM WIB
 * Contoh: 24 Agu 2026 • 07:30 WIB
 */

export const SHORT_MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const FULL_MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format tanggal standar Indonesia penuh: "22 Juli 2026".
 * Menerima format YYYY-MM-DD, ISO string (2026-07-22T00:00:00.000Z), DD/MM/YYYY, atau objek Date.
 */
export function formatTanggalIndonesia(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime()) || dateInput.getFullYear() <= 1970) return '-';
    return `${dateInput.getDate()} ${FULL_MONTHS_ID[dateInput.getMonth()]} ${dateInput.getFullYear()}`;
  }

  const clean = String(dateInput).trim();
  if (!clean) return '-';

  const target = clean.includes(' • ') ? clean.split(' • ')[0].trim() : clean;
  if (target.startsWith('1899-12-30')) return '-';

  // Match YYYY-MM-DD or YYYY/MM/DD (including prefix of ISO 2026-07-22T00:00:00.000Z)
  const ymdMatch = target.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1970) {
      return `${day} ${FULL_MONTHS_ID[month - 1]} ${year}`;
    }
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = target.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1970) {
      return `${day} ${FULL_MONTHS_ID[month - 1]} ${year}`;
    }
  }

  try {
    const dObj = new Date(target);
    if (!isNaN(dObj.getTime()) && dObj.getFullYear() > 1970) {
      return `${dObj.getDate()} ${FULL_MONTHS_ID[dObj.getMonth()]} ${dObj.getFullYear()}`;
    }
  } catch {}

  return clean;
}

/**
 * Format tanggal dan jam lengkap Indonesia: "13 November 2026, 20.35 WIB".
 */
export function formatTanggalWaktuIndonesia(dateInput?: Date | string | number | null): string {
  const d =
    dateInput instanceof Date
      ? dateInput
      : dateInput
        ? new Date(dateInput)
        : new Date();
  if (isNaN(d.getTime())) return '-';
  const tgl = `${d.getDate()} ${FULL_MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${tgl}, ${hh}.${mm} WIB`;
}

/**
 * Memformat tanggal menjadi format "DD Mon YYYY" (contoh: 24 Agu 2026).
 * Mengabaikan tanggal epoch default 1899-12-30.
 */
export function formatCardDate(dateInput?: string): string {
  if (!dateInput) return '-';
  const clean = String(dateInput).trim();

  // Jika string gabungan "date • time", ambil bagian tanggal
  const target = clean.includes(' • ') ? clean.split(' • ')[0].trim() : clean;

  // Abaikan tanggal 1899-12-30 (default penyimpanan jam saja di database/spreadsheet)
  if (target.startsWith('1899-12-30')) {
    return '-';
  }

  // Cari pola tahun-bulan-hari YYYY-MM-DD atau YYYY/MM/DD
  const match = target.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    if (m >= 1 && m <= 12) {
      const monthName = SHORT_MONTHS_ID[m - 1];
      const dayStr = String(d).padStart(2, '0');
      return `${dayStr} ${monthName} ${y}`;
    }
  }

  // Fallback parsing objek Date jika format ISO lain
  try {
    const dObj = new Date(target);
    if (!isNaN(dObj.getTime()) && dObj.getFullYear() > 1970) {
      const dayStr = String(dObj.getDate()).padStart(2, '0');
      const monthName = SHORT_MONTHS_ID[dObj.getMonth()];
      return `${dayStr} ${monthName} ${dObj.getFullYear()}`;
    }
  } catch (e) {
    // ignore
  }

  return clean;
}

/**
 * Memformat jam menjadi format "HH:MM WIB" (contoh: 07:30 WIB).
 * Mengabaikan tanggal 1899-12-30, huruf T, dan milidetik .000Z.
 */
export function formatCardTime(timeInput?: string, fallbackTime: string = '08:00'): string {
  if (!timeInput) return `${fallbackTime} WIB`;
  let clean = String(timeInput).trim();

  // Jika string gabungan "date • time", ambil bagian jam
  if (clean.includes(' • ')) {
    clean = clean.split(' • ')[1]?.trim() || '';
  }

  // Hilangkan teks "WIB" jika sudah ada
  clean = clean.replace(/WIB/i, '').trim();

  // Cari pola jam HH:MM dari format ISO (contoh: 1899-12-30T07:30:00.000Z atau 07:30:00)
  const isoTimeMatch = clean.match(/(?:T|\s|^)(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\.\d+)?(?:Z)?/);
  if (isoTimeMatch) {
    const h = isoTimeMatch[1].padStart(2, '0');
    const m = isoTimeMatch[2];
    return `${h}:${m} WIB`;
  }

  // Pola sederhana HH:MM
  const simpleMatch = clean.match(/^(\d{1,2})[:.](\d{2})/);
  if (simpleMatch) {
    const h = simpleMatch[1].padStart(2, '0');
    const m = simpleMatch[2];
    return `${h}:${m} WIB`;
  }

  return `${fallbackTime} WIB`;
}

/**
 * Menghasilkan penulisan tanggal dan jam rapi untuk semua kartu:
 * Format selalu konsisten: "DD Mon YYYY • HH:MM WIB"
 * Contoh: 24 Agu 2026 • 07:30 WIB
 */
export function formatCardDateTime(
  dateInput?: string,
  timeInput?: string,
  fallbackTime: string = '08:00'
): string {
  if (!dateInput && !timeInput) return '-';

  let rawDate = dateInput ? String(dateInput).trim() : '';
  let rawTime = timeInput ? String(timeInput).trim() : '';

  // Tangani jika string sudah berupa gabungan "date • time"
  if (rawDate.includes(' • ')) {
    const parts = rawDate.split(' • ');
    rawDate = parts[0]?.trim() || '';
    if (!rawTime) {
      rawTime = parts[1]?.trim() || '';
    }
  }

  // Jika rawDate mengandung T dan rawTime kosong
  if (!rawTime && rawDate.includes('T')) {
    const parts = rawDate.split('T');
    const timePart = parts[1] || '';
    if (!timePart.startsWith('00:00:00')) {
      rawTime = timePart;
    }
  }

  const dateStr = formatCardDate(rawDate);
  const timeStr = formatCardTime(rawTime, fallbackTime);

  if (dateStr === '-' && timeStr) {
    return timeStr;
  }

  return `${dateStr} • ${timeStr}`;
}
