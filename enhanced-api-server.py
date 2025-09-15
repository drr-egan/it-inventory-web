#!/usr/bin/env python3
"""
Enhanced SQLite-based API server with improved stability
Features: Connection pooling, proper resource cleanup, request timeouts, and error handling
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
import time
import signal
import sys
import traceback
import queue
import contextlib
from concurrent.futures import ThreadPoolExecutor

DATABASE = 'inventory.db'
PORT = 3000
MAX_CONNECTIONS = 20
REQUEST_TIMEOUT = 30
POOL_SIZE = 10

class DatabaseConnectionPool:
    """Thread-safe database connection pool"""
    
    def __init__(self, database_path, pool_size=POOL_SIZE):
        self.database_path = database_path
        self.pool_size = pool_size
        self.pool = queue.Queue(maxsize=pool_size)
        self.lock = threading.Lock()
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the connection pool"""
        for _ in range(self.pool_size):
            conn = self._create_connection()
            if conn:
                self.pool.put(conn)
    
    def _create_connection(self):
        """Create a new database connection"""
        try:
            conn = sqlite3.connect(
                self.database_path, 
                check_same_thread=False,
                timeout=10.0,  # 10 second timeout for database locks
                isolation_level=None  # Autocommit mode
            )
            conn.row_factory = self._dict_from_row
            # Enable WAL mode for better concurrency
            conn.execute('PRAGMA journal_mode=WAL')
            conn.execute('PRAGMA synchronous=NORMAL')
            conn.execute('PRAGMA cache_size=10000')
            conn.execute('PRAGMA temp_store=MEMORY')
            return conn
        except Exception as e:
            print(f"Failed to create database connection: {e}")
            return None
    
    def _dict_from_row(self, cursor, row):
        """Convert sqlite3 row to dictionary"""
        return {cursor.description[idx][0]: value for idx, value in enumerate(row)}
    
    @contextlib.contextmanager
    def get_connection(self):
        """Get a connection from the pool (context manager)"""
        conn = None
        try:
            # Try to get connection with timeout
            conn = self.pool.get(timeout=5.0)
            # Verify connection is still good
            conn.execute('SELECT 1')
            yield conn
        except queue.Empty:
            # Pool exhausted, create temporary connection
            print("Warning: Connection pool exhausted, creating temporary connection")
            temp_conn = self._create_connection()
            if temp_conn:
                try:
                    yield temp_conn
                finally:
                    temp_conn.close()
            else:
                raise Exception("Unable to create database connection")
        except sqlite3.OperationalError:
            # Connection is bad, create a new one
            if conn:
                try:
                    conn.close()
                except:
                    pass
            conn = self._create_connection()
            if conn:
                yield conn
            else:
                raise Exception("Unable to create database connection")
        finally:
            if conn:
                try:
                    # Return connection to pool
                    self.pool.put_nowait(conn)
                except queue.Full:
                    # Pool is full, close the connection
                    conn.close()
    
    def close_all(self):
        """Close all connections in the pool"""
        while not self.pool.empty():
            try:
                conn = self.pool.get_nowait()
                conn.close()
            except (queue.Empty, Exception):
                break

# Global connection pool
db_pool = None

