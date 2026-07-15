import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BUSINESS_FLOW } from '@/lib/hub/hubData';

interface BusinessFlowTrailProps {
    activeDomain?: string | null;
    className?: string;
}

export const BusinessFlowTrail = ({ className }: BusinessFlowTrailProps) => {
    const navigate = useNavigate();

    return (
        <div className={cn('', className)}>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Flux commercial
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 overflow-x-auto">
                <div className="flex items-center gap-1 min-w-max">
                    {BUSINESS_FLOW.map((step, index) => {
                        const Icon = step.icon;
                        const isLast = index === BUSINESS_FLOW.length - 1;

                        return (
                            <div key={step.id} className="flex items-center gap-1">
                                <motion.button
                                    whileHover={{ scale: 1.06 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => navigate(step.route)}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg group',
                                        'hover:shadow-sm transition-all duration-150',
                                        step.color,
                                        'hover:brightness-95'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-[11px] font-semibold whitespace-nowrap">
                                        {step.label}
                                    </span>
                                </motion.button>

                                {!isLast && (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 mx-0.5" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
