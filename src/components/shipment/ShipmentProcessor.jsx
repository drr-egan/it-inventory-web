import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs } from 'firebase/firestore';
import MaterialButton from '../shared/MaterialButton';
import MaterialInput from '../shared/MaterialInput';

const ShipmentProcessor = ({ items, checkoutHistory, user }) => {
    // Item selection from inventory
    const [selectedInventoryItems, setSelectedInventoryItems] = useState([]);
    const [inventorySearchQuery, setInventorySearchQuery] = useState('');

    // Matched checkout records with confirmation details
    const [matchedCheckouts, setMatchedCheckouts] = useState([]);

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [manualTax, setManualTax] = useState('');
    const [manualFees, setManualFees] = useState('');
    const [uploadedPdf, setUploadedPdf] = useState(null);
    const [status, setStatus] = useState('');
    const [processingResults, setProcessingResults] = useState([]);
    const [lastProcessedTransaction, setLastProcessedTransaction] = useState(null);

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

    // Toggle selection of inventory item
    const handleToggleInventoryItem = (item) => {
        const index = selectedInventoryItems.findIndex(selected => selected.id === item.id);
        if (index >= 0) {
            setSelectedInventoryItems(prev => prev.filter(selected => selected.id !== item.id));
            // Remove from matched checkouts
            setMatchedCheckouts(prev => prev.filter(match => match.inventoryItem.id !== item.id));
        } else {
            setSelectedInventoryItems(prev => [...prev, item]);
            // Find and match checkout records
            matchCheckoutRecords(item);
        }
    };

    // Match inventory item to checkout records
    const matchCheckoutRecords = (inventoryItem) => {
        const matchingCheckouts = checkoutHistory.filter(checkout =>
            checkout.itemName?.toLowerCase() === inventoryItem.name?.toLowerCase() ||
            checkout.item?.toLowerCase() === inventoryItem.name?.toLowerCase()
        );

        if (matchingCheckouts.length > 0) {
            const match = {
                inventoryItem,
                checkoutRecords: matchingCheckouts,
                confirmedQuantity: matchingCheckouts.reduce((sum, checkout) => sum + (checkout.quantity || 1), 0),
                confirmedPrice: inventoryItem.price || 0
            };
            setMatchedCheckouts(prev => [...prev, match]);
        } else {
            // No matches found, create with defaults
            const match = {
                inventoryItem,
                checkoutRecords: [],
                confirmedQuantity: 1,
                confirmedPrice: inventoryItem.price || 0
            };
            setMatchedCheckouts(prev => [...prev, match]);
        }
    };

    // Update confirmed quantity or price for a matched item
    const updateConfirmedDetails = (inventoryItemId, field, value) => {
        setMatchedCheckouts(prev => prev.map(match =>
            match.inventoryItem.id === inventoryItemId
                ? { ...match, [field]: parseFloat(value) || 0 }
                : match
        ));
    };

    // Handle PDF file upload
    const handlePdfUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setUploadedPdf(file);
        } else {
            alert('Please select a valid PDF file.');
        }
    };

    // Undo last processed transaction
    const handleUndoProcessing = async () => {
        if (!lastProcessedTransaction) {
            alert('No transaction to undo');
            return;
        }

        const confirmMessage = `This will undo the last processing of ${lastProcessedTransaction.itemsProcessed} items.\n\nThis will:\n• Restore checkout records from archive\n• Revert inventory quantity changes\n• Remove cost allocation records\n\nContinue?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            setStatus('⏳ Undoing last transaction...');
            const batch = writeBatch(db);

            // Restore checkout records from archive to active history
            for (const checkout of lastProcessedTransaction.checkoutRecords) {
                // Skip synthetic entries
                if (checkout.id.startsWith('synthetic-')) continue;

                // Move from archived back to active
                const checkoutRef = doc(db, 'checkoutHistory', checkout.id);
                const checkoutData = { ...checkout };
                delete checkoutData.id;
                delete checkoutData.inventoryItem;
                delete checkoutData.confirmedPrice;
                batch.set(checkoutRef, checkoutData);

                // Delete from archive
                const archivedRef = doc(db, 'archivedCheckouts', checkout.id);
                batch.delete(archivedRef);
            }

            // Revert inventory quantity changes
            for (const update of lastProcessedTransaction.inventoryUpdates) {
                const item = items.find(i => i.id === update.itemId);
                if (item) {
                    const inventoryRef = doc(db, 'items', update.itemId);
                    const revertedQty = Math.max(0, item.quantity - update.quantityAdded);
                    batch.update(inventoryRef, { quantity: revertedQty });
                }
            }

            // Delete cost allocation records for this transaction
            // Note: We can't easily query and delete in a batch, so we'll do this separately
            const costAllocationsQuery = await getDocs(collection(db, 'costAllocation'));
            const transactionTime = new Date(lastProcessedTransaction.timestamp).getTime();
            const timeWindow = 5000; // 5 second window

            costAllocationsQuery.docs.forEach(docSnap => {
                const data = docSnap.data();
                const processedTime = data.processedAt?.toDate?.()?.getTime();

                if (processedTime && Math.abs(processedTime - transactionTime) < timeWindow) {
                    batch.delete(doc(db, 'costAllocation', docSnap.id));
                }
            });

            await batch.commit();

            // Clear the last transaction
            setLastProcessedTransaction(null);

            // Remove from processing results
            setProcessingResults(prev => prev.slice(0, -1));

            setStatus('✅ Transaction successfully undone. Checkout records restored and inventory reverted.');
        } catch (error) {
            console.error('Error undoing transaction:', error);
            setStatus(`❌ Error undoing transaction: ${error.message}`);
        }
    };

    // Process receipt
    const handleProcessShipment = async () => {
        if (!uploadedPdf) {
            setStatus('❌ Please upload a receipt PDF first');
            return;
        }

        if (matchedCheckouts.length === 0) {
            setStatus('❌ Please select at least one item from inventory');
            return;
        }

        // Debug logging: Show what's about to be processed
        console.log('=== SHIPMENT PROCESSING DEBUG ===');
        console.log('Matched checkouts:', matchedCheckouts.length);
        matchedCheckouts.forEach((match, index) => {
            console.log(`Item ${index + 1}: ${match.inventoryItem.name}`);
            console.log(`  - Confirmed Quantity: ${match.confirmedQuantity}`);
            console.log(`  - Confirmed Price: $${match.confirmedPrice}`);
            console.log(`  - Checkout Records: ${match.checkoutRecords.length}`);
        });
        const totalExpectedItems = matchedCheckouts.reduce((sum, match) => sum + match.confirmedQuantity, 0);
        console.log(`Total Expected Items: ${totalExpectedItems}`);
        console.log('=================================');

        // Confirmation dialog with item breakdown
        const itemsList = matchedCheckouts.map(match =>
            `  • ${match.inventoryItem.name}: ${match.confirmedQuantity} items @ $${match.confirmedPrice.toFixed(2)}`
        ).join('\n');

        const confirmMessage = `You are about to process ${matchedCheckouts.length} item type(s) with a total of ${totalExpectedItems} items:\n\n${itemsList}\n\nDo you want to proceed?`;

        if (!confirm(confirmMessage)) {
            setStatus('❌ Processing cancelled by user');
            return;
        }

        setIsProcessing(true);
        setStatus('⏳ Processing receipt and generating cost allocation...');

        try {
            // Parse tax and fees
            const tax = parseFloat(manualTax) || 0;
            const fees = parseFloat(manualFees) || 0;

            // Build checkout records from the matched checkouts (selected items only)
            const allCheckoutRecords = matchedCheckouts.flatMap(match => {
                const confirmedQty = match.confirmedQuantity;

                // Sort checkout records by date (oldest first)
                const sortedCheckouts = [...match.checkoutRecords].sort((a, b) => {
                    const dateA = a.dateEntered?.toDate?.() || a.dateEntered || new Date(0);
                    const dateB = b.dateEntered?.toDate?.() || b.dateEntered || new Date(0);
                    return dateA - dateB;
                });

                // Take oldest records until we've accounted for confirmedQuantity units
                const recordsToUse = [];
                let accumulatedQty = 0;

                for (const checkout of sortedCheckouts) {
                    if (accumulatedQty >= confirmedQty) break;

                    const checkoutQty = checkout.quantity || 1;
                    const remainingQty = confirmedQty - accumulatedQty;

                    if (remainingQty < checkoutQty) {
                        // Would overshoot - create partial checkout with only remaining quantity needed
                        recordsToUse.push({
                            ...checkout,
                            quantity: remainingQty
                        });
                        accumulatedQty += remainingQty;
                    } else {
                        // Won't overshoot - add full checkout
                        recordsToUse.push(checkout);
                        accumulatedQty += checkoutQty;
                    }
                }

                // If we still need more units, create synthetic entries for shortfall
                const shortfall = confirmedQty - accumulatedQty;
                const syntheticEntries = [];

                if (shortfall > 0) {
                    for (let i = 0; i < shortfall; i++) {
                        syntheticEntries.push({
                            id: `synthetic-${match.inventoryItem.id}-${Date.now()}-${i}`,
                            itemName: match.inventoryItem.name,
                            userName: 'IT Stock',
                            quantity: 1,
                            departmentId: '1-20-000-5770',
                            dateEntered: new Date(),
                            inventoryItem: match.inventoryItem,
                            confirmedPrice: match.confirmedPrice
                        });
                    }
                }

                // Map real records to include inventory item and confirmed price
                const mappedRecords = recordsToUse.map(checkout => ({
                    ...checkout,
                    inventoryItem: match.inventoryItem,
                    confirmedPrice: match.confirmedPrice
                }));

                return [...mappedRecords, ...syntheticEntries];
            });

            // Calculate total quantity for distribution
            const totalQuantity = allCheckoutRecords.reduce((sum, checkout) => sum + (checkout.quantity || 1), 0);

            // Debug logging: Verify allocated records match expectations
            console.log('=== ALLOCATION RESULT ===');
            console.log(`Total checkout records allocated: ${allCheckoutRecords.length}`);
            console.log(`Total item quantity: ${totalQuantity}`);
            if (totalQuantity !== totalExpectedItems) {
                console.warn(`⚠️ MISMATCH: Expected ${totalExpectedItems} items but allocated ${totalQuantity}!`);
            } else {
                console.log(`✓ Quantities match!`);
            }
            console.log('========================');

            // Distribute tax and fees per item unit (quantity-based)
            const taxPerItem = totalQuantity > 0 ? tax / totalQuantity : 0;
            const feePerItem = totalQuantity > 0 ? fees / totalQuantity : 0;

            // Group checkout records by item name and cost code
            const groupedByItemAndCostCode = allCheckoutRecords.reduce((groups, checkout) => {
                const costCode = checkout.departmentId || checkout.costCode || 'IT Stock 1-20-000-5770';
                const itemName = checkout.inventoryItem.name;
                const key = `${itemName}|${costCode}`;
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(checkout);
                return groups;
            }, {});

            // Build allocation records aggregated by item and cost code
            const allocation = Object.entries(groupedByItemAndCostCode).map(([key, checkouts]) => {
                const [itemName, costCode] = key.split('|');
                const totalQty = checkouts.reduce((sum, c) => sum + (c.quantity || 1), 0);
                const unitPrice = checkouts[0].confirmedPrice;
                const itemTax = taxPerItem * totalQty;
                const itemFees = feePerItem * totalQty;

                return {
                    itemName: itemName,
                    quantity: totalQty,
                    unitPrice: unitPrice,
                    totalCost: (unitPrice * totalQty) + itemTax + itemFees,
                    taxAllocation: itemTax,
                    feeAllocation: itemFees,
                    costCode: costCode
                };
            });

            // Calculate totals
            const subtotal = allocation.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
            const total = subtotal + tax + fees;

            // Generate PDF report (append to uploaded PDF)
            await generateCostAllocationReport(
                allocation,
                { subtotal, tax, fees, total, taxPerItem, feePerItem },
                uploadedPdf,
                allCheckoutRecords
            );

            // Use batch for atomic operations
            const batch = writeBatch(db);

            // Create cost allocation records per checkout
            for (const checkout of allCheckoutRecords) {
                const costCode = checkout.departmentId || checkout.costCode || 'IT Stock 1-20-000-5770';
                const qty = checkout.quantity || 1;
                const unitPrice = checkout.confirmedPrice;
                const itemTax = taxPerItem * qty;
                const itemFees = feePerItem * qty;

                const costAllocationRef = doc(collection(db, 'costAllocation'));
                batch.set(costAllocationRef, {
                    itemId: checkout.inventoryItem.id,
                    itemName: checkout.inventoryItem.name,
                    quantity: qty,
                    unitPrice: unitPrice,
                    totalCost: (unitPrice * qty) + itemTax + itemFees,
                    taxAllocation: itemTax,
                    feeAllocation: itemFees,
                    costCode: costCode,
                    userName: checkout.userName || checkout.user || 'Unknown',
                    processedAt: Timestamp.now(),
                    processedBy: user?.employeeID || user?.email || 'Unknown',
                    type: costCode.includes('Job') ? 'job' : 'it_stock'
                });

                // Archive checkout record (skip synthetic entries)
                if (!checkout.id.startsWith('synthetic-')) {
                    const archivedData = {
                        ...checkout,
                        archivedAt: Timestamp.now(),
                        archivedBy: user?.employeeID || user?.email || 'Unknown',
                        archiveReason: 'Processed receipt'
                    };
                    delete archivedData.id;
                    const archivedRef = doc(db, 'archivedCheckouts', checkout.id);
                    batch.set(archivedRef, archivedData);

                    // Remove from active checkout history
                    const checkoutRef = doc(db, 'checkoutHistory', checkout.id);
                    batch.delete(checkoutRef);
                }
            }

            // Update inventory quantities (add confirmed quantities to stock)
            for (const match of matchedCheckouts) {
                const inventoryRef = doc(db, 'items', match.inventoryItem.id);
                const currentQty = match.inventoryItem.quantity || 0;
                const newQty = currentQty + match.confirmedQuantity;
                batch.update(inventoryRef, { quantity: newQty });
            }

            await batch.commit();

            // Save transaction data for undo functionality
            const transactionData = {
                timestamp: new Date().toISOString(),
                itemsProcessed: allCheckoutRecords.length,
                totalAmount: total,
                checkoutRecords: allCheckoutRecords,
                inventoryUpdates: matchedCheckouts.map(match => ({
                    itemId: match.inventoryItem.id,
                    quantityAdded: match.confirmedQuantity
                }))
            };
            setLastProcessedTransaction(transactionData);

            // Save processing result for display
            const result = {
                timestamp: new Date().toISOString(),
                itemsProcessed: allCheckoutRecords.length,
                totalAmount: total
            };
            setProcessingResults(prev => [...prev, result]);

            // Reset form
            setSelectedInventoryItems([]);
            setMatchedCheckouts([]);
            setManualTax('');
            setManualFees('');
            setUploadedPdf(null);

            setStatus(`✅ Shipment processed successfully! ${totalQuantity} items from ${matchedCheckouts.length} product type(s) included in report. PDF downloaded and items archived.`);
            setIsProcessing(false);

        } catch (error) {
            console.error('Error processing shipment:', error);
            setStatus(`❌ Error: ${error.message}`);
            setIsProcessing(false);
        }
    };

    // Generate PDF cost allocation report matching oldinvoice.pdf format
    const generateCostAllocationReport = async (allocation, totals, uploadedPdf, allCheckoutRecords) => {
        try {
            const PDFLib = window.PDFLib;
            const { PDFDocument, rgb, StandardFonts } = PDFLib;

            // Extract taxPerItem and feePerItem from totals
            const taxPerItem = totals.taxPerItem || 0;
            const feePerItem = totals.feePerItem || 0;

            // Load the uploaded PDF as base document
            const uploadedPdfBytes = await uploadedPdf.arrayBuffer();
            const pdfDoc = await PDFDocument.load(uploadedPdfBytes);
            let currentPage = pdfDoc.addPage([612, 792]); // Letter size
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            const { width, height } = currentPage.getSize();
            let yPos = height - 50;

            // Title
            currentPage.drawText('Shipment Cost Allocation Report', {
                x: 50,
                y: yPos,
                size: 16,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 30;

            // Tax and fees distribution note
            if (totals.tax > 0 || totals.fees > 0) {
                const taxFeeNote = `Tax ($${totals.tax.toFixed(2)}) and Fees ($${totals.fees.toFixed(2)}) distributed evenly per item`;
                currentPage.drawText(taxFeeNote, {
                    x: 50,
                    y: yPos,
                    size: 10,
                    font: font,
                    color: rgb(0, 0, 0)
                });
                yPos -= 30;
            }

            // Cost Allocation Summary heading
            currentPage.drawText('Cost Allocation Summary', {
                x: 50,
                y: yPos,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 25;

            // Table header
            currentPage.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Qty', { x: 280, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Job/Cost Code', { x: 320, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Unit Price', { x: 440, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Total Cost', { x: 510, y: yPos, size: 9, font: boldFont });
            yPos -= 15;

            // Table data
            for (const item of allocation) {
                if (yPos < 150) {
                    // Create new page if needed
                    currentPage = pdfDoc.addPage([612, 792]);
                    yPos = height - 50;
                    // Re-draw table header on new page
                    currentPage.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Qty', { x: 280, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Job/Cost Code', { x: 320, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Unit Price', { x: 440, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Total Cost', { x: 510, y: yPos, size: 9, font: boldFont });
                    yPos -= 15;
                }

                const itemName = item.itemName.length > 45 ?
                    item.itemName.substring(0, 45) + '...' : item.itemName;

                currentPage.drawText(itemName, { x: 50, y: yPos, size: 9, font });
                currentPage.drawText(String(item.quantity), { x: 280, y: yPos, size: 9, font });
                currentPage.drawText(item.costCode || '-', { x: 320, y: yPos, size: 9, font });
                currentPage.drawText(`$${item.unitPrice.toFixed(2)}`, { x: 440, y: yPos, size: 9, font });
                currentPage.drawText(`$${item.totalCost.toFixed(2)}`, { x: 510, y: yPos, size: 9, font });
                yPos -= 15;
            }

            yPos -= 10;

            // Quantity total for allocation summary
            const totalAllocationQty = allocation.reduce((sum, item) => sum + item.quantity, 0);
            currentPage.drawText(`Total Items: ${totalAllocationQty}`, { x: 50, y: yPos, size: 9, font: boldFont });
            yPos -= 20;

            // Financial totals (right-aligned like the invoice)
            const totalsX = 420;
            currentPage.drawText(`Subtotal (Items): $${totals.subtotal.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 12;
            currentPage.drawText(`Tax: $${totals.tax.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 12;
            currentPage.drawText(`Fees: $${totals.fees.toFixed(2)}`, { x: totalsX, y: yPos, size: 9, font });
            yPos -= 15;
            currentPage.drawText(`Grand Total: $${totals.total.toFixed(2)}`, { x: totalsX, y: yPos, size: 10, font: boldFont });
            yPos -= 30;

            // Check if we need a new page for Individual Checkout Details
            if (yPos < 150) {
                currentPage = pdfDoc.addPage([612, 792]);
                yPos = height - 50;
            }

            // Individual Checkout Details heading
            currentPage.drawText('Individual Checkout Details', {
                x: 50,
                y: yPos,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            yPos -= 25;

            // Checkout details table header
            currentPage.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('User', { x: 210, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Qty', { x: 330, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Cost Code', { x: 360, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Unit Price', { x: 460, y: yPos, size: 9, font: boldFont });
            currentPage.drawText('Total Cost', { x: 520, y: yPos, size: 9, font: boldFont });
            yPos -= 15;

            // Checkout details data
            for (const checkout of allCheckoutRecords) {
                if (yPos < 100) {
                    // Create new page and re-draw header
                    currentPage = pdfDoc.addPage([612, 792]);
                    yPos = height - 50;
                    currentPage.drawText('Item Description', { x: 50, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('User', { x: 210, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Qty', { x: 330, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Cost Code', { x: 360, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Unit Price', { x: 460, y: yPos, size: 9, font: boldFont });
                    currentPage.drawText('Total Cost', { x: 520, y: yPos, size: 9, font: boldFont });
                    yPos -= 15;
                }

                const itemName = checkout.inventoryItem.name.length > 30 ?
                    checkout.inventoryItem.name.substring(0, 30) + '...' : checkout.inventoryItem.name;
                const userName = (checkout.userName || checkout.user || 'N/A').length > 20 ?
                    (checkout.userName || checkout.user || 'N/A').substring(0, 20) + '...' : (checkout.userName || checkout.user || 'N/A');
                const costCode = checkout.departmentId || checkout.costCode || 'IT Stock 1-20-000-5770';
                const unitPrice = checkout.confirmedPrice;
                const qty = checkout.quantity || 1;
                const itemTax = taxPerItem * qty;
                const itemFees = feePerItem * qty;
                const totalCost = (unitPrice * qty) + itemTax + itemFees;

                currentPage.drawText(itemName, { x: 50, y: yPos, size: 9, font });
                currentPage.drawText(userName, { x: 210, y: yPos, size: 9, font });
                currentPage.drawText(String(qty), { x: 330, y: yPos, size: 9, font });
                currentPage.drawText(costCode, { x: 360, y: yPos, size: 9, font });
                currentPage.drawText(`$${unitPrice.toFixed(2)}`, { x: 460, y: yPos, size: 9, font });
                currentPage.drawText(`$${totalCost.toFixed(2)}`, { x: 520, y: yPos, size: 9, font });
                yPos -= 15;
            }

            // Quantity total for individual checkout details
            yPos -= 5;
            const totalIndividualQty = allCheckoutRecords.reduce((sum, checkout) => sum + (checkout.quantity || 1), 0);
            currentPage.drawText(`Total Items: ${totalIndividualQty}`, { x: 50, y: yPos, size: 9, font: boldFont });

            // Save and download PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            // Use original uploaded filename to preserve file identity
            link.download = uploadedPdf.name;
            link.click();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error generating PDF report:', error);
            throw error;
        }
    };

    // Filter inventory items
    const filteredInventoryItems = items.filter(item => {
        if (!inventorySearchQuery) return true;
        const searchLower = inventorySearchQuery.toLowerCase();
        return (
            item.name?.toLowerCase().includes(searchLower) ||
            item.category?.toLowerCase().includes(searchLower) ||
            item.asin?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mat-card p-6">
                <h2 className="text-2xl font-bold flex items-center mb-4" style={{ color: 'var(--color-text-light)' }}>
                    <span className="material-icons mr-2">receipt_long</span>
                    Process Shipment Receipt
                </h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Follow the 3-step workflow: Select inventory items, confirm quantities & prices, then upload receipt and process with automatic cost allocation.
                </p>
            </div>

            {/* Step 1: Inventory Item Selection */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full mr-2 text-sm font-bold" style={{ background: 'var(--color-primary-blue)', color: 'white' }}>1</span>
                    <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>inventory_2</span>
                    Select Items from Inventory ({selectedInventoryItems.length} selected)
                </h3>

                {/* Search */}
                <div className="mb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by item name, category, or ASIN..."
                            value={inventorySearchQuery}
                            onChange={(e) => setInventorySearchQuery(e.target.value)}
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

                {/* Inventory Items Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Select</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Item</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Category</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Qty</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Price</th>
                                <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-light)' }}>Cost Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventoryItems.slice(0, 20).map((item) => {
                                const isSelected = selectedInventoryItems.some(selected => selected.id === item.id);
                                const costCode = 'IT Stock 1-20-000-5770'; // Default, will be updated from checkout records during processing

                                return (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-[var(--md-sys-color-outline-variant)] cursor-pointer hover:bg-[var(--md-sys-color-surface-container-highest)] ${
                                            isSelected ? 'bg-[rgba(59,130,246,0.15)]' : ''
                                        }`}
                                        onClick={() => handleToggleInventoryItem(item)}
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
                                            {item.name}
                                            {item.asin && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.asin}</div>}
                                        </td>
                                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            {item.category || 'Uncategorized'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="quantity-badge adequate-stock">{item.quantity || 0}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--color-success-green)' }}>
                                            {item.price > 0 ? `$${item.price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className="pill-badge">{costCode}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredInventoryItems.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                            No inventory items available
                        </div>
                    )}
                    {filteredInventoryItems.length > 20 && (
                        <div className="text-center py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Showing first 20 of {filteredInventoryItems.length} items
                        </div>
                    )}
                </div>
            </div>

            {/* Step 2: Matched Checkout Records */}
            {matchedCheckouts.length > 0 && (
                <div className="mat-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full mr-2 text-sm font-bold" style={{ background: 'var(--color-primary-blue)', color: 'white' }}>2</span>
                        <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>link</span>
                        Confirm Quantities & Prices ({matchedCheckouts.length} items)
                    </h3>

                    <div className="space-y-4">
                        {matchedCheckouts.map((match, index) => (
                            <div key={match.inventoryItem.id} className="border border-[var(--md-sys-color-outline-variant)] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                        {match.inventoryItem.name}
                                    </h4>
                                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        {match.checkoutRecords.length} checkout{match.checkoutRecords.length !== 1 ? 's' : ''} matched
                                    </span>
                                </div>

                                {/* Checkout Details */}
                                {match.checkoutRecords.length > 0 && (
                                    <div className="mb-3">
                                        <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-light)' }}>Checkout Details:</h5>
                                        <div className="space-y-1">
                                            {match.checkoutRecords.map((checkout, idx) => (
                                                <div key={checkout.id} className="text-xs p-2 rounded" style={{ background: 'var(--md-sys-color-surface-container-high)', color: 'var(--color-text-muted)' }}>
                                                    {checkout.userName || checkout.user} • Qty: {checkout.quantity} • Dept: {checkout.departmentId || checkout.costCode} • {new Date(checkout.dateEntered?.toDate?.() || checkout.dateEntered || checkout.date).toLocaleDateString()}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Confirmation Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-light)' }}>
                                            Received Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={match.confirmedQuantity}
                                            onChange={(e) => updateConfirmedDetails(match.inventoryItem.id, 'confirmedQuantity', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-[var(--md-sys-color-outline-variant)]"
                                            style={{
                                                background: 'var(--md-sys-color-surface)',
                                                color: 'var(--color-text-light)'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-light)' }}>
                                            Unit Price
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={match.confirmedPrice}
                                            onChange={(e) => updateConfirmedDetails(match.inventoryItem.id, 'confirmedPrice', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-[var(--md-sys-color-outline-variant)]"
                                            style={{
                                                background: 'var(--md-sys-color-surface)',
                                                color: 'var(--color-text-light)'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    Total: ${(match.confirmedQuantity * match.confirmedPrice).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 3: Processing Options */}
            <div className="mat-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full mr-2 text-sm font-bold" style={{ background: 'var(--color-primary-blue)', color: 'white' }}>3</span>
                    <span className="material-icons mr-2" style={{ color: 'var(--color-success-green)' }}>receipt_long</span>
                    Upload Receipt & Finalize
                </h3>

                {/* PDF Upload Section */}
                <div className="mb-6">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-light)' }}>
                        Upload Receipt PDF (Required)
                    </label>
                    <div className="border-2 border-dashed border-[var(--md-sys-color-outline-variant)] rounded-lg p-6 text-center hover:border-[var(--color-primary-blue)] transition-colors">
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfUpload}
                            className="hidden"
                            id="pdf-upload"
                        />
                        <label htmlFor="pdf-upload" className="cursor-pointer">
                            <span className="material-icons text-4xl" style={{ color: 'var(--color-text-muted)' }}>upload_file</span>
                            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-light)' }}>
                                Click to upload PDF receipt or drag and drop
                            </p>
                            {uploadedPdf && (
                                <p className="mt-2 text-sm font-medium" style={{ color: 'var(--color-success-green)' }}>
                                    Selected: {uploadedPdf.name}
                                </p>
                            )}
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Live Cost Summary */}
                {matchedCheckouts.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--md-sys-color-surface-container-highest)', border: '2px solid var(--color-primary-blue)' }}>
                        <h4 className="font-semibold mb-3 flex items-center" style={{ color: 'var(--color-text-light)' }}>
                            <span className="material-icons mr-2" style={{ color: 'var(--color-primary-blue)' }}>calculate</span>
                            Cost Summary
                        </h4>
                        <div className="space-y-2">
                            {(() => {
                                const subtotal = matchedCheckouts.reduce((sum, match) =>
                                    sum + (match.confirmedQuantity * match.confirmedPrice), 0
                                );
                                const tax = parseFloat(manualTax) || 0;
                                const fees = parseFloat(manualFees) || 0;
                                const total = subtotal + tax + fees;

                                return (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span style={{ color: 'var(--color-text-muted)' }}>Subtotal:</span>
                                            <span className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                                ${subtotal.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span style={{ color: 'var(--color-text-muted)' }}>Tax:</span>
                                            <span className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                                ${tax.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span style={{ color: 'var(--color-text-muted)' }}>Fees:</span>
                                            <span className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                                ${fees.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="pt-2 mt-2 border-t border-[var(--md-sys-color-outline-variant)]">
                                            <div className="flex justify-between">
                                                <span className="font-bold" style={{ color: 'var(--color-text-light)' }}>Total:</span>
                                                <span className="font-bold text-xl" style={{ color: 'var(--color-success-green)' }}>
                                                    ${total.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                <MaterialButton
                    color="success"
                    className="w-full mt-6"
                    disabled={isProcessing || !uploadedPdf || matchedCheckouts.length === 0}
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
                            Process Receipt ({matchedCheckouts.length} items)
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

            {/* Undo Button */}
            {lastProcessedTransaction && (
                <div className="mat-card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center mb-2" style={{ color: 'var(--color-text-light)' }}>
                                <span className="material-icons mr-2" style={{ color: 'var(--color-warning-orange)' }}>undo</span>
                                Undo Last Processing
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Last processed: {lastProcessedTransaction.itemsProcessed} items • Total: ${lastProcessedTransaction.totalAmount.toFixed(2)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                {new Date(lastProcessedTransaction.timestamp).toLocaleString()}
                            </p>
                        </div>
                        <MaterialButton
                            variant="outlined"
                            color="error"
                            onClick={handleUndoProcessing}
                            className="ml-4"
                        >
                            <span className="material-icons mr-2">undo</span>
                            Undo Transaction
                        </MaterialButton>
                    </div>
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
                                        <p className="font-medium" style={{ color: 'var(--color-text-light)' }}>
                                            {result.itemsProcessed} items processed
                                        </p>
                                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            Total: ${result.totalAmount.toFixed(2)}
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
