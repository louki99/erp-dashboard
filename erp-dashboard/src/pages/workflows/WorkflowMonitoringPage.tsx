import { useState } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { RealtimeWorkflowMonitor } from '@/components/workflow/RealtimeWorkflowMonitor';
import { SLADashboard } from '@/components/workflow/SLADashboard';
import { Activity, TrendingUp, Search } from 'lucide-react';

/**
 * Workflow Monitoring Page
 * Follows Single Responsibility Principle - orchestrates workflow monitoring views
 */
export function WorkflowMonitoringPage() {
    const [activeTab, setActiveTab] = useState<'sla' | 'workflow'>('sla');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWorkflow, setSelectedWorkflow] = useState<{
        type: string;
        id: number;
    } | null>(null);

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto bg-gray-50">
                    <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                        <Activity className="w-7 h-7 text-blue-600" />
                                        Workflow Monitoring
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        Real-time workflow progress and SLA tracking
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-6">
                            <div className="flex gap-6">
                                <button
                                    onClick={() => setActiveTab('sla')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'sla'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <TrendingUp className="w-4 h-4 inline mr-2" />
                                    SLA Dashboard
                                    {activeTab === 'sla' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('workflow')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'workflow'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Activity className="w-4 h-4 inline mr-2" />
                                    Workflow Tracker
                                    {activeTab === 'workflow' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'sla' && <SLADashboard />}

                        {activeTab === 'workflow' && (
                            <div className="space-y-6">
                                {/* Workflow Selector */}
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Search by Order ID
                                            </label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Enter BC/BL/BCH/BP ID..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button
                                                onClick={() => {
                                                    if (searchQuery) {
                                                        setSelectedWorkflow({
                                                            type: 'bc',
                                                            id: parseInt(searchQuery),
                                                        });
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                Track Workflow
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Workflow Monitor */}
                                {selectedWorkflow ? (
                                    <RealtimeWorkflowMonitor
                                        workflowType={selectedWorkflow.type}
                                        taskableId={selectedWorkflow.id}
                                    />
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                                            No Workflow Selected
                                        </h3>
                                        <p className="text-gray-600">
                                            Enter an order ID above to track its workflow progress
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            }
        />
    );
}
