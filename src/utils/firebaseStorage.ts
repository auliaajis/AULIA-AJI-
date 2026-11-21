import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from '../firebase';
import { getActiveSchoolId, sanitizeSchoolId } from './schoolConfig';
import { ensureFirebaseAuth } from './firestoreSync';

export { storage };

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

/**
 * Upload file dengan isolasi tenant per-sekolah ke Cloud Storage:
 * Format path: /schools/{schoolId}/{folder}/{timestamp}_{cleanFileName}
 */
export async function uploadSchoolFile(
  file: File | Blob,
  folder: 'students' | 'cases' | 'services' | 'documents' | 'surat' = 'documents',
  customFileName?: string,
  schoolIdInput?: string
): Promise<UploadResult> {
  const schoolId = sanitizeSchoolId(schoolIdInput || getActiveSchoolId());
  const now = new Date().toISOString();
  const rawName = customFileName || (file instanceof File ? file.name : `file_${Date.now()}`);
  const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `schools/${schoolId}/${folder}/${Date.now()}_${cleanName}`;

  try {
    await ensureFirebaseAuth();
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file, {
      customMetadata: {
        schoolId,
        uploadedAt: now,
        originalName: rawName
      }
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      downloadUrl,
      storagePath: filePath,
      fileName: rawName,
      size: file.size,
      uploadedAt: now
    };
  } catch (err: any) {
    console.warn(`[Storage] Cloud Storage upload fallback to local base64 URL:`, err);
    // Offline/Local Base64 Fallback jika Storage belum diaktifkan di Google Cloud
    const base64Url = await blobToBase64(file);
    return {
      downloadUrl: base64Url,
      storagePath: `local/${filePath}`,
      fileName: rawName,
      size: file.size,
      uploadedAt: now
    };
  }
}

/**
 * Hapus file dari Cloud Storage
 */
export async function deleteSchoolFile(storagePath: string): Promise<boolean> {
  if (!storagePath || storagePath.startsWith('local/')) return true;
  try {
    await ensureFirebaseAuth();
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
    return true;
  } catch (err) {
    console.warn(`[Storage] Could not delete file ${storagePath}:`, err);
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
