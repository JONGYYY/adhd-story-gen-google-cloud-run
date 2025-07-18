from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
import subprocess
import sys

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get content length
            content_length = int(self.headers['Content-Length'])
            
            # Read post data
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Test response
            response = {
                "success": True,
                "message": "Python function is working",
                "python_version": sys.version,
                "data": data
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            # Error response
            error_response = {
                "success": False,
                "error": str(e),
                "python_version": sys.version
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def do_GET(self):
        try:
            # Test response
            response = {
                "success": True,
                "message": "Python function is working",
                "python_version": sys.version
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            # Error response
            error_response = {
                "success": False,
                "error": str(e),
                "python_version": sys.version
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8')) 