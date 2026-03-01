import { Search, X } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: SearchInputProps) {
    return (
        <div className={`relative ${className}`}>
            <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                style={{ color: 'var(--ff-text-muted)' }}
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-9 py-2 rounded-lg text-sm bg-surface border border-border focus:ring-2 focus:ring-accent/50 outline-none transition-all"
                style={{
                    background: 'var(--ff-surface)',
                    color: 'var(--ff-text-primary)',
                    border: '1px solid var(--ff-border)'
                }}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-accent transition-colors"
                    style={{ color: 'var(--ff-text-muted)' }}
                    title="Clear search"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
