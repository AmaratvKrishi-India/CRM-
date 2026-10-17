// Contract derived from pinned NetSIPCore source; no upstream implementation copied.
export const UPSTREAM = Object.freeze({ commit: 'f594e3eea6b65825691513943a2ccf5cda8e853b', host: '127.0.0.1', port: 4890 });
export function indiaMobile(value) {
  if (typeof value !== 'string' || value.length > 32 || !/^[+\d ()-]+$/.test(value)) throw new Error('invalid-number');
  const digits = value.replace(/[ ()-]/g, '');
  const match = /^(?:\+91|91)?([6-9]\d{9})$/.exec(digits);
  if (!match) throw new Error('invalid-number');
  return `+91${match[1]}`;
}
export function command(command, username, remote) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(username)) throw new Error('invalid-account');
  if (command === 'hangup') return JSON.stringify({ command, username }) + '\n';
  if (command !== 'call') throw new Error('unsupported-command');
  return JSON.stringify({ command, username, server: '127.0.0.1:5061', remote: indiaMobile(remote) }) + '\n';
}
export class StateDecoder {
  buffer = '';
  push(chunk) {
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > 8192) { this.buffer = ''; throw new Error('oversized-ndjson'); }
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop();
    return lines.map(line => {
      let event;
      try { event = JSON.parse(line); } catch { throw new Error('malformed-ndjson'); }
      if (!event || typeof event !== 'object' || !/^[A-Za-z0-9_-]{1,64}$/.test(event.username ?? '') ||
          !['registering', 'registered', 'incoming', 'ringing', 'confirmed', 'streaming', 'disconnected'].includes(event.state) ||
          !['inactive', 'connected'].includes(event.media_state) || !['play', 'stop'].includes(event.audio_state)) throw new Error('invalid-engine-event');
      // Do not forward remote URI/number or unknown fields to the hosted browser.
      return { account: event.username, state: event.state, media: event.media_state };
    });
  }
}
