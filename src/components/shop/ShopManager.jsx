import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../shared/LoadingSpinner';

const ShopManager = ({ user, cart, setCart }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

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

    const categories = ['all', ...new Set(items.map(item => item.category || 'Uncategorized'))];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory && (item.quantity || 0) > 0;
    });

    const addToCart = (item) => {
        const existingItem = cart.find(c => c.id === item.id);
        if (existingItem) {
            setCart(cart.map(c => c.id === item.id ? { ...c, cartQuantity: c.cartQuantity + 1 } : c));
        } else {
            setCart([...cart, { ...item, cartQuantity: 1 }]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="large" />
                <span className="ml-4">Loading shop...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-6 md-elevation-1">
                <h2 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center mb-4">
                    <span className="material-icons mr-2">storefront</span>
                    Shop
                </h2>

                {/* Search and Filter */}
                <div className="flex gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-4 py-2 border border-[var(--md-sys-color-outline)] rounded-lg bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2 border border-[var(--md-sys-color-outline)] rounded-lg bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(item => (
                    <div key={item.id} className="bg-[var(--md-sys-color-surface-container)] rounded-lg p-4 md-elevation-1 hover:md-elevation-2 transition-all">
                        <h3 className="font-semibold text-[var(--md-sys-color-on-surface)] mb-2">{item.name}</h3>
                        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-2">{item.category || 'Uncategorized'}</p>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                    Stock: <span className={item.quantity <= (item.minThreshold || 0) ? 'text-[var(--md-sys-color-error)]' : 'text-[var(--md-sys-color-success)]'}>
                                        {item.quantity}
                                    </span>
                                </p>
                                {item.price > 0 && (
                                    <p className="text-lg font-bold text-[var(--md-sys-color-primary)]">${Number(item.price).toFixed(2)}</p>
                                )}
                            </div>
                            <button
                                onClick={() => addToCart(item)}
                                className="md-button primary"
                            >
                                <span className="material-icons">add_shopping_cart</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-8">
                    <span className="material-icons text-4xl text-[var(--md-sys-color-on-surface-variant)]">inbox</span>
                    <p className="text-[var(--md-sys-color-on-surface-variant)] mt-2">No items found</p>
                </div>
            )}
        </div>
    );
};

export default ShopManager;