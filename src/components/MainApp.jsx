import React, { Suspense, useState } from 'react';
import { auth } from '../services/firebase';
import LoadingSpinner from './shared/LoadingSpinner';

// Lazy load feature components
const ShopManager = React.lazy(() => import('./shop/ShopManager'));
const BarcodeScanner = React.lazy(() => import('./scanner/BarcodeScanner'));
const InventoryManager = React.lazy(() => import('./inventory/InventoryManager'));
const UsersManager = React.lazy(() => import('./users/UsersManager'));
const AdminPanel = React.lazy(() => import('./admin/AdminPanel'));
const ShipmentProcessor = React.lazy(() => import('./shipment/ShipmentProcessor'));
const CheckoutHistory = React.lazy(() => import('./history/CheckoutHistory'));
const ShoppingCart = React.lazy(() => import('./cart/ShoppingCart'));

const MainApp = ({ user }) => {
    const [activeTab, setActiveTab] = useState('shop');
    const [cart, setCart] = useState([]);

    const tabs = [
        { id: 'shop', name: 'Shop', icon: 'storefront', count: cart.length },
        { id: 'scanner', name: 'Scanner', icon: 'qr_code_scanner' },
        { id: 'inventory', name: 'Inventory', icon: 'inventory_2' },
        { id: 'users', name: 'Users', icon: 'people' },
        { id: 'admin', name: 'Admin', icon: 'admin_panel_settings' },
        { id: 'shipment', name: 'Process Shipment', icon: 'local_shipping' },
        { id: 'history', name: 'History', icon: 'history' },
    ];

    const renderTabContent = () => {
        const commonProps = { user, cart, setCart };

        switch (activeTab) {
            case 'shop':
                return <ShopManager {...commonProps} />;
            case 'scanner':
                return <BarcodeScanner {...commonProps} />;
            case 'inventory':
                return <InventoryManager {...commonProps} />;
            case 'users':
                return <UsersManager {...commonProps} />;
            case 'admin':
                return <AdminPanel {...commonProps} />;
            case 'shipment':
                return <ShipmentProcessor {...commonProps} />;
            case 'history':
                return <CheckoutHistory {...commonProps} />;
            default:
                return <ShopManager {...commonProps} />;
        }
    };

    return (
        <div className="min-h-screen bg-[var(--md-sys-color-surface)]">
            {/* Header */}
            <header className="bg-[var(--md-sys-color-surface-container)] md-elevation-1">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <span className="material-icons text-[var(--md-sys-color-primary)] mr-2">inventory_2</span>
                            <h1 className="text-xl font-semibold text-[var(--md-sys-color-on-surface)]">
                                IT Inventory Management
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                Welcome, {user.displayName || user.email}
                            </span>
                            <button
                                onClick={() => auth.signOut()}
                                className="text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-[var(--md-sys-color-surface-container-high)] md-navigation-bar">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-2 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`md-navigation-tab ${
                                    activeTab === tab.id
                                        ? 'text-[var(--md-sys-color-primary)] border-b-2 border-[var(--md-sys-color-primary)]'
                                        : 'text-[var(--md-sys-color-on-surface-variant)]'
                                }`}
                            >
                                <span className="material-icons">{tab.icon}</span>
                                <span>{tab.name}</span>
                                {tab.count > 0 && (
                                    <span className="md-badge bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)]">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-64">
                            <LoadingSpinner size="large" />
                            <span className="ml-4 text-[var(--md-sys-color-on-surface-variant)]">Loading {tabs.find(t => t.id === activeTab)?.name}...</span>
                        </div>
                    }
                >
                    {renderTabContent()}
                </Suspense>
            </main>

            {/* FAB for quick access to cart */}
            {cart.length > 0 && activeTab !== 'shop' && (
                <button
                    onClick={() => setActiveTab('shop')}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] md-elevation-3 flex items-center justify-center hover:md-elevation-4 transition-all z-50"
                >
                    <span className="material-icons">shopping_cart</span>
                    {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {cart.length}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
};

export default MainApp;