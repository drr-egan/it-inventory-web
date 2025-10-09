import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import LoadingSpinner from '../shared/LoadingSpinner';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';

const CheckoutHistory = ({ user }) => {
    const [checkoutHistory, setCheckoutHistory] = useState([]);
    const [archivedCheckouts, setArchivedCheckouts] = useState([]);
    const [viewMode, setViewMode] = useState('current'); // 'current' or 'archive'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Edit modal state
    const [editCheckoutRecord, setEditCheckoutRecord] = useState(null);
    const [showEditCheckoutModal, setShowEditCheckoutModal] = useState(false);
    const [editRecordSource, setEditRecordSource] = useState('checkoutHistory');

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

    // Format department ID
    const formatDepartmentId = (deptId) => {
        if (!deptId) return '';
        const parts = deptId.split('-');
        if (parts.length >= 3) {
            const [first, second, third] = parts;
            const formattedThird = third.padStart(3, '0');
            return `${first}-${second}-${formattedThird}-5770`;
        }
        return deptId;
    };

    // Edit checkout record functions
    const openEditCheckoutModal = (record, source = 'checkoutHistory') => {
        setEditCheckoutRecord({
            id: record.id,
            itemName: record.itemName,
            userName: record.userName,
            quantity: record.quantity,
            departmentId: record.departmentId || record.costCode || '',
            jobNumber: record.jobNumber || '',
            notes: record.notes || ''
        });
        setEditRecordSource(source);
        setShowEditCheckoutModal(true);
    };

    const closeEditCheckoutModal = () => {
        setEditCheckoutRecord(null);
        setShowEditCheckoutModal(false);
    };

    const saveEditCheckoutRecord = async () => {
        if (!editCheckoutRecord || !editCheckoutRecord.id) return;

        try {
            const collectionName = editRecordSource === 'archivedCheckouts' ? 'archivedCheckouts' : 'checkoutHistory';
            const docRef = doc(db, collectionName, editCheckoutRecord.id);

            await updateDoc(docRef, {
                itemName: editCheckoutRecord.itemName,
                userName: editCheckoutRecord.userName,
                quantity: parseInt(editCheckoutRecord.quantity),
                departmentId: formatDepartmentId(editCheckoutRecord.departmentId),
                jobNumber: editCheckoutRecord.jobNumber,
                notes: editCheckoutRecord.notes,
                lastUpdated: serverTimestamp()
            });

            closeEditCheckoutModal();
            alert('Checkout record updated successfully');
        } catch (error) {
            console.error('Error updating checkout record:', error);
            alert('Failed to update checkout record');
        }
    };

    // Manual archive function
    const manualArchiveRecord = async (record) => {
        if (!confirm(`Archive checkout record for ${record.itemName}?`)) return;

        try {
            const archiveData = {
                ...record,
                archivedAt: serverTimestamp(),
                manuallyArchived: true,
                archivedBy: user?.email || 'unknown'
            };
            delete archiveData.id;

            await setDoc(doc(db, 'archivedCheckouts', record.id), archiveData);
            await deleteDoc(doc(db, 'checkoutHistory', record.id));

            console.log(`Manually archived checkout record for ${record.itemName}`);
        } catch (error) {
            console.error('Error manually archiving record:', error);
            alert('Failed to archive record. Please try again.');
        }
    };

    // Un-archive function
    const unarchiveRecord = async (record) => {
        if (!confirm(`Move ${record.itemName} back to current checkout history?`)) return;

        try {
            const recordData = { ...record };
            delete recordData.archivedAt;
            delete recordData.manuallyArchived;
            delete recordData.shipmentDetails;
            delete recordData.id;

            await setDoc(doc(db, 'checkoutHistory', record.id), recordData);
            await deleteDoc(doc(db, 'archivedCheckouts', record.id));

            console.log(`Unarchived checkout record for ${record.itemName}`);
        } catch (error) {
            console.error('Error unarchiving record:', error);
            alert('Failed to unarchive record. Please try again.');
        }
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] uppercase">
                                    <div className="flex items-center">
                                        <span className="material-icons mr-1 text-sm">settings</span>
                                        Actions
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={viewMode === 'archive' ? 7 : 6} className="px-6 py-8 text-center">
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
                                            <span className="quantity-badge adequate-stock">
                                                {record.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="pill-badge">
                                                {record.departmentId || record.costCode || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                            {formatDate(record.dateEntered || record.date)}
                                        </td>
                                        {viewMode === 'archive' && (
                                            <td className="px-6 py-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                                {formatDate(record.archivedAt)}
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                {viewMode === 'current' ? (
                                                    <>
                                                        <MaterialButton
                                                            variant="text"
                                                            color="primary"
                                                            className="!p-2 !min-w-0"
                                                            onClick={() => openEditCheckoutModal(record)}
                                                        >
                                                            <span className="material-icons text-sm">edit</span>
                                                        </MaterialButton>
                                                        <MaterialButton
                                                            variant="text"
                                                            color="secondary"
                                                            className="!p-2 !min-w-0"
                                                            onClick={() => manualArchiveRecord(record)}
                                                        >
                                                            <span className="material-icons text-sm">archive</span>
                                                        </MaterialButton>
                                                    </>
                                                ) : (
                                                    <>
                                                        <MaterialButton
                                                            variant="text"
                                                            color="primary"
                                                            className="!p-2 !min-w-0"
                                                            onClick={() => openEditCheckoutModal(record, 'archivedCheckouts')}
                                                        >
                                                            <span className="material-icons text-sm">edit</span>
                                                        </MaterialButton>
                                                        <MaterialButton
                                                            variant="text"
                                                            color="secondary"
                                                            className="!p-2 !min-w-0"
                                                            onClick={() => unarchiveRecord(record)}
                                                        >
                                                            <span className="material-icons text-sm">unarchive</span>
                                                        </MaterialButton>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Checkout Record Modal */}
            {showEditCheckoutModal && editCheckoutRecord && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeEditCheckoutModal}>
                    <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 max-w-2xl w-full mx-4 md-elevation-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center">
                                <span className="material-icons mr-2 text-[var(--md-sys-color-primary)]">edit</span>
                                Edit Checkout Record
                            </h2>
                            <button onClick={closeEditCheckoutModal} className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]">
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <MaterialInput
                                label="Item Name"
                                value={editCheckoutRecord.itemName}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, itemName: e.target.value }))}
                                required
                            />

                            <MaterialInput
                                label="User Name"
                                value={editCheckoutRecord.userName}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, userName: e.target.value }))}
                                required
                            />

                            <MaterialInput
                                label="Quantity"
                                type="number"
                                value={editCheckoutRecord.quantity}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, quantity: e.target.value }))}
                                required
                                min="1"
                            />

                            <MaterialInput
                                label="Department ID"
                                value={editCheckoutRecord.departmentId}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, departmentId: e.target.value }))}
                                placeholder="e.g., 2-20-060"
                            />

                            <MaterialInput
                                label="Job Number"
                                value={editCheckoutRecord.jobNumber}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, jobNumber: e.target.value }))}
                                placeholder="Optional job number"
                            />

                            <MaterialInput
                                label="Notes"
                                value={editCheckoutRecord.notes}
                                onChange={(e) => setEditCheckoutRecord(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Optional notes"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <MaterialButton variant="outlined" onClick={closeEditCheckoutModal}>
                                Cancel
                            </MaterialButton>
                            <MaterialButton variant="contained" color="primary" onClick={saveEditCheckoutRecord}>
                                <span className="material-icons mr-2">save</span>
                                Save Changes
                            </MaterialButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutHistory;