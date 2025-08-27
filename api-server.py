#!/usr/bin/env python3
"""
SQLite-based API server for IT Inventory app
Replacement for json-server
"""

import sqlite3
import json
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import uuid
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

DATABASE = 'inventory.db'

def get_db():
    """Get database connection"""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row  # This enables column access by name
    return db

@app.teardown_appcontext
def close_connection(exception):
    """Close database connection"""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    """Execute query and return results"""
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def dict_from_row(row):
    """Convert sqlite3.Row to dictionary"""
    return {key: row[key] for key in row.keys()}

# Items endpoints
@app.route('/items', methods=['GET'])
def get_items():
    """Get all items"""
    items = query_db('SELECT * FROM items ORDER BY name')
    return jsonify([dict_from_row(item) for item in items])

@app.route('/items/<item_id>', methods=['GET'])
def get_item(item_id):
    """Get single item"""
    item = query_db('SELECT * FROM items WHERE id = ?', [item_id], one=True)
    if item is None:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify(dict_from_row(item))

@app.route('/items', methods=['POST'])
def create_item():
    """Create new item"""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    item_id = data.get('id', str(uuid.uuid4())[:8])
    
    db = get_db()
    try:
        db.execute('''
            INSERT INTO items (id, name, asin, quantity, minThreshold, category)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            item_id,
            data.get('name'),
            data.get('asin', ''),
            data.get('quantity', 0),
            data.get('minThreshold', 5),
            data.get('category', 'Uncategorized')
        ))
        db.commit()
        
        # Return the created item
        item = query_db('SELECT * FROM items WHERE id = ?', [item_id], one=True)
        return jsonify(dict_from_row(item)), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Item with this ID already exists'}), 409

@app.route('/items/<item_id>', methods=['PATCH'])
def update_item(item_id):
    """Update item"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Check if item exists
    item = query_db('SELECT * FROM items WHERE id = ?', [item_id], one=True)
    if item is None:
        return jsonify({'error': 'Item not found'}), 404
    
    # Build update query dynamically
    updates = []
    values = []
    
    for field in ['name', 'asin', 'quantity', 'minThreshold', 'category']:
        if field in data:
            updates.append(f'{field} = ?')
            values.append(data[field])
    
    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400
    
    values.append(item_id)
    query = f"UPDATE items SET {', '.join(updates)} WHERE id = ?"
    
    db = get_db()
    db.execute(query, values)
    db.commit()
    
    # Return updated item
    item = query_db('SELECT * FROM items WHERE id = ?', [item_id], one=True)
    return jsonify(dict_from_row(item))

@app.route('/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Delete item"""
    db = get_db()
    cursor = db.execute('DELETE FROM items WHERE id = ?', [item_id])
    db.commit()
    
    if cursor.rowcount == 0:
        return jsonify({'error': 'Item not found'}), 404
    
    return '', 204

# Users endpoints
@app.route('/users', methods=['GET'])
def get_users():
    """Get all users"""
    users = query_db('SELECT * FROM users ORDER BY lastName, firstName')
    return jsonify([dict_from_row(user) for user in users])

@app.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """Get single user"""
    user = query_db('SELECT * FROM users WHERE id = ?', [user_id], one=True)
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(dict_from_row(user))

@app.route('/users', methods=['POST'])
def create_user():
    """Create new user"""
    data = request.get_json()
    if not data or not data.get('firstName') or not data.get('lastName'):
        return jsonify({'error': 'firstName and lastName are required'}), 400
    
    user_id = data.get('id', str(uuid.uuid4())[:8])
    
    db = get_db()
    try:
        db.execute('''
            INSERT INTO users (id, name, cost_code, firstName, lastName)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_id,
            f"{data.get('firstName')} {data.get('lastName')}",
            data.get('costCode', data.get('cost_code', '')),
            data.get('firstName'),
            data.get('lastName')
        ))
        db.commit()
        
        # Return the created user
        user = query_db('SELECT * FROM users WHERE id = ?', [user_id], one=True)
        return jsonify(dict_from_row(user)), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'User with this ID already exists'}), 409

@app.route('/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete user"""
    db = get_db()
    cursor = db.execute('DELETE FROM users WHERE id = ?', [user_id])
    db.commit()
    
    if cursor.rowcount == 0:
        return jsonify({'error': 'User not found'}), 404
    
    return '', 204

# Checkout History endpoints
@app.route('/checkoutHistory', methods=['GET'])
def get_checkout_history():
    """Get all checkout history"""
    history = query_db('SELECT * FROM checkoutHistory ORDER BY dateEntered DESC')
    return jsonify([dict_from_row(record) for record in history])

@app.route('/checkoutHistory/<record_id>', methods=['GET'])
def get_checkout_record(record_id):
    """Get single checkout record"""
    record = query_db('SELECT * FROM checkoutHistory WHERE id = ?', [record_id], one=True)
    if record is None:
        return jsonify({'error': 'Record not found'}), 404
    return jsonify(dict_from_row(record))

@app.route('/checkoutHistory', methods=['POST'])
def create_checkout_record():
    """Create new checkout record"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    record_id = data.get('id', str(uuid.uuid4())[:8])
    
    db = get_db()
    try:
        db.execute('''
            INSERT INTO checkoutHistory 
            (id, item, user, costCode, dateEntered, jobNumber, notes, isUsed, isComplete, 
             itemName, userName, departmentId, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id,
            data.get('item', ''),
            data.get('user', ''),
            data.get('costCode', ''),
            data.get('dateEntered', datetime.now().isoformat()),
            data.get('jobNumber', data.get('jobNum', '')),
            data.get('notes', ''),
            data.get('isUsed', False),
            data.get('isComplete', False),
            data.get('itemName', ''),
            data.get('userName', ''),
            data.get('departmentId', ''),
            data.get('quantity', 1)
        ))
        db.commit()
        
        # Return the created record
        record = query_db('SELECT * FROM checkoutHistory WHERE id = ?', [record_id], one=True)
        return jsonify(dict_from_row(record)), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Record with this ID already exists'}), 409

@app.route('/checkoutHistory/<record_id>', methods=['DELETE'])
def delete_checkout_record(record_id):
    """Delete checkout record"""
    db = get_db()
    cursor = db.execute('DELETE FROM checkoutHistory WHERE id = ?', [record_id])
    db.commit()
    
    if cursor.rowcount == 0:
        return jsonify({'error': 'Record not found'}), 404
    
    return '', 204

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'database': DATABASE})

if __name__ == '__main__':
    # Check if database exists
    if not os.path.exists(DATABASE):
        print(f"Database {DATABASE} not found!")
        print("Please run 'python3 convert-to-sqlite.py' first to create the database.")
        exit(1)
    
    print(f"Starting API server with SQLite database: {DATABASE}")
    print("API will be available at: http://localhost:3001")
    app.run(debug=True, host='0.0.0.0', port=3001)