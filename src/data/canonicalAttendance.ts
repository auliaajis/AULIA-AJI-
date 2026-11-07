import { ClassAttendanceRecord, StudentAttendance } from '../types';
import { CANONICAL_AULIA_STUDENTS } from './canonicalStudents';

/**
 * Helper to generate authentic attendance records for SMP Negeri 2 Susukan
 * Under Koordinator BK: Bapak Aulia Aji Sasongko, S.Pd.
 */
function createClassRecord(
  className: string,
  dateStr: string,
  overrides: Record<string, { status: 'H' | 'S' | 'I' | 'A'; notes: string }> = {}
): ClassAttendanceRecord {
  const studentsInClass = CANONICAL_AULIA_STUDENTS.filter(
    (s) => s.class.replace(/kelas\s*/i, '').trim().toUpperCase() === className.replace(/kelas\s*/i, '').trim().toUpperCase()
  );

  const cleanClassId = className.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = `att-${cleanClassId}-${dateStr}`;

  const records: StudentAttendance[] = studentsInClass.map((st) => {
    const override = overrides[st.id];
    if (override) {
      return {
        studentId: st.id,
        studentName: st.name,
        nis: st.nis || '',
        status: override.status,
        notes: override.notes,
      };
    }

    return {
      studentId: st.id,
      studentName: st.name,
      nis: st.nis || '',
      status: 'H',
      notes: '',
    };
  });

  return {
    id,
    class: className.startsWith('Kelas') ? className : `Kelas ${className}`,
    date: dateStr,
    records,
    updatedAt: new Date(`${dateStr}T12:00:00Z`).toISOString(),
    submittedBy: 'Aulia Aji Sasongko, S.Pd.',
    schoolId: 'sch_20320123' as any
  };
}

/**
 * Generates canonical attendance dataset for Kelas 8A s/d 8G
 */
export function buildCanonicalAttendanceHistory(): ClassAttendanceRecord[] {
  const list: ClassAttendanceRecord[] = [];
  const classes = ['Kelas 8A', 'Kelas 8B', 'Kelas 8C', 'Kelas 8D', 'Kelas 8E', 'Kelas 8F', 'Kelas 8G'];

  // Base term dates: October 2024
  const termDates = [
    '2024-10-14',
    '2024-10-15',
    '2024-10-16',
    '2024-10-17',
    '2024-10-18',
    '2024-10-21',
    '2024-10-22',
    '2024-10-23',
    '2024-10-24',
    '2024-10-25'
  ];

  termDates.forEach((dateStr) => {
    classes.forEach((cls) => {
      const overrides: Record<string, { status: 'H' | 'S' | 'I' | 'A'; notes: string }> = {};

      if (cls === 'Kelas 8A') {
        if (dateStr === '2024-10-15') {
          overrides['s4'] = { status: 'S', notes: 'Sakit demam, surat keterangan dokter terlampir' };
        }
        if (dateStr === '2024-10-18') {
          overrides['s8'] = { status: 'A', notes: 'Membolos jam pelajaran ke-3 (dikonseling Guru BK)' };
          overrides['s2'] = { status: 'I', notes: 'Izin urusan keluarga mendesak' };
        }
        if (dateStr === '2024-10-22') {
          overrides['s7'] = { status: 'S', notes: 'Sakit flu & istirahat di UKS' };
        }
      } else if (cls === 'Kelas 8B') {
        if (dateStr === '2024-10-16') {
          overrides['s5'] = { status: 'S', notes: 'Sakit demam' };
        }
        if (dateStr === '2024-10-23') {
          overrides['s11'] = { status: 'I', notes: 'Izin mewakili lomba sekolah' };
        }
      } else if (cls === 'Kelas 8D') {
        if (dateStr === '2024-10-17') {
          overrides['s3'] = { status: 'A', notes: 'Tanpa keterangan saat jam pertama' };
        }
        if (dateStr === '2024-10-24') {
          overrides['s3'] = { status: 'I', notes: 'Izin keperluan keluarga didampingi orang tua' };
        }
      } else if (cls === 'Kelas 8E') {
        if (dateStr === '2024-10-18') {
          overrides['s12'] = { status: 'A', notes: 'Terlambat lebih dari 30 menit (Tanpa Keterangan)' };
        }
      }

      list.push(createClassRecord(cls, dateStr, overrides));
    });
  });

  // Dynamic recent dates for the active/current year-month so Matrix View & Input Form immediately show active records
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // Generate for the last 5 weekdays of the current month
    const recentDates: string[] = [];
    for (let dayOffset = 0; dayOffset <= 12; dayOffset++) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOffset);
      const dayOfWeek = d.getDay();
      // Only Monday - Friday
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && d.getMonth() === currentMonth) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const ds = `${yyyy}-${mm}-${dd}`;
        if (!recentDates.includes(ds)) {
          recentDates.push(ds);
        }
        if (recentDates.length >= 5) break;
      }
    }

    recentDates.forEach((ds) => {
      // Don't duplicate if already in termDates
      if (termDates.includes(ds)) return;

      classes.forEach((cls) => {
        const overrides: Record<string, { status: 'H' | 'S' | 'I' | 'A'; notes: string }> = {};
        if (cls === 'Kelas 8A') {
          overrides['s8'] = { status: 'H', notes: 'Hadir tepat waktu setelah pembinaan bimbingan' };
        }
        list.push(createClassRecord(cls, ds, overrides));
      });
    });
  } catch (e) {
    console.warn('Dynamic date generation notice:', e);
  }

  return list;
}

export const CANONICAL_ATTENDANCE_HISTORY: ClassAttendanceRecord[] = buildCanonicalAttendanceHistory();
