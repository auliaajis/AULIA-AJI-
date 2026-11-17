import { showToast } from './toast';

/**
 * Menghasilkan ID unik berbasis timestamp + random suffix agar tidak pernah bentrok
 * meskipun beberapa item dibuat dalam milidetik yang sama.
 */
export function generateUniqueId(prefix: string = 'item'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

/**
 * Validasi ID sebelum proses hapus tunggal.
 * Menolak string kosong, spasi saja, null, undefined, atau literal "undefined"/"null".
 */
export function isValidDeleteId(id: unknown): id is string {
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  const clean = String(id).trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan') return false;
  return true;
}

export interface SafeDeleteResult<T> {
  ok: boolean;
  next: T[];
  dropped: number;
  removed?: T;
  reason?: 'invalid_id' | 'mass_delete';
}

/**
 * PENGAMAN ANTI HAPUS SEMUA untuk operasi hapus 1 item berdasarkan `id`.
 * 1. Menolak jika ID kosong / tidak valid.
 * 2. Menolak & membatalkan jika dalam 1 operasi hapus terdeteksi kehilangan > maxAllowedDrop (default 5) item.
 */
export function safeFilterSingleDelete<T extends { id?: unknown }>(
  prevList: T[],
  targetId: unknown,
  maxAllowedDrop: number = 5
): SafeDeleteResult<T> {
  if (!Array.isArray(prevList)) {
    return { ok: true, next: [], dropped: 0 };
  }

  if (!isValidDeleteId(targetId)) {
    showToast('Gagal: ID data tidak valid, hapus dibatalkan', 'error');
    return {
      ok: false,
      next: prevList,
      dropped: 0,
      reason: 'invalid_id',
    };
  }

  const cleanTargetId = String(targetId).trim();
  let removed: T | undefined = undefined;
  const next = prevList.filter((item) => {
    if (!item || !isValidDeleteId(item.id)) return true;
    const isMatch = String(item.id).trim() === cleanTargetId;
    if (isMatch && !removed) removed = item;
    return !isMatch;
  });

  const dropped = prevList.length - next.length;
  if (dropped > maxAllowedDrop) {
    showToast('Gagal: Terdeteksi hapus massal, dibatalkan', 'error');
    return {
      ok: false,
      next: prevList,
      dropped,
      reason: 'mass_delete',
    };
  }

  return {
    ok: true,
    next,
    dropped,
    removed,
  };
}

/**
 * Pengaman umum untuk hapus 1 item berbasis predikat khusus (mis. index atau studentId di AKPD).
 * Membatalkan otomatis jika jumlah data yang terbuang melebihi maxAllowedDrop (default 5).
 */
export function safeGuardMassDrop<T>(
  prevList: T[],
  nextList: T[],
  maxAllowedDrop: number = 5
): SafeDeleteResult<T> {
  if (!Array.isArray(prevList) || !Array.isArray(nextList)) {
    return { ok: false, next: Array.isArray(prevList) ? prevList : [], dropped: 0, reason: 'invalid_id' };
  }
  const dropped = prevList.length - nextList.length;
  if (dropped > maxAllowedDrop) {
    showToast('Gagal: Terdeteksi hapus massal, dibatalkan', 'error');
    return {
      ok: false,
      next: prevList,
      dropped,
      reason: 'mass_delete',
    };
  }
  return {
    ok: true,
    next: nextList,
    dropped,
  };
}
