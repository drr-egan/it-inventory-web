import React, { Suspense, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [checkoutHistory, setCheckoutHistory] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('materialYouTheme');
        return saved ? JSON.parse(saved) : true; // Default to dark mode
    });

    // Dark mode theme handler
    useEffect(() => {
        localStorage.setItem('materialYouTheme', JSON.stringify(isDarkMode));

        const root = document.documentElement;

        if (isDarkMode) {
            // Material You Dark Theme with dark blue
            root.classList.add('dark');
            root.style.setProperty('--md-sys-color-primary', '#A6C8FF');
            root.style.setProperty('--md-sys-color-on-primary', '#002E69');
            root.style.setProperty('--md-sys-color-primary-container', '#004494');
            root.style.setProperty('--md-sys-color-on-primary-container', '#D1E4FF');
            root.style.setProperty('--md-sys-color-surface', '#101418');
            root.style.setProperty('--md-sys-color-on-surface', '#E1E2E8');
            root.style.setProperty('--md-sys-color-surface-variant', '#42474E');
            root.style.setProperty('--md-sys-color-on-surface-variant', '#C2C7CF');
            root.style.setProperty('--md-sys-color-surface-container', '#1C2024');
            root.style.setProperty('--md-sys-color-surface-container-high', '#272A2F');
            root.style.setProperty('--md-sys-color-surface-container-highest', '#31353A');
            root.style.setProperty('--md-sys-color-outline', '#8C9199');
            root.style.setProperty('--md-sys-color-outline-variant', '#42474E');
            root.style.setProperty('--md-sys-color-error', '#FFB4AB');
            root.style.setProperty('--md-sys-color-error-container', '#93000A');
            root.style.setProperty('--md-sys-color-warning', '#FFB951');
            root.style.setProperty('--md-sys-color-warning-container', '#7F4F00');
            root.style.setProperty('--md-sys-color-success', '#4DD865');
            root.style.setProperty('--md-sys-color-success-container', '#00390F');
        } else {
            // Material You Light Theme
            root.classList.remove('dark');
            root.style.setProperty('--md-sys-color-primary', '#1B5FBF');
            root.style.setProperty('--md-sys-color-on-primary', '#FFFFFF');
            root.style.setProperty('--md-sys-color-primary-container', '#D1E4FF');
            root.style.setProperty('--md-sys-color-on-primary-container', '#001D35');
            root.style.setProperty('--md-sys-color-surface', '#FCFCFF');
            root.style.setProperty('--md-sys-color-on-surface', '#1A1C1E');
            root.style.setProperty('--md-sys-color-surface-variant', '#E1E2E8');
            root.style.setProperty('--md-sys-color-on-surface-variant', '#42474E');
            root.style.setProperty('--md-sys-color-surface-container', '#F3F4FA');
            root.style.setProperty('--md-sys-color-surface-container-high', '#ECEEF4');
            root.style.setProperty('--md-sys-color-surface-container-highest', '#E6E7ED');
            root.style.setProperty('--md-sys-color-outline', '#73777F');
            root.style.setProperty('--md-sys-color-outline-variant', '#C2C7CF');
            root.style.setProperty('--md-sys-color-error', '#BA1A1A');
            root.style.setProperty('--md-sys-color-error-container', '#FFDAD6');
            root.style.setProperty('--md-sys-color-warning', '#A06500');
            root.style.setProperty('--md-sys-color-warning-container', '#FFDDB3');
            root.style.setProperty('--md-sys-color-success', '#146C2E');
            root.style.setProperty('--md-sys-color-success-container', '#B7F4B7');
        }
    }, [isDarkMode]);

    // Cart management functions
    const addToCart = (item, quantity = 1) => {
        const existingItem = cart.find(c => c.id === item.id);
        if (existingItem) {
            setCart(cart.map(c =>
                c.id === item.id
                    ? { ...c, cartQuantity: c.cartQuantity + quantity }
                    : c
            ));
        } else {
            setCart([...cart, { ...item, cartQuantity: quantity }]);
        }
    };

    const removeFromCart = (itemId) => {
        const existingItem = cart.find(c => c.id === itemId);
        if (existingItem && existingItem.cartQuantity > 1) {
            setCart(cart.map(c =>
                c.id === itemId
                    ? { ...c, cartQuantity: c.cartQuantity - 1 }
                    : c
            ));
        } else {
            setCart(cart.filter(c => c.id !== itemId));
        }
    };

    const clearCart = () => {
        setCart([]);
    };

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    // Load data for count badges
    useEffect(() => {
        const itemsQuery = query(collection(db, 'items'), orderBy('name'));
        const itemsUnsub = onSnapshot(itemsQuery, (snapshot) => {
            const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(itemsData);

            // Generate low stock notifications
            const lowStockItems = itemsData.filter(item =>
                item.quantity <= (item.minThreshold || 5)
            );
            setNotifications(lowStockItems);
        });

        const usersQuery = query(collection(db, 'users'), orderBy('firstName'));
        const usersUnsub = onSnapshot(usersQuery, (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const checkoutQuery = query(collection(db, 'checkoutHistory'), orderBy('dateEntered', 'desc'));
        const checkoutUnsub = onSnapshot(checkoutQuery, (snapshot) => {
            setCheckoutHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            itemsUnsub();
            usersUnsub();
            checkoutUnsub();
        };
    }, []);

    const tabs = [
        { id: 'shop', name: 'Shop', icon: 'storefront', count: cart.length },
        { id: 'scanner', name: 'Scanner', icon: 'qr_code_scanner' },
        { id: 'inventory', name: 'Inventory', icon: 'inventory_2', count: items.length },
        { id: 'users', name: 'Users', icon: 'people', count: users.length },
        { id: 'admin', name: 'Admin', icon: 'admin_panel_settings' },
        { id: 'shipment', name: 'Process Shipment', icon: 'local_shipping' },
        { id: 'history', name: 'History', icon: 'history', count: checkoutHistory.length },
    ];

    const renderTabContent = () => {
        const commonProps = {
            user,
            cart,
            setCart,
            addToCart,
            removeFromCart,
            clearCart,
            items,
            users,
            checkoutHistory,
            notifications
        };

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
        <div className="min-h-screen transition-colors duration-300">
            {/* Top Blue Banner */}
            <div style={{
                background: 'var(--color-primary-blue)',
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--md-elevation-2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: 'white' }}>inventory_2</span>
                    <div>
                        <h1 style={{
                            color: 'white',
                            fontSize: '20px',
                            fontWeight: '500',
                            margin: 0,
                            lineHeight: '1.2'
                        }}>IT Inventory System</h1>
                        <p style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '12px',
                            margin: 0,
                            lineHeight: '1.2'
                        }}>Firebase powered</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--color-success-green)',
                            boxShadow: '0 0 8px var(--color-success-green)'
                        }}></div>
                        <span style={{ color: 'white', fontSize: '14px' }}>{user.email}</span>
                    </div>
                    <button
                        onClick={() => auth.signOut()}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--md-sys-shape-corner-full)',
                            padding: '6px 16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        <span className="material-icons" style={{ fontSize: '18px' }}>logout</span>
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Firebase Connection Status Bar */}
            <div style={{
                background: 'var(--color-success-green)',
                padding: '8px 16px',
                textAlign: 'center',
                color: 'white',
                fontSize: '14px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ fontSize: '16px' }}>cloud_done</span>
                    <span>Firebase Connected - Real-time sync active</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav style={{
                backgroundColor: 'rgba(31, 41, 55, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex space-x-2 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="md-navigation-tab"
                                    style={{
                                        backgroundColor: activeTab === tab.id ? 'var(--color-primary-blue)' : 'transparent',
                                        color: activeTab === tab.id ? 'white' : 'var(--color-text-muted)',
                                        borderRadius: 'var(--md-sys-shape-corner-small)'
                                    }}
                                >
                                    <span className="material-icons">{tab.icon}</span>
                                    <span>{tab.name}</span>
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="count-badge">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 16px',
                            background: 'var(--color-success-green)',
                            color: 'white',
                            borderRadius: 'var(--md-sys-shape-corner-full)',
                            fontSize: '12px',
                            fontWeight: '600'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                background: 'white',
                                borderRadius: '50%',
                                animation: 'md-pulse 2s ease-in-out infinite'
                            }}></div>
                            <span>Connected</span>
                        </div>
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