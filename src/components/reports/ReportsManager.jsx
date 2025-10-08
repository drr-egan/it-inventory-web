import React, { Suspense, useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import LoadingSpinner from '../shared/LoadingSpinner';
import MaterialCard from '../shared/MaterialCard';

// Lazy load PDF processing component for better performance
const PDFProcessor = React.lazy(() => import('./PDFProcessor'));

const ReportsManager = ({ user }) => {
    const [costAllocation, setCostAllocation] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'costAllocation'), orderBy('processedAt', 'desc'));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const allocationData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCostAllocation(allocationData);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching cost allocation:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const totalAllocated = costAllocation.reduce((sum, record) => sum + (record.totalCost || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                            <span className="material-icons mr-2">assessment</span>
                            Reports & Analytics
                        </h2>
                        <p className="text-gray-600">
                            Generate reports and process shipments
                        </p>
                    </div>
                </div>
            </div>

            {/* PDF Processing Section */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">PDF Processing</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Upload and process receipt PDFs for cost allocation
                    </p>
                </div>
                <div className="p-6">
                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center h-32">
                                <LoadingSpinner size="large" />
                                <span className="ml-4 text-gray-600">Loading PDF processor...</span>
                            </div>
                        }
                    >
                        <PDFProcessor user={user} />
                    </Suspense>
                </div>
            </div>

            {/* Cost Allocation Viewer */}
            <MaterialCard elevation={1}>
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <span className="material-icons mr-2 text-green-600">account_balance_wallet</span>
                        Cost Allocation Records
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                        View processed receipts and cost allocations by billing code
                    </p>
                </div>
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <LoadingSpinner size="large" />
                            <span className="ml-4 text-gray-600">Loading cost allocation records...</span>
                        </div>
                    ) : costAllocation.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-icons text-4xl text-gray-400">account_balance_wallet</span>
                            <p className="text-gray-500 mt-2">No cost allocation records found</p>
                            <p className="text-sm text-gray-400">Process receipts to see allocation records here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {costAllocation.slice(0, 10).map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{record.itemName}</div>
                                                {record.orderNumber && (
                                                    <div className="text-sm text-gray-500">Order: {record.orderNumber}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    record.costCode?.includes('Job') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {record.costCode || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{record.quantity}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-green-600">
                                                ${record.totalCost?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{record.vendor || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {record.processedAt?.toDate?.() ? record.processedAt.toDate().toLocaleDateString() : 'Unknown'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {costAllocation.length > 10 && (
                                <div className="text-center py-2 text-sm text-gray-500">
                                    Showing first 10 of {costAllocation.length} records
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </MaterialCard>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-blue-600 mr-3">receipt_long</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Processed Receipts</p>
                            <p className="text-2xl font-bold text-gray-900">{costAllocation.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-green-600 mr-3">attach_money</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Cost Allocated</p>
                            <p className="text-2xl font-bold text-gray-900">${totalAllocated.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-purple-600 mr-3">account_balance_wallet</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Allocation Records</p>
                            <p className="text-2xl font-bold text-gray-900">{costAllocation.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsManager;