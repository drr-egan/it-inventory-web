#!/usr/bin/env python3
"""
Convert db.json to SQLite database for IT Inventory app
"""

import json
import sqlite3
import os
from datetime import datetime

def create_database():
    """Create SQLite database with proper schema"""
    conn = sqlite3.connect('inventory.db')
    cursor = conn.cursor()
    
    # Enable foreign key constraints
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # Create items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            asin TEXT,
            quantity INTEGER NOT NULL DEFAULT 0,
            minThreshold INTEGER DEFAULT 5,
            category TEXT DEFAULT 'Uncategorized'
        )
    ''')
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            cost_code TEXT NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL
        )
    ''')
    
    # Create checkoutHistory table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS checkoutHistory (
            id TEXT PRIMARY KEY,
            item TEXT,
            user TEXT,
            costCode TEXT,
            dateEntered TEXT,
            jobNumber TEXT,
            notes TEXT,
            isUsed BOOLEAN DEFAULT 0,
            isComplete BOOLEAN DEFAULT 0,
            itemName TEXT,
            userName TEXT,
            departmentId TEXT,
            quantity INTEGER DEFAULT 1
        )
    ''')

    
    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_name ON users(lastName, firstName)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_cost_code ON users(cost_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_checkout_date ON checkoutHistory(dateEntered)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_checkout_item ON checkoutHistory(itemName)')
    
    conn.commit()
    return conn

def migrate_data():
    """Migrate data from db.json to SQLite"""
    # Read existing JSON data
    if not os.path.exists('db.json'):
        print("db.json not found!")
        return
    
    with open('db.json', 'r') as f:
        data = json.load(f)
    
    conn = create_database()
    cursor = conn.cursor()
    
    # Migrate items
    print(f"Migrating {len(data.get('items', []))} items...")
    for item in data.get('items', []):
        cursor.execute('''
            INSERT OR REPLACE INTO items (id, name, asin, quantity, minThreshold, category)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            item.get('id'),
            item.get('name'),
            item.get('asin', ''),
            item.get('quantity', 0),
            item.get('minThreshold', 5),
            item.get('category', 'Uncategorized')
        ))
    
    # Migrate users
    print(f"Migrating {len(data.get('users', []))} users...")
    for user in data.get('users', []):
        cursor.execute('''
            INSERT OR REPLACE INTO users (id, name, cost_code, firstName, lastName)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user.get('id'),
            user.get('name', ''),
            user.get('cost_code', ''),
            user.get('firstName', ''),
            user.get('lastName', '')
        ))
    
    # Migrate checkout history
    print(f"Migrating {len(data.get('checkoutHistory', []))} checkout records...")
    for record in data.get('checkoutHistory', []):
        cursor.execute('''
            INSERT OR REPLACE INTO checkoutHistory 
            (id, item, user, costCode, dateEntered, jobNumber, notes, isUsed, isComplete, 
             itemName, userName, departmentId, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.get('id'),
            record.get('item', ''),
            record.get('user', ''),
            record.get('costCode', ''),
            record.get('dateEntered', ''),
            record.get('jobNumber', ''),
            record.get('notes', ''),
            record.get('isUsed', False),
            record.get('isComplete', False),
            record.get('itemName', ''),
            record.get('userName', ''),
            record.get('departmentId', ''),
            record.get('quantity', 1)
        ))
    
    conn.commit()
    conn.close()
    
    print("Migration completed successfully!")
    print("SQLite database created as 'inventory.db'")

if __name__ == "__main__":
    migrate_data()