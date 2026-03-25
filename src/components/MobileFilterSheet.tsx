import { X, SlidersHorizontal } from 'lucide-react';
import { useMediaQuery, MOBILE } from '../hooks/useMediaQuery';

interface MobileFilterSheetProps {
    open: boolean;
    onToggle: () => void;
    /** Number of currently active filters (shown as badge) */
    filterCount?: number;
    children: React.ReactNode;
}

/**
 * On mobile: renders a "Filters" button + a slide-up bottom sheet overlay.
 * On desktop: renders children inline (pass-through).
 */
export function MobileFilterSheet({ open, onToggle, filterCount = 0, children }: MobileFilterSheetProps) {
    const isMobile = useMediaQuery(MOBILE);

    /* ── Desktop: render filter bar inline ── */
    if (!isMobile) {
        return (
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl"
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                {children}
            </div>
        );
    }

    /* ── Mobile: collapsed filter button + bottom sheet ── */
    return (
        <>
            {/* Filter toggle button */}
            <button
                onClick={onToggle}
                className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium w-full"
                style={{
                    background: open ? 'var(--ff-accent)' : 'var(--ff-surface)',
                    color: open ? 'white' : 'var(--ff-text-primary)',
                    border: '1px solid var(--ff-border)',
                }}
            >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
                {filterCount > 0 && (
                    <span
                        className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                            background: open ? 'rgba(255,255,255,0.2)' : 'var(--ff-accent)',
                            color: 'white',
                        }}
                    >
                        {filterCount}
                    </span>
                )}
            </button>

            {/* Bottom sheet overlay */}
            {open && (
                <>
                    <div className="drawer-backdrop" onClick={onToggle} />
                    <div
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl"
                        style={{
                            background: 'var(--ff-surface)',
                            boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
                            maxHeight: '70vh',
                            overflowY: 'auto',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        }}
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--ff-border)' }} />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3 border-b" style={{ borderColor: 'var(--ff-border)' }}>
                            <h3 className="font-semibold text-base" style={{ color: 'var(--ff-text-primary)' }}>Filters</h3>
                            <button
                                onClick={onToggle}
                                className="p-2 rounded-lg"
                                style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Filter controls (stacked vertically) */}
                        <div className="flex flex-col gap-3 p-5">
                            {children}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
