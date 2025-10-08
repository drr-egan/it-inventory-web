import React, { useState, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';
import MaterialPagination from '../shared/MaterialPagination';

const UsersManager = ({ users }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Form state
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        costCode: '',
        email: ''
    });

    // Search and filter
    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.costCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Handle form input
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Add new user
    const handleAddUser = async (e) => {
        e.preventDefault();

        if (!formData.firstName || !formData.lastName || !formData.costCode) {
            setUploadStatus('❌ First Name, Last Name, and Cost Code are required');
            return;
        }

        try {
            await addDoc(collection(db, 'users'), {
                ...formData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            setUploadStatus('✅ User added successfully');
            setFormData({ firstName: '', lastName: '', costCode: '', email: '' });
            setShowAddForm(false);
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (error) {
            console.error('Error adding user:', error);
            setUploadStatus(`❌ Error: ${error.message}`);
        }
    };

    // Update user
    const handleUpdateUser = async (e) => {
        e.preventDefault();

        if (!editingUser) return;

        try {
            const userRef = doc(db, 'users', editingUser.id);
            await updateDoc(userRef, {
                ...formData,
                updatedAt: Timestamp.now()
            });

            setUploadStatus('✅ User updated successfully');
            setEditingUser(null);
            setFormData({ firstName: '', lastName: '', costCode: '', email: '' });
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (error) {
            console.error('Error updating user:', error);
            setUploadStatus(`❌ Error: ${error.message}`);
        }
    };

    // Delete user
    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await deleteDoc(doc(db, 'users', userId));
            setUploadStatus('✅ User deleted successfully');
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (error) {
            console.error('Error deleting user:', error);
            setUploadStatus(`❌ Error: ${error.message}`);
        }
    };

    // Start editing
    const startEdit = (user) => {
        setEditingUser(user);
        setFormData({
            firstName: user.firstName,
            lastName: user.lastName,
            costCode: user.costCode,
            email: user.email || ''
        });
        setShowAddForm(true);
    };

    // Cancel edit
    const cancelEdit = () => {
        setEditingUser(null);
        setFormData({ firstName: '', lastName: '', costCode: '', email: '' });
        setShowAddForm(false);
    };

    // CSV Import
    const handleFileChange = (e) => {
        setCsvFile(e.target.files[0]);
        setUploadStatus('');
    };

    const handleCsvUpload = async () => {
        if (!csvFile) {
            setUploadStatus('❌ Please select a CSV file');
            return;
        }

        setUploading(true);
        setUploadStatus('⏳ Uploading and processing CSV...');

        try {
            const text = await csvFile.text();
            const Papa = window.Papa;

            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const data = results.data;
                    let successCount = 0;
                    let errorCount = 0;

                    for (const row of data) {
                        try {
                            // Required fields: FirstName, LastName, CostCode
                            if (!row.FirstName || !row.LastName || !row.CostCode) {
                                errorCount++;
                                continue;
                            }

                            await addDoc(collection(db, 'users'), {
                                firstName: row.FirstName.trim(),
                                lastName: row.LastName.trim(),
                                costCode: row.CostCode.trim(),
                                email: row.Email?.trim() || '',
                                createdAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                            });

                            successCount++;
                        } catch (error) {
                            console.error('Error importing user:', error);
                            errorCount++;
                        }
                    }

                    setUploadStatus(`✅ Import complete: ${successCount} users added, ${errorCount} errors`);
                    setCsvFile(null);
                    setUploading(false);

                    // Clear file input
                    const fileInput = document.getElementById('user-csv-input');
                    if (fileInput) fileInput.value = '';
                },
                error: (error) => {
                    console.error('CSV parse error:', error);
                    setUploadStatus(`❌ Error parsing CSV: ${error.message}`);
                    setUploading(false);
                }
            });
        } catch (error) {
            console.error('Error reading file:', error);
            setUploadStatus(`❌ Error: ${error.message}`);
            setUploading(false);
        }
    };

    // Export users to CSV
    const handleExportCsv = () => {
        if (users.length === 0) {
            setUploadStatus('❌ No users to export');
            return;
        }

        const headers = ['FirstName', 'LastName', 'CostCode', 'Email'];
        const rows = users.map(user => [
            user.firstName,
            user.lastName,
            user.costCode,
            user.email || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        setUploadStatus('✅ Users exported successfully');
        setTimeout(() => setUploadStatus(''), 3000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mat-card p-6">
                <h2 className="text-2xl font-bold flex items-center mb-4" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2">people</span>
                    Users Management
                </h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Manage user database via CSV import or manual entry. Users can be assigned to checkout history.
                </p>
            </div>

            {/* Actions */}
            <div className="mat-card p-6">
                <div className="flex flex-wrap gap-4 mb-4">
                    <MaterialButton
                        color="primary"
                        onClick={() => {
                            setShowAddForm(!showAddForm);
                            if (editingUser) cancelEdit();
                        }}
                    >
                        <span className="material-icons">person_add</span>
                        Add User
                    </MaterialButton>

                    <MaterialButton
                        variant="outlined"
                        onClick={handleExportCsv}
                        disabled={users.length === 0}
                    >
                        <span className="material-icons">download</span>
                        Export CSV
                    </MaterialButton>

                    <div className="flex gap-2 items-center">
                        <input
                            id="user-csv-input"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <label htmlFor="user-csv-input">
                            <MaterialButton
                                variant="outlined"
                                onClick={() => document.getElementById('user-csv-input').click()}
                            >
                                <span className="material-icons">upload_file</span>
                                Select CSV
                            </MaterialButton>
                        </label>
                        {csvFile && (
                            <MaterialButton
                                color="primary"
                                onClick={handleCsvUpload}
                                disabled={uploading}
                            >
                                <span className="material-icons">cloud_upload</span>
                                {uploading ? 'Uploading...' : 'Import CSV'}
                            </MaterialButton>
                        )}
                    </div>
                </div>

                {/* CSV Format Info */}
                <div className="info-box text-sm">
                    <strong>CSV Format:</strong> FirstName, LastName, CostCode, Email (optional)
                    <br />
                    <strong>Example:</strong> John, Doe, 2-20-060-5770, john.doe@example.com
                </div>

                {/* Status Message */}
                {uploadStatus && (
                    <div className={`mt-4 p-3 rounded-lg ${
                        uploadStatus.includes('✅') ? 'success-box' :
                        uploadStatus.includes('⏳') ? 'info-box' :
                        'error-box'
                    }`}>
                        {uploadStatus}
                    </div>
                )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="mat-card p-6">
                    <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-light)' }}>
                        {editingUser ? 'Edit User' : 'Add New User'}
                    </h3>
                    <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MaterialInput
                                label="First Name *"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                required
                            />
                            <MaterialInput
                                label="Last Name *"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                required
                            />
                            <MaterialInput
                                label="Cost Code *"
                                name="costCode"
                                value={formData.costCode}
                                onChange={handleInputChange}
                                placeholder="e.g., 2-20-060-5770"
                                required
                            />
                            <MaterialInput
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="flex gap-3">
                            <MaterialButton type="submit" color="primary">
                                <span className="material-icons">save</span>
                                {editingUser ? 'Update User' : 'Add User'}
                            </MaterialButton>
                            <MaterialButton type="button" variant="outlined" onClick={cancelEdit}>
                                <span className="material-icons">cancel</span>
                                Cancel
                            </MaterialButton>
                        </div>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="mat-card p-6">
                <MaterialInput
                    label="Search Users"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                    placeholder="Search by name, cost code, or email..."
                >
                    <span className="material-icons" style={{ position: 'absolute', right: '12px', top: '16px', color: 'var(--color-text-muted)' }}>
                        search
                    </span>
                </MaterialInput>
            </div>

            {/* Users Table */}
            <div className="mat-card p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-light)' }}>
                        Users ({filteredUsers.length})
                    </h3>
                </div>

                {paginatedUsers.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="material-icons text-6xl mb-4 opacity-50">people_outline</span>
                        <p>No users found</p>
                        <p className="text-sm">Add users manually or import from CSV</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-[var(--md-sys-color-outline-variant)]">
                                        <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Name</th>
                                        <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Cost Code</th>
                                        <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Email</th>
                                        <th className="text-right p-3" style={{ color: 'var(--color-text-light)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map((user) => (
                                        <tr key={user.id} className="border-b border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                                            <td className="p-3" style={{ color: 'var(--color-text-light)' }}>
                                                {user.firstName} {user.lastName}
                                            </td>
                                            <td className="p-3">
                                                <span className="pill-badge">
                                                    {user.costCode}
                                                </span>
                                            </td>
                                            <td className="p-3" style={{ color: 'var(--color-text-muted)' }}>
                                                {user.email || '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => startEdit(user)}
                                                        className="p-2 rounded hover:bg-blue-500/20 transition-colors"
                                                        style={{ color: 'var(--color-primary-blue)' }}
                                                        title="Edit user"
                                                    >
                                                        <span className="material-icons text-sm">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-2 rounded hover:bg-red-500/20 transition-colors"
                                                        style={{ color: 'var(--color-error-red)' }}
                                                        title="Delete user"
                                                    >
                                                        <span className="material-icons text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-6">
                                <MaterialPagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default UsersManager;
