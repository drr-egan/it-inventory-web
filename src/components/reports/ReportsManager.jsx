import React, { Suspense } from 'react';
import LoadingSpinner from '../shared/LoadingSpinner';

// Lazy load PDF processing component for better performance
const PDFProcessor = React.lazy(() => import('./PDFProcessor'));

const ReportsManager = ({ user }) => {
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

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-blue-600 mr-3">receipt_long</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Processed PDFs</p>
                            <p className="text-2xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-green-600 mr-3">attach_money</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Cost Allocated</p>
                            <p className="text-2xl font-bold text-gray-900">$0.00</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                        <span className="material-icons text-purple-600 mr-3">history</span>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Archived Records</p>
                            <p className="text-2xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsManager;