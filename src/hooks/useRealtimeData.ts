import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db, SYNC_MAP, saveToFirestore, deleteFromFirestore, saveBulkToFirestore, isQuotaExceeded } from '../utils/firestoreSync';
import { getDeletedIds } from '../utils/deletionTracker';
import { isDummyRecord } from '../utils/purgeDummyData';

/**
 * Universal Realtime Hook for Firebase Firestore Collections
 * 
 * Features:
 * - Instant UI updates via onSnapshot() server listener
 * - 0ms initial load from LocalStorage cache
 * - Optimistic local updates with automatic server push
 * - Cross-component & cross-tab synchronization
 * - Graceful fallback if offline or quota exceeded
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
          return parsed.filter((item: any) => !deletedSet.has(String(item?.id)) && !isDummyRecord(item, localKey));
        }
      }
    } catch (e) {
      console.warn(`Error reading initial local cache for [${localKey}]:`, e);
    }
    return initialFallback;
  });

  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  // 2. Direct onSnapshot Listener to Firestore
  useEffect(() => {
    if (isQuotaExceeded) {
      setIsRealtimeActive(false);
      return;
    }

    try {
      const colRef = collection(db, colName);
      const q = sortField 
        ? query(colRef, orderBy(sortField, sortDirection))
        : query(colRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const deletedSet = new Set(getDeletedIds());
          const remoteList: T[] = [];

          snapshot.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() } as any;
            if (item && item.id && !deletedSet.has(String(item.id)) && !isDummyRecord(item, localKey)) {
              remoteList.push(item);
            }
          });

          // Only update if there are remote documents or if remoteList changed
          if (snapshot.size > 0 || remoteList.length > 0) {
            const remoteStr = JSON.stringify(remoteList);
            const currentLocalStr = localStorage.getItem(localKey);

            if (currentLocalStr !== remoteStr) {
              localStorage.setItem(localKey, remoteStr);
              setData(remoteList);
              // Notify other listening components in the same window
              window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: remoteList } }));
            }
          }
          setIsRealtimeActive(true);
        },
        (error) => {
          console.warn(`Realtime onSnapshot sync error for [${colName}]:`, error);
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

  // 6. Individual Item Delete (Optimistic + Direct Server Push)
  const deleteItem = useCallback(async (id: string) => {
    if (!id) return;

    setData((prev) => {
      const updated = prev.filter((i: any) => String(i.id) !== String(id));
      localStorage.setItem(localKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('bk_realtime_sync', { detail: { key: localKey, data: updated } }));
      return updated;
    });

    await deleteFromFirestore(localKey, id);
  }, [localKey]);

  // 7. Bulk Save
  const saveAll = useCallback(async (items: T[]) => {
    updateData(items);
  }, [updateData]);

  return [data, updateData, { saveItem, deleteItem, saveAll, isRealtimeActive }];
}

export default useRealtimeData;
