import { UserCog } from 'lucide-react';
import { useDriver } from '../../contexts/DriverContext';

export function DriverProfile() {
    const { driver } = useDriver();

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-xl font-bold" style={{ color: 'var(--ff-text-primary)' }}>Profile</h1>

            <div className="rounded-xl divide-y" style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderColor: 'var(--ff-border)' }}>
                {([
                    ['Name', driver?.name],
                    ['Phone', driver?.phone],
                    ['Licence No.', driver?.license_number],
                    ['NRC No.', driver?.nrc_number],
                ] as [string, string | null | undefined][]).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>{label}</span>
                        <span className="text-sm" style={{ color: 'var(--ff-text-primary)' }}>{value || '—'}</span>
                    </div>
                ))}
            </div>

            {/* Phase 5 will make these editable (with edit history) and add document uploads. */}
            <div className="rounded-xl p-5 flex flex-col items-center text-center gap-2"
                style={{ background: 'var(--ff-surface)', border: '1px dashed var(--ff-border)' }}>
                <UserCog size={28} style={{ color: 'var(--ff-text-muted)' }} />
                <p className="text-xs" style={{ color: 'var(--ff-text-muted)' }}>
                    Editing your details and uploading documents will be available here soon.
                </p>
            </div>
        </div>
    );
}
