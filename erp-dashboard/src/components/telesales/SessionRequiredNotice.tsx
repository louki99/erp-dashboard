import { Headset } from 'lucide-react';

export const SessionRequiredNotice = ({ className = '' }: { className?: string }) => (
    <div className={`flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 ${className}`}>
        <Headset className="w-3.5 h-3.5 shrink-0" />
        Démarrez votre session pour effectuer cette action.
    </div>
);
