import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], itemsPerPage: number = 10) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

    // Ensure currentPage is always valid
    const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const paginatedItems = useMemo(() => {
        const startIndex = (validCurrentPage - 1) * itemsPerPage;
        return items.slice(startIndex, startIndex + itemsPerPage);
    }, [items, validCurrentPage, itemsPerPage]);

    return {
        currentPage: validCurrentPage,
        totalPages,
        setCurrentPage,
        paginatedItems,
    };
}
