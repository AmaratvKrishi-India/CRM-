import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { indiaMobile } from './protocol.mjs';

const token = () => randomBytes(32).toString('hex');
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Mock only. No child process, SIP socket, account credential or real engine path exists. */
export function createCompanion({ mode = 'mock', origin, userId, organizationId, role, port = 48765, host = '127.0.0.1', dailyLimit = 50, now = Date.now } = {}) {
  if (mode !== 'mock') throw new Error('local-jio-blocked-upstream-security');
  const url = new URL(origin);
  if (url.origin !== origin || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('invalid-origin');
  if (host !== '127.0.0.1' || ![userId, organizationId].every(validId) || !['ADMIN', 'AGENT'].includes(role) || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 50) throw new Error('invalid-policy');
  let pairCode = token();
  const pairingCode = pairCode; // Shown only to the local operator, never served over HTTP.
  const pairDeadline = now() + 120000;
  let paired = null;
  let active = null;
  let intent = null;
  let lastDial = -Infinity;
  let count = 0;
  const usedAttempts = new Set();
  let day = '';
  let sequence = 0;
  let event = null;
  let timers = [];
  let requests = [];
  let listeningPort = port;
  const emit = state => { event = { attemptId: active?.attemptId, state, sequence: ++sequence, observedAt: now(), provenance: 'mock', carrierVerified: false }; };
  const stop = () => { timers.forEach(clearTimeout); timers = []; if (active) emit('ended'); active = null; intent = null; };
  const revoke = () => { stop(); paired = null; };
  const expire = () => { if (intent && now() > intent.expires) intent = null; if (paired && (now() > paired.expires || now() > paired.lease)) revoke(); };
  const watchdog = setInterval(expire, 1000);
  watchdog.unref();
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
    try {
      expire();
      if (req.headers.host !== `127.0.0.1:${listeningPort}` || req.headers.origin !== origin || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return reply(403, { error: 'origin-or-host-denied' });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      requests = requests.filter(time => now() - time < 60000);
      if (requests.length >= 300) return reply(429, { error: 'rate-limited' });
      requests.push(now());
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-method'] !== 'POST') return reply(403, { error: 'method-denied' });
        const headers = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
        if (headers.some(h => !['content-type', 'authorization', 'x-crm-pairing'].includes(h))) return reply(403, { error: 'headers-denied' });
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CRM-Pairing');
        // Deliberately do not grant private-network access. Hosted Windows acceptance is still blocked.
        return reply(204, undefined);
      }
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' || !['/pair', '/status', '/intent', '/dial', '/hangup', '/unpair'].includes(req.url)) return reply(400, { error: 'request-denied' });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 4096) { reply(413, { error: 'body-too-large' }); req.destroy(); return; }
      }
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: 'invalid-json' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'invalid-body' });
      if (req.url === '/pair') {
        if (paired || now() > pairDeadline || !pairCode || !equal(req.headers['x-crm-pairing'], pairCode)) return reply(403, { error: 'pairing-denied-restart-locally' });
        if (body.userId !== userId || body.organizationId !== organizationId || body.role !== role || !validId(body.deviceId) || !validId(body.sessionId)) return reply(403, { error: 'scope-denied' });
        paired = { token: token(), deviceId: body.deviceId, sessionId: body.sessionId, expires: now() + 600000, lease: now() + 30000 };
        pairCode = null;
        return reply(200, { token: paired.token, expiresAt: paired.expires, mode: 'mock' });
      }
      if (!paired || !equal(req.headers.authorization, `Bearer ${paired.token}`) || body.deviceId !== paired.deviceId || body.sessionId !== paired.sessionId) return reply(403, { error: 'session-denied' });
      if (req.url === '/unpair') { revoke(); return reply(200, { state: 'unconfigured' }); }
      if (req.url === '/status') { paired.lease = now() + 30000; return reply(200, { installed: true, reachable: true, mode: 'mock', sipRegistered: false, carrierConfirmed: false, state: active ? event.state : 'ready', event }); }
      if (req.url === '/hangup') { if (!active || body.attemptId !== active.attemptId) return reply(409, { error: 'attempt-mismatch' }); stop(); return reply(200, { event }); }
      if (req.url === '/intent') {
        if (active || intent || usedAttempts.has(body.attemptId)) return reply(409, { error: 'one-call-only' });
        if (!validId(body.attemptId) || !validId(body.leadId) || body.doNotContact !== false || body.manualConsent !== true) return reply(403, { error: 'consent-required' });
        const number = indiaMobile(body.number);
        const today = new Date(now() + 19800000).toISOString().slice(0, 10); // India policy day
        if (today !== day) { day = today; count = 0; }
        if (count >= dailyLimit || now() - lastDial < 3000) return reply(429, { error: 'local-call-policy' });
        intent = { nonce: token(), expires: now() + 15000, attemptId: body.attemptId, number, leadId: body.leadId };
        const issued = intent;
        const expiryTimer = setTimeout(() => { if (intent === issued) intent = null; }, 15001);
        expiryTimer.unref();
        return reply(200, { nonce: intent.nonce, expiresAt: intent.expires });
      }
      if (req.url === '/dial') {
        const issued = intent;
        intent = null; // Consume even on denial. Never replay or retry automatically.
        if (!issued || active || issued.expires < now() || !equal(body.nonce, issued.nonce) || body.attemptId !== issued.attemptId) return reply(409, { error: 'intent-expired-or-replayed' });
        active = { attemptId: issued.attemptId };
        usedAttempts.add(issued.attemptId);
        count++; lastDial = now(); emit('connecting');
        const attemptId = active.attemptId;
        for (const [delay, state] of [[150, 'ringing'], [400, 'connected'], [900, 'ended']]) {
          const timer = setTimeout(() => { expire(); if (active?.attemptId !== attemptId) return; emit(state); if (state === 'ended') active = null; }, delay);
          timer.unref(); timers.push(timer);
        }
        return reply(200, { accepted: true, event });
      }
    } catch { if (!res.headersSent) reply(400, { error: 'invalid-request' }); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.maxConnections = 8;
  server.on('close', () => { clearInterval(watchdog); revoke(); });
  return { server, pairingCode, listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { listeningPort = server.address().port; resolve(listeningPort); }); }), close: () => new Promise(resolve => { revoke(); server.close(resolve); server.closeAllConnections(); clearInterval(watchdog); }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== 'mock') throw new Error('Usage: node companion/server.mjs mock ORIGIN USER_ID ORGANIZATION_ID ROLE');
  const app = createCompanion({ origin: args[1], userId: args[2], organizationId: args[3], role: args[4] });
  await app.listen();
  // Local interactive display only; do not redirect or upload terminal output.
  process.stdout.write(`Mock companion on 127.0.0.1:48765. No SIP or carrier calls.\nOne-time local pairing code (2 minutes): ${app.pairingCode}\nCtrl+C stops and unpairs.\n`);
  process.once('SIGINT', async () => { await app.close(); process.exit(0); });
  process.once('SIGTERM', async () => { await app.close(); process.exit(0); });
}
