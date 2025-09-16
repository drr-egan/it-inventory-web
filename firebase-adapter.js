// Firebase Data Adapter
// Replaces the GitHub Pages localStorage adapter with Firebase Firestore

class FirebaseDataAdapter {
    constructor() {
        this.initialized = false;
        this.listeners = new Map();
        this.cache = new Map();
        this.currentUser = null;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('🔥 Initializing Firebase Data Adapter...');

        // Wait for Firebase to be available
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }

        // Set up auth state listener
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                console.log(`✅ User authenticated: ${user.email}`);
            } else {
                console.log('🔒 User not authenticated');
            }
        });

        this.initialized = true;
        console.log('✅ Firebase Data Adapter ready');
    }

    // BENEFICIAL IMPROVEMENT: Real-time listeners for live updates
    onDataChange(collection, callback) {
        if (this.listeners.has(collection)) {
            this.listeners.get(collection)(); // Unsubscribe existing
        }

        const unsubscribe = db.collection(collection)
            .orderBy('lastUpdated', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const data = [];
                    snapshot.forEach(doc => {
                        data.push({ id: doc.id, ...doc.data() });
                    });

                    this.cache.set(collection, data);
                    callback(data);
                    console.log(`🔄 Real-time update: ${collection} (${data.length} items)`);
                },
                (error) => {
                    console.error(`❌ Real-time listener error for ${collection}:`, error);
                    callback(this.cache.get(collection) || []);
                }
            );

        this.listeners.set(collection, unsubscribe);
        return unsubscribe;
    }

    // BENEFICIAL IMPROVEMENT: Batch operations for better performance
    async batchUpdate(collection, updates) {
        const batch = db.batch();
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        updates.forEach(({ id, data }) => {
            const docRef = db.collection(collection).doc(id);
            batch.update(docRef, {
                ...data,
                lastUpdated: timestamp,
                updatedBy: this.currentUser?.email || 'anonymous'
            });
        });

        await batch.commit();
        console.log(`✅ Batch updated ${updates.length} ${collection} documents`);
    }

    // Get all items with caching and pagination support
    async getItems(limit = null, startAfter = null) {
        try {
            let query = db.collection('items')
                .orderBy('name');

            if (limit) query = query.limit(limit);
            if (startAfter) query = query.startAfter(startAfter);

            const snapshot = await query.get();
            const items = [];

            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            console.log(`📦 Retrieved ${items.length} items`);
            return items;

        } catch (error) {
            console.error('❌ Error getting items:', error);
            throw error;
        }
    }

    // Get all users with search functionality
    async getUsers(searchTerm = null, limit = 100) {
        try {
            let query = db.collection('users')
                .where('active', '==', true)
                .orderBy('lastName')
                .limit(limit);

            const snapshot = await query.get();
            let users = [];

            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });

            // BENEFICIAL IMPROVEMENT: Client-side search if searchTerm provided
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                users = users.filter(user =>
                    user.firstName?.toLowerCase().includes(term) ||
                    user.lastName?.toLowerCase().includes(term) ||
                    user.costCode?.toLowerCase().includes(term)
                );
            }

            console.log(`👥 Retrieved ${users.length} users`);
            return users;

        } catch (error) {
            console.error('❌ Error getting users:', error);
            throw error;
        }
    }

    // Get checkout history with filters
    async getCheckoutHistory(filters = {}) {
        try {
            let query = db.collection('checkoutHistory')
                .orderBy('dateEntered', 'desc');

            // Apply filters
            if (filters.userId) {
                query = query.where('userId', '==', filters.userId);
            }
            if (filters.itemId) {
                query = query.where('itemId', '==', filters.itemId);
            }
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const snapshot = await query.get();
            const history = [];

            snapshot.forEach(doc => {
                history.push({ id: doc.id, ...doc.data() });
            });

            console.log(`📋 Retrieved ${history.length} checkout records`);
            return history;

        } catch (error) {
            console.error('❌ Error getting checkout history:', error);
            throw error;
        }
    }

    // Create new item with automatic ID and metadata
    async createItem(itemData) {
        try {
            const docRef = await db.collection('items').add({
                ...itemData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: this.currentUser?.email || 'anonymous',
                updatedBy: this.currentUser?.email || 'anonymous'
            });

            console.log(`✅ Created item: ${docRef.id}`);
            return { id: docRef.id, ...itemData };

        } catch (error) {
            console.error('❌ Error creating item:', error);
            throw error;
        }
    }

    // Update item with optimistic updates
    async updateItem(itemId, updateData) {
        try {
            const docRef = db.collection('items').doc(itemId);

            await docRef.update({
                ...updateData,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: this.currentUser?.email || 'anonymous'
            });

            console.log(`✅ Updated item: ${itemId}`);

        } catch (error) {
            console.error('❌ Error updating item:', error);
            throw error;
        }
    }

    // BENEFICIAL IMPROVEMENT: Atomic inventory transactions
    async updateInventory(itemId, quantityChange, reason = 'manual') {
        try {
            await db.runTransaction(async (transaction) => {
                const itemRef = db.collection('items').doc(itemId);
                const doc = await transaction.get(itemRef);

                if (!doc.exists) {
                    throw new Error('Item not found');
                }

                const currentQuantity = doc.data().quantity || 0;
                const newQuantity = Math.max(0, currentQuantity + quantityChange);

                transaction.update(itemRef, {
                    quantity: newQuantity,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: this.currentUser?.email || 'anonymous'
                });

                // Log inventory change
                transaction.set(db.collection('inventoryLogs').doc(), {
                    itemId,
                    quantityChange,
                    newQuantity,
                    reason,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    user: this.currentUser?.email || 'anonymous'
                });
            });

            console.log(`✅ Updated inventory: ${itemId} (${quantityChange > 0 ? '+' : ''}${quantityChange})`);

        } catch (error) {
            console.error('❌ Error updating inventory:', error);
            throw error;
        }
    }

    // Create checkout record with inventory update
    async createCheckout(checkoutData) {
        try {
            const result = await db.runTransaction(async (transaction) => {
                // Create checkout record
                const checkoutRef = db.collection('checkoutHistory').doc();
                const checkoutRecord = {
                    ...checkoutData,
                    id: checkoutRef.id,
                    dateEntered: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'active',
                    createdBy: this.currentUser?.email || 'anonymous'
                };

                transaction.set(checkoutRef, checkoutRecord);

                // Update item quantity
                if (checkoutData.itemId && checkoutData.quantity) {
                    const itemRef = db.collection('items').doc(checkoutData.itemId);
                    const itemDoc = await transaction.get(itemRef);

                    if (itemDoc.exists) {
                        const currentQuantity = itemDoc.data().quantity || 0;
                        const newQuantity = Math.max(0, currentQuantity - checkoutData.quantity);

                        transaction.update(itemRef, {
                            quantity: newQuantity,
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }

                return checkoutRecord;
            });

            console.log(`✅ Created checkout: ${result.id}`);
            return result;

        } catch (error) {
            console.error('❌ Error creating checkout:', error);
            throw error;
        }
    }

    // BENEFICIAL IMPROVEMENT: Advanced search across collections
    async search(query, collections = ['items', 'users']) {
        const results = {};

        for (const collection of collections) {
            try {
                const snapshot = await db.collection(collection).get();
                const matches = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const searchText = JSON.stringify(data).toLowerCase();

                    if (searchText.includes(query.toLowerCase())) {
                        matches.push({ id: doc.id, ...data, collection });
                    }
                });

                results[collection] = matches;

            } catch (error) {
                console.error(`❌ Error searching ${collection}:`, error);
                results[collection] = [];
            }
        }

        console.log(`🔍 Search results for "${query}":`, results);
        return results;
    }

    // BENEFICIAL IMPROVEMENT: Data export functionality
    async exportData(collections = ['items', 'users', 'checkoutHistory']) {
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '2.0',
            source: 'firebase'
        };

        for (const collection of collections) {
            try {
                const snapshot = await db.collection(collection).get();
                const data = [];

                snapshot.forEach(doc => {
                    data.push({ id: doc.id, ...doc.data() });
                });

                exportData[collection] = data;

            } catch (error) {
                console.error(`❌ Error exporting ${collection}:`, error);
                exportData[collection] = [];
            }
        }

        console.log('📤 Data export completed');
        return exportData;
    }

    // Clean up listeners
    disconnect() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners.clear();
        console.log('🔥 Firebase listeners disconnected');
    }
}

// Global instance
window.firebaseAdapter = new FirebaseDataAdapter();

console.log('🎯 Firebase Data Adapter loaded and ready!');