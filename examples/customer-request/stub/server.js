// Stub endpoints for the customer-request example. No dependencies.
// Every call is appended to a JSON-lines file so it survives a container restart.
const http = require('node:http');
const fs = require('node:fs');

const PORT = Number(process.env.PORT || 8080);
const LOG = process.env.CALLS_FILE || '/data/calls.jsonl';
const RECORDED = new Set(['/notify', '/approvals', '/business-system']);

fs.mkdirSync(require('node:path').dirname(LOG), { recursive: true });

function readCalls() {
  if (!fs.existsSync(LOG)) return [];
  return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

      if (url.pathname === '/calls') {
        if (req.method === 'DELETE') {
          fs.rmSync(LOG, { force: true });
          return send(res, 200, { cleared: true });
        }
        const path = url.searchParams.get('path');
        const requestId = url.searchParams.get('request_id');
        const calls = readCalls().filter(
          (c) => (!path || c.path === path) && (!requestId || c.body?.request_id === requestId),
        );
        return send(res, 200, calls);
      }

      if (req.method === 'POST' && RECORDED.has(url.pathname)) {
        let body;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return send(res, 400, { error: 'body must be JSON' });
        }
        const call = { path: url.pathname, at: new Date().toISOString(), body };
        fs.appendFileSync(LOG, JSON.stringify(call) + '\n');
        console.log(`${call.at} ${call.path} ${JSON.stringify(body)}`);
        const reply =
          url.pathname === '/business-system'
            ? { ok: true, ticket_id: `TCK-${Date.now()}` }
            : { ok: true };
        return send(res, 200, reply);
      }

      send(res, 404, { error: 'not found' });
    });
  })
  .listen(PORT, () => console.log(`stub listening on :${PORT}, calls -> ${LOG}`));
