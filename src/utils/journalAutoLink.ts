import { BKJournalEntry } from '../types';
import { triggerBackgroundAutoSync } from './googleSync';
import { saveToFirestore } from './firestoreSync';
import { safeSetItem } from './storageQuota';
import { loadSchoolData, saveSchoolData } from './schoolConfig';

export interface AutoJournalSettings {
  syncViolations: boolean; // default: false (Catatan Pelanggaran TIDAK masuk jurnal)
  syncServices: boolean; // default: true (Layanan Konseling masuk jurnal)
  syncSummonsAndVisits: boolean; // default: true (Pemanggilan Ortu / Home Visit masuk jurnal)
  syncAchievements: boolean; // default: true (Apresiasi / Prestasi masuk jurnal)
}

export function getAutoJournalSettings(): AutoJournalSettings {
  try {
    const saved = localStorage.getItem('bk_auto_journal_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Error reading bk_auto_journal_settings:', err);
  }
  return {
    syncViolations: false, // Default NONAKTIF agar catatan pelanggaran TIDAK masuk jurnal harian
    syncServices: true, // Default AKTIF untuk Layanan Konseling
    syncSummonsAndVisits: true, // Default AKTIF untuk Pemanggilan Ortu / Home Visit
    syncAchievements: true, // Default AKTIF untuk Apresiasi / Prestasi
  };
}

export function saveAutoJournalSettings(settings: AutoJournalSettings): void {
  try {
    safeSetItem('bk_auto_journal_settings', JSON.stringify(settings));
    saveToFirestore('bk_auto_journal_settings', settings);
  } catch (err) {
    console.error('Error saving bk_auto_journal_settings:', err);
  }
}

export interface AutoJournalInput {
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  activityType: BKJournalEntry['activityType'];
  title: string;
  description: string;
  target: string;
  status?: BKJournalEntry['status'];
  counselorId?: string;
  proofPhotoUrl?: string;
  proofPhotoName?: string;
  absentStudents?: string;
  sourceType?: 'violation' | 'service' | 'summon_visit' | 'achievement';
}

/**
  * Safely appends an automatic activity record directly into `bk_daily_journals`
  * in localStorage so it instantly appears in the Jurnal Harian view & reports.
  */
export function autoPushToJournal(input: AutoJournalInput): void {
  try {
    const settings = getAutoJournalSettings();

    // Check if category is enabled in settings
    if (input.sourceType === 'violation' && !settings.syncViolations) {
      // Catatan Pelanggaran tidak dimasukkan ke Jurnal Harian
      return;
    }
    if (input.sourceType === 'service' && !settings.syncServices) {
      return;
    }
    if (input.sourceType === 'summon_visit' && !settings.syncSummonsAndVisits) {
      return;
    }
    if (input.sourceType === 'achievement' && !settings.syncAchievements) {
      return;
    }

    const journals: BKJournalEntry[] = loadSchoolData('bk_daily_journals', []);

    const dateStr = input.date || new Date().toISOString().split('T')[0];
    
    // Prevent strict duplicate entries on the same day with identical titles
    const isDuplicate = journals.some(j => j.date === dateStr && j.title === input.title);
    if (isDuplicate) {
      return;
    }

    const now = new Date();
    const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const endHour = `${String(now.getHours() + 1).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newJournal: BKJournalEntry = {
      id: `j-auto-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      date: dateStr,
      startTime: input.startTime || currentHour,
      endTime: input.endTime || endHour,
      activityType: input.activityType,
      title: input.title,
      description: input.description,
      target: input.target,
      status: input.status || 'Selesai',
      counselorId: input.counselorId || 'c1',
      createdAt: new Date().toISOString(),
      proofPhotoUrl: input.proofPhotoUrl,
      proofPhotoName: input.proofPhotoName,
      absentStudents: input.absentStudents
    };

    const updated = [newJournal, ...journals];
    saveSchoolData('bk_daily_journals', updated);
    saveToFirestore('bk_daily_journals', newJournal);
    triggerBackgroundAutoSync();
  } catch (err) {
    console.error('Error auto-linking activity to Jurnal Harian:', err);
  }
}
