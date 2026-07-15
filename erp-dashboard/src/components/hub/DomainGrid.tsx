import { useState } from 'react';
import { motion } from 'framer-motion';
import { DomainCard } from './DomainCard';
import type { BusinessDomain } from '@/lib/hub/hubData';
import { cn } from '@/lib/utils';

interface DomainGridProps {
    domains: BusinessDomain[];
    className?: string;
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 },
    },
};

const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const DomainGrid = ({ domains, className }: DomainGridProps) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (!domains.length) return null;

    return (
        <div className={cn('', className)}>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                Domaines métier
            </p>
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3"
            >
                {domains.map((domain) => (
                    <motion.div key={domain.id} variants={item}>
                        <DomainCard
                            domain={domain}
                            isActive={hoveredId === domain.id}
                            onHover={setHoveredId}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};
