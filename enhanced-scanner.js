// Enhanced Barcode Scanner Component for Firebase
// Supports keyboard scanning, camera scanning, and real-time updates

const EnhancedScanner = ({ items, onItemScanned, onQuantityUpdate, scanMode = 'keyboard' }) => {
    const [scanInput, setScanInput] = React.useState('');
    const [isScanning, setIsScanning] = React.useState(false);
    const [scanHistory, setScanHistory] = React.useState([]);
    const [cameraStream, setCameraStream] = React.useState(null);
    const [scanFeedback, setScanFeedback] = React.useState('');
    const [audioEnabled, setAudioEnabled] = React.useState(true);

    const scanInputRef = React.useRef(null);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    // BENEFICIAL IMPROVEMENT: Audio feedback for scans
    const playBeep = (success = true) => {
        if (!audioEnabled) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(success ? 800 : 400, audioContext.currentTime);
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    };

    // BENEFICIAL IMPROVEMENT: Real-time Firebase inventory updates
    const handleItemScanned = async (itemIdentifier, quantityChange = 1) => {
        try {
            // Find item by name, ASIN, or ID
            const item = items.find(i =>
                i.name.toLowerCase().includes(itemIdentifier.toLowerCase()) ||
                i.asin === itemIdentifier ||
                i.id === itemIdentifier
            );

            if (!item) {
                setScanFeedback(`❌ Item not found: ${itemIdentifier}`);
                playBeep(false);
                return false;
            }

            // Update inventory in Firebase with atomic transaction
            await window.firebaseAdapter.updateInventory(
                item.id,
                quantityChange,
                'barcode-scan'
            );

            // Add to scan history
            const scanRecord = {
                id: Date.now().toString(),
                itemId: item.id,
                itemName: item.name,
                quantityChange: quantityChange,
                timestamp: new Date(),
                scannedBy: window.firebaseAdapter.currentUser?.email || 'anonymous'
            };

            setScanHistory(prev => [scanRecord, ...prev.slice(0, 9)]); // Keep last 10 scans

            // Show success feedback
            setScanFeedback(`✅ ${item.name} +${quantityChange}`);
            playBeep(true);

            // Clear feedback after 3 seconds
            setTimeout(() => setScanFeedback(''), 3000);

            // Callback for parent component
            if (onItemScanned) {
                onItemScanned(item, quantityChange);
            }

            return true;

        } catch (error) {
            console.error('❌ Scan error:', error);
            setScanFeedback(`❌ Scan failed: ${error.message}`);
            playBeep(false);
            return false;
        }
    };

    // Keyboard scanning (existing functionality enhanced)
    const handleKeyboardScan = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            if (scanInput.trim()) {
                setIsScanning(true);
                await handleItemScanned(scanInput.trim());
                setScanInput('');
                setIsScanning(false);

                // Keep focus on input for rapid scanning
                if (scanInputRef.current) {
                    scanInputRef.current.focus();
                }
            }
        }
    };

    // BENEFICIAL IMPROVEMENT: Camera-based scanning
    const startCameraScanning = async () => {
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera if available
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            setCameraStream(stream);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();

                // Start barcode detection
                startBarcodeDetection();
            }

            setScanFeedback('📷 Camera scanning active - point at barcode');

        } catch (error) {
            console.error('❌ Camera access error:', error);
            setScanFeedback('❌ Camera access denied or not available');
        }
    };

    const stopCameraScanning = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setScanFeedback('');
    };

    // BENEFICIAL IMPROVEMENT: Real-time barcode detection
    const startBarcodeDetection = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const detectBarcodes = () => {
            if (video.readyState === 4) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);

                // Try to use BarcodeDetector API (Chrome/Edge)
                if ('BarcodeDetector' in window) {
                    const detector = new BarcodeDetector();
                    detector.detect(canvas).then(barcodes => {
                        if (barcodes.length > 0) {
                            const barcode = barcodes[0];
                            handleItemScanned(barcode.rawValue);
                        }
                    }).catch(err => {
                        // Fallback to manual detection or third-party library
                        console.log('Barcode detection not available:', err);
                    });
                } else {
                    // Could integrate with libraries like QuaggaJS or ZXing-js
                    console.log('BarcodeDetector not supported in this browser');
                }
            }

            // Continue detection
            if (cameraStream) {
                requestAnimationFrame(detectBarcodes);
            }
        };

        detectBarcodes();
    };

    // BENEFICIAL IMPROVEMENT: Batch scanning mode
    const BatchScanMode = () => {
        const [batchItems, setBatchItems] = React.useState([]);
        const [batchQuantity, setBatchQuantity] = React.useState(1);

        const processBatchScans = async () => {
            if (batchItems.length === 0) return;

            setIsScanning(true);
            setScanFeedback(`📦 Processing ${batchItems.length} items...`);

            try {
                // Process all scans in Firebase batch
                const updates = batchItems.map(item => ({
                    id: item.id,
                    data: { quantity: item.quantity + batchQuantity }
                }));

                await window.firebaseAdapter.batchUpdate('items', updates);

                setScanFeedback(`✅ Batch processed: ${batchItems.length} items`);
                setBatchItems([]);
                playBeep(true);

            } catch (error) {
                setScanFeedback(`❌ Batch failed: ${error.message}`);
                playBeep(false);
            } finally {
                setIsScanning(false);
            }
        };

        return (
            <div className="mt-4 p-4 border border-gray-300 rounded">
                <h3 className="font-semibold mb-2">📦 Batch Scan Mode</h3>
                <div className="flex items-center space-x-2 mb-2">
                    <label>Default Quantity:</label>
                    <input
                        type="number"
                        value={batchQuantity}
                        onChange={(e) => setBatchQuantity(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 border rounded"
                        min="1"
                    />
                </div>
                <div className="mb-2">
                    <strong>Queued Items:</strong> {batchItems.length}
                </div>
                {batchItems.length > 0 && (
                    <button
                        onClick={processBatchScans}
                        disabled={isScanning}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isScanning ? 'Processing...' : `Process ${batchItems.length} Items`}
                    </button>
                )}
            </div>
        );
    };

    // Clean up camera on unmount
    React.useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    return (
        <div className="bg-white p-6 border border-gray-300 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">📷 Enhanced Barcode Scanner</h2>
                <div className="flex items-center space-x-2">
                    <label className="text-sm">
                        <input
                            type="checkbox"
                            checked={audioEnabled}
                            onChange={(e) => setAudioEnabled(e.target.checked)}
                            className="mr-1"
                        />
                        Audio
                    </label>
                </div>
            </div>

            {/* Feedback Display */}
            {scanFeedback && (
                <div className={`mb-4 p-3 rounded ${
                    scanFeedback.includes('❌')
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-green-100 text-green-700 border border-green-300'
                }`}>
                    {scanFeedback}
                </div>
            )}

            {/* Scanning Mode Tabs */}
            <div className="mb-4">
                <div className="flex space-x-2">
                    <button
                        onClick={() => {
                            if (cameraStream) stopCameraScanning();
                        }}
                        className={`px-3 py-2 rounded text-sm ${
                            !cameraStream ? 'bg-blue-600 text-white' : 'bg-gray-200'
                        }`}
                    >
                        ⌨️ Keyboard
                    </button>
                    <button
                        onClick={cameraStream ? stopCameraScanning : startCameraScanning}
                        className={`px-3 py-2 rounded text-sm ${
                            cameraStream ? 'bg-blue-600 text-white' : 'bg-gray-200'
                        }`}
                    >
                        📷 Camera
                    </button>
                </div>
            </div>

            {/* Keyboard Scanning */}
            {!cameraStream && (
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                        Scan Item (Name, ASIN, or ID):
                    </label>
                    <input
                        ref={scanInputRef}
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyPress={handleKeyboardScan}
                        placeholder="Scan barcode or type item name..."
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isScanning}
                        autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Press Enter to scan • Focus will stay in this field for rapid scanning
                    </p>
                </div>
            )}

            {/* Camera Scanning */}
            {cameraStream && (
                <div className="mb-4">
                    <video
                        ref={videoRef}
                        className="w-full max-w-md mx-auto rounded border"
                        playsInline
                        muted
                    />
                    <canvas
                        ref={canvasRef}
                        className="hidden"
                    />
                    <p className="text-sm text-gray-500 text-center mt-2">
                        Point camera at barcode - detection is automatic
                    </p>
                </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold mb-2">📋 Recent Scans</h3>
                    <div className="max-h-40 overflow-y-auto">
                        {scanHistory.map((scan, index) => (
                            <div
                                key={scan.id}
                                className={`flex justify-between items-center p-2 rounded mb-1 ${
                                    index === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                }`}
                            >
                                <div className="flex-1">
                                    <div className="font-medium">{scan.itemName}</div>
                                    <div className="text-xs text-gray-500">
                                        {scan.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                                <div className="text-green-600 font-semibold">
                                    +{scan.quantityChange}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
                <strong>💡 Scanning Tips:</strong>
                <ul className="mt-1 list-disc list-inside text-xs">
                    <li>Use keyboard mode with handheld scanners</li>
                    <li>Use camera mode for mobile devices</li>
                    <li>All scans update inventory in real-time</li>
                    <li>Multiple users can scan simultaneously</li>
                    <li>Offline scans sync when reconnected</li>
                </ul>
            </div>
        </div>
    );
};

window.EnhancedScanner = EnhancedScanner;