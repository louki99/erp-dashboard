import React, { useState, useRef, useEffect } from 'react';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';

interface EntityRecordExampleProps {
    data?: any;
}

export const EntityRecordExample: React.FC<EntityRecordExampleProps> = ({ data }) => {
    // 1. Define Tabs
    const tabs: TabItem[] = [
        { id: 'identity', label: 'Identité' },
        { id: 'addr', label: 'Adresses' },
        { id: 'comm', label: 'Commerciales' },
        { id: 'mgmt', label: 'Gestion' },
        { id: 'fin', label: 'Financières' },
        { id: 'deliv', label: 'Clients livrés' },
        { id: 'bank', label: 'Données bancaires' },
        { id: 'contacts', label: 'Contacts' },
        { id: 'supp', label: 'Info. supl.' },
    ];

    // 2. State Management
    const [activeTab, setActiveTab] = useState('identity');
    // Track open state for each section. Default all open or based on `defaultOpen`?
    // Let's default all to OPEN to match the "long scrolled form" behavior usually seen.
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(
        tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: true }), { identity: true })
    );

    // Refs for scroll spy - map tab ID to DOM element
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false); // To prevent spy from overriding click scroll

    // Default mock data
    const partner = data || {
        code: 'CUST-00921',
        name: 'TechCorp Inc.',
        status: 'Actif',
        currency: 'EUR - Euro',
        rep: 'Jean Dupont',
        sector: 'NORD-EST'
    };

    // 3. Scroll Spy Logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;

            // Simple spy: find the first section that is visible or close to top
            // We only spy if ALL sections are effectively "available" (expanded behavior).
            // Users requirement: "tabs is change possition this happend only if all tabs expended"
            // We can approximate this by checking if the currently viewed section is open.

            // Find the section closest to the top of the container
            let currentSection = activeTab;
            let minDistance = Infinity;

            for (const tab of tabs) {
                const element = sectionRefs.current[tab.id];
                if (element && openSections[tab.id]) {
                    const rect = element.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    // Distance from top of container
                    const distance = Math.abs(rect.top - containerRect.top);

                    // Logic: The element should be somewhat visible. 
                    // Let's simple check if it's within the viewport "zone" near the top.
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentSection = tab.id;
                    }
                }
            }

            // Should properly check intersection but distance heuristic usually works well for sticky headers style
            // Better: loop and find the first one whose bottom is > container top + offset

            // Improved Logic:
            const containerTop = container.scrollTop;
            let found = false;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el) continue;

                // If section is closed, it has little height, skip?
                if (!openSections[tab.id]) continue;

                // element offsetTop is relative to parent if positioned? 
                // We use use standard checks.
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;

                // Check if this element covers the "reading line" (e.g. 50px-100px from top)
                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
                    if (activeTab !== tab.id) {
                        setActiveTab(tab.id);
                    }
                    found = true;
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [openSections, tabs, activeTab]);

    // 4. Handlers
    const handleTabChange = (id: string) => {
        setActiveTab(id);

        // Use flag to ignore scroll events during auto-scroll
        isScrollingRef.current = true;

        // 1. Ensure section is open
        if (!openSections[id]) {
            setOpenSections(prev => ({ ...prev, [id]: true }));
        }

        // 2. Scroll to section within the container
        // Timeout to allow state update and DOM render if it was closed
        setTimeout(() => {
            const el = sectionRefs.current[id];
            const container = containerRef.current;

            if (el && container) {
                // Calculate the position of the element relative to the container
                const elementTop = el.offsetTop;

                // Scroll the container to show the element at the top
                container.scrollTo({
                    top: elementTop - container.offsetTop,
                    behavior: 'smooth'
                });
            }

            // Release lock after scroll animation approx time
            setTimeout(() => { isScrollingRef.current = false; }, 600);
        }, 100); // Increased timeout to ensure collapsible renders
    };

    const handleExpandAll = () => {
        const allOpen = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: true }), { identity: true });
        setOpenSections(allOpen);
    };

    const handleCollapseAll = () => {
        const allClosed = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: false }), { identity: false });
        // Maybe keep active one open? Or just close all. Let's close all for "Collapse All".
        setOpenSections(allClosed);
    };

    const toggleSection = (id: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [id]: isOpen }));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Top Tabs Area */}
            <div className="shrink-0 bg-white z-10 min-w-0">
                <SageTabs
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                />
            </div>

            {/* Scrollable Content Area */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth">

                {/* Identity Section - Treated as a collapsible now for consistency or kept static? 
                    User image implies it's just the first section. Let's wrap it in Collapsible or just a divRef.
                    But 'identity' is a tab. So it should probably behave like others.
                */}
                <div ref={el => { sectionRefs.current['identity'] = el; }}>
                    {/* Explicitly using Collapsible for Identity to match "Expand All" behavior evenly? 
                       Or keep as fixed card if "Identity" is special? 
                       Let's make it a SageCollapsible for consistency in "Expand/Collapse All" logic.
                   */}
                    <SageCollapsible
                        title="Identité"
                        defaultOpen={openSections['identity']}
                        onOpenChange={(open) => toggleSection('identity', open)}
                        isOpen={openSections['identity']}
                    >
                        <div className="grid grid-cols-2 gap-6">
                            {/* ... Content ... */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Code Tiers</label>
                                    <input type="text" value={partner.code} className="mt-1 w-full p-2 border border-gray-300 rounded-sm bg-gray-50" readOnly />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Raison Sociale</label>
                                    <input type="text" value={partner.name} className="mt-1 w-full p-2 border border-gray-300 rounded-sm" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Statut</label>
                                    <span className="inline-flex mt-2 items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {partner.status}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Devise</label>
                                    <input type="text" value={partner.currency} className="mt-1 w-full p-2 border border-gray-300 rounded-sm" />
                                </div>
                            </div>
                        </div>
                    </SageCollapsible>
                </div>

                {/* Other Sections */}
                <div ref={el => { sectionRefs.current['addr'] = el; }}>
                    <SageCollapsible
                        title="Adresses"
                        isOpen={openSections['addr']}
                        onOpenChange={(open) => toggleSection('addr', open)}
                    >
                        <div className="text-sm text-gray-600">
                            Liste des adresses de facturation et de livraison...
                        </div>
                    </SageCollapsible>
                </div>

                <div ref={el => { sectionRefs.current['comm'] = el; }}>
                    <SageCollapsible
                        title="Commerciales"
                        isOpen={openSections['comm']}
                        onOpenChange={(open) => toggleSection('comm', open)}
                    >
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500">Représentant</label>
                                <input className="w-full border-b border-gray-300 focus:border-primary outline-none py-1 text-sm" value={partner.rep} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 block">Secteur</label>
                                <input className="w-full border-b border-gray-300 focus:border-primary outline-none py-1 text-sm" value={partner.sector} />
                            </div>
                        </div>
                    </SageCollapsible>
                </div>

                {['mgmt', 'fin', 'deliv', 'bank', 'contacts', 'supp'].map(id => {
                    const tab = tabs.find(t => t.id === id);
                    return (
                        <div key={id} ref={el => { sectionRefs.current[id] = el; }}>
                            <SageCollapsible
                                title={tab?.label || id}
                                isOpen={openSections[id]}
                                onOpenChange={(open) => toggleSection(id, open)}
                            >
                                <div className="h-20 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                                    Contenu pour {tab?.label}...
                                </div>
                            </SageCollapsible>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
