#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- CLI argument parsing ---
const args = process.argv.slice(2);
let port = null;
let graphFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' && args[i + 1] && /^\d+$/.test(args[i + 1])) {
    port = parseInt(args[i + 1], 10);
    i++; // skip next
  } else if (!args[i].startsWith('-')) {
    graphFile = path.resolve(args[i]);
  }
}

const PORT = port || process.env.PORT || 8765;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /ext-graph — serve the external graph file passed via CLI
  if (req.method === 'GET' && url.pathname === '/ext-graph' && graphFile) {
    fs.readFile(graphFile, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Graph file not found' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // POST /ext-graph — save back to the external graph file
  if (req.method === 'POST' && url.pathname === '/ext-graph' && graphFile) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        JSON.parse(body);
        fs.mkdirSync(path.dirname(graphFile), { recursive: true });
        fs.writeFileSync(graphFile, body + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: graphFile }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /schema — return the JSON Schema
  if (req.method === 'GET' && url.pathname === '/schema') {
    const schemaPath = path.join(ROOT, 'schema', 'graph.schema.json');
    fs.readFile(schemaPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Schema file not found' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/schema+json' });
      res.end(data);
    });
    return;
  }

  // POST /save?file=examples/pattern-taxonomy.json — write JSON to disk
  if (req.method === 'POST' && url.pathname === '/save') {
    const file = url.searchParams.get('file');
    if (!file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing ?file= parameter' }));
    }

    const target = path.resolve(ROOT, file);
    // Safety: only allow writing inside the repo
    if (!target.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Path outside repo' }));
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        // Validate it's valid JSON before writing
        JSON.parse(body);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: file }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = path.join(ROOT, url.pathname);
  if (filePath.endsWith('/')) filePath += 'index.html';

  // Security: no path traversal
  if (!path.resolve(filePath).startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const viewerUrl = graphFile
    ? `http://localhost:${PORT}/viewer/?graph=ext-graph`
    : `http://localhost:${PORT}/viewer/`;
  console.log(`Knowledge Graph → ${viewerUrl}`);
});
