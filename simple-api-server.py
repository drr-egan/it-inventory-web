#!/usr/bin/env python3
"""
Simple SQLite-based API server using only Python standard library
Replacement for json-server without external dependencies
"""

import sqlite3
import json
import http.server
import socketserver
import urllib.parse
from urllib.parse import urlparse, parse_qs
import uuid
from datetime import datetime
import os
import threading

DATABASE = 'inventory.db'

def dict_from_row(cursor, row):
    """Convert sqlite3 row to dictionary"""
    return {cursor.description[idx][0]: value for idx, value in enumerate(row)}

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = dict_from_row
    return conn

class APIHandler(http.server.BaseHTTPRequestHandler):
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if not path_parts:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy', 'database': DATABASE}).encode())
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1] if len(path_parts) > 1 else None
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                if resource_id:
                    cursor.execute('SELECT * FROM items WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if result is None:
                        self.send_error(404, 'Item not found')
                        return
                else:
                    cursor.execute('SELECT * FROM items ORDER BY name')
                    result = cursor.fetchall()
            
            elif resource == 'users':
                if resource_id:
                    cursor.execute('SELECT * FROM users WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if result is None:
                        self.send_error(404, 'User not found')
                        return
                else:
                    cursor.execute('SELECT * FROM users ORDER BY lastName, firstName')
                    result = cursor.fetchall()
            
            elif resource == 'checkoutHistory':
                if resource_id:
                    cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if result is None:
                        self.send_error(404, 'Record not found')
                        return
                else:
                    cursor.execute('SELECT * FROM checkoutHistory ORDER BY dateEntered DESC')
                    result = cursor.fetchall()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"Error in GET: {e}")
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if not path_parts:
            self.send_error(404, 'Resource not found')
            return
        
        resource = path_parts[0]
        
        # Read request body
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, 'Invalid JSON')
            return
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                if not data.get('name'):
                    self.send_error(400, 'Name is required')
                    return
                
                item_id = data.get('id', str(uuid.uuid4())[:8])
                cursor.execute('''
                    INSERT INTO items (id, name, asin, quantity, minThreshold, category, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item_id,
                    data.get('name'),
                    data.get('asin', ''),
                    data.get('quantity', 0),
                    data.get('minThreshold', 5),
                    data.get('category', 'Uncategorized'),
                    data.get('price', 0.0)
                ))
                conn.commit()
                
                cursor.execute('SELECT * FROM items WHERE id = ?', (item_id,))
                result = cursor.fetchone()
            
            elif resource == 'users':
                if not data.get('firstName') or not data.get('lastName'):
                    self.send_error(400, 'firstName and lastName are required')
                    return
                
                user_id = data.get('id', str(uuid.uuid4())[:8])
                cursor.execute('''
                    INSERT INTO users (id, name, cost_code, firstName, lastName)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    f"{data.get('firstName')} {data.get('lastName')}",
                    data.get('costCode', data.get('cost_code', '')),
                    data.get('firstName'),
                    data.get('lastName')
                ))
                conn.commit()
                
                cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
                result = cursor.fetchone()
            
            elif resource == 'checkoutHistory':
                record_id = data.get('id', str(uuid.uuid4())[:8])
                cursor.execute('''
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
                conn.commit()
                
                cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (record_id,))
                result = cursor.fetchone()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except sqlite3.IntegrityError:
            self.send_error(409, 'Resource with this ID already exists')
        except Exception as e:
            print(f"Error in POST: {e}")
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_PATCH(self):
        """Handle PATCH requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 2:
            self.send_error(404, 'Resource not found')
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1]
        
        # Read request body
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, 'Invalid JSON')
            return
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                # Build update query dynamically
                updates = []
                values = []
                
                for field in ['name', 'asin', 'quantity', 'minThreshold', 'category', 'price']:
                    if field in data:
                        updates.append(f'{field} = ?')
                        values.append(data[field])
                
                if not updates:
                    self.send_error(400, 'No valid fields to update')
                    return
                
                values.append(resource_id)
                query = f"UPDATE items SET {', '.join(updates)} WHERE id = ?"
                
                cursor.execute(query, values)
                conn.commit()
                
                if cursor.rowcount == 0:
                    self.send_error(404, 'Item not found')
                    return
                
                cursor.execute('SELECT * FROM items WHERE id = ?', (resource_id,))
                result = cursor.fetchone()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"Error in PATCH: {e}")
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 2:
            self.send_error(404, 'Resource not found')
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1]
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                cursor.execute('DELETE FROM items WHERE id = ?', (resource_id,))
            elif resource == 'users':
                cursor.execute('DELETE FROM users WHERE id = ?', (resource_id,))
            elif resource == 'checkoutHistory':
                cursor.execute('DELETE FROM checkoutHistory WHERE id = ?', (resource_id,))
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.commit()
            
            if cursor.rowcount == 0:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
        except Exception as e:
            print(f"Error in DELETE: {e}")
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    # Check if database exists
    if not os.path.exists(DATABASE):
        print(f"Database {DATABASE} not found!")
        print("Please run 'python3 convert-to-sqlite.py' first to create the database.")
        exit(1)
    
    PORT = 3001
    print(f"Starting API server with SQLite database: {DATABASE}")
    print(f"API will be available at: http://localhost:{PORT}")
    
    with socketserver.TCPServer(("", PORT), APIHandler) as httpd:
        httpd.serve_forever()