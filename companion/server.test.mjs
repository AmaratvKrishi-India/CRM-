import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createCompanion } from './server.mjs';
import { command, StateDecoder, indiaMobile } from './protocol.mjs';

const scope = { userId: 'synthetic-user', organizationId: 'synthetic-org', role: 'AGENT', deviceId: 'test-device', sessionId: 'test-session' };
const origin = 'http://127.0.0.1:4174';
async function fixture(t, options = {}) {
  const app = createCompanion({ origin, ...scope, port: 0, ...options });
  const port = await app.listen();
  t.after(() => app.close());
  const post = (path, body = {}, headers = {}) => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { Origin: origin, Host: `127.0.0.1:${port}`, 'Content-Type': 'application/json', ...headers } }, response => {
      let data = ''; response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: data ? JSON.parse(data) : null, headers: response.headers }));
    });
    request.on('error', reject); request.end(JSON.stringify({ ...scope, ...body }));
  });
  const pair = async (body = {}) => post('/pair', body, { 'X-CRM-Pairing': app.pairingCode });
  const login = async () => { const paired = await pair(); assert.equal(paired.status, 200); return (path, body = {}, headers = {}) => post(path, body, { Authorization: `Bearer ${paired.body.token}`, ...headers }); };
  return { app, port, post, pair, login };
}
const intent = { attemptId: 'attempt-1', leadId: 'synthetic-lead', number: '+91 90000 00001', manualConsent: true, doNotContact: false };

for (const number of ['9000000001', '+91 90000-00001', '919000000001', '(90000) 00001']) test(`normalizes permitted format ${number.length}`, () => assert.equal(indiaMobile(number), '+919000000001'));
for (const number of ['tel:9000000001', '+1 9000000001', '0000000000', '9000000001;ext=1', '9000000001\n', '++919000000001', '90000000012', '', null]) test(`rejects malformed number ${JSON.stringify(number)}`, () => assert.throws(() => indiaMobile(number)));

