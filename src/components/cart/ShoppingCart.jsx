import React, { useState } from 'react';

const ShoppingCart = ({ user }) => {
    const [cartItems, setCartItems] = useState([]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                            <span className="material-icons mr-2">shopping_cart</span>
                            Shopping Cart
                        </h2>
                        <p className="text-gray-600">
                            Review and checkout your selected items
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{cartItems.length}</p>
                        <p className="text-sm text-gray-500">Items in Cart</p>
                    </div>
                </div>
            </div>

            {/* Cart Contents */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Cart Items</h3>
                </div>
                <div className="p-6">
                    {cartItems.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-icons text-gray-400 text-4xl mb-4">shopping_cart</span>
                            <p className="text-gray-500">Your cart is empty</p>
                            <p className="text-sm text-gray-400 mt-2">
                                Visit the inventory to add items to your cart
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cartItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-between border-b pb-4">
                                    <div>
                                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                                        <p className="text-sm text-gray-500">{item.category}</p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                                        <button className="text-red-600 hover:text-red-800">
                                            <span className="material-icons text-sm">delete</span>
                                        </button>
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

export default ShoppingCart;