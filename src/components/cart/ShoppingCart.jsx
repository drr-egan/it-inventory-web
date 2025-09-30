import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

const ShoppingCart = ({ cart, addToCart, removeFromCart, clearCart, users, onCheckout }) => {
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutMethod, setCheckoutMethod] = useState('user');
    const [selectedUser, setSelectedUser] = useState('');
    const [jobNumber, setJobNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');

    const cartTotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.cartQuantity, 0);

    const formatDepartmentId = (deptId) => {
        if (!deptId) return '';
        const parts = deptId.toString().split('-');
        if (parts.length >= 3) {
            const segment = parts[2];
            const paddedSegment = segment.length === 3 ? segment : segment.padStart(3, '0').substring(0, 3);
            return `${parts[0]}-${parts[1]}-${paddedSegment}-5770`;
        }
        return deptId;
    };

    // Filter users based on search term
    const filteredUsers = users.filter(user => {
        if (!userSearchTerm) return true;
        const search = userSearchTerm.toLowerCase();
        const userName = user.name || `${user.firstName} ${user.lastName}`;
        const costCode = formatDepartmentId(user.costCode || user.cost_code);
        return (
            userName.toLowerCase().includes(search) ||
            costCode.toLowerCase().includes(search)
        );
    });

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (checkoutMethod === 'user' && !selectedUser) {
            alert('Please select a user for checkout');
            return;
        }

        if (checkoutMethod === 'job' && !jobNumber.trim()) {
            alert('Please enter a job number');
            return;
        }

        setIsCheckingOut(true);

        try {
            const user = users.find(u => u.id === selectedUser);

            for (const cartItem of cart) {
                // Update inventory using Firestore v9 API
                const itemRef = doc(db, 'items', cartItem.id);
                await runTransaction(db, async (transaction) => {
                    const itemDoc = await transaction.get(itemRef);
                    const currentQty = itemDoc.data().quantity || 0;
                    const newQty = Math.max(0, currentQty - cartItem.cartQuantity);

                    transaction.update(itemRef, {
                        quantity: newQty,
                        lastUpdated: serverTimestamp()
                    });

                    // Create checkout record
                    const checkoutRef = doc(collection(db, 'checkoutHistory'));
                    transaction.set(checkoutRef, {
                        itemId: cartItem.id,
                        itemName: cartItem.name,
                        userId: checkoutMethod === 'user' ? selectedUser : '',
                        userName: checkoutMethod === 'user' ? (user?.name || `${user?.firstName} ${user?.lastName}`) : 'Job Checkout',
                        quantity: cartItem.cartQuantity,
                        departmentId: checkoutMethod === 'user' ? formatDepartmentId(user?.costCode || user?.cost_code) : jobNumber,
                        jobNumber: checkoutMethod === 'job' ? jobNumber : '',
                        notes: notes,
                        status: 'active',
                        dateEntered: serverTimestamp(),
                        createdBy: 'system'
                    });
                });
            }

            // Clear cart and form
            clearCart();
            setSelectedUser('');
            setJobNumber('');
            setNotes('');
            alert(`Checkout completed! ${cart.length} items processed.`);

            if (onCheckout) onCheckout();

        } catch (error) {
            console.error('Checkout error:', error);
            alert(`Checkout failed: ${error.message}`);
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <span className="material-icons text-xl mr-2 text-blue-600">shopping_cart</span>
                    <h3 className="text-lg font-medium dark:text-white">Shopping Cart</h3>
                </div>
                <div className="flex items-center space-x-2">
                    {cart.length > 0 && (
                        <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
                            {cart.length} items
                        </div>
                    )}
                    {cartTotal > 0 && (
                        <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium">
                            ${cartTotal.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>

            {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <span className="material-icons text-6xl mb-4 opacity-50">shopping_cart</span>
                    <p className="font-medium">Your cart is empty</p>
                    <p className="text-sm">Add items to get started</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-white truncate">{item.name}</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Qty: {item.cartQuantity}
                                        {item.price > 0 && (
                                            <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                                ${(item.price * item.cartQuantity).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-3">
                                    <button
                                        onClick={() => addToCart(item, 1)}
                                        className="p-2 min-w-0 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded transition-all flex items-center justify-center"
                                    >
                                        <span className="material-icons text-sm">add</span>
                                    </button>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="p-2 min-w-0 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded transition-all flex items-center justify-center"
                                    >
                                        <span className="material-icons text-sm">remove</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t dark:border-gray-600 pt-4 space-y-4">
                        {/* Checkout Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Checkout Method
                            </label>
                            <div className="flex space-x-4">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        value="user"
                                        checked={checkoutMethod === 'user'}
                                        onChange={(e) => setCheckoutMethod(e.target.value)}
                                        className="mr-2 text-blue-600"
                                    />
                                    <span className="material-icons mr-1 text-sm">person</span>
                                    <span className="text-sm dark:text-gray-300">User Checkout</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        value="job"
                                        checked={checkoutMethod === 'job'}
                                        onChange={(e) => setCheckoutMethod(e.target.value)}
                                        className="mr-2 text-blue-600"
                                    />
                                    <span className="material-icons mr-1 text-sm">work</span>
                                    <span className="text-sm dark:text-gray-300">Job Checkout</span>
                                </label>
                            </div>
                        </div>

                        {/* User Selection */}
                        {checkoutMethod === 'user' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select User
                                </label>
                                <div className="relative mb-2">
                                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder="Search by name or cost code..."
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Choose a user...</option>
                                    {filteredUsers.slice(0, 200).map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || `${user.firstName} ${user.lastName}`} - {formatDepartmentId(user.costCode || user.cost_code)}
                                        </option>
                                    ))}
                                </select>
                                {userSearchTerm && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Job Number */}
                        {checkoutMethod === 'job' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Job Number
                                </label>
                                <input
                                    type="text"
                                    value={jobNumber}
                                    onChange={(e) => setJobNumber(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Notes (Optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Checkout Buttons */}
                        <div className="flex space-x-3">
                            <button
                                onClick={handleCheckout}
                                disabled={isCheckingOut}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center"
                            >
                                {isCheckingOut ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons mr-2">check_circle</span>
                                        Checkout
                                    </>
                                )}
                            </button>
                            <button
                                onClick={clearCart}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                            >
                                <span className="material-icons">clear</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShoppingCart;