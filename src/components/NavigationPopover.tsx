import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function NavigationPopover({ label, trigger, children, align = 'left' }: {
    label: string;
    trigger: ReactNode;
    children: (close: () => void) => ReactNode;
    align?: 'left' | 'right';
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const id = useId();
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                button.current?.focus();
            }
        };
        document.addEventListener('pointerdown', outside);
        const element = root.current;
        element?.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            element?.removeEventListener('keydown', escape);
        };
    }, [open]);
    return (
        <div ref={root} className="relative min-w-0" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}>
            <button ref={button} type="button" aria-label={label} title={label}
                aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
                className="flex items-center gap-2 w-full rounded-xl text-left min-h-11 p-2 focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--ff-text-primary)', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                {trigger}
            </button>
            {open && <div id={id} aria-label={label}
                className={`absolute top-full mt-2 z-[60] w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
                style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-border)' }}>
                {children(() => setOpen(false))}
            </div>}
        </div>
    );
}
