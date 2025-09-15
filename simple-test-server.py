#!/usr/bin/env python3
import http.server
import socketserver
import sys

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        client_ip = self.client_address[0]
        response = f"""
        <html><body style="font-family: Arial;">
        <h1>✅ HTTP Test Server Working!</h1>
        <p>Your IP: {client_ip}</p>
        <p>Server IP: {self.server.server_address[0]}</p>
        <p>If you can see this from another device, HTTP connectivity works!</p>
        </body></html>
        """
        self.wfile.write(response.encode())

PORT = 8888
print(f"Starting test HTTP server on 0.0.0.0:{PORT}")
print("Test from another device: http://$LOCAL_IP:{PORT}")
print("Press Ctrl+C to stop")

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), TestHandler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nTest server stopped")
except OSError as e:
    print(f"Error: {e}")
    print("Port 8888 may be in use")