class EnhancedAPIHandler(http.server.BaseHTTPRequestHandler):
    """Enhanced API handler with better error handling and resource management"""
    
    protocol_version = 'HTTP/1.1'
    
    def __init__(self, *args, **kwargs):
        self.request_start_time = time.time()
        super().__init__(*args, **kwargs)
    
    def log_message(self, format, *args):
        """Override to reduce log verbosity"""
        pass  # Disable default logging
    
    def handle_one_request(self):
        """Handle one request with timeout"""
        try:
            # Set socket timeout
            self.connection.settimeout(REQUEST_TIMEOUT)
            super().handle_one_request()
        except socket.timeout:
            self.send_error(408, 'Request Timeout')
        except Exception as e:
            print(f"Request handling error: {e}")
            try:
                self.send_error(500, 'Internal Server Error')
            except:
                pass
        finally:
            # Ensure connection is closed
            try:
                self.connection.close()
            except:
                pass
    
    def end_headers(self):
        """Add connection close header for proper cleanup"""
        if not hasattr(self, '_headers_sent'):
            self.send_header('Connection', 'close')
            self._headers_sent = True
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests with improved error handling"""
        try:
            parsed_url = urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            
            # Health check endpoint
            if not path_parts:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                health_data = {
                    'status': 'healthy', 
                    'database': DATABASE,
                    'timestamp': datetime.now().isoformat(),
                    'version': '2.0-enhanced'
                }
                self.wfile.write(json.dumps(health_data).encode())
                return
            
            resource = path_parts[0]
            resource_id = path_parts[1] if len(path_parts) > 1 else None
            
            with db_pool.get_connection() as conn:
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
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
        except Exception as e:
            print(f"Error in GET {self.path}: {e}")
            traceback.print_exc()
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_POST(self):
        """Handle POST requests with improved validation and error handling"""
        try:
            parsed_url = urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            
            if not path_parts:
                self.send_error(404, 'Resource not found')
                return
            
            resource = path_parts[0]
            
            # Read and validate request body
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 1024 * 1024:  # 1MB limit
                    self.send_error(413, 'Request entity too large')
                    return
                    
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
            except (ValueError, json.JSONDecodeError) as e:
                self.send_error(400, f'Invalid JSON: {str(e)}')
                return
            except Exception as e:
                self.send_error(400, f'Bad request: {str(e)}')
                return
            
            with db_pool.get_connection() as conn:
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
                    
                    cursor.execute('SELECT * FROM items WHERE id = ?', (item_id,))
                    result = cursor.fetchone()
                
                elif resource == 'users':
                    if not data.get('firstName') or not data.get('lastName'):
                        self.send_error(400, 'firstName and lastName are required')
                        return
                    
                    user_id = data.get('id', str(uuid.uuid4())[:8])
                    cursor.execute('''
                        INSERT INTO users (id, name, cost_code, firstName, lastName, employeeId)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        user_id,
                        f"{data.get('firstName')} {data.get('lastName')}",
                        data.get('costCode', data.get('cost_code', '')),
                        data.get('firstName'),
                        data.get('lastName'),
                        data.get('employeeId', '')
                    ))
                    
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
                    
                    cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (record_id,))
                    result = cursor.fetchone()
                
                else:
                    self.send_error(404, 'Resource not found')
                    return
                
                self.send_response(201)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
        except sqlite3.IntegrityError as e:
            self.send_error(409, f'Resource conflict: {str(e)}')
        except Exception as e:
            print(f"Error in POST {self.path}: {e}")
            traceback.print_exc()
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_PATCH(self):
        """Handle PATCH requests with improved validation"""
        try:
            parsed_url = urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            
            if len(path_parts) != 2:
                self.send_error(404, 'Resource not found')
                return
            
            resource = path_parts[0]
            resource_id = path_parts[1]
            
            # Read and validate request body
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
            except (ValueError, json.JSONDecodeError) as e:
                self.send_error(400, f'Invalid JSON: {str(e)}')
                return
            
            with db_pool.get_connection() as conn:
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
                    
                    if cursor.rowcount == 0:
                        self.send_error(404, 'Item not found')
                        return
                    
                    cursor.execute('SELECT * FROM items WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                
                elif resource == 'users':
                    # Build update query dynamically for users
                    updates = []
                    values = []
                    
                    for field in ['firstName', 'lastName', 'cost_code', 'costCode', 'employeeId']:
                        if field in data:
                            if field == 'costCode':
                                updates.append('cost_code = ?')
                            else:
                                updates.append(f'{field} = ?')
                            values.append(data[field])
                    
                    # Update name field if firstName or lastName changed
                    if 'firstName' in data or 'lastName' in data:
                        cursor.execute('SELECT firstName, lastName FROM users WHERE id = ?', (resource_id,))
                        current_user = cursor.fetchone()
                        if current_user:
                            first_name = data.get('firstName', current_user['firstName'])
                            last_name = data.get('lastName', current_user['lastName'])
                            updates.append('name = ?')
                            values.append(f"{first_name} {last_name}")
                    
                    if not updates:
                        self.send_error(400, 'No valid fields to update')
                        return
                    
                    values.append(resource_id)
                    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
                    
                    cursor.execute(query, values)
                    
                    if cursor.rowcount == 0:
                        self.send_error(404, 'User not found')
                        return
                    
                    cursor.execute('SELECT * FROM users WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                
                elif resource == 'checkoutHistory':
                    # Build update query for checkout history
                    updates = []
                    values = []
                    
                    valid_fields = ['itemName', 'userName', 'departmentId', 'jobNumber', 'quantity', 'notes', 'costCode']
                    for field in valid_fields:
                        if field in data:
                            updates.append(f'{field} = ?')
                            values.append(data[field])
                    
                    if not updates:
                        self.send_error(400, 'No valid fields to update')
                        return
                    
                    values.append(resource_id)
                    query = f"UPDATE checkoutHistory SET {', '.join(updates)} WHERE id = ?"
                    
                    cursor.execute(query, values)
                    
                    if cursor.rowcount == 0:
                        self.send_error(404, 'Checkout record not found')
                        return
                    
                    cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                
                else:
                    self.send_error(404, 'Resource not found')
                    return
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
                
        except Exception as e:
            print(f"Error in PATCH {self.path}: {e}")
            traceback.print_exc()
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        try:
            parsed_url = urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            
            if len(path_parts) != 2:
                self.send_error(404, 'Resource not found')
                return
            
            resource = path_parts[0]
            resource_id = path_parts[1]
            
            with db_pool.get_connection() as conn:
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
                
                if cursor.rowcount == 0:
                    self.send_error(404, 'Resource not found')
                    return
                
                self.send_response(204)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
        except Exception as e:
            print(f"Error in DELETE {self.path}: {e}")
            traceback.print_exc()
            self.send_error(500, f'Server error: {str(e)}')
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

class EnhancedTCPServer(socketserver.ThreadingTCPServer):
    """Enhanced TCP server with better resource management"""
    
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 50
    
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Set socket timeouts
        self.socket.settimeout(1.0)
        self.timeout = 1.0
    
    def handle_timeout(self):
        """Handle server timeout"""
        pass
    
    def shutdown_request(self, request):
        """Clean shutdown of request"""
        try:
            request.shutdown(socket.SHUT_WR)
        except OSError:
            pass
        self.close_request(request)
    
    def close_request(self, request):
        """Clean close of request"""
        try:
            request.close()
        except OSError:
            pass

def signal_handler(signum, frame):
    """Graceful shutdown on signal"""
    print(f"\nReceived signal {signum}, shutting down gracefully...")
    if db_pool:
        db_pool.close_all()
    sys.exit(0)

if __name__ == '__main__':
    # Import socket here to avoid issues with global imports
    import socket
    
    # Check if database exists
    if not os.path.exists(DATABASE):
        print(f"Database {DATABASE} not found!")
        print("Please run 'python3 convert-to-sqlite.py' first to create the database.")
        sys.exit(1)
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Initialize database connection pool
    print(f"Initializing database connection pool (size: {POOL_SIZE})...")
    db_pool = DatabaseConnectionPool(DATABASE, POOL_SIZE)
    
    print(f"Starting Enhanced API Server v2.0")
    print(f"Database: {DATABASE}")
    print(f"Port: {PORT}")
    print(f"Max Connections: {MAX_CONNECTIONS}")
    print(f"Request Timeout: {REQUEST_TIMEOUT}s")
    print(f"Connection Pool Size: {POOL_SIZE}")
    
    try:
        with EnhancedTCPServer(("", PORT), EnhancedAPIHandler) as httpd:
            print(f"✅ Enhanced API server running at http://localhost:{PORT}")
            print("Press Ctrl+C to stop")
            httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")
        traceback.print_exc()
    finally:
        if db_pool:
            print("Closing database connections...")
            db_pool.close_all()
        print("Server stopped.")
"""
Enhanced SQLite-based API server with connection pooling, threading, and resilience features
Replacement for simple-api-server.py with improved reliability and performance
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
import time
import logging
import queue
import signal
import atexit
import functools

