import { doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { SyncAction } from '../types';
import { 
  getPendingSyncActions, 
  updateSyncAction, 
  removeSyncAction,
  countPendingSyncActions 
} from './syncQueue';

let isSyncInProgress = false;
let listenersInitialized = false;

export interface SyncEngineStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

type SyncStatusListener = (status: SyncEngineStatus) => void;
const statusListeners = new Set<SyncStatusListener>();

let currentStatus: SyncEngineStatus = {
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
};

function emitStatus(partial: Partial<SyncEngineStatus>) {
  currentStatus = { ...currentStatus, ...partial };
  statusListeners.forEach((fn) => fn(currentStatus));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('maisoft:sync-engine-status', {
        detail: currentStatus,
      })
    );
  }
}

export function subscribeToSyncStatus(listener: SyncStatusListener): () => void {
  statusListeners.add(listener);
  // Send current status immediately
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getSyncEngineStatus(): SyncEngineStatus {
  return currentStatus;
}

/**
 * Pushes all queued actions stored in IndexedDB to Firebase.
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  // Check if browser is online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const count = await countPendingSyncActions();
    emitStatus({ isSyncing: false, pendingCount: count });
    return { processed: 0, failed: 0, remaining: count };
  }

  // Prevent multiple concurrent sync runs
  if (isSyncInProgress) {
    const count = await countPendingSyncActions();
    return { processed: 0, failed: 0, remaining: count };
  }

  isSyncInProgress = true;
  let processed = 0;
  let failed = 0;

  try {
    const pendingActions = await getPendingSyncActions();
    emitStatus({ isSyncing: true, pendingCount: pendingActions.length });

    if (pendingActions.length === 0) {
      emitStatus({ isSyncing: false, pendingCount: 0, lastSyncAt: new Date() });
      isSyncInProgress = false;
      return { processed: 0, failed: 0, remaining: 0 };
    }

    console.info(`[SyncQueue] Sincronizando ${pendingActions.length} acción(es) pendiente(s) con Firebase...`);

    for (const action of pendingActions) {
      // Check again if network disconnected during batch
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[SyncQueue] Desconexión detectada durante sincronización. Pausando cola.');
        break;
      }

      action.status = 'syncing';
      await updateSyncAction(action);

      try {
        await executeFirebaseAction(action);
        // Successfully pushed to Firebase, delete from IndexedDB queue
        await removeSyncAction(action.id);
        processed++;
        console.info(`[SyncQueue] Acción sincronizada con éxito: ${action.description}`);
      } catch (err: any) {
        failed++;
        console.error(`[SyncQueue] Error al sincronizar acción "${action.description}":`, err);

        const isNetworkError =
          err?.code === 'unavailable' ||
          err?.message?.includes('offline') ||
          err?.message?.includes('network') ||
          (typeof navigator !== 'undefined' && !navigator.onLine);

        action.status = 'failed';
        action.attempts = (action.attempts || 0) + 1;
        action.lastError = err?.message || 'Error al comunicarse con Firebase';
        await updateSyncAction(action);

        if (isNetworkError) {
          // Stop processing subsequent actions if network failed
          emitStatus({ lastError: 'Error de red al sincronizar' });
          break;
        }
      }
    }

    const remaining = await countPendingSyncActions();
    emitStatus({
      isSyncing: false,
      pendingCount: remaining,
      lastSyncAt: processed > 0 ? new Date() : currentStatus.lastSyncAt,
      lastError: failed > 0 ? `${failed} acción(es) pendientes por reintentar` : null,
    });

    return { processed, failed, remaining };
  } catch (err: any) {
    console.error('[SyncQueue] Error general en processSyncQueue:', err);
    const count = await countPendingSyncActions();
    emitStatus({
      isSyncing: false,
      pendingCount: count,
      lastError: err?.message || 'Fallo general de sincronización',
    });
    return { processed, failed, remaining: count };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Executes a single queued action on Firebase.
 */
async function executeFirebaseAction(action: SyncAction): Promise<void> {
  const { type, payload } = action;

  switch (type) {
    case 'SAVE_CUSTOMER': {
      const customer = payload.customer;
      if (!customer?.id) throw new Error('Cliente inválido sin ID');
      await setDoc(doc(db, 'customers', customer.id), customer, { merge: true });
      break;
    }

    case 'DELETE_CUSTOMER': {
      if (!payload?.id) throw new Error('ID de cliente requerido para eliminación');
      await deleteDoc(doc(db, 'customers', payload.id));
      break;
    }

    case 'SAVE_PRODUCT': {
      const product = payload.product;
      if (!product?.id) throw new Error('Producto inválido sin ID');
      await setDoc(doc(db, 'products', product.id), product, { merge: true });
      break;
    }

    case 'DELETE_PRODUCT': {
      if (!payload?.id) throw new Error('ID de producto requerido para eliminación');
      await deleteDoc(doc(db, 'products', payload.id));
      break;
    }

    case 'ADD_SALE': {
      const { sale, inventoryUpdates } = payload;
      if (!sale?.id) throw new Error('Venta inválida sin ID');

      const batch = writeBatch(db);
      batch.set(doc(db, 'sales', sale.id), sale);

      if (Array.isArray(inventoryUpdates)) {
        for (const update of inventoryUpdates) {
          batch.update(doc(db, 'products', update.productId), {
            stock: update.newStock,
          });
        }
      }

      await batch.commit();
      break;
    }

    case 'CANCEL_SALE': {
      const { saleId, inventoryUpdates } = payload;
      if (!saleId) throw new Error('ID de venta requerido para anulación');

      const batch = writeBatch(db);
      batch.update(doc(db, 'sales', saleId), { status: 'cancelled' });

      if (Array.isArray(inventoryUpdates)) {
        for (const update of inventoryUpdates) {
          batch.update(doc(db, 'products', update.productId), {
            stock: update.newStock,
          });
        }
      }

      await batch.commit();
      break;
    }

    case 'UPDATE_INSTALLMENTS': {
      const { saleId, installmentList } = payload;
      if (!saleId || !installmentList) throw new Error('Parámetros de cuota incompletos');
      await updateDoc(doc(db, 'sales', saleId), {
        installmentList,
      });
      break;
    }

    case 'UPDATE_SETTINGS': {
      if (!payload) throw new Error('Payload de configuración vacío');
      await setDoc(doc(db, 'settings', 'global'), payload, { merge: true });
      break;
    }

    default:
      console.warn(`[SyncQueue] Tipo de acción no reconocido: ${(action as any).type}`);
  }
}

/**
 * Initializes automatic online/reconnection listeners to trigger queue synchronization.
 */
export function setupAutoSyncListeners(): () => void {
  if (typeof window === 'undefined' || listenersInitialized) {
    return () => {};
  }

  listenersInitialized = true;

  const handleOnline = () => {
    console.info('[SyncQueue] Conexión a internet detectada. Iniciando sincronización automática con Firebase...');
    processSyncQueue();
  };

  const handleCustomQueueChange = () => {
    countPendingSyncActions().then((count) => {
      emitStatus({ pendingCount: count });
      // If we are online and not syncing, trigger process
      if (navigator.onLine && !isSyncInProgress && count > 0) {
        processSyncQueue();
      }
    });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('maisoft:sync-queue-changed', handleCustomQueueChange);

  // Initial count check and process if online
  countPendingSyncActions().then((count) => {
    emitStatus({ pendingCount: count });
    if (navigator.onLine && count > 0) {
      processSyncQueue();
    }
  });

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('maisoft:sync-queue-changed', handleCustomQueueChange);
    listenersInitialized = false;
  };
}
