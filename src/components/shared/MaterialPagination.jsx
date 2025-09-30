import React from 'react';
import MaterialButton from './MaterialButton';

const MaterialPagination = ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    className = ''
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getVisiblePages = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];

        for (let i = Math.max(2, currentPage - delta);
             i <= Math.min(totalPages - 1, currentPage + delta);
             i++) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            rangeWithDots.push(1, '...');
        } else {
            rangeWithDots.push(1);
        }

        rangeWithDots.push(...range);

        if (currentPage + delta < totalPages - 1) {
            rangeWithDots.push('...', totalPages);
        } else {
            rangeWithDots.push(totalPages);
        }

        return rangeWithDots.filter((v, i, a) => a.indexOf(v) === i);
    };

    if (totalPages <= 1) return null;

    return (
        <div className={`flex items-center justify-between flex-wrap gap-4 mt-6 ${className}`}>
            <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {startItem}-{endItem} of {totalItems} items
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Items per page:
                    </span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <MaterialButton
                    variant="text"
                    color="primary"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="!p-2 !min-w-0"
                >
                    <span className="material-icons">chevron_left</span>
                </MaterialButton>

                {getVisiblePages().map((page, index) => (
                    page === '...' ? (
                        <span key={`dots-${index}`} className="px-2 text-gray-400 dark:text-gray-500">...</span>
                    ) : (
                        <MaterialButton
                            key={page}
                            variant={currentPage === page ? "contained" : "text"}
                            color="primary"
                            onClick={() => onPageChange(page)}
                            className="!p-2 !min-w-[40px] !w-10 !h-10"
                        >
                            {page}
                        </MaterialButton>
                    )
                ))}

                <MaterialButton
                    variant="text"
                    color="primary"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="!p-2 !min-w-0"
                >
                    <span className="material-icons">chevron_right</span>
                </MaterialButton>
            </div>
        </div>
    );
};

export default MaterialPagination;