# Configuration
DATABASE = 'inventory.db'
PORT = 3001
POOL_SIZE = 10
REQUEST_TIMEOUT = 30
HEALTH_CHECK_INTERVAL = 30

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api-server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DatabasePool:
    """Thread-safe database connection pool"""
    
    def __init__(self, database_path, pool_size=POOL_SIZE):
        self.database_path = database_path
        self.pool_size = pool_size
        self.connections = queue.Queue(maxsize=pool_size)
        self.lock = threading.Lock()
        self.total_connections = 0
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the connection pool"""
        logger.info(f"Initializing database pool with {self.pool_size} connections")
        for _ in range(self.pool_size):
            try:
                conn = self._create_connection()
                self.connections.put(conn)
                self.total_connections += 1
            except Exception as e:
                logger.error(f"Failed to create database connection: {e}")
                break
    
    def _create_connection(self):
        """Create a new database connection with optimizations"""
        conn = sqlite3.connect(
            self.database_path, 
            check_same_thread=False,
            timeout=30.0,
            isolation_level=None  # Autocommit mode
        )
        
        # Optimize connection
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=10000")
        conn.execute("PRAGMA temp_store=memory")
        conn.execute("PRAGMA busy_timeout=30000")
        
        conn.row_factory = self._dict_from_row
        return conn
    
    def _dict_from_row(self, cursor, row):
        """Convert sqlite3 row to dictionary"""
        return {cursor.description[idx][0]: value for idx, value in enumerate(row)}
    
    def get_connection(self, timeout=REQUEST_TIMEOUT):
        """Get a connection from the pool"""
        try:
            conn = self.connections.get(timeout=timeout)
            # Test connection is still alive
            conn.execute("SELECT 1")
            return conn
        except queue.Empty:
            logger.warning("Database connection pool exhausted")
            raise Exception("Database connection timeout - server busy")
        except sqlite3.Error as e:
            logger.warning(f"Stale connection detected, creating new one: {e}")
            # Connection is stale, create a new one
            try:
                return self._create_connection()
            except Exception as create_error:
                logger.error(f"Failed to create new connection: {create_error}")
                raise Exception("Database unavailable")
    
    def return_connection(self, conn):
        """Return a connection to the pool"""
        if conn:
            try:
                # In autocommit mode, no need to rollback
                # Just verify connection is still good
                conn.execute("SELECT 1")
                self.connections.put(conn, block=False)
            except queue.Full:
                # Pool is full, close the connection
                conn.close()
            except Exception as e:
                logger.warning(f"Error returning connection: {e}")
                conn.close()
    
    def close_all(self):
        """Close all connections in the pool"""
        logger.info("Closing all database connections")
        while not self.connections.empty():
            try:
                conn = self.connections.get_nowait()
                conn.close()
            except (queue.Empty, Exception):
                break

class HealthMonitor:
    """Health monitoring and auto-recovery system"""
    
    def __init__(self, db_pool, check_interval=HEALTH_CHECK_INTERVAL):
        self.db_pool = db_pool
        self.check_interval = check_interval
        self.last_check = time.time()
        self.consecutive_failures = 0
        self.is_healthy = True
        
        # Start health check thread
        self.health_thread = threading.Thread(target=self._health_check_loop, daemon=True)
        self.health_thread.start()
    
    def _health_check_loop(self):
        """Continuous health checking"""
        while True:
            try:
                time.sleep(self.check_interval)
                self._perform_health_check()
            except Exception as e:
                logger.error(f"Health check thread error: {e}")
    
    def _perform_health_check(self):
        """Perform a health check"""
        try:
            # Test database connectivity
            conn = self.db_pool.get_connection(timeout=5)
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM items LIMIT 1")
                result = cursor.fetchone()
                logger.debug(f"Health check passed: {result}")
            finally:
                self.db_pool.return_connection(conn)
            
            # Reset failure count on success
            if self.consecutive_failures > 0:
                logger.info("Health check recovered after failures")
            self.consecutive_failures = 0
            self.is_healthy = True
            
        except Exception as e:
            self.consecutive_failures += 1
            logger.warning(f"Health check failed (attempt {self.consecutive_failures}): {e}")
            
            if self.consecutive_failures >= 3:
                self.is_healthy = False
                logger.error("Multiple consecutive health check failures - server unhealthy")
            
            if self.consecutive_failures >= 5:
                logger.critical("Critical health failure - may need manual intervention")
    
    def get_status(self):
        """Get current health status"""
        return {
            'healthy': self.is_healthy,
            'consecutive_failures': self.consecutive_failures,
            'last_check': self.last_check,
            'uptime': time.time() - self.last_check
        }

def with_error_handling(func):
    """Decorator for robust error handling"""
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        start_time = time.time()
        method = getattr(self, 'command', 'UNKNOWN')
        path = getattr(self, 'path', 'unknown')
        
        try:
            return func(self, *args, **kwargs)
        except sqlite3.OperationalError as e:
            logger.error(f"Database operational error: {e}")
            self.send_error(503, "Database temporarily unavailable")
        except sqlite3.DatabaseError as e:
            logger.error(f"Database error: {e}")
            self.send_error(500, "Database error")
        except Exception as e:
            logger.error(f"Unexpected error in {method} {path}: {e}")
            self.send_error(500, "Internal server error")
        finally:
            duration = time.time() - start_time
            if duration > 1.0:  # Log slow requests
                logger.warning(f"Slow request: {method} {path} - {duration:.3f}s")
            else:
                logger.debug(f"{method} {path} - {duration:.3f}s")
    
    return wrapper

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Multi-threaded TCP server with enhanced configuration"""
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 50
    timeout = REQUEST_TIMEOUT
    
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.socket.settimeout(REQUEST_TIMEOUT)

