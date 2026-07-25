import { RefreshCw, WifiOff, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useTelesalesSync } from '@/hooks/telesales/useTelesalesSync';

/**
 * Offline cache status + manual sync trigger (docs §4.4). Auto-sync also
 * fires once on session start (TelesalesSessionBanner) — this is the
 * always-visible status readout plus a manual "Synchroniser" fallback.
 */
export const SyncStatusBadge = () => {
    const { syncing, lastSyncedAt, productCount, partnerCount, syncNow } = useTelesalesSync();

    const handleSync = async () => {
        try {
            const res = await syncNow();
            toast.success(`Catalogue et partenaires synchronisés (${res.products} produits, ${res.partners} partenaires)`);
        } catch {
            toast.error('Échec de la synchronisation');
        }
    };

    return (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0 text-gray-500">
                {lastSyncedAt ? (
                    <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="truncate">
                            {productCount} produits · {partnerCount} partenaires
                            <span className="text-gray-400"> — {new Date(lastSyncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                    </>
                ) : (
                    <>
                        <WifiOff className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>Cache local vide</span>
                    </>
                )}
            </div>
            <button
                onClick={handleSync}
                disabled={syncing}
                title="Synchroniser le catalogue et les partenaires"
                className="p-1 rounded text-gray-400 hover:text-sage-600 hover:bg-white disabled:opacity-50 shrink-0"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
        </div>
    );
};
