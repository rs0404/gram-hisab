# Local preview server for testing the app screens in a browser (no caching).
import http.server, functools, os, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
http.server.ThreadingHTTPServer(('', int(sys.argv[1]) if len(sys.argv) > 1 else 8765), functools.partial(H, directory=d)).serve_forever()
