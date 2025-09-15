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
            console.log('📥 Loading initial data from JSON files...');
            
            // Load items
            const itemsResponse = await fetch('./data/items.json');
            if (itemsResponse.ok) {
                this.data.items = await itemsResponse.json();
            }
            
            // Load users  
            const usersResponse = await fetch('./data/users.json');
            if (usersResponse.ok) {
                this.data.users = await usersResponse.json();
            }
            
            // Load checkout history
            const historyResponse = await fetch('./data/checkoutHistory.json');
            if (historyResponse.ok) {
                this.data.checkoutHistory = await historyResponse.json();
            }
            
            // Save to localStorage
            this.saveToLocalStorage();
            console.log('✅ Initial data loaded and saved to localStorage');
            
        } catch (error) {
            console.warn('⚠️ Could not load initial data files, using empty arrays:', error);
            this.data.items = [];
            this.data.users = [];
            this.data.checkoutHistory = [];
        }
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