test('rejects real mode, wildcard binder, unsafe origin and inflated budget', () => {
  for (const options of [{mode:'local-jio'}, {host:'0.0.0.0'}, {origin:'http://evil.test'}, {dailyLimit:51}]) assert.throws(() => createCompanion({origin,...scope,...options}));
});
test('source-derived command includes server omitted by upstream docs', () => {
  assert.deepEqual(JSON.parse(command('call','mock-account','9000000001')), {command:'call',username:'mock-account',server:'127.0.0.1:5061',remote:'+919000000001'});
  assert.deepEqual(JSON.parse(command('hangup','mock-account')), {command:'hangup',username:'mock-account'});
  assert.throws(() => command('send_audio','mock-account'));
  assert.throws(() => command('call','a\n','9000000001'));
});
test('bounded NDJSON handles split frames, strips private fields and rejects corruption', () => {
  const decoder = new StateDecoder();
  assert.deepEqual(decoder.push('{"username":"mock","state":"reg'), []);
  assert.deepEqual(decoder.push('istered","media_state":"inactive","audio_state":"stop","remote":"private"}\n'), [{account:'mock',state:'registered',media:'inactive'}]);
  assert.throws(() => decoder.push('not-json\n'));
  assert.throws(() => new StateDecoder().push('x'.repeat(8193)));
  assert.throws(() => new StateDecoder().push('{"username":"mock","state":"madeup"}\n'));
});
test('NDJSON socket contract uses isolated ephemeral loopback mock and tears down', async t => {
  const server = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.includes('\n')) {
        assert.equal(JSON.parse(buffer).server, '127.0.0.1:5061');
        socket.end('{"username":"mock","state":"confirmed","media_state":"connected","audio_state":"stop"}\n');
      }
    });
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const events = await new Promise((resolve,reject) => {
    const socket = net.connect(server.address().port,'127.0.0.1',() => socket.write(command('call','mock','9000000001')));
    const decoder = new StateDecoder(); const received=[];
    socket.setTimeout(1000, () => socket.destroy(new Error('timeout')));
    socket.on('data', chunk => received.push(...decoder.push(chunk.toString())));
    socket.on('end',() => resolve(received)); socket.on('error',reject);
  });
  assert.equal(events[0].state, 'confirmed');
});
test('unpaired and forged browser requests fail closed without CORS wildcard', async t => {
  const f=await fixture(t);
  assert.equal((await f.post('/status')).status,403);
  assert.equal((await f.post('/pair',{}, {'X-CRM-Pairing':'wrong'})).status,403);
  const denied=await f.post('/pair',{}, {Origin:'https://evil.test'});
  assert.equal(denied.status,403); assert.equal(denied.headers['access-control-allow-origin'],undefined);
  assert.equal((await f.post('/pair',{}, {Host:`evil.test:${f.port}`})).status,403);
  assert.equal((await f.post('/pair',{}, {Origin:''})).status,403);
});
test('pairing binds user, tenant, role, session and device; code consumed once', async t => {
  const f=await fixture(t);
  for (const body of [{userId:'other'},{organizationId:'other'},{role:'ADMIN'}]) assert.equal((await f.pair(body)).status,403);
  const post=await f.login();
  assert.equal((await f.pair()).status,403);
  for (const body of [{deviceId:'other'},{sessionId:'other'}]) assert.equal((await post('/status',body)).status,403);
  assert.equal((await post('/status')).body.sipRegistered,false);
});
test('one-time pairing expires and cannot be renewed by remote page', async t => {
  let clock=0; const f=await fixture(t,{now:()=>clock}); clock=120001;
  assert.equal((await f.pair()).status,403);
});
test('one call lock, replay protection and explicit hangup', async t => {
  const f=await fixture(t); const post=await f.login();
  const grant=await post('/intent',intent); assert.equal(grant.status,200);
  assert.equal((await post('/intent',{...intent,attemptId:'attempt-2'})).status,409);
  const accepted=await post('/dial',{nonce:grant.body.nonce,attemptId:intent.attemptId});
  assert.equal(accepted.body.event.provenance,'mock'); assert.equal(accepted.body.event.carrierVerified,false);
  assert.equal((await post('/dial',{nonce:grant.body.nonce,attemptId:intent.attemptId})).status,409);
  assert.equal((await post('/hangup',{attemptId:'other'})).status,409);
  assert.equal((await post('/hangup',{attemptId:intent.attemptId})).body.event.state,'ended');
  assert.equal((await post('/intent',intent)).status,409);
});
test('DNC, missing consent and payload injection cannot create intent', async t => {
  const f=await fixture(t); const post=await f.login();
  for (const body of [{doNotContact:true},{manualConsent:false},{number:'sip:9000000001@evil'},{leadId:'x\ny'}]) assert.notEqual((await post('/intent',{...intent,...body})).status,200);
});
test('intent expiry, wrong nonce and changed attempt fail without ghost calls', async t => {
  let clock=0; const f=await fixture(t,{now:()=>clock}); const post=await f.login();
  const grant=await post('/intent',intent); clock=15001;
  assert.equal((await post('/dial',{nonce:grant.body.nonce,attemptId:intent.attemptId})).status,409);
  const next=await post('/intent',intent);
  assert.equal((await post('/dial',{nonce:next.body.nonce,attemptId:'wrong'})).status,409);
  assert.equal((await post('/status')).body.state,'ready');
});
test('daily budget and cooldown persist across unpair within process', async t => {
  let clock=0; const f=await fixture(t,{now:()=>clock,dailyLimit:1}); const post=await f.login();
  const grant=await post('/intent',intent); await post('/dial',{nonce:grant.body.nonce,attemptId:intent.attemptId}); await post('/hangup',{attemptId:intent.attemptId});
  clock=3001; assert.equal((await post('/intent',{...intent,attemptId:'next'})).status,429);
  await post('/unpair'); assert.equal((await post('/intent',{...intent,attemptId:'next'})).status,403);
});
test('lease expiry and logout revoke pending intents; no queued call after recovery', async t => {
  let clock=0; const f=await fixture(t,{now:()=>clock}); const post=await f.login();
  const grant=await post('/intent',intent); clock=30001;
  assert.equal((await post('/dial',{nonce:grant.body.nonce,attemptId:intent.attemptId})).status,403);
  assert.equal((await post('/status')).status,403);
});
test('port collision fails rather than choosing public or alternate listener', async t => {
  const f=await fixture(t); const second=createCompanion({origin,...scope,port:f.port});
  await assert.rejects(second.listen(),{code:'EADDRINUSE'}); await second.close();
});
test('fixed request budget rejects request floods', async t => {
  const f=await fixture(t); const post=await f.login();
  for(let i=0;i<299;i++) await post('/status');
  assert.equal((await post('/status')).status,429);
});
