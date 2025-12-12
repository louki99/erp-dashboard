import React from 'react';
import {
    Users,
    CreditCard,
    FileCheck,
    AlertTriangle,
    TrendingUp,
    Clock,
    CheckCircle2,
    Ban
} from 'lucide-react';
import { MasterLayout } from '@/components/layout/MasterLayout';

// Mock Data for ADV Dashboard
const STATS = [
    { label: 'Commandes à Valider', value: '12', change: '+2', icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-100', trend: 'up' },
    { label: 'Blocages Crédit', value: '5', change: '-1', icon: Ban, color: 'text-red-600', bg: 'bg-red-100', trend: 'down' },
    { label: 'Encours Clients', value: '1.2M Dh', change: '+12%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', trend: 'up' },
    { label: 'Validation Partenaires', value: '3', change: '0', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', trend: 'neutral' },
];

const RECENT_ALERTS = [
    { id: 1, type: 'credit', message: 'Dépassement encours - Client MARJANE', time: '10 min ago', severity: 'high' },
    { id: 2, type: 'validation', message: 'Nouvelle commande > 50k Dh à valider', time: '1h ago', severity: 'medium' },
    { id: 3, type: 'partner', message: 'Nouveau client BIM - Dossier incomplet', time: '3h ago', severity: 'low' },
];

const AdvDashboardContent = () => {
    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tableau de bord ADV</h1>
                    <p className="text-gray-500 mt-1">Supervision de l'administration des ventes et du risque client.</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-sage-600 text-white rounded-lg shadow-sm hover:bg-sage-700 transition-colors text-sm font-medium">
                        Rafraîchir
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {STATS.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${stat.bg}`}>
                                    <Icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.trend === 'up' ? 'text-emerald-700 bg-emerald-50' :
                                        stat.trend === 'down' ? 'text-rose-700 bg-rose-50' : 'text-gray-600 bg-gray-100'
                                    }`}>
                                    {stat.change}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
                                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900">Validations en attente</h3>
                            <button className="text-sm text-sage-600 hover:text-sage-700 font-medium">Voir tout</button>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-bold text-sm">
                                            CMD
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">Commande #CMD-2024-{100 + i}</p>
                                            <p className="text-xs text-gray-500">Client: ACME Corp • 45,000.00 Dh</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors">
                                            Valider
                                        </button>
                                        <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
                                            Détails
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Side Alerts */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Alertes Récentes
                        </h3>
                        <div className="space-y-4">
                            {RECENT_ALERTS.map((alert) => (
                                <div key={alert.id} className="flex gap-3 items-start">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${alert.severity === 'high' ? 'bg-red-500' :
                                            alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                        }`} />
                                    <div>
                                        <p className="text-sm text-gray-800 font-medium leading-tight">{alert.message}</p>
                                        <span className="text-xs text-gray-400 mt-1 block">{alert.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Credit Management</h3>
                            <p className="text-indigo-200 text-sm mb-4">Review credit limits and blocked partners.</p>
                            <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
                                Open Credit Console
                            </button>
                        </div>
                        {/* Decorative background circle */}
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdvDashboard = () => {
    return (
        <MasterLayout
            leftContent={<div className="bg-white h-full p-6 border-r border-gray-100 flex items-center justify-center text-gray-400 text-sm italic">ADV Quick Actions</div>}
            mainContent={<div className="h-full overflow-y-auto bg-slate-50"><AdvDashboardContent /></div>}
        />
    );
};
