import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createOrderingDatabase, org, otherOrg, actor, quote } from './helpers/f003Postgres.ts';

const edgeSource = readFileSync('supabase/functions/create-agent/index.ts', 'utf8');
const clientSource = readFileSync('src/services/agentManagementService.ts', 'utf8');
const execFileAsync = promisify(execFile);

describe('F002 create-agent abuse controls', { concurrency: 1 }, () => {
  let database: ReturnType<typeof createOrderingDatabase>;
  const secondAdmin = '20000000-0000-4000-8000-000000000099';
  const otherAdmin = '20000000-0000-4000-8000-000000000098';

  before(() => {
    database = createOrderingDatabase();
    database.raw(`INSERT INTO auth.users(id) VALUES ('30000000-0000-4000-8000-000000000099'),('30000000-0000-4000-8000-000000000098');
      INSERT INTO public.profiles(id,auth_user_id,organization_id,name,email,role,status)
      VALUES ('${secondAdmin}','30000000-0000-4000-8000-000000000099','${org}','Second Admin','second-admin@example.invalid','ADMIN','ACTIVE');`);
    database.raw(`INSERT INTO public.profiles(id,auth_user_id,organization_id,name,email,role,status)
      VALUES ('${otherAdmin}','30000000-0000-4000-8000-000000000098','${otherOrg}','Other Admin','other-admin@example.invalid','ADMIN','ACTIVE');`);
  });
  after(() => database.close());
  // Keep unrelated assertions away from a real-time five-minute window boundary;
  // the dedicated reset/retry tests below override this value explicitly.
  beforeEach(() => database.raw(`TRUNCATE public.agent_provisioning_rate_limits;
    UPDATE public.agent_provisioning_policy SET window_seconds=86400,per_admin_limit=10,per_organization_limit=25;`));

  const reserve = (organization = org, administrator = actor) => database.raw(
    `SELECT public.reserve_agent_provisioning(${quote(organization)}::uuid,${quote(administrator)}::uuid)::text;`
  ).trim();

  it('1 authorized admin path remains present', () => assert.match(edgeSource, /callerProfile\.role !== 'ADMIN'/));
  it('2 unauthenticated requests are rejected', () => assert.match(edgeSource, /Missing Authorization header/));
  it('3 non-admin requests are rejected', () => assert.match(edgeSource, /Only administrators are authorized/));
  it('4 organization is derived from the trusted caller profile', () => {
    assert.match(edgeSource, /organization_id: callerProfile\.organization_id/);
    assert.doesNotMatch(edgeSource, /organization_id:\s*body\./);
  });
  it('5 invalid email is rejected', () => assert.match(edgeSource, /Invalid email format/));
  it('6 malformed JSON is rejected', () => assert.match(edgeSource, /Invalid JSON request body/));
  it('7 same-email replay returns the existing agent safely', () => assert.match(edgeSource, /replayed: true/));
  it('8 client supplies a UUID idempotency key', () => assert.match(clientSource, /idempotencyKey: crypto\.randomUUID\(\)/));
  it('9 response-loss replay is backed by durable provisioning_key lookup', () => assert.match(edgeSource, /\.eq\('provisioning_key', idempotencyKey\)/));
  it('10 idempotency-key reuse binds all persisted identity fields', () => {
    assert.match(edgeSource, /keyedProfile\.name\.trim\(\) !== name\.trim\(\)/);
    assert.match(edgeSource, /keyedProfile\.phone \|\| ''/);
    assert.match(edgeSource, /already used for a different request/);
  });

  it('11 requests below the configured admin limit succeed', () => {
    for (let i = 0; i < 10; i += 1) assert.equal(JSON.parse(reserve()).allowed, true);
  });
  it('12 the configured per-admin rate limit triggers', () => {
    for (let i = 0; i < 10; i += 1) reserve();
    assert.equal(JSON.parse(reserve()).allowed, false);
  });
  it('13 a rejected excess request does not increment the counter', () => {
    for (let i = 0; i < 11; i += 1) reserve();
    assert.equal(database.raw(`SELECT request_count FROM public.agent_provisioning_rate_limits WHERE administrator_id='${actor}';`).trim(), '10');
  });
  it('14 concurrent requests enforce the organization-wide limit atomically', async () => {
    database.raw('UPDATE public.agent_provisioning_policy SET per_admin_limit=20,per_organization_limit=3;');
    const sql = (admin: string) => `SELECT public.reserve_agent_provisioning('${org}'::uuid,'${admin}'::uuid)::text;`;
    const results = await Promise.all([actor, secondAdmin, actor, secondAdmin].map(async admin => {
      const { stdout } = await execFileAsync('docker', ['exec','-i','supabase_db_calling_app','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database.name,'-c',sql(admin)]);
      return JSON.parse(stdout.trim());
    }));
    assert.equal(results.filter(result => result.allowed).length, 3);
    assert.equal(results.filter(result => !result.allowed).length, 1);
  });
  it('15 one organization cannot consume another organization limit', () => {
    database.raw('UPDATE public.agent_provisioning_policy SET per_admin_limit=2,per_organization_limit=2;');
    reserve(org); reserve(org);
    assert.equal(JSON.parse(reserve(org)).allowed, false);
    assert.equal(JSON.parse(reserve(otherOrg, otherAdmin)).allowed, true);
  });
  it('16 the fixed window resets deterministically', () => {
    database.raw('UPDATE public.agent_provisioning_policy SET per_admin_limit=1;');
    assert.equal(JSON.parse(reserve()).allowed, true);
    assert.equal(JSON.parse(reserve()).allowed, false);
    database.raw(`UPDATE public.agent_provisioning_rate_limits SET window_started_at=window_started_at-interval '10 minutes';`);
    assert.equal(JSON.parse(reserve()).allowed, true);
  });
  it('17 retry-after is bounded by the configured window', () => {
    database.raw('UPDATE public.agent_provisioning_policy SET per_admin_limit=1,window_seconds=60;');
    reserve();
    const result = JSON.parse(reserve());
    assert.ok(result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 60);
  });
  it('18 rate state is tied to trusted UUID organization/admin keys', () => {
    reserve();
    const row = JSON.parse(database.raw(`SELECT row_to_json(r)::text FROM public.agent_provisioning_rate_limits r;`).trim());
    assert.equal(row.organization_id, org);
    assert.equal(row.administrator_id, actor);
  });
  it('19 malformed trusted context fails closed', () => {
    assert.throws(() => database.raw('SELECT public.reserve_agent_provisioning(NULL,NULL);'));
    assert.throws(() => reserve(otherOrg, actor));
  });
  it('20 provisioning keys are unique inside an organization', () => {
    const key = randomUUID();
    database.raw(`UPDATE public.profiles SET provisioning_key=${quote(key)}::uuid WHERE id=${quote(actor)}::uuid;`);
    assert.throws(() => database.raw(`UPDATE public.profiles SET provisioning_key=${quote(key)}::uuid WHERE id=${quote(secondAdmin)}::uuid;`));
  });
});
