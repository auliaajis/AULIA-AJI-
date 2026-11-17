import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy
} from 'firebase/firestore';
import { db, SYNC_MAP, saveToFirestore, softDeleteFromFirestore, saveBulkToFirestore, isQuotaExceeded, getCurrentUserSchoolIdSync } from '../utils/firestoreSync';
import { matchesSchoolOrLegacy, isLegacyUnassignedRecord } from '../utils/schoolConfig';
import { getDeletedIds, registerDeletedId } from '../utils/deletionTracker';
import { isDummyRecord } from '../utils/purgeDummyData';

/**
 * Universal Realtime Hook for Firebase Firestore Collections
 * 
 * Features:
 * - Instant UI updates via onSnapshot() server listener
 * - 0ms initial load from LocalStorage cache
 * - Dual-condition school scope: displays (schoolId === mySchool OR schoolId empty/null/missing)
 * - Gracefully preserves soft-deleted protections (isDeleted !== true)
 */
export function useRealtimeData<T = any>(
  keyOrCollectionName: string,
  initialFallback: T[] = [],
  sortField?: string,
  sortDirection: 'asc' | 'desc' = 'desc'
): [
  T[],
  (newData: T[] | ((prev: T[]) => T[])) => void,
  {
    saveItem: (item: T) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    saveAll: (items: T[]) => Promise<void>;
    isRealtimeActive: boolean;
  }
] {
  // Determine localStorage key and Firestore collection name
  const isLocalKey = keyOrCollectionName.startsWith('bk_');
  const localKey = isLocalKey 
    ? keyOrCollectionName 
    : Object.keys(SYNC_MAP).find(k => SYNC_MAP[k] === keyOrCollectionName) || `bk_${keyOrCollectionName}`;
  const colName = SYNC_MAP[localKey] || keyOrCollectionName.replace(/^bk_/, '');

  // 1. Initial State: cached from localStorage for 0ms initial render
  const [data, setData] = useState<T[]>(() => {
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deletedSet = new Set(getDeletedIds());
          const schoolIdUser = getCurrentUserSchoolIdSync();
          return parsed.filter(
            (item: any) =>
              item?.isDeleted !== true &&
              !deletedSet.has(String(item?.id)) &&
              !isDummyRecord(item, localKey) &&
              matchesSchoolOrLegacy(item, schoolIdUser)
          );
        }
      }
    } catch (e) {
      console.warn(`Error reading initial local cache for [${localKey}]:`, e);
    }
    return initialFallback;
  });

  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  // 2. Direct onSnapshot Listener to Firestore (2-condition: matching schoolId OR unassigned legacy)
  useEffect(() => {
    if (isQuotaExceeded) {
      setIsRealtimeActive(false);
      return;
    }

    try {
      const schoolIdUser = getCurrentUserSchoolIdSync();
      const colRef = collection(db, colName);

      // Jangan pakai where("schoolId", "==", x) sendirian karena Firestore membuang dokumen lama tanpa schoolId.
      // Tarik koleksi dan terapkan filter 2 syarat (schoolId === schoolIdUser ATAU schoolId kosong/null/missing).
      let q: any = colRef;
      if (sortField) {
        try {
          q = query(colRef, orderBy(sortField, sortDirection));
        } catch {
          q = colRef;
        }
      }

      const processSnapshot = (snapshot: any) => {
        const deletedSet = new Set(getDeletedIds());
        const remoteList: T[] = [];
        const remoteIdSet = new Set<string>();

        snapshot.forEach((docSnap: any) => {
          const rawItem = { id: docSnap.id, ...docSnap.data() } as any;
          if (!rawItem || !rawItem.id) return;
          if (rawItem.isDeleted === true) {
            registerDeletedId(String(rawItem.id));
            return;
          }
          if (deletedSet.has(String(rawItem.id)) || isDummyRecord(rawItem, localKey)) {
            return;
          }
          if (!matchesSchoolOrLegacy(rawItem, schoolIdUser)) {
            return;
          }
          const isUnassigned = isLegacyUnassignedRecord(rawItem);
          const item = isUnassigned ? { ...rawItem, isLegacyUnmigrated: true } : rawItem;
          remoteList.push(item);
          remoteIdSet.add(String(item.id));
        });

        // Sertakan data lokal yang belum memiliki schoolId atau belum sempat sync agar tidak disembunyikan
        try {
          const cached = localStorage.getItem(localKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              parsed.forEach((localItem: any) => {
                if (
                  localItem &&
                  localItem.id &&
                  localItem.isDeleted !== true &&
                  !remoteIdSet.has(String(localItem.id)) &&
                  !deletedSet.has(String(localItem.id)) &&
                  matchesSchoolOrLegacy(localItem, schoolIdUser)
                ) {
                  if (isLegacyUnassignedRecord(localItem)) {
                    remoteList.push({
                      ...localItem,
                      isLegacyUnmigrated: true
                    });
                    remoteIdSet.add(String(localItem.id));
                  }
                }
              });
            }
          }
        } catch (e) {}

        if (snapshot.size > 0 || remoteList.length > 0) {
          const remoteStr = JSON.stringify(remoteList);
          const currentLocalStr = localStorage.getItem(localKey);

          if (currentLocalStr !== remoteStr) {
            localStorage.setItem(localKey, remoteStr);
            setData(remoteList);
            window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: remoteList } }));
          }
        }
        setIsRealtimeActive(true);
      };

      const unsubscribe = onSnapshot(
        q,
        processSnapshot,
        (error) => {
          console.warn(`Realtime onSnapshot sync query error for [${colName}]:`, error);
          if (sortField) {
            try {
              onSnapshot(colRef, processSnapshot);
            } catch {}
          }
          setIsRealtimeActive(false);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.error(`Failed to attach onSnapshot listener for [${colName}]:`, err);
      setIsRealtimeActive(false);
    }
  }, [colName, localKey, sortField, sortDirection]);

  // 3. Listen to internal broadcast events for instant cross-component synchronization
  useEffect(() => {
    const handleBroadcast = (e: any) => {
      if (e?.detail?.key === localKey && Array.isArray(e.detail.data)) {
        setData(e.detail.data);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === localKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setData(parsed);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('bk_realtime_sync', handleBroadcast);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('bk_realtime_sync', handleBroadcast);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [localKey]);

  // 4. State Setter Helper with LocalStorage & Event synchronization
  const updateData = useCallback((newDataOrUpdater: T[] | ((prev: T[]) => T[])) => {
    setData((prev) => {
      const next = typeof newDataOrUpdater === 'function' ? (newDataOrUpdater as any)(prev) : newDataOrUpdater;
      if (Array.isArray(next)) {
        localStorage.setItem(localKey, JSON.stringify(next));
        saveBulkToFirestore(localKey, next);
        window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: next } }));
        window.dispatchEvent(new Event('storage'));
      }
      return next;
    });
  }, [localKey]);

  // 5. Individual Item Save (Optimistic + Direct Server Push)
  const saveItem = useCallback(async (item: T) => {
    const targetItem = item as any;
    if (!targetItem || !targetItem.id) return;

    setData((prev) => {
      const index = prev.findIndex((i: any) => String(i.id) === String(targetItem.id));
      let updated: T[];
      if (index !== -1) {
        updated = [...prev];
        updated[index] = { ...prev[index], ...targetItem };
      } else {
        updated = [targetItem, ...prev];
      }
      localStorage.setItem(localKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: updated } }));
      return updated;
    });

    await saveToFirestore(localKey, targetItem);
  }, [localKey]);

  // 6. Individual Item Delete (Optimistic Soft Delete + Direct Server Push)
  const deleteItem = useCallback(async (id: string) => {
    if (!id) return;

    let deletedSnapshot: any = id;
    setData((prev) => {
      const target = prev.find((i: any) => String(i.id) === String(id));
      if (target) deletedSnapshot = target;
      const updated = prev.filter((i: any) => String(i.id) !== String(id));
      localStorage.setItem(localKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: updated } }));
      return updated;
    });

    await softDeleteFromFirestore(localKey, deletedSnapshot);
  }, [localKey]);

  // 7. Bulk Save
  const saveAll = useCallback(async (items: T[]) => {
    updateData(items);
  }, [updateData]);

  return [data, updateData, { saveItem, deleteItem, saveAll, isRealtimeActive }];
}

export default useRealtimeData;
