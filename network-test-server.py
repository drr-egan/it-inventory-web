#!/usr/bin/env python3
import http.server
import socketserver
import threading
import time

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        client_ip = self.client_address[0]
        message = f"""
        <html><body style="font-family: Arial; margin: 40px;">
            <h2>🌐 Network Test Server</h2>
            <p><strong>Status:</strong> ✅ Connection Successful!</p>
            <p><strong>Your IP:</strong> {client_ip}</p>
            <p><strong>Server IP:</strong> {self.server.server_address[0]}</p>
            <p><strong>Server Port:</strong> {self.server.server_address[1]}</p>
            <hr>
            <p>If you can see this page from another device, network connectivity is working!</p>
        </body></html>
        """
        self.wfile.write(message.encode())

def start_test_server(port=8888):
    with socketserver.TCPServer(("0.0.0.0", port), TestHandler) as httpd:
        print(f"Test server running on http://0.0.0.0:{port}")
        httpd.serve_forever()

if __name__ == "__main__":
    start_test_server()
