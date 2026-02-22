import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const REPORT_TYPES = [
    { id: 'profit_loss', label: 'Profit & Loss', desc: 'Income vs Expenses summary by period' },
    { id: 'vehicle_performance', label: 'Vehicle Performance', desc: 'Earnings and costs per vehicle' },
    { id: 'expense_breakdown', label: 'Expense Breakdown', desc: 'Costs categorised by type' },
    { id: 'license_summary', label: 'License Status', desc: 'Active, expiring and expired licenses' },
];

export function Reports() {
    return (
        <div>
            <PageHeader
                title="Reports"
                subtitle="Generate and export business reports in ZMW"
                action={
                    <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', color: 'var(--ff-text-primary)' }}
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                }
            />

            {/* Date range picker */}
            <div
                className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
            >
                <div className="flex items-center gap-2">
                    <label className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>From</label>
                    <input
                        type="date"
                        className="text-sm px-3 py-2 rounded-lg"
                        style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>To</label>
                    <input
                        type="date"
                        className="text-sm px-3 py-2 rounded-lg"
                        style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                    />
                </div>
                <select
                    className="text-sm px-3 py-2 rounded-lg"
                    style={{ background: 'var(--ff-navy)', color: 'var(--ff-text-primary)', border: '1px solid var(--ff-border)' }}
                >
                    <option value="">All Vehicles</option>
                </select>
            </div>

            {/* Report type cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {REPORT_TYPES.map(rt => (
                    <button
                        key={rt.id}
                        className="flex items-start gap-4 p-5 rounded-xl text-left transition-transform hover:-translate-y-0.5"
                        style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
                    >
                        <div
                            className="flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ width: 44, height: 44, background: '#3b82f620' }}
                        >
                            <BarChart3 size={20} style={{ color: '#3b82f6' }} />
                        </div>
                        <div>
                            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ff-text-primary)' }}>
                                {rt.label}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                                {rt.desc}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Empty state */}
            <div
                className="flex flex-col items-center justify-center h-32 rounded-xl mt-6"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}
            >
                <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                    Select a report type and date range above to generate a report.
                </p>
            </div>
        </div>
    );
}
