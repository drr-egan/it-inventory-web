import React from 'react';

const BarcodeScanner = ({ user }) => {
    return (
        <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
            <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center mb-4">
                <span className="material-icons mr-2">qr_code_scanner</span>
                Barcode Scanner
            </h2>
            <p className="text-[var(--md-sys-color-on-surface-variant)]">Scanner functionality coming soon.</p>
        </div>
    );
};

export default BarcodeScanner;