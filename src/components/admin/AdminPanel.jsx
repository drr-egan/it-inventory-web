import React, { useState } from 'react';

const AdminPanel = ({ user }) => {
    const [activeSection, setActiveSection] = useState('overview');

    return (
        <div className="space-y-6">
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center mb-4">
                    <span className="material-icons mr-2">admin_panel_settings</span>
                    Admin Panel
                </h2>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">
                    Administrative tools and bulk operations for inventory management.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                    <span className="material-icons text-[var(--md-sys-color-primary)] text-4xl mb-2">upload_file</span>
                    <h3 className="font-semibold text-[var(--md-sys-color-on-surface)] mb-2">CSV Import</h3>
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-4">Import items from CSV file</p>
                    <button className="md-button primary w-full">
                        <span className="material-icons">upload</span>
                        Import CSV
                    </button>
                </div>

                <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                    <span className="material-icons text-[var(--md-sys-color-secondary)] text-4xl mb-2">download</span>
                    <h3 className="font-semibold text-[var(--md-sys-color-on-surface)] mb-2">CSV Export</h3>
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-4">Export inventory to CSV</p>
                    <button className="md-button secondary w-full">
                        <span className="material-icons">download</span>
                        Export CSV
                    </button>
                </div>

                <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                    <span className="material-icons text-[var(--md-sys-color-tertiary)] text-4xl mb-2">restore</span>
                    <h3 className="font-semibold text-[var(--md-sys-color-on-surface)] mb-2">Reset Inventory</h3>
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-4">Set all quantities to zero</p>
                    <button className="md-button error w-full">
                        <span className="material-icons">restart_alt</span>
                        Reset All
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;