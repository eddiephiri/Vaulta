import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
    return (
        <div className="flex items-start justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>
                    {title}
                </h2>
                {subtitle && (
                    <p className="mt-1 text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        {subtitle}
                    </p>
                )}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}
