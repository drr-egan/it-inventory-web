import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, doc, addDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import MaterialCard from '../shared/MaterialCard';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';

const AdminPanel = ({ user, items, users, checkoutHistory, notifications }) => {
    // Form states
    const [newItemForm, setNewItemForm] = useState({
        name: '',
        category: '',
        quantity: '',
        price: '',
        minThreshold: '5'
    });
    const [newUserForm, setNewUserForm] = useState({
        firstName: '',
        lastName: '',
        costCode: '',
        department: ''
    });

    // Operation states
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [csvOperations, setCsvOperations] = useState({
        importingItems: false,
        importingUsers: false,
        exportingItems: false,
        exportingUsers: false
    });

    // Create new item
    const handleCreateItem = async (e) => {
        e.preventDefault();
        setIsCreatingItem(true);

        try {
            const itemData = {
                name: newItemForm.name.trim(),
                category: newItemForm.category || 'Uncategorized',
                quantity: parseInt(newItemForm.quantity) || 0,
                price: parseFloat(newItemForm.price) || 0,
                minThreshold: parseInt(newItemForm.minThreshold) || 5,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                createdBy: user?.employeeID || user?.email || 'admin'
            };

            await addDoc(collection(db, 'items'), itemData);

            setNewItemForm({
                name: '',
                category: '',
                quantity: '',
                price: '',
                minThreshold: '5'
            });

            alert(`Item "${itemData.name}" created successfully!`);
        } catch (error) {
            console.error('Error creating item:', error);
            alert(`Failed to create item: ${error.message}`);
        } finally {
            setIsCreatingItem(false);
        }
    };

    // Create new user
    const handleCreateUser = async (e) => {
        e.preventDefault();
        setIsCreatingUser(true);

        try {
            const userData = {
                firstName: newUserForm.firstName.trim(),
                lastName: newUserForm.lastName.trim(),
                name: `${newUserForm.firstName.trim()} ${newUserForm.lastName.trim()}`,
                costCode: newUserForm.costCode || `${Date.now()}-${Math.floor(Math.random() * 1000)}-5770`,
                department: newUserForm.department || 'General',
                status: 'active',
                createdAt: serverTimestamp(),
                createdBy: user?.employeeID || user?.email || 'admin'
            };

            await addDoc(collection(db, 'users'), userData);

            setNewUserForm({
                firstName: '',
                lastName: '',
                costCode: '',
                department: ''
            });

            alert(`User "${userData.name}" created successfully!`);
        } catch (error) {
            console.error('Error creating user:', error);
            alert(`Failed to create user: ${error.message}`);
        } finally {
            setIsCreatingUser(false);
        }
    };

    // Export Items to CSV
    const exportItemsToCSV = async () => {
        setCsvOperations(prev => ({ ...prev, exportingItems: true }));

        try {
            const headers = ['Item Name', 'Category', 'Quantity', 'Price', 'ASIN', 'Min Threshold'];
            const csvRows = [headers.join(',')];

            items.forEach(item => {
                const row = [
                    `"${item.name || ''}"`,
                    `"${item.category || 'Uncategorized'}"`,
                    item.quantity || 0,
                    item.price || 0,
                    `"${item.asin || ''}"`,
                    item.minThreshold || 5
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `inventory-items-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            alert(`Exported ${items.length} items to CSV`);
        } catch (error) {
            alert(`Export failed: ${error.message}`);
        } finally {
            setCsvOperations(prev => ({ ...prev, exportingItems: false }));
        }
    };

    // Export Users to CSV
    const exportUsersToCSV = async () => {
        setCsvOperations(prev => ({ ...prev, exportingUsers: true }));

        try {
            const headers = ['EmployeeID', 'First Name', 'Last Name', 'Cost Code', 'Department', 'Status'];
            const csvRows = [headers.join(',')];

            users.forEach(user => {
                const row = [
                    `"${user.employeeID || ''}"`,
                    `"${user.firstName || ''}"`,
                    `"${user.lastName || ''}"`,
                    `"${user.costCode || user.cost_code || ''}"`,
                    `"${user.department || ''}"`,
                    `"${user.status || 'active'}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `inventory-users-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            alert(`Exported ${users.length} users to CSV`);
        } catch (error) {
            alert(`Export failed: ${error.message}`);
        } finally {
            setCsvOperations(prev => ({ ...prev, exportingUsers: false }));
        }
    };

    // Import Items from CSV
    const handleItemsImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setCsvOperations(prev => ({ ...prev, importingItems: true }));
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

                let successCount = 0;
                let errorCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;

                    try {
                        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
                        const item = {};

                        headers.forEach((header, index) => {
                            switch(header.toLowerCase()) {
                                case 'item name':
                                case 'name':
                                    item.name = values[index];
                                    break;
                                case 'category':
                                    item.category = values[index] || 'Uncategorized';
                                    break;
                                case 'quantity':
                                    item.quantity = parseInt(values[index]) || 0;
                                    break;
                                case 'price':
                                    item.price = parseFloat(values[index]) || 0;
                                    break;
                                case 'min threshold':
                                    item.minThreshold = parseInt(values[index]) || 5;
                                    break;
                                case 'asin':
                                    item.asin = values[index];
                                    break;
                            }
                        });

                        if (!item.name) {
                            errorCount++;
                            continue;
                        }

                        item.createdAt = serverTimestamp();
                        item.lastUpdated = serverTimestamp();
                        item.createdBy = user?.employeeID || user?.email || 'csv-import';

                        await addDoc(collection(db, 'items'), item);
                        successCount++;
                    } catch (itemError) {
                        errorCount++;
                        console.error('Error importing item:', itemError);
                    }
                }

                alert(`Import completed: ${successCount} items added, ${errorCount} errors`);
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            } finally {
                setCsvOperations(prev => ({ ...prev, importingItems: false }));
                event.target.value = ''; // Reset file input
            }
        };

        reader.readAsText(file);
    };

    // Import Users from CSV
    const handleUsersImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setCsvOperations(prev => ({ ...prev, importingUsers: true }));
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

                let successCount = 0;
                let errorCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;

                    try {
                        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
                        const userData = {};

                        headers.forEach((header, index) => {
                            switch(header.toLowerCase()) {
                                case 'employeeid':
                                case 'employee id':
                                case 'employee_id':
                                    userData.employeeID = values[index];
                                    break;
                                case 'first name':
                                case 'firstname':
                                    userData.firstName = values[index];
                                    break;
                                case 'last name':
                                case 'lastname':
                                    userData.lastName = values[index];
                                    break;
                                case 'cost code':
                                case 'costcode':
                                    userData.costCode = values[index];
                                    break;
                                case 'department':
                                    userData.department = values[index];
                                    break;
                            }
                        });

                        if (!userData.firstName || !userData.lastName) {
                            errorCount++;
                            continue;
                        }

                        // Check if user already exists by employeeID or by name if no employeeID
                        let existingUser = null;
                        if (userData.employeeID) {
                            existingUser = users.find(u => u.employeeID === userData.employeeID);
                        } else {
                            // For users without employeeID, match by firstName + lastName
                            existingUser = users.find(u =>
                                !u.employeeID &&
                                u.firstName === userData.firstName &&
                                u.lastName === userData.lastName
                            );
                        }

                        userData.name = `${userData.firstName} ${userData.lastName}`;
                        userData.status = 'active';
                        userData.costCode = userData.costCode || `${Date.now()}-${Math.floor(Math.random() * 1000)}-5770`;

                        if (existingUser) {
                            // Update existing user if data is different
                            const hasChanges = (
                                existingUser.firstName !== userData.firstName ||
                                existingUser.lastName !== userData.lastName ||
                                existingUser.costCode !== userData.costCode ||
                                existingUser.department !== userData.department ||
                                existingUser.employeeID !== userData.employeeID
                            );

                            if (hasChanges) {
                                const userRef = doc(db, 'users', existingUser.id);
                                await updateDoc(userRef, {
                                    ...userData,
                                    updatedAt: serverTimestamp(),
                                    updatedBy: user?.employeeID || user?.email || 'csv-import'
                                });
                                successCount++;
                            } else {
                                // No changes needed, skip
                                continue;
                            }
                        } else {
                            // Create new user
                            userData.createdAt = serverTimestamp();
                            userData.createdBy = user?.employeeID || user?.email || 'csv-import';
                            await addDoc(collection(db, 'users'), userData);
                            successCount++;
                        }
                    } catch (userError) {
                        errorCount++;
                        console.error('Error importing user:', userError);
                    }
                }

                alert(`Import completed: ${successCount} users added, ${errorCount} errors`);
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            } finally {
                setCsvOperations(prev => ({ ...prev, importingUsers: false }));
                event.target.value = ''; // Reset file input
            }
        };

        reader.readAsText(file);
    };

    // Reset all quantities to zero
    const handleResetAllQuantities = async () => {
        if (!confirm('Are you sure you want to reset ALL item quantities to zero? This cannot be undone.')) {
            return;
        }

        try {
            const batch = writeBatch(db);
            items.forEach(item => {
                const itemRef = doc(db, 'items', item.id);
                batch.update(itemRef, {
                    quantity: 0,
                    lastUpdated: serverTimestamp()
                });
            });

            await batch.commit();
            alert(`Reset quantities for ${items.length} items`);
        } catch (error) {
            alert(`Bulk reset failed: ${error.message}`);
        }
    };

    // Remove duplicate users based on multiple criteria
    const handleRemoveDuplicateUsers = async () => {
        if (!confirm('Are you sure you want to remove duplicate users? This will analyze duplicates by employeeID, name, and other criteria, keeping the most complete/recent version of each unique user.')) {
            return;
        }

        try {
            const duplicates = [];
            const keepUsers = new Set();

            // First pass: Group by employeeID (highest priority)
            const employeeIdMap = new Map();
            users.forEach(user => {
                if (user.employeeID) {
                    if (!employeeIdMap.has(user.employeeID)) {
                        employeeIdMap.set(user.employeeID, []);
                    }
                    employeeIdMap.get(user.employeeID).push(user);
                }
            });

            // Process employeeID groups
            employeeIdMap.forEach((userList, employeeID) => {
                if (userList.length > 1) {
                    // Sort by completeness and recency
                    const sorted = userList.sort((a, b) => {
                        // Prefer users with more complete data
                        const aComplete = (a.firstName ? 1 : 0) + (a.lastName ? 1 : 0) + (a.costCode ? 1 : 0) + (a.department ? 1 : 0);
                        const bComplete = (b.firstName ? 1 : 0) + (b.lastName ? 1 : 0) + (b.costCode ? 1 : 0) + (b.department ? 1 : 0);

                        if (aComplete !== bComplete) return bComplete - aComplete;

                        // Then by recency
                        const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                        const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                        return dateB - dateA;
                    });

                    keepUsers.add(sorted[0].id);
                    duplicates.push(...sorted.slice(1));
                } else {
                    keepUsers.add(userList[0].id);
                }
            });

            // Second pass: Group remaining users (without employeeID) by normalized name
            const nameMap = new Map();
            users.forEach(user => {
                if (!user.employeeID && !keepUsers.has(user.id)) {
                    const normalizedName = `${user.firstName?.toLowerCase().trim()}_${user.lastName?.toLowerCase().trim()}`;
                    if (!nameMap.has(normalizedName)) {
                        nameMap.set(normalizedName, []);
                    }
                    nameMap.get(normalizedName).push(user);
                }
            });

            // Process name groups
            nameMap.forEach((userList, normalizedName) => {
                if (userList.length > 1) {
                    // Sort by completeness and recency
                    const sorted = userList.sort((a, b) => {
                        // Prefer users with more complete data
                        const aComplete = (a.costCode ? 1 : 0) + (a.department ? 1 : 0);
                        const bComplete = (b.costCode ? 1 : 0) + (b.department ? 1 : 0);

                        if (aComplete !== bComplete) return bComplete - aComplete;

                        // Then by recency
                        const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                        const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                        return dateB - dateA;
                    });

                    keepUsers.add(sorted[0].id);
                    duplicates.push(...sorted.slice(1));
                } else if (userList.length === 1) {
                    keepUsers.add(userList[0].id);
                }
            });

            if (duplicates.length === 0) {
                alert('No duplicate users found.');
                return;
            }

            // Show summary before deletion
            const summary = duplicates.reduce((acc, user) => {
                if (user.employeeID) {
                    acc.byEmployeeId++;
                } else {
                    acc.byName++;
                }
                return acc;
            }, { byEmployeeId: 0, byName: 0 });

            const confirmMessage = `Found ${duplicates.length} duplicate users:\n` +
                `- ${summary.byEmployeeId} duplicates by Employee ID\n` +
                `- ${summary.byName} duplicates by name\n\n` +
                `This will keep ${keepUsers.size} unique users. Continue?`;

            if (!confirm(confirmMessage)) {
                return;
            }

            // Delete duplicates in batches
            const batchSize = 100;
            for (let i = 0; i < duplicates.length; i += batchSize) {
                const batch = writeBatch(db);
                const batchDuplicates = duplicates.slice(i, i + batchSize);

                batchDuplicates.forEach(user => {
                    const userRef = doc(db, 'users', user.id);
                    batch.delete(userRef);
                });

                await batch.commit();
            }

            alert(`Successfully removed ${duplicates.length} duplicate users. ${keepUsers.size} unique users remain.`);
        } catch (error) {
            alert(`Failed to remove duplicates: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center mb-2">
                    <span className="material-icons mr-2">admin_panel_settings</span>
                    Administration
                </h2>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    Administrative tools, data management, and bulk operations
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Add New Item */}
                <MaterialCard elevation={2}>
                    <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center">
                        <span className="material-icons mr-2 text-blue-600">add_box</span>
                        Add New Item
                    </h3>
                    <form onSubmit={handleCreateItem} className="space-y-4">
                        <MaterialInput
                            label="Item Name"
                            value={newItemForm.name}
                            onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <MaterialInput
                                label="Price"
                                type="number"
                                step="0.01"
                                value={newItemForm.price}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, price: e.target.value }))}
                                placeholder="0.00"
                            />
                            <MaterialInput
                                label="Quantity"
                                type="number"
                                value={newItemForm.quantity}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div className="mat-input">
                            <select
                                value={newItemForm.category}
                                onChange={(e) => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3 py-2 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] rounded-lg border border-[var(--md-sys-color-outline-variant)]"
                            >
                                <option value="">Choose category...</option>
                                <option value="Electronics">Electronics</option>
                                <option value="Accessories">Accessories</option>
                                <option value="Cables">Cables</option>
                                <option value="Office">Office</option>
                                <option value="Hardware">Hardware</option>
                                <option value="Software">Software</option>
                                <option value="Supplies">Supplies</option>
                            </select>
                            <label className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Category</label>
                        </div>
                        <MaterialButton
                            type="submit"
                            variant="contained"
                            color="primary"
                            className="w-full"
                            disabled={isCreatingItem}
                        >
                            {isCreatingItem ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons mr-2">add</span>
                                    Create Item
                                </>
                            )}
                        </MaterialButton>
                    </form>
                </MaterialCard>

                {/* Add New User */}
                <MaterialCard elevation={2}>
                    <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center">
                        <span className="material-icons mr-2 text-green-600">person_add</span>
                        Add New User
                    </h3>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <MaterialInput
                                label="First Name"
                                value={newUserForm.firstName}
                                onChange={(e) => setNewUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                                required
                            />
                            <MaterialInput
                                label="Last Name"
                                value={newUserForm.lastName}
                                onChange={(e) => setNewUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                                required
                            />
                        </div>
                        <MaterialInput
                            label="Cost Code"
                            value={newUserForm.costCode}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, costCode: e.target.value }))}
                            placeholder="e.g., 1-10-100-5770 (auto-generated if empty)"
                        />
                        <MaterialInput
                            label="Department"
                            value={newUserForm.department}
                            onChange={(e) => setNewUserForm(prev => ({ ...prev, department: e.target.value }))}
                            placeholder="e.g., IT, Finance, Operations"
                        />
                        <MaterialButton
                            type="submit"
                            variant="contained"
                            color="success"
                            className="w-full"
                            disabled={isCreatingUser}
                        >
                            {isCreatingUser ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons mr-2">person_add</span>
                                    Create User
                                </>
                            )}
                        </MaterialButton>
                    </form>
                </MaterialCard>

                {/* CSV Import/Export */}
                <MaterialCard elevation={2}>
                    <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center">
                        <span className="material-icons mr-2 text-purple-600">import_export</span>
                        CSV Import/Export
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium text-[var(--md-sys-color-on-surface)] mb-2">Import Data</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleItemsImport}
                                        className="hidden"
                                        id="items-csv-import"
                                    />
                                    <MaterialButton
                                        onClick={() => document.getElementById('items-csv-import').click()}
                                        variant="outlined"
                                        color="primary"
                                        className="w-full"
                                        disabled={csvOperations.importingItems}
                                    >
                                        {csvOperations.importingItems ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons mr-2">upload_file</span>
                                                Import Items
                                            </>
                                        )}
                                    </MaterialButton>
                                </div>
                                <div>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleUsersImport}
                                        className="hidden"
                                        id="users-csv-import"
                                    />
                                    <MaterialButton
                                        onClick={() => document.getElementById('users-csv-import').click()}
                                        variant="outlined"
                                        color="primary"
                                        className="w-full"
                                        disabled={csvOperations.importingUsers}
                                    >
                                        {csvOperations.importingUsers ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons mr-2">upload_file</span>
                                                Import Users
                                            </>
                                        )}
                                    </MaterialButton>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-[var(--md-sys-color-outline-variant)] pt-4">
                            <h4 className="font-medium text-[var(--md-sys-color-on-surface)] mb-2">Export Data</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <MaterialButton
                                    onClick={exportItemsToCSV}
                                    variant="outlined"
                                    color="secondary"
                                    className="w-full"
                                    disabled={csvOperations.exportingItems}
                                >
                                    {csvOperations.exportingItems ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons mr-2">download</span>
                                            Export Items ({items?.length || 0})
                                        </>
                                    )}
                                </MaterialButton>
                                <MaterialButton
                                    onClick={exportUsersToCSV}
                                    variant="outlined"
                                    color="secondary"
                                    className="w-full"
                                    disabled={csvOperations.exportingUsers}
                                >
                                    {csvOperations.exportingUsers ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons mr-2">download</span>
                                            Export Users ({users?.length || 0})
                                        </>
                                    )}
                                </MaterialButton>
                            </div>
                        </div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="font-medium mb-1">📋 CSV Format Tips:</p>
                            <p><strong>Items:</strong> Item Name, Category, Quantity, Price, ASIN, Min Threshold</p>
                            <p><strong>Users:</strong> EmployeeID, First Name, Last Name, Cost Code, Department</p>
                        </div>
                    </div>
                </MaterialCard>

                {/* Bulk Operations */}
                <MaterialCard elevation={2}>
                    <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center">
                        <span className="material-icons mr-2 text-orange-600">batch_prediction</span>
                        Bulk Operations
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium text-[var(--md-sys-color-on-surface)] mb-2">Inventory Management</h4>
                            <div className="space-y-3">
                                <MaterialButton
                                    onClick={exportItemsToCSV}
                                    variant="outlined"
                                    color="primary"
                                    className="w-full"
                                >
                                    <span className="material-icons mr-2">edit</span>
                                    Bulk Edit via CSV Export/Import
                                </MaterialButton>
                                <MaterialButton
                                    onClick={() => alert('Price bulk update: Export CSV, edit prices, then import back')}
                                    variant="outlined"
                                    color="primary"
                                    className="w-full"
                                >
                                    <span className="material-icons mr-2">attach_money</span>
                                    Update Prices via CSV
                                </MaterialButton>
                                <MaterialButton
                                    onClick={handleResetAllQuantities}
                                    variant="outlined"
                                    color="error"
                                    className="w-full"
                                >
                                    <span className="material-icons mr-2">restore</span>
                                    Reset All Quantities to Zero
                                </MaterialButton>
                                <MaterialButton
                                    onClick={handleRemoveDuplicateUsers}
                                    variant="outlined"
                                    color="warning"
                                    className="w-full"
                                >
                                    <span className="material-icons mr-2">cleaning_services</span>
                                    Remove Duplicate Users
                                </MaterialButton>
                            </div>
                        </div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <p className="font-medium mb-1">⚠️ Bulk Operations:</p>
                            <p><strong>Edit/Prices:</strong> Use CSV export → edit → import workflow</p>
                            <p><strong>Reset:</strong> Sets ALL item quantities to zero (permanent!)</p>
                            <p><strong>Duplicates:</strong> Removes duplicate users by employeeID (keeps most recent)</p>
                        </div>
                    </div>
                </MaterialCard>

                {/* System Stats */}
                <MaterialCard elevation={2} className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center">
                        <span className="material-icons mr-2 text-indigo-600">analytics</span>
                        System Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{items?.length || 0}</div>
                            <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Total Items</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{users?.length || 0}+</div>
                            <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Active Users</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{checkoutHistory?.length || 0}</div>
                            <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Recent Checkouts</div>
                        </div>
                        <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{notifications?.length || 0}</div>
                            <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Low Stock Alerts</div>
                        </div>
                    </div>
                </MaterialCard>
            </div>
        </div>
    );
};

export default AdminPanel;