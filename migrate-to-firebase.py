#!/usr/bin/env python3
"""
Firebase Data Migration Script
Migrates existing SQLite data to Firebase Firestore
"""

import json
import sqlite3
from datetime import datetime, timezone
import os
import sys

# You'll need to install these packages:
# pip install firebase-admin

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("❌ Firebase Admin SDK not installed.")
    print("Please install with: pip install firebase-admin")
    sys.exit(1)

class FirebaseMigrator:
    def __init__(self, service_account_path, sqlite_db_path="inventory.db"):
        """
        Initialize Firebase connection

        Args:
            service_account_path: Path to Firebase service account JSON file
            sqlite_db_path: Path to SQLite database file
        """
        self.sqlite_db_path = sqlite_db_path
        self.db = None

        # Initialize Firebase Admin SDK
        try:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("✅ Firebase connection established")
        except Exception as e:
            print(f"❌ Failed to connect to Firebase: {e}")
            sys.exit(1)

    def get_sqlite_data(self):
        """Extract all data from SQLite database"""
        if not os.path.exists(self.sqlite_db_path):
            print(f"❌ SQLite database not found: {self.sqlite_db_path}")
            return None

        try:
            conn = sqlite3.connect(self.sqlite_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            data = {}

            # Get items
            cursor.execute('SELECT * FROM items')
            items = [dict(row) for row in cursor.fetchall()]
            data['items'] = items
            print(f"📦 Found {len(items)} items in SQLite")

            # Get users
            cursor.execute('SELECT * FROM users')
            users = [dict(row) for row in cursor.fetchall()]
            data['users'] = users
            print(f"👥 Found {len(users)} users in SQLite")

            # Get checkout history
            cursor.execute('SELECT * FROM checkoutHistory')
            history = [dict(row) for row in cursor.fetchall()]
            data['checkoutHistory'] = history
            print(f"📝 Found {len(history)} checkout records in SQLite")

            conn.close()
            return data

        except Exception as e:
            print(f"❌ Error reading SQLite database: {e}")
            return None

    def prepare_item_data(self, item):
        """Prepare item data for Firebase with metadata"""
        return {
            'id': item['id'],
            'name': item['name'],
            'asin': item.get('asin', ''),
            'quantity': item.get('quantity', 0),
            'minThreshold': item.get('minThreshold', 5),
            'category': item.get('category', 'Uncategorized'),
            'price': float(item.get('price', 0.0)),
            # Firebase metadata
            'createdAt': firestore.SERVER_TIMESTAMP,
            'lastUpdated': firestore.SERVER_TIMESTAMP,
            'createdBy': 'migration-script',
            'updatedBy': 'migration-script',
            'active': True
        }

    def prepare_user_data(self, user):
        """Prepare user data for Firebase with metadata"""
        return {
            'id': user['id'],
            'firstName': user.get('firstName', ''),
            'lastName': user.get('lastName', ''),
            'name': user.get('name', f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()),
            'costCode': user.get('cost_code', ''),
            'email': user.get('email', ''),  # Will be empty initially
            # Firebase metadata
            'createdAt': firestore.SERVER_TIMESTAMP,
            'lastUpdated': firestore.SERVER_TIMESTAMP,
            'createdBy': 'migration-script',
            'active': True,
            # Role-based access (can be updated later)
            'role': 'user'
        }

    def prepare_checkout_data(self, record):
        """Prepare checkout history data for Firebase"""
        # Parse date if it exists
        date_entered = None
        if record.get('dateEntered'):
            try:
                # Try parsing various date formats
                date_str = record['dateEntered']
                if 'T' in date_str:
                    # ISO format
                    date_entered = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    # Assume it's a simple date
                    date_entered = datetime.strptime(date_str, '%Y-%m-%d')
            except:
                date_entered = datetime.now(timezone.utc)
        else:
            date_entered = datetime.now(timezone.utc)

        return {
            'id': record['id'],
            'itemId': record.get('item', ''),
            'itemName': record.get('itemName', ''),
            'userId': record.get('user', ''),
            'userName': record.get('userName', ''),
            'quantity': record.get('quantity', 1),
            'departmentId': record.get('departmentId', ''),
            'costCode': record.get('costCode', ''),
            'jobNumber': record.get('jobNumber', ''),
            'notes': record.get('notes', ''),
            'status': 'active' if not record.get('isComplete') else 'completed',
            'dateEntered': date_entered,
            # Firebase metadata
            'createdAt': firestore.SERVER_TIMESTAMP,
            'createdBy': 'migration-script'
        }

    def migrate_collection(self, collection_name, data_list, prepare_func):
        """Migrate a collection to Firebase with batch processing"""
        print(f"\n🔄 Migrating {collection_name}...")

        if not data_list:
            print(f"⚠️ No data found for {collection_name}")
            return

        collection_ref = self.db.collection(collection_name)

        # Process in batches of 500 (Firestore limit)
        batch_size = 500
        total_batches = (len(data_list) + batch_size - 1) // batch_size

        for i in range(0, len(data_list), batch_size):
            batch = self.db.batch()
            batch_data = data_list[i:i + batch_size]

            print(f"  📝 Processing batch {i//batch_size + 1}/{total_batches} ({len(batch_data)} records)")

            for item in batch_data:
                try:
                    doc_data = prepare_func(item)
                    doc_ref = collection_ref.document(doc_data['id'])
                    batch.set(doc_ref, doc_data)
                except Exception as e:
                    print(f"    ⚠️ Error preparing {item.get('id', 'unknown')}: {e}")

            try:
                batch.commit()
                print(f"    ✅ Batch {i//batch_size + 1} committed successfully")
            except Exception as e:
                print(f"    ❌ Batch {i//batch_size + 1} failed: {e}")

        print(f"✅ {collection_name} migration completed")

    def setup_security_rules(self):
        """Display recommended Firestore security rules"""
        print("\n🔒 Recommended Firestore Security Rules:")
        print("=" * 50)

        rules = """
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Items collection - read/write for authenticated users
    match /items/{document} {
      allow read, write: if request.auth != null;
    }

    // Users collection - read for authenticated users, write for admins
    match /users/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                   (resource == null ||
                    request.auth.token.email == resource.data.email ||
                    getUserRole() == 'admin');
    }

    // Checkout history - full access for authenticated users
    match /checkoutHistory/{document} {
      allow read, write: if request.auth != null;
    }

    // User profiles - users can only edit their own profile
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Inventory logs - read only for authenticated users
    match /inventoryLogs/{document} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }

    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role;
    }
  }
}
        """

        print(rules)
        print("=" * 50)
        print("Copy these rules to your Firebase Console > Firestore > Rules")

    def migrate_all(self):
        """Migrate all data from SQLite to Firebase"""
        print("🚀 Starting Firebase migration...")

        # Get SQLite data
        sqlite_data = self.get_sqlite_data()
        if not sqlite_data:
            print("❌ Failed to read SQLite data")
            return False

        # Migrate each collection
        self.migrate_collection('items', sqlite_data['items'], self.prepare_item_data)
        self.migrate_collection('users', sqlite_data['users'], self.prepare_user_data)
        self.migrate_collection('checkoutHistory', sqlite_data['checkoutHistory'], self.prepare_checkout_data)

        # Show security rules
        self.setup_security_rules()

        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Update Firebase security rules in the console")
        print("2. Update firebase-config.js with your project settings")
        print("3. Test the application with index-firebase.html")

        return True


def main():
    print("🔥 Firebase Migration Tool")
    print("=" * 40)

    # Check for service account file
    service_account_path = "firebase-service-account.json"

    if not os.path.exists(service_account_path):
        print(f"❌ Service account file not found: {service_account_path}")
        print("\nTo get your service account file:")
        print("1. Go to Firebase Console > Project Settings")
        print("2. Click 'Service Accounts' tab")
        print("3. Click 'Generate new private key'")
        print("4. Save the file as 'firebase-service-account.json' in this directory")
        return

    # Check for SQLite database
    sqlite_path = "inventory.db"
    if not os.path.exists(sqlite_path):
        print(f"❌ SQLite database not found: {sqlite_path}")
        print("Please ensure your inventory.db file is in the current directory")
        return

    # Run migration
    try:
        migrator = FirebaseMigrator(service_account_path, sqlite_path)
        migrator.migrate_all()
    except KeyboardInterrupt:
        print("\n⚠️ Migration interrupted by user")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()