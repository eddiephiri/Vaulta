import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: string;
        positive: boolean;
    };
    accent?: string; // CSS color
}

export function StatCard({ label, value, icon: Icon, trend, accent = '#3b82f6' }: StatCardProps) {
    return (
        <div
            className="rounded-xl p-5 flex items-start gap-4 transition-transform hover:-translate-y-0.5"
            style={{
                background: 'var(--ff-surface)',
                border: '1px solid var(--ff-border)',
            }}
        >
            {/* Icon */}
            <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{
                    width: 44,
                    height: 44,
                    background: `${accent}20`,
                }}
            >
                <Icon size={20} style={{ color: accent }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ff-text-muted)' }}>
                    {label}
                </p>
                <p className="text-2xl font-bold truncate" style={{ color: 'var(--ff-text-primary)' }}>
                    {value}
                </p>
                {trend && (
                    <p
                        className="text-xs mt-1 font-medium"
                        style={{ color: trend.positive ? 'var(--ff-green)' : 'var(--ff-red)' }}
                    >
                        {trend.positive ? '▲' : '▼'} {trend.value}
                    </p>
                )}
            </div>
        </div>
    );
}
