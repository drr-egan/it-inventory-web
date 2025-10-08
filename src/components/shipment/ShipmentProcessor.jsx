import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';

const ShipmentProcessor = ({ items, checkoutHistory, user }) => {
    // Item selection from checkout history
    const [selectedCheckoutItems, setSelectedCheckoutItems] = useState([]);
    const [checkoutSearchQuery, setCheckoutSearchQuery] = useState('');

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [vendorName, setVendorName] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [receiptDate, setReceiptDate] = useState('');
    const [manualTax, setManualTax] = useState('');
    const [manualFees, setManualFees] = useState('');
    const [status, setStatus] = useState('');
    const [processingResults, setProcessingResults] = useState([]);

    // Format department ID or use job number as cost code
    const formatCostCode = (record) => {
        // If there's a job number, use it as the cost code
        if (record.jobNum && record.jobNum.trim()) {
            return record.jobNum.trim();
        }
        // Otherwise format the department ID
        if (!record.departmentId) return '';
        const deptId = record.departmentId;
        const parts = deptId.split('-');
        if (parts.length >= 3) {
            const [first, second, third] = parts;
            const formattedThird = third.length === 4 ? third.substring(0, 3) : third.padStart(3, '0');
            return `${first}-${second}-${formattedThird}-5770`;
        }
        return deptId;
    };

    // Toggle selection of checkout item
    const handleToggleCheckoutItem = (record) => {
        const index = selectedCheckoutItems.findIndex(item => item.id === record.id);
        if (index >= 0) {
            setSelectedCheckoutItems(prev => prev.filter(item => item.id !== record.id));
        } else {
            setSelectedCheckoutItems(prev => [...prev, record]);
        }
    };

    // Process shipment
    const handleProcessShipment = async () => {
        if (selectedCheckoutItems.length === 0) {
            setStatus('❌ Please select at least one item from checkout history');
            return;
        }

        setIsProcessing(true);
        setStatus('⏳ Processing shipment and generating report...');

        try {
            // Parse tax and fees
            const tax = parseFloat(manualTax) || 0;
            const fees = parseFloat(manualFees) || 0;

            // Calculate total quantity for distribution
            const totalQuantity = selectedCheckoutItems.reduce((sum, record) => sum + (record.quantity || 1), 0);

            // Distribute tax and fees per item unit (quantity-based)
            const taxPerItem = totalQuantity > 0 ? tax / totalQuantity : 0;
            const feePerItem = totalQuantity > 0 ? fees / totalQuantity : 0;

            // Build allocation records
            const allocation = selectedCheckoutItems.map(record => {
                const qty = record.quantity || 1;
                const unitPrice = record.price || 0;
                const itemTax = taxPerItem * qty;
                const itemFees = feePerItem * qty;

                return {
                    itemName: record.itemName,
                    quantity: qty,
                    unitPrice: unitPrice,
                    totalCost: (unitPrice * qty) + itemTax + itemFees,
                    taxAllocation: itemTax,
                    feeAllocation: itemFees,
                    userName: record.userName,
                    costCode: formatCostCode(record)
                };
            });

            // Calculate totals
            const subtotal = allocation.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
            const total = subtotal + tax + fees;

            // Generate PDF report
            await generateCostAllocationReport(allocation, { subtotal, tax, fees, total });

            // Archive processed checkout items
            for (const record of selectedCheckoutItems) {
                await addDoc(collection(db, 'archivedCheckouts'), {
                    ...record,
                    archivedAt: Timestamp.now(),
                    processedBy: user?.email || 'Unknown',
                    orderNumber: orderNumber || 'N/A',
                    vendor: vendorName || 'Unknown'
                });
                await deleteDoc(doc(db, 'checkoutHistory', record.id));
            }

            // Save processing result
            const result = {
                timestamp: new Date().toISOString(),
                orderNumber: orderNumber || 'N/A',
                itemsProcessed: selectedCheckoutItems.length,
                totalAmount: total,
                vendor: vendorName || 'Unknown'
            };
            setProcessingResults(prev => [...prev, result]);

            // Reset form
            setSelectedCheckoutItems([]);
            setVendorName('');
            setOrderNumber('');
            setReceiptDate('');
            setManualTax('');
            setManualFees('');

            setStatus('✅ Shipment processed successfully! Report downloaded and items archived.');
            setIsProcessing(false);

        } catch (error) {
            console.error('Error processing shipment:', error);
            setStatus(`❌ Error: ${error.message}`);
            setIsProcessing(false);
        }
    };

    // Generate PDF cost allocation report matching oldinvoice.pdf format
    const generateCostAllocationReport = async (allocation, totals) => {
        try {
            const PDFLib = window.PDFLib;
            const { PDFDocument, rgb, StandardFonts } = PDFLib;

            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([612, 792]); // Letter size
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            const { width, height } = page.getSize();
            let yPos = height - 50;

            // Title
            page.drawText('Shipment Cost Allocation Report', {
                x: 50,
                y: yPos,
                size: 16,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 25;

            // Generated timestamp
            const generatedDate = new Date().toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true
            });
            page.drawText(`Generated: ${generatedDate}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: font,
                color: rgb(0, 0, 0)
            });
            yPos -= 20;

            // Tax and fees distribution note
            if (totals.tax > 0 || totals.fees > 0) {
                const taxFeeNote = `Tax ($${totals.tax.toFixed(2)}) and Fees ($${totals.fees.toFixed(2)}) distributed evenly per item`;
                page.drawText(taxFeeNote, {
                    x: 50,
                    y: yPos,
                    size: 10,
                    font: font,
                    color: rgb(0, 0, 0)
                });
                yPos -= 30;
            }

            // Cost Allocation Summary heading
            page.drawText('Cost Allocation Summary', {
                x: 50,
                y: yPos,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 25;

            // Table header
            page.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
            page.drawText('Qty', { x: 250, y: yPos, size: 9, font: boldFont });
            page.drawText('Job/Cost Code', { x: 280, y: yPos, size: 9, font: boldFont });
            page.drawText('Units', { x: 380, y: yPos, size: 9, font: boldFont });
            page.drawText('Unit Price', { x: 420, y: yPos, size: 9, font: boldFont });
            page.drawText('Total Cost', { x: 500, y: yPos, size: 9, font: boldFont });
            yPos -= 15;

            // Table data
            for (const item of allocation) {
                if (yPos < 150) {
                    // Create new page if needed
                    const newPage = pdfDoc.addPage([612, 792]);
                    yPos = height - 50;
                }

                const itemName = item.itemName.length > 35 ?
                    item.itemName.substring(0, 35) + '...' : item.itemName;

                page.drawText(itemName, { x: 50, y: yPos, size: 9, font });
                page.drawText(String(item.quantity), { x: 250, y: yPos, size: 9, font });
                page.drawText(item.costCode || '-', { x: 280, y: yPos, size: 9, font });
                page.drawText(String(item.quantity), { x: 380, y: yPos, size: 9, font });
                page.drawText(`$${item.unitPrice.toFixed(2)}`, { x: 420, y: yPos, size: 9, font });
                page.drawText(`$${item.totalCost.toFixed(2)}`, { x: 500, y: yPos, size: 9, font });
                yPos -= 15;
            }

            yPos -= 10;

            // Financial totals (right-aligned like the invoice)
            const totalsX = 420;
            page.drawText(`Subtotal (Items): $${totals.subtotal.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 12;
            page.drawText(`Tax: $${totals.tax.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 12;
            page.drawText(`Fees: $${totals.fees.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 15;
            page.drawText(`Grand Total: $${totals.total.toFixed(2)}`, { x: totalsX, y: yPos, size: 10, font: boldFont });
            yPos -= 30;

            // Individual Checkout Details heading
            page.drawText('Individual Checkout Details', {
                x: 50,
                y: yPos,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 25;

            // Checkout details table header
            page.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
            page.drawText('User', { x: 280, y: yPos, size: 9, font: boldFont });
            page.drawText('Cost Code', { x: 450, y: yPos, size: 9, font: boldFont });
            yPos -= 15;

            // Checkout details data
            for (const item of allocation) {
                if (yPos < 100) {
                    break; // Stop if running out of space
                }

                const itemName = item.itemName.length > 35 ?
                    item.itemName.substring(0, 35) + '...' : item.itemName;
                const userName = item.userName || 'N/A';

                page.drawText(itemName, { x: 50, y: yPos, size: 9, font });
                page.drawText(userName, { x: 280, y: yPos, size: 9, font });
                page.drawText(item.costCode || '-', { x: 450, y: yPos, size: 9, font });
                yPos -= 15;
            }

            // Save and download PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = orderNumber ?
                `shipment-allocation-${orderNumber}.pdf` :
                `shipment-allocation-${new Date().toISOString().split('T')[0]}.pdf`;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating PDF report:', error);
            throw error;
        }
    };

    // Filter checkout history
    const filteredCheckoutHistory = checkoutHistory.filter(record => {
        if (!checkoutSearchQuery) return true;
        const searchLower = checkoutSearchQuery.toLowerCase();
        return (
            record.itemName?.toLowerCase().includes(searchLower) ||
            record.userName?.toLowerCase().includes(searchLower) ||
            record.departmentId?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mat-card p-6">
                <h2 className="text-2xl font-bold flex items-center mb-4" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2">local_shipping</span>
                    Process Shipment
                </h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Select items from checkout history and allocate costs with tax and fee distribution.
                </p>
            </div>

            {/* Checkout History Selection */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>checklist</span>
                    Select from Checkout History ({selectedCheckoutItems.length} selected)
                </h3>

                {/* Search */}
                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by item name, user, or department..."
                            value={checkoutSearchQuery}
                            onChange={(e) => setCheckoutSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-[var(--md-sys-color-outline-variant)]"
                            style={{
                                background: 'var(--md-sys-color-surface)',
                                color: 'var(--color-text-light)'
                            }}
                        />
                        <span className="material-icons absolute right-3 top-2.5" style={{ color: 'var(--color-text-muted)' }}>
                            search
                        </span>
                    </div>
                </div>

                {/* Checkout History Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Select</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Item</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>User</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Qty</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Price</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Department</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCheckoutHistory.slice(0, 20).map((record) => {
                                const isSelected = selectedCheckoutItems.some(item => item.id === record.id);
                                return (
                                    <tr
                                        key={record.id}
                                        className={`border-b border-[var(--md-sys-color-outline-variant)] cursor-pointer hover:bg-[var(--md-sys-color-surface-container-highest)] ${
                                            isSelected ? 'bg-[rgba(59,130,246,0.15)]' : ''
                                        }`}
                                        onClick={() => handleToggleCheckoutItem(record)}
                                    >
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
                                            {record.itemName}
                                        </td>
                                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            {record.userName}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="quantity-badge adequate-stock">{record.quantity || 1}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--color-success-green)' }}>
                                            {record.price > 0 ? `$${record.price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="pill-badge">{record.departmentId || record.jobNum || '-'}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredCheckoutHistory.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                            No checkout history available
                        </div>
                    )}
                    {filteredCheckoutHistory.length > 20 && (
                        <div className="text-center py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Showing first 20 of {filteredCheckoutHistory.length} records
                        </div>
                    )}
                </div>
            </div>

            {/* Processing Options */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2" style={{ color: 'var(--color-success-green)' }}>settings</span>
                    Shipment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MaterialInput
                        type="text"
                        label="Vendor Name"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        placeholder="e.g., Amazon, Staples"
                    />
                    <MaterialInput
                        type="text"
                        label="Order Number"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="e.g., 114-5534389-2755439"
                    />
                    <MaterialInput
                        type="date"
                        label="Receipt Date"
                        value={receiptDate}
                        onChange={(e) => setReceiptDate(e.target.value)}
                    />
                    <div></div>
                    <MaterialInput
                        type="number"
                        label="Tax Amount"
                        value={manualTax}
                        onChange={(e) => setManualTax(e.target.value)}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        required
                    />
                    <MaterialInput
                        type="number"
                        label="Fees (Shipping/Handling)"
                        value={manualFees}
                        onChange={(e) => setManualFees(e.target.value)}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                    />
                </div>

                <MaterialButton
                    color="success"
                    className="w-full mt-6"
                    disabled={isProcessing || selectedCheckoutItems.length === 0}
                    onClick={handleProcessShipment}
                >
                    {isProcessing ? (
                        <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Processing...
                        </>
                    ) : (
                        <>
                            <span className="material-icons mr-2">receipt_long</span>
                            Process Shipment ({selectedCheckoutItems.length} items)
                        </>
                    )}
                </MaterialButton>
            </div>

            {/* Status Message */}
            {status && (
                <div className={`mat-card p-4 ${
                    status.includes('✅') ? 'success-box' :
                    status.includes('⏳') ? 'info-box' :
                    'error-box'
                }`}>
                    {status}
                </div>
            )}

            {/* Recent Processing */}
            {processingResults.length > 0 && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>history</span>
                        Recent Shipment Processing
                    </h3>
                    <div className="space-y-3">
                        {processingResults.slice(-5).reverse().map((result, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                                <div className="flex items-center space-x-3">
                                    <span className="material-icons" style={{ color: 'var(--color-success-green)' }}>check_circle</span>
                                    <div>
                                        <p className="font-medium" style={{ color: 'var(--color-text-light)' }}>Order {result.orderNumber}</p>
                                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            {result.itemsProcessed} items • ${result.totalAmount.toFixed(2)} • {result.vendor}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    {new Date(result.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipmentProcessor;
