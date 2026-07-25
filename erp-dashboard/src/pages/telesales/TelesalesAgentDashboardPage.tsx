import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, ShoppingCart, Briefcase, RotateCcw, PhoneCall, ChevronRight } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';

// Écran 1 (docs §8.1) — bandeau de session + accès rapide aux autres écrans du
// poste, tous construits depuis (§8.2–§8.8). "Fiche télé-visite" n'a pas de
// route autonome (elle se navigue avec un visit_id, via Planning/Portefeuille)
// — on y renvoie l'agent vers le planning du jour à la place.
const SECTIONS = [
    { icon: CalendarDays, label: 'Planning / Semainier', description: 'Appels planifiés du jour, appel libre', route: '/telesales/planning' },
    { icon: FileText, label: 'Fiche télé-visite', description: "Qualifier un appel en cours", route: '/telesales/planning' },
    { icon: ShoppingCart, label: 'Catalogue & Prise de commande', description: 'Rechercher un produit, créer une commande', route: '/telesales/catalog' },
    { icon: Briefcase, label: 'Devis B2B', description: 'Créer, envoyer, convertir un devis', route: '/telesales/devis' },
    { icon: Briefcase, label: 'Mon portefeuille', description: 'Partenaires assignés par le superviseur', route: '/telesales/portfolio' },
    { icon: RotateCcw, label: 'Retours clients', description: 'Retours commerciaux différés', route: '/telesales/returns' },
];

export const TelesalesAgentDashboardPage = () => {
    const navigate = useNavigate();

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <TelesalesSessionBanner />

            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Poste Télévendeur</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                    Démarrez votre session pour commencer à passer des appels.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
                    {SECTIONS.map(({ icon: Icon, label, description, route }) => (
                        <button
                            key={label}
                            onClick={() => navigate(route)}
                            className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-sage-200 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start justify-between">
                                <Icon className="w-6 h-6 text-sage-500 mb-3" />
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-sage-500 group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <div className="text-sm font-bold text-gray-800">{label}</div>
                            <div className="text-xs text-gray-400 mt-1">{description}</div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/telesales/planning')}
                    className="mt-6 flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow"
                >
                    <PhoneCall className="w-4 h-4" />
                    Appel libre
                </button>
            </div>
        </div>
    );

    return (
        <MasterLayout
            mainContent={mainContent}
            rightContent={<ActionPanel groups={[]} />}
        />
    );
};

export default TelesalesAgentDashboardPage;
