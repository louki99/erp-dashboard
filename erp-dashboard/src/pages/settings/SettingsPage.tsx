import { useState } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { SageTabs } from '@/components/common/SageTabs';
import { Settings, Palette, Briefcase, Wallet, Sparkles, Monitor } from 'lucide-react';
import { GeneralSettingsTab } from './components/GeneralSettingsTab';
import { ThemeSettingsTab } from './components/ThemeSettingsTab';
import { BusinessSettingsTab } from './components/BusinessSettingsTab';
import { WithdrawSettingsTab } from './components/WithdrawSettingsTab';
import { AISettingsTab } from './components/AISettingsTab';

export const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        {
            id: 'general',
            label: 'General',
            icon: Settings,
            content: <GeneralSettingsTab />
        },
        {
            id: 'theme',
            label: 'Theme',
            icon: Palette,
            content: <ThemeSettingsTab />
        },
        {
            id: 'business',
            label: 'Business',
            icon: Briefcase,
            content: <BusinessSettingsTab />
        },
        {
            id: 'withdraw',
            label: 'Withdraw',
            icon: Wallet,
            content: <WithdrawSettingsTab />
        },
        {
            id: 'ai',
            label: 'AI Integration',
            icon: Sparkles,
            content: <AISettingsTab />
        },
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="bg-white h-full p-6 border-r border-gray-200 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6 text-sage-700">
                        <Monitor className="w-6 h-6" />
                        <h2 className="font-semibold text-xl">System Settings</h2>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Manage your application configuration, branding, and business rules from a centralized dashboard.
                    </p>
                </div>
            }
            mainContent={
                <div className="p-8 w-full max-w-6xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
                        <p className="text-gray-600 mt-1">Configure global application settings.</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
                        <SageTabs
                            tabs={tabs}
                            activeTabId={activeTab}
                            onTabChange={setActiveTab}
                        />
                        <div className="p-8">
                            {tabs.find((t) => t.id === activeTab)?.content}
                        </div>
                    </div>
                </div>
            }
        />
    );
};