class EnhancedAPIHandler(http.server.BaseHTTPRequestHandler):
    """Enhanced API handler with connection pooling and error handling"""
    
    timeout = REQUEST_TIMEOUT
    
    def setup(self):
        super().setup()
        self.request.settimeout(REQUEST_TIMEOUT)
    
    def log_message(self, format, *args):
        """Override to use proper logging"""
        logger.info(f"{self.address_string()} - {format % args}")
    
    @with_error_handling
    def do_GET(self):
        """Handle GET requests with enhanced error handling"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        # Health check endpoint
        if not path_parts:
            health_status = health_monitor.get_status()
            response = {
                'status': 'healthy' if health_status['healthy'] else 'unhealthy',
                'database': DATABASE,
                'health': health_status,
                'version': '2.0-enhanced'
            }
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Special health endpoint
        if path_parts[0] == 'health':
            health_status = health_monitor.get_status()
            self.send_response(200 if health_status['healthy'] else 503)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(health_status).encode())
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1] if len(path_parts) > 1 else None
        
        conn = db_pool.get_connection()
        try:
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
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        finally:
            db_pool.return_connection(conn)
    
    @with_error_handling
    def do_POST(self):
        """Handle POST requests with enhanced error handling"""
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
        
        conn = db_pool.get_connection()
        try:
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
                
                cursor.execute('SELECT * FROM items WHERE id = ?', (item_id,))
                result = cursor.fetchone()
            
            elif resource == 'users':
                if not data.get('firstName') or not data.get('lastName'):
                    self.send_error(400, 'firstName and lastName are required')
                    return
                
                user_id = data.get('id', str(uuid.uuid4())[:8])
                cursor.execute('''
                    INSERT INTO users (id, name, cost_code, firstName, lastName, employeeId)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    f"{data.get('firstName')} {data.get('lastName')}",
                    data.get('costCode', data.get('cost_code', '')),
                    data.get('firstName'),
                    data.get('lastName'),
                    data.get('employeeId', '')
                ))
                
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
                
                cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (record_id,))
                result = cursor.fetchone()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.commit()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except sqlite3.IntegrityError:
            self.send_error(409, 'Resource with this ID already exists')
        finally:
            db_pool.return_connection(conn)
    
    @with_error_handling
    def do_PATCH(self):
        """Handle PATCH requests with enhanced error handling"""
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
        
        conn = db_pool.get_connection()
        try:
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
            
            elif resource == 'users':
                # Build update query dynamically for users
                updates = []
                values = []
                
                for field in ['firstName', 'lastName', 'cost_code', 'costCode', 'employeeId']:
                    if field in data:
                        if field == 'costCode':
                            updates.append('cost_code = ?')
                        else:
                            updates.append(f'{field} = ?')
                        values.append(data[field])
                
                # Update name field if firstName or lastName changed
                if 'firstName' in data or 'lastName' in data:
                    # Get current user data to build name
                    cursor.execute('SELECT firstName, lastName FROM users WHERE id = ?', (resource_id,))
                    current_user = cursor.fetchone()
                    if current_user:
                        first_name = data.get('firstName', current_user['firstName'])
                        last_name = data.get('lastName', current_user['lastName'])
                        updates.append('name = ?')
                        values.append(f"{first_name} {last_name}")
                
                if not updates:
                    self.send_error(400, 'No valid fields to update')
                    return
                
                values.append(resource_id)
                query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
                
                cursor.execute(query, values)
                conn.commit()
                
                if cursor.rowcount == 0:
                    self.send_error(404, 'User not found')
                    return
                
                cursor.execute('SELECT * FROM users WHERE id = ?', (resource_id,))
                result = cursor.fetchone()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        finally:
            db_pool.return_connection(conn)
    
    @with_error_handling
    def do_DELETE(self):
        """Handle DELETE requests with enhanced error handling"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 2:
            self.send_error(404, 'Resource not found')
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1]
        
        conn = db_pool.get_connection()
        try:
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
            
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
        finally:
            db_pool.return_connection(conn)
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

