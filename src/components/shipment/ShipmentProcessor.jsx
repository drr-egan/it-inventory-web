import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import MaterialButton from '../shared/MaterialButton';

const ShipmentProcessor = ({ checkoutHistory, user }) => {
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfPreview, setPdfPreview] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState('');
    const [matchedItems, setMatchedItems] = useState([]);
    const [prices, setPrices] = useState({});
    const [subtotal, setSubtotal] = useState(0);
    const [tax, setTax] = useState(0);
    const [fees, setFees] = useState(0);
    const [pdfText, setPdfText] = useState('');

    // Format department ID to x-xx-xxx-5770 pattern
    const formatDepartmentId = (deptId) => {
        if (!deptId) return '';

        const cleaned = deptId.toString().replace(/-/g, '');
        const parts = deptId.split('-');

        if (parts.length >= 3) {
            const part1 = parts[0];
            const part2 = parts[1];
            let part3 = parts[2];

            // Ensure third segment is 3 digits
            if (part3.length === 4) {
                part3 = part3.substring(0, 3);
            } else if (part3.length === 2) {
                part3 = part3 + '0';
            }

            return `${part1}-${part2}-${part3}-5770`;
        }

        return deptId;
    };

    // Handle PDF file selection
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPdfFile(file);
        setStatus('📄 PDF selected. Click "Process Shipment" to continue.');
        setMatchedItems([]);
        setPdfText('');

        // Generate preview
        try {
            const pdfjsLib = window.pdfjsLib;
            const fileReader = new FileReader();

            fileReader.onload = async function() {
                const typedArray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                const page = await pdf.getPage(1);

                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport }).promise;
                setPdfPreview(canvas.toDataURL());
            };

            fileReader.readAsArrayBuffer(file);
        } catch (error) {
            console.error('Error generating preview:', error);
        }
    };

    // Extract text from PDF
    const extractPdfText = async (file) => {
        const pdfjsLib = window.pdfjsLib;
        const fileReader = new FileReader();

        return new Promise((resolve, reject) => {
            fileReader.onload = async function() {
                try {
                    const typedArray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }

                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };

            fileReader.onerror = reject;
            fileReader.readAsArrayBuffer(file);
        });
    };

    // Parse financial information from PDF text
    const parseFinancials = (text) => {
        let subtotalMatch = text.match(/subtotal[:\s]*\$?(\d+\.?\d*)/i);
        let taxMatch = text.match(/tax[:\s]*\$?(\d+\.?\d*)/i);
        let feesMatch = text.match(/fee[s]?[:\s]*\$?(\d+\.?\d*)/i) ||
                       text.match(/shipping[:\s]*\$?(\d+\.?\d*)/i);

        return {
            subtotal: subtotalMatch ? parseFloat(subtotalMatch[1]) : 0,
            tax: taxMatch ? parseFloat(taxMatch[1]) : 0,
            fees: feesMatch ? parseFloat(feesMatch[1]) : 0
        };
    };

    // Process the shipment
    const handleProcessShipment = async () => {
        if (!pdfFile) {
            setStatus('❌ Please select a PDF file first');
            return;
        }

        setProcessing(true);
        setStatus('⏳ Processing PDF and matching items...');

        try {
            // Extract text from PDF
            const text = await extractPdfText(pdfFile);
            setPdfText(text);

            // Parse financials
            const financials = parseFinancials(text);
            setSubtotal(financials.subtotal);
            setTax(financials.tax);
            setFees(financials.fees);

            // Match items from checkout history
            const matches = [];
            const tempPrices = {};

            for (const record of checkoutHistory) {
                const itemName = record.itemName.toLowerCase();

                // Search for item name in PDF text (case insensitive)
                if (text.toLowerCase().includes(itemName)) {
                    matches.push(record);

                    // Try to extract price for this item
                    const priceRegex = new RegExp(itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\d]*(\\d+\\.\\d{2})', 'i');
                    const priceMatch = text.match(priceRegex);
                    if (priceMatch) {
                        tempPrices[record.id] = parseFloat(priceMatch[1]);
                    } else {
                        tempPrices[record.id] = 0;
                    }
                }
            }

            if (matches.length === 0) {
                setStatus('⚠️ No matching items found in PDF. Items from checkout history must appear in the receipt.');
                setMatchedItems([]);
                setProcessing(false);
                return;
            }

            setMatchedItems(matches);
            setPrices(tempPrices);
            setStatus(`✅ Found ${matches.length} matching item(s). Review and click "Generate Report" to continue.`);
            setProcessing(false);

        } catch (error) {
            console.error('Error processing PDF:', error);
            setStatus(`❌ Error: ${error.message}`);
            setProcessing(false);
        }
    };

    // Update price for matched item
    const handlePriceChange = (recordId, value) => {
        setPrices(prev => ({
            ...prev,
            [recordId]: parseFloat(value) || 0
        }));
    };

    // Generate cost allocation report
    const handleGenerateReport = async () => {
        if (matchedItems.length === 0) {
            setStatus('❌ No matched items to generate report');
            return;
        }

        setProcessing(true);
        setStatus('⏳ Generating cost allocation report...');

        try {
            const PDFLib = window.PDFLib;
            const { PDFDocument, rgb, StandardFonts } = PDFLib;

            // Create new PDF document
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

            // Date
            page.drawText(`Generated: ${new Date().toLocaleString()}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: font,
                color: rgb(0.5, 0.5, 0.5)
            });
            yPos -= 30;

            // Calculate totals
            const totalQuantity = matchedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const itemsSubtotal = matchedItems.reduce((sum, item) => sum + (prices[item.id] || 0) * (item.quantity || 0), 0);
            const taxPerItem = tax / matchedItems.length;
            const feesPerItem = fees / matchedItems.length;

            // Summary table header
            page.drawText('Cost Allocation Summary', {
                x: 50,
                y: yPos,
                size: 12,
                font: boldFont
            });
            yPos -= 20;

            // Table headers
            const headers = ['Item Description', 'Qty', 'Job/Cost Code', 'Unit Price', 'Total Cost'];
            const colWidths = [200, 40, 120, 80, 80];
            let xPos = 50;

            headers.forEach((header, i) => {
                page.drawText(header, {
                    x: xPos,
                    y: yPos,
                    size: 9,
                    font: boldFont
                });
                xPos += colWidths[i];
            });
            yPos -= 15;

            // Draw header line
            page.drawLine({
                start: { x: 50, y: yPos },
                end: { x: width - 50, y: yPos },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });
            yPos -= 15;

            // Table rows
            for (const item of matchedItems) {
                const unitPrice = prices[item.id] || 0;
                const itemTax = taxPerItem;
                const itemFees = feesPerItem;
                const totalCost = (unitPrice * (item.quantity || 0)) + itemTax + itemFees;
                const costCode = item.jobNum || formatDepartmentId(item.departmentId);

                xPos = 50;

                // Item name (with text wrapping if needed)
                const itemName = item.itemName.substring(0, 30);
                page.drawText(itemName, {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: font
                });
                xPos += colWidths[0];

                // Quantity
                page.drawText(String(item.quantity || 0), {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: font
                });
                xPos += colWidths[1];

                // Cost Code
                page.drawText(costCode || '-', {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: font
                });
                xPos += colWidths[2];

                // Unit Price
                page.drawText(`$${unitPrice.toFixed(2)}`, {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: font
                });
                xPos += colWidths[3];

                // Total Cost
                page.drawText(`$${totalCost.toFixed(2)}`, {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: font
                });

                yPos -= 20;

                // Check if we need a new page
                if (yPos < 100) {
                    yPos = height - 50;
                }
            }

            yPos -= 10;

            // Financial breakdown
            page.drawLine({
                start: { x: 50, y: yPos },
                end: { x: width - 50, y: yPos },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });
            yPos -= 20;

            page.drawText('Financial Breakdown', {
                x: 50,
                y: yPos,
                size: 10,
                font: boldFont
            });
            yPos -= 15;

            const grandTotal = itemsSubtotal + tax + fees;
            const breakdown = [
                `Items Subtotal: $${itemsSubtotal.toFixed(2)}`,
                `Tax (distributed): $${tax.toFixed(2)}`,
                `Fees (distributed): $${fees.toFixed(2)}`,
                `Grand Total: $${grandTotal.toFixed(2)}`
            ];

            breakdown.forEach(line => {
                page.drawText(line, {
                    x: 50,
                    y: yPos,
                    size: 9,
                    font: font
                });
                yPos -= 15;
            });

            // Save PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `shipment-allocation-${new Date().toISOString().split('T')[0]}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            // Archive processed items
            await archiveProcessedItems();

            setStatus('✅ Report generated and items archived successfully!');
            setProcessing(false);

        } catch (error) {
            console.error('Error generating report:', error);
            setStatus(`❌ Error generating report: ${error.message}`);
            setProcessing(false);
        }
    };

    // Archive processed items to archivedCheckouts collection
    const archiveProcessedItems = async () => {
        for (const item of matchedItems) {
            try {
                // Add to archived collection
                await addDoc(collection(db, 'archivedCheckouts'), {
                    ...item,
                    archivedAt: Timestamp.now(),
                    processedBy: user?.email || 'unknown',
                    shipmentDate: new Date().toISOString()
                });

                // Delete from active checkout history
                await deleteDoc(doc(db, 'checkoutHistory', item.id));
            } catch (error) {
                console.error('Error archiving item:', error);
            }
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
                    Upload PDF receipt to match against checkout history and generate cost allocation report.
                </p>
            </div>

            {/* PDF Upload */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-light)' }}>
                    Step 1: Upload PDF Receipt
                </h3>

                <div className="flex gap-4 mb-4">
                    <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <label htmlFor="pdf-upload">
                        <MaterialButton
                            variant="secondary"
                            onClick={() => document.getElementById('pdf-upload').click()}
                        >
                            <span className="material-icons">upload_file</span>
                            Select PDF Receipt
                        </MaterialButton>
                    </label>

                    {pdfFile && (
                        <MaterialButton
                            variant="primary"
                            onClick={handleProcessShipment}
                            disabled={processing}
                        >
                            <span className="material-icons">search</span>
                            {processing ? 'Processing...' : 'Process Shipment'}
                        </MaterialButton>
                    )}
                </div>

                {pdfFile && (
                    <div className="info-box">
                        <strong>Selected:</strong> {pdfFile.name} ({(pdfFile.size / 1024).toFixed(2)} KB)
                    </div>
                )}

                {/* Status */}
                {status && (
                    <div className={`mt-4 p-3 rounded-lg ${
                        status.includes('✅') ? 'success-box' :
                        status.includes('⏳') ? 'info-box' :
                        status.includes('⚠️') ? 'warning-box' :
                        'error-box'
                    }`}>
                        {status}
                    </div>
                )}
            </div>

            {/* PDF Preview */}
            {pdfPreview && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-light)' }}>
                        PDF Preview (Page 1)
                    </h3>
                    <div className="border border-[var(--md-sys-color-outline-variant)] rounded-lg overflow-hidden">
                        <img src={pdfPreview} alt="PDF Preview" className="max-w-full h-auto" />
                    </div>
                </div>
            )}

            {/* Matched Items */}
            {matchedItems.length > 0 && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-light)' }}>
                        Step 2: Review Matched Items ({matchedItems.length})
                    </h3>

                    <div className="overflow-x-auto mb-4">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-[var(--md-sys-color-outline-variant)]">
                                    <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Item</th>
                                    <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>User</th>
                                    <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Qty</th>
                                    <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Cost Code</th>
                                    <th className="text-left p-3" style={{ color: 'var(--color-text-light)' }}>Unit Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matchedItems.map((item) => (
                                    <tr key={item.id} className="border-b border-[var(--md-sys-color-outline-variant)]">
                                        <td className="p-3" style={{ color: 'var(--color-text-light)' }}>
                                            {item.itemName}
                                        </td>
                                        <td className="p-3" style={{ color: 'var(--color-text-muted)' }}>
                                            {item.userName}
                                        </td>
                                        <td className="p-3">
                                            <span className="quantity-badge adequate-stock">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className="pill-badge">
                                                {item.jobNum || formatDepartmentId(item.departmentId)}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={prices[item.id] || 0}
                                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                                className="w-24 px-2 py-1 rounded border border-[var(--md-sys-color-outline-variant)]"
                                                style={{
                                                    background: 'var(--md-sys-color-surface)',
                                                    color: 'var(--color-text-light)'
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="info-box">
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Subtotal (from PDF)</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-text-light)' }}>
                                ${subtotal.toFixed(2)}
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Tax (from PDF)</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-text-light)' }}>
                                ${tax.toFixed(2)}
                            </div>
                        </div>
                        <div className="info-box">
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Fees (from PDF)</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-text-light)' }}>
                                ${fees.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="warning-box mb-4">
                        <strong>Note:</strong> Tax and fees will be distributed evenly across all items in the cost allocation report.
                    </div>

                    <MaterialButton
                        variant="primary"
                        onClick={handleGenerateReport}
                        disabled={processing}
                    >
                        <span className="material-icons">receipt_long</span>
                        {processing ? 'Generating...' : 'Generate Cost Allocation Report'}
                    </MaterialButton>
                </div>
            )}

            {/* Instructions */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-light)' }}>
                    How It Works
                </h3>
                <ol className="list-decimal list-inside space-y-2" style={{ color: 'var(--color-text-muted)' }}>
                    <li>Upload a PDF receipt from your shipment</li>
                    <li>System extracts text and searches for items from active checkout history</li>
                    <li>Review matched items and adjust prices if needed</li>
                    <li>Generate cost allocation report with department IDs formatted as x-xx-xxx-5770</li>
                    <li>Processed items are automatically archived to maintain clean checkout history</li>
                </ol>
            </div>
        </div>
    );
};

export default ShipmentProcessor;
