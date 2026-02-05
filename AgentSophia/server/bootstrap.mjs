import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5000', 10);
const distDir = path.join(__dirname, '..', 'dist');

console.log('[Bootstrap] Starting...');
console.log('[Bootstrap] PORT:', PORT);
console.log('[Bootstrap] distDir:', distDir);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript', 
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  res.end(content);
  return true;
}

let backendReady = false;
let backendProcess = null;

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', backend: backendReady }));
    return;
  }

  if (urlPath.startsWith('/api/') && backendReady) {
    const proxyReq = http.request({
      hostname: 'localhost',
      port: 3001,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.writeHead(503);
      res.end('Backend unavailable');
    });
    req.pipe(proxyReq);
    return;
  }

  if (urlPath.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend starting...' }));
    return;
  }

  const filePath = urlPath.includes('.') 
    ? path.join(distDir, urlPath)
    : path.join(distDir, 'index.html');
    
  if (!serveFile(res, filePath)) {
    if (!serveFile(res, path.join(distDir, 'index.html'))) {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bootstrap] Server listening on port ${PORT}`);
  
  import('child_process').then(({ spawn }) => {
    console.log('[Bootstrap] Starting backend...');
    backendProcess = spawn('npx', ['tsx', path.join(__dirname, 'index.ts')], {
      env: { ...process.env, PORT: '3001' },
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    const checkBackend = () => {
      http.get('http://localhost:3001/health', res => {
        if (res.statusCode === 200) {
          backendReady = true;
          console.log('[Bootstrap] Backend ready');
        } else {
          setTimeout(checkBackend, 2000);
        }
      }).on('error', () => setTimeout(checkBackend, 2000));
    };
    
    setTimeout(checkBackend, 5000);
  });
});

process.on('SIGTERM', () => {
  if (backendProcess) backendProcess.kill();
  server.close();
  process.exit(0);
});
