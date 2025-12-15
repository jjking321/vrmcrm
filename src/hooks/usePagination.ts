import { useState, useMemo, useCallback, useEffect } from 'react';

export const usePagination = <T>(items: T[], pageSize: number = 100) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  const paginatedItems = useMemo(() => 
    items.slice(startIndex, endIndex), 
    [items, startIndex, endIndex]
  );
  
  // Reset to page 1 when items change significantly (like new filter results)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 1));
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    setCurrentPage: goToPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    startIndex: startIndex + 1,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    goToNextPage,
    goToPrevPage,
    resetPage,
  };
};
