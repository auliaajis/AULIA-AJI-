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

/**
 * Escapes special characters for RFC 5545 iCalendar values
 */
export function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Computes an effective end time for a counseling session (defaults to 45 mins after start)
 */
export function getServiceEndTime(service: CounselingService): string {
  if (service.endTime && service.endTime.trim()) {
    return service.endTime.trim();
  }
  const start = service.startTime || '08:00';
  const clean = start.replace('.', ':').trim();
  const [h, m] = clean.split(':').map((num) => parseInt(num, 10));
  const totalMinutes = (h || 8) * 60 + (m || 0) + 45;
  const endH = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const endM = String(totalMinutes % 60).padStart(2, '0');
  return `${endH}:${endM}`;
}

/**
 * Builds RFC 5545 .ics string for one or multiple counseling services
 */
export function generateIcsFileContent(
  services: CounselingService[],
  calendarTitle: string = 'Jadwal Layanan BK - SIKAP BK'
): string {
  const nowStamp = formatToGCalDateTime(
    new Date().toISOString().slice(0, 10),
    `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIKAP-BK SMP Negeri 2 Susukan//Layanan BK//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
    'X-WR-TIMEZONE:Asia/Jakarta',
  ];

  services.forEach((srv) => {
    const sDate = srv.date || new Date().toISOString().slice(0, 10);
    const sStart = srv.startTime || '08:00';
    const sEnd = getServiceEndTime(srv);

    const dtStart = formatToGCalDateTime(sDate, sStart);
    const dtEnd = formatToGCalDateTime(sDate, sEnd);

    const studentNamesStr = srv.students && srv.students.length > 0
      ? srv.students.map((st) => `${st.name} (${st.class})`).join(', ')
      : 'Siswa BK';

    const title = `📅 [Layanan BK] ${srv.serviceType} - ${studentNamesStr}`;

    const descriptionParts = [
      `💬 Topik / Permasalahan: ${srv.problem}`,
      `👥 Peserta Siswa: ${studentNamesStr}`,
      `📌 Jenis Layanan: ${srv.serviceType} (${srv.targetType || 'Individu'})`,
      `📅 Status Layanan: ${srv.status || 'Terjadwal'}`,
      srv.bkComponent ? `🏛 Pilar BK: ${srv.bkComponent}` : '',
      srv.bidangBimbingan ? `🎯 Bidang Bimbingan: ${srv.bidangBimbingan}` : '',
      srv.description ? `📝 Keterangan / Uraian Sesi: ${srv.description}` : '',
      srv.followUp ? `➡️ Rencana Tindak Lanjut: ${srv.followUp}` : '',
      '--------------------------------------------------',
      'Aplikasi SIKAP-BK SMP Negeri 2 Susukan'
    ].filter(Boolean);

    const description = descriptionParts.join('\n\n');
    const location = 'Ruang Bimbingan Konseling (BK)';
    const status = srv.status === 'Dibatalkan' ? 'CANCELLED' : srv.status === 'Selesai' ? 'CONFIRMED' : 'TENTATIVE';
    const cleanUid = `bk-${srv.id.replace(/[^a-zA-Z0-9-]/g, '')}-${sDate}@sikap-bk.smpn2susukan.sch.id`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${cleanUid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push(`LOCATION:${escapeIcsText(location)}`);
    lines.push(`STATUS:${status}`);
    lines.push(`CATEGORIES:${escapeIcsText(`Bimbingan Konseling,${srv.serviceType}`)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers instant browser file download of .ics content
 */
export function downloadIcsFile(filename: string, icsContent: string): void {
  const cleanFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export single counseling session to .ics file
 */
export function exportSingleServiceToIcs(service: CounselingService): void {
  const primaryName = service.students?.[0]?.name ? service.students[0].name.replace(/[^a-zA-Z0-9]/g, '_') : 'Siswa';
  const sDate = service.date ? service.date.replace(/[^0-9-]/g, '') : 'jadwal';
  const filename = `Jadwal-BK-${primaryName}-${sDate}.ics`;

  const icsContent = generateIcsFileContent([service], `Layanan BK: ${service.serviceType} - ${service.students?.map(s => s.name).join(', ') || 'Siswa'}`);
  downloadIcsFile(filename, icsContent);
  showToast(`File kalender "${filename}" berhasil diunduh! Klik file untuk menambahkan ke Google Calendar / Kalender HP.`, 'success');
}

/**
 * Export a collection of counseling services to a combined .ics file
 */
export function exportServicesToIcs(
  services: CounselingService[],
  customFilename?: string,
  calendarTitle?: string
): void {
  if (!services || services.length === 0) {
    showToast('Tidak ada jadwal layanan BK untuk diekspor.', 'warning');
    return;
  }

  const filename = customFilename || `Jadwal-Layanan-BK-${new Date().toISOString().slice(0, 10)}.ics`;
  const icsContent = generateIcsFileContent(services, calendarTitle || 'Semua Jadwal Layanan BK - SIKAP BK');
  downloadIcsFile(filename, icsContent);
  showToast(`Berhasil mengekspor ${services.length} sesi layanan BK ke "${filename}"! File siap diimpor ke Google Calendar.`, 'success');
}
