import { Loader2 } from 'lucide-react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { useDispatcherDashboard } from '@/hooks/dispatcher/useDispatcherDashboard';

const DispatcherDashboardContent = () => {
    const { data, loading, error, refetch } = useDispatcherDashboard();

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-sage-500" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">{error || 'No data available'}</p>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-sage-500 text-white rounded hover:bg-sage-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tableau de bord Dispatcher</h1>
                    <p className="text-gray-500 mt-1">Supervision des conversions BC, BL et bons de chargement.</p>
                </div>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg shadow-sm hover:bg-sage-700 transition-colors text-sm font-medium"
                >
                    Rafraîchir
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm text-gray-600">Dashboard payload reçu (stats):</p>
                <pre className="mt-3 text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
                    {JSON.stringify(data.stats || {}, null, 2)}
                </pre>
            </div>
        </div>
    );
};

export const DispatcherDashboard = () => {
    return (
        <MasterLayout
            leftContent={<div className="bg-white h-full p-6 border-r border-gray-100 flex items-center justify-center text-gray-400 text-sm italic">Dispatcher Quick Actions</div>}
            mainContent={<div className="h-full overflow-y-auto bg-slate-50"><DispatcherDashboardContent /></div>}
        />
    );
};