class GracefulShutdown:
    """Graceful shutdown handler"""
    
    def __init__(self, server, db_pool):
        self.server = server
        self.db_pool = db_pool
        self.shutdown_requested = False
        
        # Register signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        atexit.register(self.cleanup)
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        if not self.shutdown_requested:
            self.shutdown_requested = True
            logger.info(f"Received signal {signum}, shutting down gracefully...")
            threading.Thread(target=self.shutdown, daemon=True).start()
    
    def shutdown(self):
        """Perform graceful shutdown"""
        try:
            logger.info("Stopping server...")
            self.server.shutdown()
        except Exception as e:
            logger.error(f"Error during server shutdown: {e}")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        try:
            logger.info("Cleaning up resources...")
            if hasattr(self, 'db_pool') and self.db_pool:
                self.db_pool.close_all()
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

def initialize_database():
    """Initialize database with optimizations"""
    if not os.path.exists(DATABASE):
        logger.error(f"Database {DATABASE} not found!")
        logger.error("Please run 'python3 convert-to-sqlite.py' first to create the database.")
        exit(1)
    
    logger.info("Initializing database optimizations...")
    try:
        conn = sqlite3.connect(DATABASE)
        
        # Enable optimizations
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=10000")
        conn.execute("PRAGMA temp_store=memory")
        
        # Create indexes for performance if they don't exist
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_employeeId ON users(employeeId)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_name ON users(lastName, firstName)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_checkout_date ON checkoutHistory(dateEntered)")
        
        conn.close()
        logger.info("Database optimizations applied")
        
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        exit(1)

# Global instances
db_pool = None
health_monitor = None

if __name__ == '__main__':
    logger.info("Starting Enhanced API Server...")
    logger.info(f"Python version: {os.sys.version}")
    logger.info(f"Database: {DATABASE}")
    logger.info(f"Port: {PORT}")
    logger.info(f"Pool size: {POOL_SIZE}")
    logger.info(f"Request timeout: {REQUEST_TIMEOUT}s")
    
    try:
        # Initialize database
        initialize_database()
        
        # Create connection pool
        db_pool = DatabasePool(DATABASE, POOL_SIZE)
        
        # Start health monitoring
        health_monitor = HealthMonitor(db_pool)
        
        # Create and configure server
        server = ThreadedTCPServer(("", PORT), EnhancedAPIHandler)
        
        # Set up graceful shutdown
        shutdown_handler = GracefulShutdown(server, db_pool)
        
        logger.info(f"Enhanced API server running at http://localhost:{PORT}")
        logger.info("Press Ctrl+C to stop the server")
        
        # Start serving
        server.serve_forever()
        
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        exit(1)
    finally:
        if db_pool:
            db_pool.close_all()
        logger.info("Server stopped")