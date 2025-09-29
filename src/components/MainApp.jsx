import React, { Suspense, useState } from 'react';
import { auth } from '../services/firebase';
import LoadingSpinner from './shared/LoadingSpinner';

// Lazy load feature components
const InventoryManager = React.lazy(() => import('./inventory/InventoryManager'));
const ShoppingCart = React.lazy(() => import('./cart/ShoppingCart'));
const ReportsManager = React.lazy(() => import('./reports/ReportsManager'));

const MainApp = ({ user }) => {
    const [activeTab, setActiveTab] = useState('inventory');

    const tabs = [
        { id: 'inventory', name: 'Inventory', icon: 'inventory_2' },
        { id: 'cart', name: 'Cart', icon: 'shopping_cart' },
        { id: 'reports', name: 'Reports', icon: 'assessment' },
    ];

    const renderTabContent = () => {
        const commonProps = { user };

        switch (activeTab) {
            case 'inventory':
                return <InventoryManager {...commonProps} />;
            case 'cart':
                return <ShoppingCart {...commonProps} />;
            case 'reports':
                return <ReportsManager {...commonProps} />;
            default:
                return <InventoryManager {...commonProps} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <span className="material-icons text-blue-600 mr-2">inventory_2</span>
                            <h1 className="text-xl font-semibold text-gray-900">
                                IT Inventory Management
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                                Welcome, {user.displayName || user.email}
                            </span>
                            <button
                                onClick={() => auth.signOut()}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="material-icons text-sm">{tab.icon}</span>
                                <span>{tab.name}</span>
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
                            <span className="ml-4 text-gray-600">Loading {tabs.find(t => t.id === activeTab)?.name}...</span>
                        </div>
                    }
                >
                    {renderTabContent()}
                </Suspense>
            </main>
        </div>
    );
};

export default MainApp;