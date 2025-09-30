import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../shared/LoadingSpinner';
import MaterialCard from '../shared/MaterialCard';
import MaterialButton from '../shared/MaterialButton';
import MaterialPagination from '../shared/MaterialPagination';
import ShoppingCart from '../cart/ShoppingCart';

const ShopManager = ({ user, cart, addToCart, removeFromCart, clearCart }) => {
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 50,
        totalItems: 0
    });

    useEffect(() => {
        const itemsQuery = query(collection(db, 'items'), orderBy('name'));
        const itemsUnsub = onSnapshot(itemsQuery,
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

        const usersQuery = query(collection(db, 'users'), orderBy('firstName'));
        const usersUnsub = onSnapshot(usersQuery,
            (snapshot) => {
                const usersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsers(usersData);
            },
            (error) => {
                console.error('Error fetching users:', error);
            }
        );

        return () => {
            itemsUnsub();
            usersUnsub();
        };
    }, []);

    const categories = ['all', ...new Set(items.map(item => item.category || 'Uncategorized'))];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory && (item.quantity || 0) > 0;
    });

    // Update pagination total
    useEffect(() => {
        setPagination(prev => ({ ...prev, totalItems: filteredItems.length }));
    }, [filteredItems.length]);

    // Get paginated items
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="large" />
                <span className="ml-4 dark:text-gray-300">Loading shop...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
            {/* Shop Items - 2/3 width on desktop */}
            <div className="xl:col-span-2 space-y-4 lg:space-y-6 order-2 xl:order-1">
                {/* Barcode Scanner */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                            <span className="material-icons text-xl mr-2 text-blue-600">qr_code_scanner</span>
                            <h3 className="text-lg font-medium dark:text-white">Barcode Scanner</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Ready</span>
                        </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Quick add items to cart by scanning barcodes or typing item names
                    </div>
                </div>

                {/* Shop Items Grid */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mb-4">
                        <span className="material-icons mr-2">storefront</span>
                        Shop Items
                    </h2>

                    {/* Search and Filter */}
                    <div className="flex gap-4 mb-6">
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Items Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
                        {getPaginatedItems().map(item => (
                            <MaterialCard key={item.id} elevation={1} className="!p-3 lg:!p-4 hover:mat-elevation-4">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2">
                                        {item.name}
                                    </h3>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        item.quantity <= (item.minThreshold || 5)
                                            ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                            : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                    }`}>
                                        {item.quantity}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                                    <div className="flex items-center">
                                        <span className="material-icons text-xs mr-1">category</span>
                                        {item.category || 'Uncategorized'}
                                    </div>
                                    {item.price > 0 && (
                                        <div className="flex items-center mt-1 text-green-600 dark:text-green-400 font-medium">
                                            <span className="material-icons text-xs mr-1">attach_money</span>
                                            ${item.price}
                                        </div>
                                    )}
                                </div>
                                <MaterialButton
                                    onClick={() => addToCart(item)}
                                    disabled={item.quantity === 0}
                                    variant="contained"
                                    color="primary"
                                    className="w-full !py-2"
                                >
                                    {item.quantity === 0 ? (
                                        <>
                                            <span className="material-icons mr-2 text-sm">block</span>
                                            Out of Stock
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons mr-2 text-sm">add_shopping_cart</span>
                                            Add to Cart
                                        </>
                                    )}
                                </MaterialButton>
                            </MaterialCard>
                        ))}
                    </div>

                    {/* Pagination */}
                    <MaterialPagination
                        currentPage={pagination.currentPage}
                        totalItems={pagination.totalItems}
                        itemsPerPage={pagination.itemsPerPage}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                    />

                    {filteredItems.length === 0 && (
                        <div className="text-center py-8">
                            <span className="material-icons text-4xl text-gray-400 dark:text-gray-500">inbox</span>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">No items found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Shopping Cart - 1/3 width on desktop, sticky */}
            <div className="order-1 xl:order-2">
                <ShoppingCart
                    cart={cart}
                    addToCart={addToCart}
                    removeFromCart={removeFromCart}
                    clearCart={clearCart}
                    users={users}
                    onCheckout={() => {
                        console.log('Checkout completed');
                    }}
                />
            </div>
        </div>
    );
};

export default ShopManager;