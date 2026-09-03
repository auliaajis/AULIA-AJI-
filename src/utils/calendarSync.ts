import { CounselingService } from '../types';
import { showToast } from './toast';
import { getSavedScriptUrl, callGasApi } from './googleSync';

/**
 * Converts local date string (YYYY-MM-DD or DD/MM/YYYY) and time string (HH:mm)
 * to an ISO 8601 UTC string formatted for Google Calendar URLs (YYYYMMDDTHHmmssZ).
 */
export function formatToGCalDateTime(dateStr: string, timeStr: string): string {
  try {
    let year = 2026;
    let month = 1;
    let day = 1;

    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      year = parseInt(parts[0], 10) || 2026;
      month = parseInt(parts[1], 10) || 1;
      day = parseInt(parts[2], 10) || 1;
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      day = parseInt(parts[0], 10) || 1;
      month = parseInt(parts[1], 10) || 1;
      year = parseInt(parts[2], 10) || 2026;
    }

    let hours = 8;
    let minutes = 0;
    if (timeStr) {
      const cleanTime = timeStr.replace('.', ':').trim();
      const timeParts = cleanTime.split(':');
      hours = parseInt(timeParts[0], 10) || 8;
      minutes = parseInt(timeParts[1], 10) || 0;
    }

    // Create a Date object in local time
    const dateObj = new Date(year, month - 1, day, hours, minutes, 0);

    // Convert to ISO string YYYYMMDDTHHmmssZ
    const utcYear = dateObj.getUTCFullYear();
    const utcMonth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(dateObj.getUTCDate()).padStart(2, '0');
    const utcHours = String(dateObj.getUTCHours()).padStart(2, '0');
    const utcMinutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
    const utcSeconds = String(dateObj.getUTCSeconds()).padStart(2, '0');

    return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`;
  } catch (err) {
    console.error('Error formatting GCal date:', err);
    return '20260810T020000Z'; // fallback
  }
}

/**
 * Generates direct Google Calendar Web App event creation URL
 */
export function generateGoogleCalendarUrl(service: CounselingService): string {
  const studentNamesStr = service.students && service.students.length > 0
    ? service.students.map((st) => `${st.name} (${st.class})`).join(', ')
    : 'Siswa BK';

  const title = `📅 [Layanan BK] ${service.serviceType} - ${studentNamesStr}`;

  const startGCalTime = formatToGCalDateTime(service.date || new Date().toISOString().slice(0, 10), service.startTime || '08:00');
  
  // Default end time to 45 mins after start time if not provided
  let endTimeToUse = service.endTime;
  if (!endTimeToUse && service.startTime) {
    const [h, m] = service.startTime.split(':').map((num) => parseInt(num, 10));
    const endMinutes = ((h || 8) * 60 + (m || 0) + 45);
    const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    endTimeToUse = `${endH}:${endM}`;
  }
  
  const endGCalTime = formatToGCalDateTime(service.date || new Date().toISOString().slice(0, 10), endTimeToUse || '09:00');

  const details = [
    `💬 Topik / Permasalahan: ${service.problem}`,
    `👥 Peserta Siswa: ${studentNamesStr}`,
    `📌 Jenis Layanan: ${service.serviceType} (${service.targetType || 'Individu'})`,
    `📅 Status Layanan: ${service.status || 'Terjadwal'}`,
    service.description ? `📝 Keterangan / Deskripsi: ${service.description}` : '',
    '--------------------------------------------------',
    'Dibuat secara otomatis melalui Portal Sistem Administrasi BK'
  ].filter(Boolean).join('\n\n');

  const location = 'Ruang Bimbingan Konseling (BK)';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startGCalTime}/${endGCalTime}`,
    details: details,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Open Google Calendar in a new window/tab to add event directly
 */
export function addToGoogleCalendar(service: CounselingService): void {
  const url = generateGoogleCalendarUrl(service);
  window.open(url, '_blank', 'noopener,noreferrer');
  
  showToast(`Membuka Google Calendar untuk menyinkronkan sesi ${service.serviceType}`, 'info');

  // Async sync to Google Apps Script backend if configured
  const scriptUrl = getSavedScriptUrl();
  if (scriptUrl) {
    syncServiceToGasCalendar(service, scriptUrl);
  }
}

/**
 * Optional background sync to Google Apps Script Calendar API
 */
async function syncServiceToGasCalendar(service: CounselingService, scriptUrl: string) {
  try {
    const studentNames = service.students?.map((s) => `${s.name} (${s.class})`).join(', ') || '';
    await callGasApi(scriptUrl, 'POST', {
      action: 'createCalendarEvent',
      serviceId: service.id,
      title: `Layanan BK: ${service.serviceType} - ${studentNames}`,
      date: service.date,
      startTime: service.startTime,
      endTime: service.endTime,
      description: `Topik: ${service.problem}\nPeserta: ${studentNames}\nKeterangan: ${service.description}`,
      location: 'Ruang Bimbingan Konseling (BK)',
    });
  } catch (err) {
    // Non-blocking catch
    console.warn('Background GAS calendar sync:', err);
  }
}
