import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import LoadingSpinner from '../shared/LoadingSpinner';
import MaterialCard from '../shared/MaterialCard';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';
import MaterialPagination from '../shared/MaterialPagination';

const InventoryManager = ({ user }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('edit'); // 'edit' or 'scan'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [editingItems, setEditingItems] = useState({}); // { itemId: { quantity, price } }
    const [scanInput, setScanInput] = useState('');
    const [recentScans, setRecentScans] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 50,
        totalItems: 0
    });

    // New item form
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        quantity: '',
        category: '',
        asin: ''
    });
    const [isCreatingItem, setIsCreatingItem] = useState(false);

    // Bulk edit
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [bulkValue, setBulkValue] = useState('');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const scanInputRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'items'), orderBy('name'));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const itemsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setItems(itemsData);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching items:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const categories = ['all', ...new Set(items.map(item => item.category || 'Uncategorized').filter(Boolean))];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.asin?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    useEffect(() => {
        setPagination(prev => ({ ...prev, totalItems: filteredItems.length }));
    }, [filteredItems.length]);

    const getPaginatedItems = () => {
        const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
        const endIndex = startIndex + pagination.itemsPerPage;
        return filteredItems.slice(startIndex, endIndex);
    };

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, currentPage: page }));
    };

    const handleItemsPerPageChange = (perPage) => {
        setPagination(prev => ({ ...prev, itemsPerPage: perPage, currentPage: 1 }));
    };

    const handleEditChange = (itemId, field, value) => {
        setEditingItems(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSaveItem = async (itemId) => {
        const edits = editingItems[itemId];
        if (!edits) return;

        try {
            const updates = {};
            if (edits.quantity !== undefined) updates.quantity = parseInt(edits.quantity);
            if (edits.price !== undefined) updates.price = parseFloat(edits.price);
            updates.lastUpdated = serverTimestamp();

            await updateDoc(doc(db, 'items', itemId), updates);

            // Clear editing state for this item
            setEditingItems(prev => {
                const newState = { ...prev };
                delete newState[itemId];
                return newState;
            });
        } catch (error) {
            console.error('Error updating item:', error);
            alert(`Failed to update item: ${error.message}`);
        }
    };

    const handleScan = async () => {
        if (!scanInput.trim()) return;

        try {
            const searchLower = scanInput.toLowerCase().trim();
            const item = items.find(i =>
                i.asin === scanInput ||
                i.id === scanInput ||
                i.name.toLowerCase() === searchLower ||
                i.name.toLowerCase().includes(searchLower)
            );

            if (!item) {
                alert(`Item not found: ${scanInput}`);
                return;
            }

            // Update quantity
            await updateDoc(doc(db, 'items', item.id), {
                quantity: (item.quantity || 0) + 1,
                lastUpdated: serverTimestamp()
            });

            // Add to recent scans
            setRecentScans(prev => [{
                id: Date.now(),
                item: item,
                timestamp: new Date()
            }, ...prev.slice(0, 4)]);

            setScanInput('');
            if (scanInputRef.current) {
                scanInputRef.current.focus();
            }
        } catch (error) {
            console.error('Scan error:', error);
            alert(`Scan failed: ${error.message}`);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && scanInput.trim()) {
            e.preventDefault();
            handleScan();
        }
    };

    const handleCreateItem = async () => {
        if (!newItem.name.trim()) {
            alert('Item name is required');
            return;
        }

        setIsCreatingItem(true);
        try {
            await addDoc(collection(db, 'items'), {
                name: newItem.name.trim(),
                price: newItem.price ? parseFloat(newItem.price) : 0,
                quantity: newItem.quantity ? parseInt(newItem.quantity) : 0,
                category: newItem.category || 'Uncategorized',
                asin: newItem.asin || '',
                minThreshold: 5,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });

            setNewItem({ name: '', price: '', quantity: '', category: '', asin: '' });
            alert('Item created successfully!');
        } catch (error) {
            console.error('Error creating item:', error);
            alert(`Failed to create item: ${error.message}`);
        } finally {
            setIsCreatingItem(false);
        }
    };

    const exportToCSV = () => {
        const csvHeader = 'Item,Current Quantity,New Quantity,Price,ASIN,Category\n';
        const csvData = items.map(item =>
            `"${item.name}",${item.quantity || 0},,${item.price || ''},${item.asin || ''},${item.category || ''}`
        ).join('\n');

        const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const toggleSelectItem = (itemId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === getPaginatedItems().length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(getPaginatedItems().map(item => item.id)));
        }
    };

    const handleBulkAction = async () => {
        if (selectedItems.size === 0) {
            alert('Please select items to perform bulk action');
            return;
        }

        if (!bulkAction) {
            alert('Please select a bulk action');
            return;
        }

        if ((bulkAction === 'setQuantity' || bulkAction === 'setPrice') && !bulkValue) {
            alert('Please enter a value');
            return;
        }

        const confirmMsg = `Are you sure you want to ${bulkAction} for ${selectedItems.size} items?`;
        if (!confirm(confirmMsg)) return;

        setIsBulkProcessing(true);
        try {
            const updates = [];

            for (const itemId of selectedItems) {
                const updateData = { lastUpdated: serverTimestamp() };

                switch (bulkAction) {
                    case 'setQuantity':
                        updateData.quantity = parseInt(bulkValue);
                        break;
                    case 'setPrice':
                        updateData.price = parseFloat(bulkValue);
                        break;
                    case 'setZero':
                        updateData.quantity = 0;
                        break;
                    case 'incrementQuantity':
                        const item = items.find(i => i.id === itemId);
                        updateData.quantity = (item?.quantity || 0) + (parseInt(bulkValue) || 1);
                        break;
                }

                updates.push(updateDoc(doc(db, 'items', itemId), updateData));
            }

            await Promise.all(updates);

            setSelectedItems(new Set());
            setBulkAction('');
            setBulkValue('');
            alert(`Bulk action completed for ${selectedItems.size} items!`);
        } catch (error) {
            console.error('Bulk action error:', error);
            alert(`Bulk action failed: ${error.message}`);
        } finally {
            setIsBulkProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="large" />
                <span className="ml-4 dark:text-gray-300">Loading inventory...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Mode Toggle */}
            <MaterialCard elevation={2}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                            <span className="material-icons mr-2">inventory_2</span>
                            Inventory Management
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {mode === 'edit' ? 'Direct editing and bulk operations' : 'Rapid inventory counting'}
                        </p>
                    </div>
                    <MaterialButton
                        variant="contained"
                        color={mode === 'scan' ? 'success' : 'primary'}
                        onClick={() => setMode(mode === 'edit' ? 'scan' : 'edit')}
                    >
                        <span className="material-icons mr-2">{mode === 'scan' ? 'edit' : 'qr_code_scanner'}</span>
                        Switch to {mode === 'edit' ? 'Scan' : 'Edit'} Mode
                    </MaterialButton>
                </div>

                {mode === 'edit' && (
                    <div className="flex items-center gap-4">
                        <MaterialButton
                            variant="outlined"
                            color="primary"
                            onClick={exportToCSV}
                        >
                            <span className="material-icons mr-2">download</span>
                            Export Template
                        </MaterialButton>
                        <MaterialButton
                            variant="outlined"
                            color="primary"
                        >
                            <span className="material-icons mr-2">upload</span>
                            Import CSV
                        </MaterialButton>
                    </div>
                )}
            </MaterialCard>

            {/* Scan Mode Interface */}
            {mode === 'scan' && (
                <MaterialCard elevation={1}>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                        <span className="material-icons mr-2 text-green-600">qr_code_scanner</span>
                        Barcode Scanner
                    </h3>
                    <div className="flex gap-4 mb-4">
                        <MaterialInput
                            ref={scanInputRef}
                            label="Scan barcode or type item name"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            placeholder="Enter item name, ASIN, or scan barcode..."
                        />
                        <MaterialButton
                            onClick={handleScan}
                            disabled={!scanInput.trim()}
                            variant="contained"
                            color="success"
                            className="!px-8"
                        >
                            <span className="material-icons mr-2">search</span>
                            Scan
                        </MaterialButton>
                    </div>

                    {/* Recent Scans */}
                    {recentScans.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recent Scans</h4>
                            <div className="space-y-2">
                                {recentScans.map((scan) => (
                                    <div key={scan.id} className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">{scan.item.name}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{scan.timestamp.toLocaleTimeString()}</div>
                                        </div>
                                        <span className="text-green-600 dark:text-green-400 font-bold">✨ +1</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </MaterialCard>
            )}

            {/* Edit Mode Interface */}
            {mode === 'edit' && (
                <>
                    {/* Add New Item Form */}
                    <MaterialCard elevation={1}>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                            <span className="material-icons mr-2 text-blue-600">add_box</span>
                            Add New Item
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MaterialInput
                                label="Item Name *"
                                value={newItem.name}
                                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                            />
                            <MaterialInput
                                label="Price"
                                type="number"
                                value={newItem.price}
                                onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                            />
                            <MaterialInput
                                label="Initial Quantity"
                                type="number"
                                value={newItem.quantity}
                                onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                            />
                            <MaterialInput
                                label="ASIN"
                                value={newItem.asin}
                                onChange={(e) => setNewItem({...newItem, asin: e.target.value})}
                            />
                            <select
                                value={newItem.category}
                                onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="">Select Category</option>
                                {categories.filter(c => c !== 'all').map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <MaterialButton
                                onClick={handleCreateItem}
                                disabled={isCreatingItem || !newItem.name.trim()}
                                variant="contained"
                                color="success"
                            >
                                <span className="material-icons mr-2">add</span>
                                {isCreatingItem ? 'Creating...' : 'Create Item'}
                            </MaterialButton>
                        </div>
                    </MaterialCard>

                    {/* Search and Filter */}
                    <MaterialCard elevation={1}>
                        <div className="flex gap-4">
                            <MaterialInput
                                label="Search items"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or ASIN..."
                            />
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                                ))}
                            </select>
                        </div>
                    </MaterialCard>

                    {/* Bulk Edit Actions */}
                    {selectedItems.size > 0 && (
                        <MaterialCard elevation={2} className="!bg-blue-50 dark:!bg-blue-900/20 !border !border-blue-200 dark:!border-blue-800">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                                        <span className="material-icons mr-2 text-blue-600">check_circle</span>
                                        Bulk Actions
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                                    </p>
                                </div>
                                <MaterialButton
                                    onClick={() => setSelectedItems(new Set())}
                                    variant="text"
                                    color="secondary"
                                >
                                    Clear Selection
                                </MaterialButton>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <select
                                    value={bulkAction}
                                    onChange={(e) => setBulkAction(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Action</option>
                                    <option value="setQuantity">Set Quantity</option>
                                    <option value="setPrice">Set Price</option>
                                    <option value="incrementQuantity">Increment Quantity</option>
                                    <option value="setZero">Set All to Zero</option>
                                </select>
                                {(bulkAction === 'setQuantity' || bulkAction === 'setPrice' || bulkAction === 'incrementQuantity') && (
                                    <MaterialInput
                                        label={bulkAction === 'setPrice' ? 'Price' : 'Quantity'}
                                        type="number"
                                        step={bulkAction === 'setPrice' ? '0.01' : '1'}
                                        value={bulkValue}
                                        onChange={(e) => setBulkValue(e.target.value)}
                                    />
                                )}
                                <MaterialButton
                                    onClick={handleBulkAction}
                                    disabled={isBulkProcessing || !bulkAction}
                                    variant="contained"
                                    color="primary"
                                    className="md:col-span-2"
                                >
                                    <span className="material-icons mr-2">done_all</span>
                                    {isBulkProcessing ? 'Processing...' : 'Apply to Selected'}
                                </MaterialButton>
                            </div>
                        </MaterialCard>
                    )}

                    {/* Editable Inventory Table */}
                    <MaterialCard elevation={1}>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.size === getPaginatedItems().length && getPaginatedItems().length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Item</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Quantity</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {getPaginatedItems().map(item => (
                                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedItems.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(item.id)}
                                                    onChange={() => toggleSelectItem(item.id)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                                {item.asin && <div className="text-sm text-gray-500 dark:text-gray-400">{item.asin}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingItems[item.id] ? (
                                                    <input
                                                        type="number"
                                                        value={editingItems[item.id].quantity ?? item.quantity}
                                                        onChange={(e) => handleEditChange(item.id, 'quantity', e.target.value)}
                                                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                ) : (
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                                        item.quantity <= (item.minThreshold || 5)
                                                            ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                                            : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                                    }`}>
                                                        {item.quantity || 0}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingItems[item.id] ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editingItems[item.id].price ?? item.price}
                                                        onChange={(e) => handleEditChange(item.id, 'price', e.target.value)}
                                                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                ) : (
                                                    item.price > 0 ? (
                                                        <span className="text-green-600 dark:text-green-400 font-medium">${item.price}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                                {item.category || 'Uncategorized'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingItems[item.id] ? (
                                                    <div className="flex gap-2">
                                                        <MaterialButton
                                                            onClick={() => handleSaveItem(item.id)}
                                                            variant="text"
                                                            color="success"
                                                            className="!p-2 !min-w-0"
                                                        >
                                                            <span className="material-icons text-sm">save</span>
                                                        </MaterialButton>
                                                        <MaterialButton
                                                            onClick={() => setEditingItems(prev => {
                                                                const newState = {...prev};
                                                                delete newState[item.id];
                                                                return newState;
                                                            })}
                                                            variant="text"
                                                            color="error"
                                                            className="!p-2 !min-w-0"
                                                        >
                                                            <span className="material-icons text-sm">close</span>
                                                        </MaterialButton>
                                                    </div>
                                                ) : (
                                                    <MaterialButton
                                                        onClick={() => setEditingItems(prev => ({
                                                            ...prev,
                                                            [item.id]: { quantity: item.quantity, price: item.price }
                                                        }))}
                                                        variant="text"
                                                        color="primary"
                                                        className="!p-2 !min-w-0"
                                                    >
                                                        <span className="material-icons text-sm">edit</span>
                                                    </MaterialButton>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <MaterialPagination
                            currentPage={pagination.currentPage}
                            totalItems={pagination.totalItems}
                            itemsPerPage={pagination.itemsPerPage}
                            onPageChange={handlePageChange}
                            onItemsPerPageChange={handleItemsPerPageChange}
                        />
                    </MaterialCard>
                </>
            )}
        </div>
    );
};

export default InventoryManager;