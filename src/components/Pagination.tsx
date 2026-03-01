import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
    if (totalPages <= 1) return null;

    // Simple logic to show surrounding pages, first, and last
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }

        return pages;
    };

    return (
        <div className={`flex items-center justify-between px-4 py-3 sm:px-6 rounded-xl border mt-4 ${className}`}
            style={{ background: 'var(--ff-surface)', borderColor: 'var(--ff-border)' }}>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm" style={{ color: 'var(--ff-text-muted)' }}>
                        Showing page <span className="font-medium" style={{ color: 'var(--ff-text-primary)' }}>{currentPage}</span> of{' '}
                        <span className="font-medium" style={{ color: 'var(--ff-text-primary)' }}>{totalPages}</span>
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                            style={{
                                borderColor: 'var(--ff-border)',
                                color: 'var(--ff-text-muted)'
                            }}
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>

                        {getPageNumbers().map((page, idx) => (
                            <button
                                key={idx}
                                onClick={() => typeof page === 'number' ? onPageChange(page) : undefined}
                                disabled={typeof page !== 'number'}
                                className={`relative inline-flex items-center px-3.5 py-2 border text-sm font-medium transition-colors ${page === currentPage
                                        ? 'z-10 bg-accent text-white'
                                        : 'hover:bg-accent/10'
                                    } ${typeof page !== 'number' ? 'cursor-default' : ''}`}
                                style={page === currentPage ? {
                                    borderColor: 'var(--ff-accent)',
                                    background: 'var(--ff-accent)',
                                    color: 'white'
                                } : {
                                    borderColor: 'var(--ff-border)',
                                    color: 'var(--ff-text-primary)'
                                }}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
                            style={{
                                borderColor: 'var(--ff-border)',
                                color: 'var(--ff-text-muted)'
                            }}
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
            {/* Mobile view */}
            <div className="flex items-center justify-between sm:hidden w-full">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium disabled:opacity-50"
                    style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-primary)' }}
                >
                    Previous
                </button>
                <span className="text-sm font-medium" style={{ color: 'var(--ff-text-muted)' }}>
                    {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium disabled:opacity-50"
                    style={{ borderColor: 'var(--ff-border)', color: 'var(--ff-text-primary)' }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
