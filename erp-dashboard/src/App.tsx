import { useState } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { BadgeCheck, Clock, MapPin } from 'lucide-react';
import { PartnerPage } from '@/components/layout/PartnerPage';

// Mock Data
const MOCK_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: `ORD-${20240000 + i}`,
  customer: ['TechCorp Inc.', 'Global Logistics', 'Alpha Solutions', 'Omega Retail'][i % 4],
  date: `2024-12-${String((i % 30) + 1).padStart(2, '0')}`,
  amount: (Math.random() * 10000).toFixed(2),
  status: ['Pending', 'Validated', 'Shipped', 'Invoiced'][i % 4],
  site: ['Avenue Factory', 'West Warehouse', 'East Depot'][i % 3]
}));

function App() {
  const [view, setView] = useState<'orders' | 'partners'>('partners');
  const [selectedRow, setSelectedRow] = useState<any>(MOCK_DATA[0]);

  const columnDefs = [
    { field: 'id', headerName: 'Order No', width: 120, pinned: 'left' },
    { field: 'customer', headerName: 'Customer', width: 200 },
    { field: 'date', headerName: 'Date', width: 120 },
    {
      field: 'amount', headerName: 'Amount', width: 120, type: 'rightAligned',
      valueFormatter: (p: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.value)
    },
    {
      field: 'status', headerName: 'Status', width: 120, cellRenderer: (params: any) => {
        const colors: any = { 'Pending': 'text-orange-600 bg-orange-50', 'Validated': 'text-blue-600 bg-blue-50', 'Shipped': 'text-purple-600 bg-purple-50', 'Invoiced': 'text-green-600 bg-green-50' };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border border-transparent ${colors[params.value]}`}>{params.value}</span>;
      }
    },
    { field: 'site', headerName: 'Site', width: 150 }
  ];

  // Orders View Components
  const LeftPaneOrders = (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center text-xs">
        <span className="font-semibold text-gray-700">All Orders</span>
        <span className="text-gray-500">{MOCK_DATA.length} records</span>
      </div>
      <div className="flex-1">
        <DataGrid rowData={MOCK_DATA} columnDefs={columnDefs} onRowSelected={setSelectedRow} />
      </div>
    </div>
  );

  const MainPaneOrders = (
    <div className="p-6 max-w-5xl mx-auto w-full">
      {selectedRow ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {selectedRow.id}
                <span className="text-sm font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded border border-gray-200">Sales Order</span>
              </h1>
              <p className="text-gray-500 mt-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {selectedRow.site}
                <span className="text-gray-300">|</span>
                <Clock className="w-4 h-4" /> {selectedRow.date}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 tracking-tight">
                ${parseFloat(selectedRow.amount).toLocaleString()}
              </div>
              <div className="text-sm font-medium text-emerald-600 mt-1 flex items-center justify-end gap-1">
                <BadgeCheck className="w-4 h-4" /> Authorized
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 flex gap-6">
              {['Header', 'Lines', 'Delivery', 'Invoicing'].map((tab, i) => (
                <button key={tab} className={`py-3 text-sm font-medium border-b-2 transition-colors ${i === 0 ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-6 grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Customer Information</h3>
                <div className="grid grid-cols-[100px_1fr] gap-y-4 text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900">{selectedRow.customer}</span>
                  <span className="text-gray-500">Account</span>
                  <span className="font-medium text-gray-900 text-blue-600 hover:underline cursor-pointer">CUST-00921</span>
                  <span className="text-gray-500">Contact</span>
                  <span className="font-medium text-gray-900">John Doe (Purchasing)</span>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Order Logistics</h3>
                <div className="grid grid-cols-[100px_1fr] gap-y-4 text-sm">
                  <span className="text-gray-500">Priority</span>
                  <span className="font-medium text-gray-900">Normal</span>
                  <span className="text-gray-500">Carrier</span>
                  <span className="font-medium text-gray-900">DHL Express</span>
                  <span className="text-gray-500">Incoterms</span>
                  <span className="font-medium text-gray-900">EXW - Ex Works</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Order Lines</h3>
              <span className="text-xs text-gray-500">5 items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2">Item Code</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-medium text-gray-600">ITM-00{i}</td>
                      <td className="px-4 py-2">Widget Type {String.fromCharCode(64 + i)}</td>
                      <td className="px-4 py-2 text-right">{i * 10}</td>
                      <td className="px-4 py-2 text-right">$120.00</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">${(i * 1200).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-gray-400">Select an order to view details</div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Dev Switcher */}
      <div className="fixed bottom-4 right-24 z-[9999] flex gap-2 bg-black/80 p-2 rounded-full shadow-lg">
        <button
          onClick={() => setView('partners')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${view === 'partners' ? 'bg-[#00b06b] text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Partners
        </button>
        <button
          onClick={() => setView('orders')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${view === 'orders' ? 'bg-[#00b06b] text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Orders
        </button>
      </div>

      {view === 'partners' ? (
        <PartnerPage />
      ) : (
        <MasterLayout
          leftContent={LeftPaneOrders}
          mainContent={MainPaneOrders}
          rightContent={<ActionPanel />}
        />
      )}
    </div>
  );
}

export default App;
