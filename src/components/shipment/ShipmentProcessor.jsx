import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';

const ShipmentProcessor = ({ items, checkoutHistory, user }) => {
    // Allocation method
    const [allocationMethod, setAllocationMethod] = useState('auto');

    // Item selection (manual mode)
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [selectedShipmentItems, setSelectedShipmentItems] = useState([]);
    const [shipmentItemDetails, setShipmentItemDetails] = useState({});
    const [showQuantityModal, setShowQuantityModal] = useState(false);

    // PDF and processing
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfText, setPdfText] = useState('');
    const [matchedItems, setMatchedItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [vendorName, setVendorName] = useState('');
    const [receiptDate, setReceiptDate] = useState('');
    const [processingNotes, setProcessingNotes] = useState('');
    const [manualTax, setManualTax] = useState(0);
    const [manualFees, setManualFees] = useState(0);
    const [status, setStatus] = useState('');
    const [processingResults, setProcessingResults] = useState([]);

    // Format department ID
    const formatDepartmentId = (deptId) => {
        if (!deptId) return '';
        const parts = deptId.split('-');
        if (parts.length >= 3) {
            const [first, second, third] = parts;
            const formattedThird = third.length === 4 ? third.substring(0, 3) : third.padStart(3, '0');
            return `${first}-${second}-${formattedThird}-5770`;
        }
        return deptId;
    };

    // Handle PDF upload
    const handlePdfUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setStatus('❌ Please select a PDF file');
            return;
        }

        setPdfFile(file);
        setIsProcessing(true);
        setStatus('⏳ Extracting text from PDF...');

        try {
            // Extract text from PDF using PDF.js
            const pdfjsLib = window.pdfjsLib;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            setPdfText(fullText);
            setStatus(`✅ PDF uploaded successfully! Extracted ${fullText.length} characters.`);

            // Auto-match items if automatic allocation is selected
            if (allocationMethod === 'auto') {
                await matchItemsFromPdf(fullText);
            } else {
                setTimeout(() => setStatus(''), 3000);
            }

        } catch (error) {
            console.error('Error processing PDF:', error);
            setStatus(`❌ Failed to process PDF: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Match items from PDF text against checkout history
    const matchItemsFromPdf = async (text) => {
        try {
            const matches = [];
            const textLower = text.toLowerCase();

            // Match against checkout history items
            for (const record of checkoutHistory) {
                const itemNameLower = record.itemName.toLowerCase();

                // Simple text matching - look for item names in the PDF
                if (textLower.includes(itemNameLower) ||
                    itemNameLower.split(' ').some(word => word.length > 3 && textLower.includes(word))) {

                    // Try to extract price and quantity from surrounding text
                    const itemIndex = textLower.indexOf(itemNameLower);
                    const surroundingText = text.substring(Math.max(0, itemIndex - 100), itemIndex + 200);

                    // Simple regex patterns for price and quantity
                    const priceMatch = surroundingText.match(/\$?(\d+\.?\d{0,2})/);
                    const quantityMatch = surroundingText.match(/(\d+)\s*(?:ea|each|qty|quantity|pcs?|pieces?)?/i);

                    matches.push({
                        ...record,
                        extractedPrice: priceMatch ? parseFloat(priceMatch[1]) : null,
                        extractedQuantity: quantityMatch ? parseInt(quantityMatch[1]) : record.quantity,
                        confidence: itemNameLower.length > 5 ? 'high' : 'medium'
                    });
                }
            }

            setMatchedItems(matches);
            setStatus(`✅ Found ${matches.length} potential item match${matches.length !== 1 ? 'es' : ''} in PDF`);
            setTimeout(() => setStatus(''), 3000);

        } catch (error) {
            console.error('Error matching items:', error);
            setStatus(`❌ Error matching items: ${error.message}`);
        }
    };

    // Add selected item from search
    const handleAddItem = (item) => {
        if (!selectedShipmentItems.includes(item.name)) {
            setSelectedShipmentItems(prev => [...prev, item.name]);
            // Initialize with default values
            setShipmentItemDetails(prev => ({
                ...prev,
                [item.name]: {
                    quantity: 1,
                    price: item.price || 0
                }
            }));
        }
        setItemSearchQuery('');
    };

    // Remove item from selection
    const handleRemoveItem = (itemName) => {
        setSelectedShipmentItems(prev => prev.filter(name => name !== itemName));
        setShipmentItemDetails(prev => {
            const newDetails = { ...prev };
            delete newDetails[itemName];
            return newDetails;
        });
    };

    // Update item details
    const handleUpdateItemDetail = (itemName, field, value) => {
        setShipmentItemDetails(prev => ({
            ...prev,
            [itemName]: {
                ...prev[itemName],
                [field]: field === 'quantity' ? parseInt(value) || 0 : parseFloat(value) || 0
            }
        }));
    };

    // Process shipment
    const handleProcessShipment = async () => {
        // Determine which items to process based on allocation method
        const itemsToProcess = allocationMethod === 'auto' ? matchedItems : selectedShipmentItems;

        if (itemsToProcess.length === 0) {
            setStatus(`❌ Please ${allocationMethod === 'auto' ? 'upload a PDF to match items' : 'select at least one item'}`);
            return;
        }

        // Validate manual mode items have quantity and price
        if (allocationMethod === 'manual') {
            const missingDetails = selectedShipmentItems.filter(itemName => {
                const details = shipmentItemDetails[itemName];
                return !details || details.quantity <= 0;
            });

            if (missingDetails.length > 0) {
                setStatus('❌ Please set quantity and price for all items');
                return;
            }
        }

        setIsProcessing(true);
        setStatus('⏳ Processing shipment and generating report...');

        try {
            // Use manually entered tax and fees
            let subtotal = 0;
            let tax = parseFloat(manualTax) || 0;
            let fees = parseFloat(manualFees) || 0;
            let total = 0;

            // Calculate totals based on allocation method
            let allocation;
            const totalItems = itemsToProcess.reduce((sum, item) => {
                return sum + (allocationMethod === 'auto' ? (item.extractedQuantity || item.quantity) : shipmentItemDetails[item]?.quantity || 0);
            }, 0);

            // Distribute tax and fees per item
            const taxPerItem = totalItems > 0 ? tax / totalItems : 0;
            const feePerItem = totalItems > 0 ? fees / totalItems : 0;

            if (allocationMethod === 'auto') {
                // Use matched items from checkout history
                allocation = matchedItems.map(record => {
                    const qty = record.extractedQuantity || record.quantity;
                    const unitPrice = record.extractedPrice || 0;
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
                        departmentId: record.departmentId,
                        costCode: formatDepartmentId(record.departmentId)
                    };
                });

                // Calculate subtotal from item prices
                subtotal = allocation.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                total = subtotal + tax + fees;
            } else {
                // Use manually selected items
                allocation = selectedShipmentItems.map(itemName => {
                    const details = shipmentItemDetails[itemName];
                    const item = items.find(i => i.name === itemName);
                    const qty = details.quantity;
                    const itemTax = taxPerItem * qty;
                    const itemFees = feePerItem * qty;

                    return {
                        itemName,
                        quantity: qty,
                        unitPrice: details.price,
                        totalCost: (details.price * qty) + itemTax + itemFees,
                        taxAllocation: itemTax,
                        feeAllocation: itemFees,
                        category: item?.category || 'Uncategorized',
                        asin: item?.asin || ''
                    };
                });

                // Calculate totals for manual mode
                subtotal = allocation.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                total = subtotal + tax + fees;
            }

            // Generate PDF report
            await generateCostAllocationReport(allocation, { subtotal, tax, fees, total });

            // Save processing result
            const result = {
                timestamp: new Date().toISOString(),
                fileName: pdfFile?.name || 'Manual Entry',
                itemsProcessed: selectedShipmentItems.length,
                totalAmount: total,
                vendor: vendorName || 'Unknown'
            };
            setProcessingResults(prev => [...prev, result]);

            // Reset form
            setSelectedShipmentItems([]);
            setShipmentItemDetails({});
            setMatchedItems([]);
            setPdfFile(null);
            setPdfText('');
            setVendorName('');
            setReceiptDate('');
            setProcessingNotes('');
            setManualTax(0);
            setManualFees(0);
            if (document.getElementById('pdf-upload')) {
                document.getElementById('pdf-upload').value = '';
            }

            setStatus('✅ Shipment processed successfully! Report downloaded.');
            setIsProcessing(false);

        } catch (error) {
            console.error('Error processing shipment:', error);
            setStatus(`❌ Error: ${error.message}`);
            setIsProcessing(false);
        }
    };

    // Generate PDF cost allocation report
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
            page.drawText('SHIPMENT COST ALLOCATION REPORT', {
                x: 50,
                y: yPos,
                size: 16,
                font: boldFont,
                color: rgb(0.12, 0.23, 0.54)
            });
            yPos -= 30;

            // Metadata
            page.drawText(`Generated: ${new Date().toLocaleString()}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: font,
                color: rgb(0.5, 0.5, 0.5)
            });
            yPos -= 15;

            if (vendorName) {
                page.drawText(`Vendor: ${vendorName}`, {
                    x: 50,
                    y: yPos,
                    size: 10,
                    font: font
                });
                yPos -= 15;
            }

            if (receiptDate) {
                page.drawText(`Receipt Date: ${receiptDate}`, {
                    x: 50,
                    y: yPos,
                    size: 10,
                    font: font
                });
                yPos -= 15;
            }

            if (pdfFile) {
                page.drawText(`Source File: ${pdfFile.name}`, {
                    x: 50,
                    y: yPos,
                    size: 10,
                    font: font
                });
                yPos -= 15;
            }

            yPos -= 20;

            // Table header
            page.drawText('Item Description', { x: 50, y: yPos, size: 10, font: boldFont });
            page.drawText('User', { x: 200, y: yPos, size: 10, font: boldFont });
            page.drawText('Qty', { x: 280, y: yPos, size: 10, font: boldFont });
            page.drawText('Cost Code', { x: 320, y: yPos, size: 10, font: boldFont });
            page.drawText('Unit $', { x: 420, y: yPos, size: 10, font: boldFont });
            page.drawText('Total $', { x: 480, y: yPos, size: 10, font: boldFont });
            yPos -= 15;

            // Draw line
            page.drawLine({
                start: { x: 50, y: yPos },
                end: { x: width - 50, y: yPos },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });
            yPos -= 15;

            // Allocation details
            for (const item of allocation) {
                if (yPos < 100) {
                    // Add new page if needed
                    const newPage = pdfDoc.addPage([612, 792]);
                    yPos = height - 50;
                }

                const itemName = item.itemName.length > 25 ?
                    item.itemName.substring(0, 25) + '...' : item.itemName;
                const userName = item.userName ?
                    (item.userName.length > 15 ? item.userName.substring(0, 15) + '...' : item.userName) : '-';
                const costCode = item.costCode || '-';

                page.drawText(itemName, { x: 50, y: yPos, size: 8, font });
                page.drawText(userName, { x: 200, y: yPos, size: 8, font });
                page.drawText(String(item.quantity), { x: 280, y: yPos, size: 8, font });
                page.drawText(costCode, { x: 320, y: yPos, size: 8, font });
                page.drawText(`$${item.unitPrice.toFixed(2)}`, { x: 420, y: yPos, size: 8, font });
                page.drawText(`$${item.totalCost.toFixed(2)}`, { x: 480, y: yPos, size: 8, font });
                yPos -= 15;
            }

            yPos -= 20;

            // Financial summary
            page.drawLine({
                start: { x: 50, y: yPos },
                end: { x: width - 50, y: yPos },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });
            yPos -= 20;

            page.drawText('FINANCIAL SUMMARY', { x: 50, y: yPos, size: 12, font: boldFont });
            yPos -= 20;
            page.drawText(`Subtotal (Items Only): $${totals.subtotal.toFixed(2)}`, { x: 50, y: yPos, size: 10, font });
            yPos -= 15;
            page.drawText(`Tax: $${totals.tax.toFixed(2)}`, { x: 50, y: yPos, size: 10, font });
            yPos -= 15;
            if (totals.fees > 0) {
                page.drawText(`Fees: $${totals.fees.toFixed(2)}`, { x: 50, y: yPos, size: 10, font });
                yPos -= 15;
            }
            page.drawText(`Grand Total: $${totals.total.toFixed(2)}`, { x: 50, y: yPos, size: 12, font: boldFont });
            yPos -= 20;

            // Cost allocation note
            if (yPos > 50 && (totals.tax > 0 || totals.fees > 0)) {
                page.drawText('Note: Tax and fees are distributed evenly across all items based on quantity.', {
                    x: 50,
                    y: yPos,
                    size: 8,
                    font,
                    color: rgb(0.5, 0.5, 0.5)
                });
                yPos -= 12;
                page.drawText('Each item\'s Total Cost includes its proportional share of tax and fees.', {
                    x: 50,
                    y: yPos,
                    size: 8,
                    font,
                    color: rgb(0.5, 0.5, 0.5)
                });
            }

            // Notes section
            if (processingNotes) {
                yPos -= 30;
                page.drawText('Notes:', { x: 50, y: yPos, size: 10, font: boldFont });
                yPos -= 15;
                const noteLines = processingNotes.match(/.{1,70}/g) || [];
                noteLines.forEach(line => {
                    if (yPos < 50) return;
                    page.drawText(line, { x: 50, y: yPos, size: 9, font });
                    yPos -= 12;
                });
            }

            // Save and download PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `shipment-allocation-${new Date().toISOString().split('T')[0]}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating PDF report:', error);
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mat-card p-6">
                <h2 className="text-2xl font-bold flex items-center mb-4" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2">local_shipping</span>
                    Process Shipment
                </h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Choose between automatic PDF matching or manual item selection for shipment processing.
                </p>
            </div>

            {/* Allocation Method Selection */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-light)' }}>
                    Cost Allocation Method
                </h3>
                <div className="space-y-3">
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="radio"
                            name="allocation"
                            value="auto"
                            checked={allocationMethod === 'auto'}
                            onChange={(e) => setAllocationMethod(e.target.value)}
                            className="mr-3"
                        />
                        <div>
                            <span className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                Automatic - Match against checkout history
                            </span>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Upload PDF receipt and automatically find matching items from checkout history
                            </p>
                        </div>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="radio"
                            name="allocation"
                            value="manual"
                            checked={allocationMethod === 'manual'}
                            onChange={(e) => setAllocationMethod(e.target.value)}
                            className="mr-3"
                        />
                        <div>
                            <span className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                Manual - Select items and set prices
                            </span>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Manually select items from inventory and enter quantities/prices
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Manual Item Selection - Only show in manual mode */}
            {allocationMethod === 'manual' && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>search</span>
                        Select Items for Processing
                    </h3>

                <div className="space-y-4">
                    {/* Search Box */}
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-light)' }}>
                            Search and Add Items
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Type item name to search..."
                                value={itemSearchQuery}
                                onChange={(e) => setItemSearchQuery(e.target.value)}
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

                        {/* Search Results */}
                        {itemSearchQuery && itemSearchQuery.length > 0 && (
                            <div className="mt-2 border border-[var(--md-sys-color-outline-variant)] rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ background: 'var(--md-sys-color-surface)' }}>
                                {items
                                    .filter(item => item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()))
                                    .slice(0, 10)
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="px-4 py-2 hover:bg-[var(--md-sys-color-surface-container-highest)] cursor-pointer border-b border-[var(--md-sys-color-outline-variant)] last:border-b-0"
                                        >
                                            <div className="font-medium" style={{ color: 'var(--color-text-light)' }}>{item.name}</div>
                                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                Qty: {item.quantity} | Category: {item.category}
                                                {item.price > 0 && <span className="ml-2" style={{ color: 'var(--color-success-green)' }}>${item.price}</span>}
                                            </div>
                                        </div>
                                    ))
                                }
                                {items.filter(item => item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-2" style={{ color: 'var(--color-text-muted)' }}>No items found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Items List */}
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-light)' }}>
                            Selected Items ({selectedShipmentItems.length})
                        </label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {selectedShipmentItems.length === 0 ? (
                                <div className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>No items selected</div>
                            ) : (
                                selectedShipmentItems.map(itemName => (
                                    <div key={itemName} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>{itemName}</span>
                                        <button
                                            onClick={() => handleRemoveItem(itemName)}
                                            className="hover:opacity-80"
                                            style={{ color: 'var(--color-error-red)' }}
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Set Quantities & Prices Button */}
                    {selectedShipmentItems.length > 0 && (
                        <MaterialButton
                            color="primary"
                            onClick={() => setShowQuantityModal(true)}
                            className="w-full"
                        >
                            <span className="material-icons mr-2">edit</span>
                            Set Quantities & Prices ({selectedShipmentItems.length} items)
                        </MaterialButton>
                    )}
                </div>
            </div>
            )}

            {/* Matched Items - Only show in auto mode */}
            {allocationMethod === 'auto' && matchedItems.length > 0 && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-success-green)' }}>assignment_turned_in</span>
                        Matched Items ({matchedItems.length})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Item</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>User</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Dept</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Confidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matchedItems.slice(0, 10).map((item, index) => (
                                    <tr key={index} className="border-b border-[var(--md-sys-color-outline-variant)]">
                                        <td className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--color-text-light)' }}>
                                            {item.itemName.length > 30 ? item.itemName.substring(0, 30) + '...' : item.itemName}
                                        </td>
                                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>{item.userName}</td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="quantity-badge adequate-stock">{item.extractedQuantity || item.quantity}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="pill-badge">{item.departmentId || '-'}</span>
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                item.confidence === 'high'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                                            }`}>
                                                {item.confidence}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {matchedItems.length > 10 && (
                            <div className="text-center py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                and {matchedItems.length - 10} more items...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PDF Upload & Processing Options */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PDF Upload */}
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>upload_file</span>
                        Upload Receipt PDF
                    </h3>
                    <div className="border-2 border-dashed border-[var(--md-sys-color-outline-variant)] rounded-lg p-8 text-center hover:border-[var(--color-primary-blue)] transition-colors">
                        <span className="material-icons text-4xl mb-2" style={{ color: 'var(--color-text-muted)' }}>picture_as_pdf</span>
                        <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
                            Drop PDF receipt here or click to upload
                        </p>
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            id="pdf-upload"
                            onChange={handlePdfUpload}
                        />
                        <MaterialButton
                            variant="outlined"
                            onClick={() => document.getElementById('pdf-upload').click()}
                        >
                            <span className="material-icons mr-2">file_upload</span>
                            {pdfFile ? pdfFile.name : 'Choose PDF File'}
                        </MaterialButton>
                    </div>
                </div>

                {/* Processing Options */}
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-success-green)' }}>settings</span>
                        Processing Options
                    </h3>
                    <div className="space-y-4">
                        <MaterialInput
                            type="date"
                            label="Receipt Date"
                            value={receiptDate}
                            onChange={(e) => setReceiptDate(e.target.value)}
                        />
                        <MaterialInput
                            type="text"
                            label="Vendor Name"
                            value={vendorName}
                            onChange={(e) => setVendorName(e.target.value)}
                            placeholder="Optional vendor name"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <MaterialInput
                                type="number"
                                label="Tax Amount"
                                value={manualTax}
                                onChange={(e) => setManualTax(e.target.value)}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
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
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-light)' }}>
                                Notes
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Processing notes or special instructions"
                                value={processingNotes}
                                onChange={(e) => setProcessingNotes(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[var(--md-sys-color-outline-variant)]"
                                style={{
                                    background: 'var(--md-sys-color-surface)',
                                    color: 'var(--color-text-light)'
                                }}
                            />
                        </div>

                        <MaterialButton
                            color="success"
                            className="w-full"
                            disabled={
                                isProcessing ||
                                (allocationMethod === 'auto' && matchedItems.length === 0) ||
                                (allocationMethod === 'manual' && selectedShipmentItems.length === 0)
                            }
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
                                    Process Shipment
                                </>
                            )}
                        </MaterialButton>
                    </div>
                </div>
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
                                        <p className="font-medium" style={{ color: 'var(--color-text-light)' }}>{result.fileName}</p>
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

            {/* Quantity & Price Modal */}
            {showQuantityModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowQuantityModal(false)}
                >
                    <div
                        className="mat-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold flex items-center" style={{ color: 'var(--color-text-light)' }}>
                                <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>edit</span>
                                Set Quantities & Prices
                            </h3>
                            <button
                                onClick={() => setShowQuantityModal(false)}
                                className="hover:opacity-80"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {selectedShipmentItems.map((itemName) => {
                                const item = items.find(i => i.name === itemName);
                                const details = shipmentItemDetails[itemName] || { quantity: 1, price: item?.price || 0 };

                                return (
                                    <div key={itemName} className="p-4 rounded-lg" style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                                        <h4 className="font-medium mb-3" style={{ color: 'var(--color-text-light)' }}>{itemName}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <MaterialInput
                                                type="number"
                                                label="Quantity"
                                                value={details.quantity}
                                                onChange={(e) => handleUpdateItemDetail(itemName, 'quantity', e.target.value)}
                                                min="1"
                                                required
                                            />
                                            <MaterialInput
                                                type="number"
                                                label="Unit Price"
                                                value={details.price}
                                                onChange={(e) => handleUpdateItemDetail(itemName, 'price', e.target.value)}
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {item && (
                                            <div className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                                Current stock: {item.quantity} | Category: {item.category}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <MaterialButton
                                variant="outlined"
                                onClick={() => setShowQuantityModal(false)}
                            >
                                Cancel
                            </MaterialButton>
                            <MaterialButton
                                color="primary"
                                onClick={() => {
                                    setShowQuantityModal(false);
                                    setStatus('✅ Item details saved successfully');
                                    setTimeout(() => setStatus(''), 3000);
                                }}
                            >
                                <span className="material-icons mr-2">save</span>
                                Save Details
                            </MaterialButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipmentProcessor;
