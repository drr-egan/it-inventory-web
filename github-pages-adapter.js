// GitHub Pages Data Adapter
// Replaces API calls with localStorage + static JSON file loading

class GitHubPagesDataAdapter {
    constructor() {
        this.initialized = false;
        this.data = {
            items: [],
            users: [],
            checkoutHistory: []
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        console.log('🚀 Initializing GitHub Pages Data Adapter...');
        
        // Load existing data from localStorage
        const savedItems = localStorage.getItem('inventory_items');
        const savedUsers = localStorage.getItem('inventory_users');
        const savedHistory = localStorage.getItem('inventory_checkoutHistory');
        
        if (savedItems && savedUsers && savedHistory) {
            // Use saved data
            this.data.items = JSON.parse(savedItems);
            this.data.users = JSON.parse(savedUsers);
            this.data.checkoutHistory = JSON.parse(savedHistory);
            console.log('✅ Loaded data from localStorage');
        } else {
            // Load initial data from static JSON files
            await this.loadInitialData();
        }
        
        this.initialized = true;
        console.log('✅ GitHub Pages Data Adapter ready');
    }
    
    async loadInitialData() {
        try {
            console.log('📥 Loading initial data...');

            // Try to load embedded data first (more reliable for GitHub Pages)
            if (window.EMBEDDED_INVENTORY_DATA) {
                console.log('✅ Using embedded inventory data');
                this.data.items = window.EMBEDDED_INVENTORY_DATA.items || [];
                this.data.users = window.EMBEDDED_INVENTORY_DATA.users || [];
                this.data.checkoutHistory = window.EMBEDDED_INVENTORY_DATA.checkoutHistory || [];

                console.log(`✅ Loaded ${this.data.items.length} items from embedded data`);
                console.log(`✅ Loaded ${this.data.users.length} users from embedded data`);
                console.log(`✅ Loaded ${this.data.checkoutHistory.length} checkout records from embedded data`);

                this.saveToLocalStorage();
                console.log('✅ Embedded data loaded and saved to localStorage');
                return;
            }

            // Fallback: Try to load from JSON files
            console.log('⚠️ No embedded data found, trying JSON files...');

            // Load items
            try {
                const itemsResponse = await fetch('./data/items.json');
                if (itemsResponse.ok) {
                    const itemsData = await itemsResponse.json();
                    this.data.items = Array.isArray(itemsData) && itemsData.length > 0 ? itemsData : this.getDefaultItems();
                    console.log(`✅ Loaded ${this.data.items.length} items from JSON`);
                } else {
                    throw new Error(`HTTP ${itemsResponse.status}`);
                }
            } catch (error) {
                console.warn('⚠️ Could not load items.json:', error);
                this.data.items = this.getDefaultItems();
            }

            // Load users
            try {
                const usersResponse = await fetch('./data/users.json');
                if (usersResponse.ok) {
                    const usersData = await usersResponse.json();
                    this.data.users = Array.isArray(usersData) && usersData.length > 0 ? usersData : this.getDefaultUsers();
                    console.log(`✅ Loaded ${this.data.users.length} users from JSON`);
                } else {
                    throw new Error(`HTTP ${usersResponse.status}`);
                }
            } catch (error) {
                console.warn('⚠️ Could not load users.json:', error);
                this.data.users = this.getDefaultUsers();
            }

            // Load checkout history
            try {
                const historyResponse = await fetch('./data/checkoutHistory.json');
                if (historyResponse.ok) {
                    const historyData = await historyResponse.json();
                    this.data.checkoutHistory = Array.isArray(historyData) ? historyData : [];
                    console.log(`✅ Loaded ${this.data.checkoutHistory.length} checkout records from JSON`);
                } else {
                    throw new Error(`HTTP ${historyResponse.status}`);
                }
            } catch (error) {
                console.warn('⚠️ Could not load checkoutHistory.json:', error);
                this.data.checkoutHistory = [];
            }

            // Save to localStorage
            this.saveToLocalStorage();
            console.log('✅ Fallback data loaded and saved to localStorage');

        } catch (error) {
            console.error('❌ Failed to load any data, using defaults:', error);
            this.data.items = this.getDefaultItems();
            this.data.users = this.getDefaultUsers();
            this.data.checkoutHistory = [];
            this.saveToLocalStorage();
        }
    }

    getDefaultItems() {
        return [
            {
                "id": "item001",
                "name": "Dell Monitor 24\"",
                "asin": "B07CVL2D2T",
                "quantity": 15,
                "minThreshold": 5,
                "category": "Electronics",
                "price": 299.99
            },
            {
                "id": "item002",
                "name": "USB-C Hub",
                "asin": "B08HR6DSLT",
                "quantity": 25,
                "minThreshold": 10,
                "category": "Accessories",
                "price": 49.99
            },
            {
                "id": "item003",
                "name": "Wireless Mouse",
                "asin": "B07FKMDJQZ",
                "quantity": 30,
                "minThreshold": 15,
                "category": "Accessories",
                "price": 29.99
            },
            {
                "id": "item004",
                "name": "Ethernet Cable 6ft",
                "asin": "B00N2VIALK",
                "quantity": 50,
                "minThreshold": 20,
                "category": "Cables",
                "price": 12.99
            },
            {
                "id": "item005",
                "name": "Laptop Stand",
                "asin": "B075GCG36Z",
                "quantity": 8,
                "minThreshold": 3,
                "category": "Accessories",
                "price": 79.99
            }
        ];
    }

    getDefaultUsers() {
        return [
            {
                "id": "user001",
                "name": "John Doe",
                "cost_code": "IT-001-5770",
                "firstName": "John",
                "lastName": "Doe"
            },
            {
                "id": "user002",
                "name": "Jane Smith",
                "cost_code": "IT-002-5770",
                "firstName": "Jane",
                "lastName": "Smith"
            },
            {
                "id": "user003",
                "name": "Mike Wilson",
                "cost_code": "HR-001-5770",
                "firstName": "Mike",
                "lastName": "Wilson"
            },
            {
                "id": "user004",
                "name": "Sarah Johnson",
                "cost_code": "ACC-001-5770",
                "firstName": "Sarah",
                "lastName": "Johnson"
            }
        ];
    }
    
    saveToLocalStorage() {
        localStorage.setItem('inventory_items', JSON.stringify(this.data.items));
        localStorage.setItem('inventory_users', JSON.stringify(this.data.users));
        localStorage.setItem('inventory_checkoutHistory', JSON.stringify(this.data.checkoutHistory));
    }
    
    // Generate unique ID
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
    
    // Mock API responses
    async mockFetch(url, options = {}) {
        await this.initialize();
        
        const method = options.method || 'GET';
        const urlParts = url.split('/');
        const resource = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        
        console.log(`🔄 Mock API: ${method} ${resource}`);
        
        // Handle different endpoints
        if (resource === 'items' || url.includes('/items')) {
            return this.handleItemsRequest(method, url, options);
        } else if (resource === 'users' || url.includes('/users')) {
            return this.handleUsersRequest(method, url, options);
        } else if (resource === 'checkoutHistory' || url.includes('/checkoutHistory')) {
            return this.handleHistoryRequest(method, url, options);
        } else if (url.includes('/health')) {
            return this.handleHealthRequest();
        }
        
        // Default response
        return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    handleItemsRequest(method, url, options) {
        const urlParts = url.split('/');
        const itemId = urlParts[urlParts.length - 1];
        
        switch (method) {
            case 'GET':
                if (itemId && itemId !== 'items') {
                    // Get single item
                    const item = this.data.items.find(i => i.id.toString() === itemId);
                    return new Response(JSON.stringify(item || null), {
                        status: item ? 200 : 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    // Get all items
                    return new Response(JSON.stringify(this.data.items), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
            case 'POST':
                const newItem = JSON.parse(options.body);
                newItem.id = this.generateId();
                this.data.items.push(newItem);
                this.saveToLocalStorage();
                return new Response(JSON.stringify(newItem), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'PATCH':
            case 'PUT':
                const updateData = JSON.parse(options.body);
                const itemIndex = this.data.items.findIndex(i => i.id.toString() === itemId);
                if (itemIndex >= 0) {
                    this.data.items[itemIndex] = { ...this.data.items[itemIndex], ...updateData };
                    this.saveToLocalStorage();
                    return new Response(JSON.stringify(this.data.items[itemIndex]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ error: 'Item not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'DELETE':
                const deleteIndex = this.data.items.findIndex(i => i.id.toString() === itemId);
                if (deleteIndex >= 0) {
                    this.data.items.splice(deleteIndex, 1);
                    this.saveToLocalStorage();
                    return new Response('', { status: 204 });
                }
                return new Response(JSON.stringify({ error: 'Item not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    }
    
    handleUsersRequest(method, url, options) {
        const urlParts = url.split('/');
        const userId = urlParts[urlParts.length - 1];
        
        switch (method) {
            case 'GET':
                if (userId && userId !== 'users') {
                    const user = this.data.users.find(u => u.id.toString() === userId);
                    return new Response(JSON.stringify(user || null), {
                        status: user ? 200 : 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    return new Response(JSON.stringify(this.data.users), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
            case 'POST':
                const newUser = JSON.parse(options.body);
                newUser.id = this.generateId();
                this.data.users.push(newUser);
                this.saveToLocalStorage();
                return new Response(JSON.stringify(newUser), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'PATCH':
            case 'PUT':
                const updateData = JSON.parse(options.body);
                const userIndex = this.data.users.findIndex(u => u.id.toString() === userId);
                if (userIndex >= 0) {
                    this.data.users[userIndex] = { ...this.data.users[userIndex], ...updateData };
                    this.saveToLocalStorage();
                    return new Response(JSON.stringify(this.data.users[userIndex]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'DELETE':
                const deleteIndex = this.data.users.findIndex(u => u.id.toString() === userId);
                if (deleteIndex >= 0) {
                    this.data.users.splice(deleteIndex, 1);
                    this.saveToLocalStorage();
                    return new Response('', { status: 204 });
                }
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    }
    
    handleHistoryRequest(method, url, options) {
        const urlParts = url.split('/');
        const recordId = urlParts[urlParts.length - 1];
        
        switch (method) {
            case 'GET':
                if (recordId && recordId !== 'checkoutHistory') {
                    const record = this.data.checkoutHistory.find(h => h.id.toString() === recordId);
                    return new Response(JSON.stringify(record || null), {
                        status: record ? 200 : 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    return new Response(JSON.stringify(this.data.checkoutHistory), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
            case 'POST':
                const newRecord = JSON.parse(options.body);
                newRecord.id = this.generateId();
                this.data.checkoutHistory.push(newRecord);
                this.saveToLocalStorage();
                return new Response(JSON.stringify(newRecord), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'PATCH':
            case 'PUT':
                const updateData = JSON.parse(options.body);
                const recordIndex = this.data.checkoutHistory.findIndex(h => h.id.toString() === recordId);
                if (recordIndex >= 0) {
                    this.data.checkoutHistory[recordIndex] = { ...this.data.checkoutHistory[recordIndex], ...updateData };
                    this.saveToLocalStorage();
                    return new Response(JSON.stringify(this.data.checkoutHistory[recordIndex]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ error: 'Record not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
                
            case 'DELETE':
                const deleteIndex = this.data.checkoutHistory.findIndex(h => h.id.toString() === recordId);
                if (deleteIndex >= 0) {
                    this.data.checkoutHistory.splice(deleteIndex, 1);
                    this.saveToLocalStorage();
                    return new Response('', { status: 204 });
                }
                return new Response(JSON.stringify({ error: 'Record not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    }
    
    handleHealthRequest() {
        return new Response(JSON.stringify({
            status: 'healthy',
            mode: 'github-pages',
            timestamp: new Date().toISOString(),
            storage: 'localStorage'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Export data for backup
    exportData() {
        return {
            items: this.data.items,
            users: this.data.users,
            checkoutHistory: this.data.checkoutHistory,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
    }
    
    // Import data from backup
    importData(backupData) {
        if (backupData.items) this.data.items = backupData.items;
        if (backupData.users) this.data.users = backupData.users;
        if (backupData.checkoutHistory) this.data.checkoutHistory = backupData.checkoutHistory;
        this.saveToLocalStorage();
        console.log('✅ Data imported successfully');
    }
    
    // Clear all data
    clearAllData() {
        this.data = { items: [], users: [], checkoutHistory: [] };
        localStorage.removeItem('inventory_items');
        localStorage.removeItem('inventory_users');
        localStorage.removeItem('inventory_checkoutHistory');
        console.log('🗑️ All data cleared');
    }
}

// Global instance
window.githubPagesAdapter = new GitHubPagesDataAdapter();

// Override fetch for GitHub Pages compatibility
window.originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    // Only intercept API calls
    if (url.includes('/items') || url.includes('/users') || url.includes('/checkoutHistory') || url.includes('/health')) {
        return window.githubPagesAdapter.mockFetch(url, options);
    }
    
    // Pass through other requests
    return window.originalFetch(url, options);
};

console.log('🎯 GitHub Pages Data Adapter loaded and ready!');