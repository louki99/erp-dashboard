import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { ShoppingCart, CheckCircle2, X, MapPin } from 'lucide-react';
import { onNewBc, type NewBcNotification } from '@/services/notifications/dispatcherNotificationBus';
import { playNewOrderSound } from '@/services/notifications/dispatcherSound';
import { useAuth } from '@/context/AuthContext';

// ─── Toast UI ────────────────────────────────────────────────────────────────

const REASON_CONFIG = {
    validated_by_adv: {
        label:     'Nouveau BC',
        Icon:      ShoppingCart,
        bgIcon:    'bg-indigo-600',
        labelColor: 'text-indigo-600',
    },
    converted_to_mission: {
        label:     'BC converti en mission',
        Icon:      CheckCircle2,
        bgIcon:    'bg-emerald-600',
        labelColor: 'text-emerald-600',
    },
} as const;

type KnownReason = keyof typeof REASON_CONFIG;

function BcToast({ t, n }: { t: { id: string; visible: boolean }; n: NewBcNotification }) {
    const fmt = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 });
    const cfg = REASON_CONFIG[n.reason as KnownReason] ?? REASON_CONFIG.validated_by_adv;
    const { Icon, bgIcon, label, labelColor } = cfg;

    return (
        <div
            className={`
                flex items-start gap-3 bg-white dark:bg-gray-900 shadow-2xl
                border border-gray-100 dark:border-gray-800
                rounded-xl px-4 py-3 w-80 transition-all duration-300
                ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            `}
        >
            {/* Icon badge */}
            <div className={`shrink-0 w-9 h-9 rounded-lg ${bgIcon} flex items-center justify-center shadow`}>
                <Icon size={16} className="text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</span>
                    <span className="text-[10px] text-gray-400">
                        {n.arrivedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{n.orderName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.partnerName}</p>
                </div>
                {n.amount != null && n.amount > 0 && (
                    <p className="text-xs font-bold text-emerald-600 mt-1">{fmt.format(n.amount)}</p>
                )}
            </div>

            {/* Dismiss */}
            <button
                onClick={() => toast.dismiss(t.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
}

// ─── Singleton component — mount once at App root ────────────────────────────

/**
 * Null-rendered — subscribes to the dispatcher notification bus, plays a chime,
 * and fires a react-hot-toast for every new BC event.
 * Active only for users with dispatcher / admin / root role.
 */
export function DispatcherNewOrderAlert() {
    const { user } = useAuth();

    const isDispatcher = user?.roles?.details?.some(
        (r: { name: string }) => ['dispatcher', 'admin', 'root'].includes(r.name)
    ) ?? false;

    useEffect(() => {
        if (!isDispatcher) return;

        const unsub = onNewBc((n) => {
            playNewOrderSound();
            toast.custom(
                (t) => <BcToast t={t} n={n} />,
                {
                    duration: 9000,
                    position: 'top-right',
                    id:       `bc-${n.orderId}`, // dedup if Reverb fires twice
                }
            );
        });

        return unsub;
    }, [isDispatcher]);

    return null;
}
