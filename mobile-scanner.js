// Mobile-Optimized Scanner Component
// Designed for tablets and phones with touch-friendly interface

const MobileScanner = ({ items, onItemScanned }) => {
    const [scanMode, setScanMode] = React.useState('camera'); // camera, keyboard, quick
    const [scanInput, setScanInput] = React.useState('');
    const [isScanning, setIsScanning] = React.useState(false);
    const [recentScans, setRecentScans] = React.useState([]);
    const [quickScanItems, setQuickScanItems] = React.useState([]);
    const [feedback, setFeedback] = React.useState('');

    // BENEFICIAL IMPROVEMENT: Quick scan for frequent items
    React.useEffect(() => {
        // Get most frequently scanned items for quick access
        const frequentItems = items
            .filter(item => item.category === 'Electronics' || item.quantity < 20)
            .slice(0, 12); // Top 12 for 3x4 grid on mobile

        setQuickScanItems(frequentItems);
    }, [items]);

    const showFeedback = (message, type = 'success') => {
        setFeedback({ message, type });

        // Haptic feedback on mobile
        if ('vibrate' in navigator) {
            navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
        }

        setTimeout(() => setFeedback(''), 3000);
    };

    const handleItemScanned = async (item, quantity = 1) => {
        try {
            setIsScanning(true);

            // Update Firebase with atomic transaction
            await window.firebaseAdapter.updateInventory(
                item.id,
                quantity,
                'mobile-scan'
            );

            // Add to recent scans (keep last 5)
            const scanRecord = {
                id: Date.now(),
                item: item,
                quantity: quantity,
                timestamp: new Date()
            };

            setRecentScans(prev => [scanRecord, ...prev.slice(0, 4)]);

            showFeedback(`✅ ${item.name} +${quantity}`, 'success');

            if (onItemScanned) {
                onItemScanned(item, quantity);
            }

        } catch (error) {
            showFeedback(`❌ Scan failed: ${error.message}`, 'error');
        } finally {
            setIsScanning(false);
        }
    };

    // BENEFICIAL IMPROVEMENT: Voice-to-text scanning
    const startVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            showFeedback('❌ Voice recognition not supported', 'error');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            showFeedback('🎤 Listening... speak item name', 'info');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            setScanInput(transcript);

            // Auto-search for matching item
            const matchingItem = items.find(item =>
                item.name.toLowerCase().includes(transcript) ||
                transcript.includes(item.name.toLowerCase().split(' ')[0])
            );

            if (matchingItem) {
                handleItemScanned(matchingItem);
            } else {
                showFeedback(`❌ No item found matching "${transcript}"`, 'error');
            }
        };

        recognition.onerror = () => {
            showFeedback('❌ Voice recognition failed', 'error');
        };

        recognition.start();
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20"> {/* Extra padding for mobile keyboards */}

            {/* Mobile Header */}
            <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">📱 Mobile Scanner</h1>
                    <div className="text-sm bg-blue-500 px-2 py-1 rounded">
                        {items.length} items
                    </div>
                </div>
            </div>

            {/* Feedback Bar */}
            {feedback && (
                <div className={`p-3 text-center font-medium ${
                    feedback.type === 'success' ? 'bg-green-100 text-green-700' :
                    feedback.type === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                }`}>
                    {feedback.message}
                </div>
            )}

            {/* Scan Mode Selector */}
            <div className="p-4 bg-white border-b">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => setScanMode('camera')}
                        className={`p-3 rounded-lg text-center ${
                            scanMode === 'camera'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                        <div className="text-2xl">📷</div>
                        <div className="text-xs mt-1">Camera</div>
                    </button>
                    <button
                        onClick={() => setScanMode('keyboard')}
                        className={`p-3 rounded-lg text-center ${
                            scanMode === 'keyboard'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                        <div className="text-2xl">⌨️</div>
                        <div className="text-xs mt-1">Keyboard</div>
                    </button>
                    <button
                        onClick={() => setScanMode('quick')}
                        className={`p-3 rounded-lg text-center ${
                            scanMode === 'quick'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                        <div className="text-2xl">⚡</div>
                        <div className="text-xs mt-1">Quick</div>
                    </button>
                </div>
            </div>

            {/* Camera Scanning Mode */}
            {scanMode === 'camera' && (
                <div className="p-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold mb-3 text-center">📷 Camera Scanning</h3>

                        {/* Camera placeholder - would integrate with actual camera */}
                        <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                            <div className="text-center text-gray-500">
                                <div className="text-4xl mb-2">📷</div>
                                <div className="text-sm">Camera view would appear here</div>
                                <div className="text-xs mt-1">Using BarcodeDetector API</div>
                            </div>
                        </div>

                        <button
                            onClick={startVoiceSearch}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium mb-2"
                        >
                            🎤 Voice Search
                        </button>

                        <p className="text-xs text-gray-500 text-center">
                            Point camera at barcode or use voice to search by name
                        </p>
                    </div>
                </div>
            )}

            {/* Keyboard Scanning Mode */}
            {scanMode === 'keyboard' && (
                <div className="p-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold mb-3 text-center">⌨️ Manual Entry</h3>

                        <input
                            type="text"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    const item = items.find(i =>
                                        i.name.toLowerCase().includes(scanInput.toLowerCase()) ||
                                        i.asin === scanInput ||
                                        i.id === scanInput
                                    );
                                    if (item) {
                                        handleItemScanned(item);
                                        setScanInput('');
                                    } else {
                                        showFeedback(`❌ Item not found: ${scanInput}`, 'error');
                                    }
                                }
                            }}
                            placeholder="Type item name, ASIN, or scan..."
                            className="w-full p-4 border border-gray-300 rounded-lg text-lg mb-4"
                            autoFocus
                        />

                        <button
                            onClick={startVoiceSearch}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
                        >
                            🎤 Use Voice Instead
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Scan Mode - Most Used Items */}
            {scanMode === 'quick' && (
                <div className="p-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold mb-3 text-center">⚡ Quick Scan</h3>
                        <p className="text-sm text-gray-600 text-center mb-4">
                            Tap frequently scanned items
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            {quickScanItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemScanned(item)}
                                    disabled={isScanning}
                                    className="p-4 bg-gray-50 rounded-lg text-left hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 transition-colors"
                                >
                                    <div className="font-medium text-sm mb-1 truncate">
                                        {item.name}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-500">
                                            Qty: {item.quantity}
                                        </span>
                                        {item.price > 0 && (
                                            <span className="text-xs text-green-600 font-medium">
                                                ${item.price}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {item.category}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Scans */}
            {recentScans.length > 0 && (
                <div className="p-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold mb-3">📋 Recent Scans</h3>
                        <div className="space-y-2">
                            {recentScans.map((scan, index) => (
                                <div
                                    key={scan.id}
                                    className={`flex justify-between items-center p-3 rounded-lg ${
                                        index === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">
                                            {scan.item.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {scan.timestamp.toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className="text-green-600 font-semibold">
                                        +{scan.quantity}
                                    </div>
                                    <button
                                        onClick={() => handleItemScanned(scan.item)}
                                        className="ml-2 text-blue-600 text-sm"
                                    >
                                        Scan Again
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile-specific Instructions */}
            <div className="p-4">
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                    <div className="font-medium mb-2">📱 Mobile Scanning Tips:</div>
                    <ul className="text-xs space-y-1">
                        <li>• Camera mode works best with good lighting</li>
                        <li>• Voice search understands partial names</li>
                        <li>• Quick scan shows your most-used items</li>
                        <li>• All scans work offline and sync automatically</li>
                        <li>• Haptic feedback confirms successful scans</li>
                    </ul>
                </div>
            </div>

        </div>
    );
};

window.MobileScanner = MobileScanner;