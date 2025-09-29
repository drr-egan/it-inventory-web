import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import LoadingSpinner from '../shared/LoadingSpinner';

const InventoryManager = ({ user }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Set up real-time listener for inventory items
        const q = query(collection(db, 'items'), limit(50));

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
                setError('Failed to load inventory items');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="large" />
                <span className="ml-4 text-gray-600">Loading inventory...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                    <span className="material-icons text-red-500 mr-2">error</span>
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                            <span className="material-icons mr-2">inventory_2</span>
                            Inventory Management
                        </h2>
                        <p className="text-gray-600">
                            Manage your IT inventory items
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{items.length}</p>
                        <p className="text-sm text-gray-500">Total Items</p>
                    </div>
                </div>
            </div>

            {/* Items List */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Current Inventory</h3>
                </div>
                <div className="p-6">
                    {items.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-icons text-gray-400 text-4xl mb-4">inbox</span>
                            <p className="text-gray-500">No items found in inventory</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => (
                                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900 truncate">
                                                {item.name || 'Unnamed Item'}
                                            </h4>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {item.category || 'Uncategorized'}
                                            </p>
                                        </div>
                                        <div className="ml-4 text-right">
                                            <p className={`text-sm font-medium ${
                                                (item.quantity || 0) <= (item.minThreshold || 0)
                                                    ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                                {item.quantity || 0} in stock
                                            </p>
                                            {item.price && (
                                                <p className="text-sm text-green-600 font-medium">
                                                    ${Number(item.price).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryManager;