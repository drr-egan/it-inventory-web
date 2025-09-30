import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../shared/LoadingSpinner';

const CheckoutHistory = ({ user }) => {
    const [checkoutHistory, setCheckoutHistory] = useState([]);
    const [archivedCheckouts, setArchivedCheckouts] = useState([]);
    const [viewMode, setViewMode] = useState('current'); // 'current' or 'archive'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Load current checkout history
    useEffect(() => {
        const q = query(
            collection(db, 'checkoutHistory'),
            orderBy('dateEntered', 'desc'),
            limit(500)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const history = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCheckoutHistory(history);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching checkout history:', err);
                setError('Failed to load checkout history');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Load archived checkouts
    useEffect(() => {
        const q = query(
            collection(db, 'archivedCheckouts'),
            orderBy('archivedAt', 'desc'),
            limit(500)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const archived = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setArchivedCheckouts(archived);
            },
            (err) => {
                console.error('Error fetching archived checkouts:', err);
            }
        );

        return () => unsubscribe();
    }, []);

    const currentData = viewMode === 'current' ? checkoutHistory : archivedCheckouts;

    // Filter data based on search term
    const filteredData = currentData.filter(record => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            (record.itemName || record.item || '').toLowerCase().includes(search) ||
            (record.userName || record.user || '').toLowerCase().includes(search) ||
            (record.departmentId || record.costCode || '').toLowerCase().includes(search) ||
            (record.quantity?.toString() || '').includes(search)
        );
    });

    const formatDate = (dateField) => {
        if (!dateField) return 'Unknown';
        if (dateField.toDate) return dateField.toDate().toLocaleDateString();
        if (typeof dateField === 'string') return new Date(dateField).toLocaleDateString();
        return 'Unknown';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="large" />
                <span className="ml-4 text-[var(--md-sys-color-on-surface)]">Loading history...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] rounded-md p-4">
                <p className="text-[var(--md-sys-color-on-error-container)]">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Toggle */}
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center">
                                <span className="material-icons mr-2">history</span>
                                Checkout History
                            </h2>
                            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
                                {viewMode === 'current'
                                    ? 'View active checkout records awaiting processing'
                                    : 'View processed and archived checkout records'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('current')}
                            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${
                                viewMode === 'current'
                                    ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] md-elevation-2'
                                    : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]'
                            }`}
                        >
                            <span className="material-icons text-sm">pending_actions</span>
                            Current
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                                {checkoutHistory.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setViewMode('archive')}
                            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${
                                viewMode === 'archive'
                                    ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] md-elevation-2'
                                    : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]'
                            }`}
                        >
                            <span className="material-icons text-sm">inventory</span>
                            Archive
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                                {archivedCheckouts.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Search by item, user, department, or quantity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] rounded-lg border border-[var(--md-sys-color-outline-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)]"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                        >
                            <span className="material-icons text-sm">close</span>
                        </button>
                    )}
                </div>

                {searchTerm && (
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                        Found {filteredData.length} of {currentData.length} records
                    </p>
                )}
            </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg md-elevation-1 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[var(--md-sys-color-surface-container-high)]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    Item
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    Quantity
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    Department
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    Date
                                </th>
                                {viewMode === 'archive' && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                        Archived Date
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={viewMode === 'archive' ? 6 : 5} className="px-6 py-8 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-icons text-4xl text-[var(--md-sys-color-on-surface-variant)]">
                                                inbox
                                            </span>
                                            <p className="text-[var(--md-sys-color-on-surface-variant)]">
                                                {searchTerm
                                                    ? `No records matching "${searchTerm}"`
                                                    : `No ${viewMode === 'archive' ? 'archived' : 'current'} records found`}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map(record => (
                                    <tr key={record.id} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                                        <td className="px-6 py-4 font-medium text-[var(--md-sys-color-on-surface)]">
                                            {record.itemName || record.item}
                                        </td>
                                        <td className="px-6 py-4 text-[var(--md-sys-color-on-surface-variant)]">
                                            {record.userName || record.user}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                                                {record.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                            {record.departmentId || record.costCode || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                            {formatDate(record.dateEntered || record.date)}
                                        </td>
                                        {viewMode === 'archive' && (
                                            <td className="px-6 py-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                                {formatDate(record.archivedAt)}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CheckoutHistory;