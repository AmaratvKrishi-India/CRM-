import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Dedicated disposable database in this project's LOCAL Docker container.
// No production URL, seed credential or schema mutation in the running app DB.
const container = 'supabase_db_calling_app';
export const org = '10000000-0000-4000-8000-000000000001';
export const otherOrg = '10000000-0000-4000-8000-000000000002';
export const actor = '20000000-0000-4000-8000-000000000001';
export const agent = '20000000-0000-4000-8000-000000000002';
export const authId = '30000000-0000-4000-8000-000000000001';
export const agentAuthId = '30000000-0000-4000-8000-000000000002';
export const quote = (value: unknown) => value === null || value === undefined ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";

export function createOrderingDatabase() {
  const name = 'f003_test_' + randomUUID().replaceAll('-', '');
  const run = (database: string, sql: string) => execFileSync('docker',
    ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database],
    { input: sql, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], maxBuffer: 16 * 1024 * 1024 });
  run('postgres', `CREATE DATABASE ${name};`);
  const raw = (sql: string) => run(name, sql);
  const query = (sql: string, user = authId) => {
    const text = raw(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub=${quote(user)}; ${sql}; COMMIT;`);
    return text.trim() ? JSON.parse(text.trim().split('\n').at(-1)!) : null;
  };
  const close = () => {
    if (!/^f003_test_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test database name');
    run('postgres', `DROP DATABASE ${name} WITH (FORCE);`);
  };
  const heldTransaction = (sql: string) => {
    const child=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',name]);
    let output='',errors='';
    const started=new Promise<void>(resolve=>child.stdout.once('data',()=>resolve()));
    child.stdout.on('data',chunk=>{output+=chunk;});
    child.stderr.on('data',chunk=>{errors+=chunk;});
    const done=new Promise<string>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(new Error(errors)));});
    child.stdin.end(sql);
    return {started,done};
  };
  try {
    raw(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      CREATE PUBLICATION supabase_realtime;`);
    const migrations = readdirSync('supabase/migrations').filter(p => p.endsWith('.sql')).sort();
    // The ordering migration is deliberately applied after the baseline schema
    // below; its follow-up conflict/index migrations depend on the same objects.
    for (const file of migrations.filter(p => !p.startsWith('20260905000008') &&
      !p.startsWith('20260907000012') && !p.startsWith('20260907000013') &&
      !p.startsWith('20260913000016') && !p.startsWith('20260913185759'))) raw(readFileSync('supabase/migrations/' + file, 'utf8'));
    raw(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,anon;
      INSERT INTO auth.users VALUES (${quote(authId)}),(${quote(agentAuthId)});
      INSERT INTO public.organizations(id,name) VALUES (${quote(org)},'F003 A'),(${quote(otherOrg)},'F003 B');
      INSERT INTO public.profiles(id,auth_user_id,organization_id,name,email,role,status)
      VALUES (${quote(actor)},${quote(authId)},${quote(org)},'F003 Admin','f003admin@example.invalid','ADMIN','ACTIVE'),
        (${quote(agent)},${quote(agentAuthId)},${quote(org)},'F003 Agent','f003agent@example.invalid','AGENT','ACTIVE');`);
    raw(`INSERT INTO leads(organization_id,business_name,phone,address,locality,created_by,assigned_to)
      SELECT ${quote(org)},'Legacy '||n,'9000000000','A','L',${quote(actor)},${quote(actor)} FROM generate_series(1,501) n;`);
    raw(readFileSync('supabase/migrations/20260905000008_server_sync_ordering.sql','utf8'));
    raw(readFileSync('supabase/migrations/20260907000012_sync_conflict_http_status.sql','utf8'));
    raw(readFileSync('supabase/migrations/20260907000013_call_record_attempt_identity.sql','utf8'));
    raw(readFileSync('supabase/migrations/20260913000016_security_definer_surface_hardening.sql','utf8'));
    raw(readFileSync('supabase/migrations/20260913185759_security_definer_helper_execute_hardening.sql','utf8'));
  } catch (error) { close(); throw error; }

  function client(user = authId) {
    return {
      async rpc(fn: string, args: Record<string, unknown> = {}) {
        try {
          const value = fn === 'sync_head' ? query('SELECT public.sync_head()',user) :
            query(`SELECT public.sync_mutate(${quote(args.entity)},${quote(args.operation)},${quote(args.mutation_id)}::uuid,
              ${quote(args.expected_revision)}::bigint,${quote(JSON.stringify(args.payload))}::jsonb)`,user);
          return {data:value,error:null};
        } catch (error) { return {data:null,error:{message:String(error)}}; }
      },
      from(table: string) {
        if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid test table');
        const filters: string[] = [], orders: string[] = [];
        let cap = 10000, start = 0;
        const q = {
          select: (_columns = '*') => q,
          eq: (key: string, value: unknown) => {filters.push(`${key}=${quote(value)}`);return q;},
          gte: (key: string, value: unknown) => {filters.push(`${key}>=${quote(value)}`);return q;},
          lte: (key: string, value: unknown) => {filters.push(`${key}<=${quote(value)}`);return q;},
          is: (key: string, _value: null) => {filters.push(`${key} IS NULL`);return q;},
          order: (key: string) => {orders.push(key);return q;},
          limit: (n: number) => {cap=n;return q;},
          range: (a: number,b: number) => {start=a;cap=b-a+1;return q;},
          or: (condition: string) => {
            const keyset = /^sync_revision.gt.(\d+),and\(sync_revision.eq.(\d+),id.gt."([\w-]+)"\)$/.exec(condition);
            if (keyset) filters.push(`(sync_revision>${keyset[1]} OR (sync_revision=${keyset[2]} AND id>${quote(keyset[3])}))`);
            else {
              const access = /^assigned_to.eq.([\w-]+),created_by.eq.([\w-]+)$/.exec(condition);
              if (!access) throw new Error('Unexpected test query: '+condition);
              filters.push(`(assigned_to=${quote(access[1])} OR created_by=${quote(access[2])})`);
            }
            return q;
          },
          then: (resolve: (value: unknown)=>unknown, reject?: (e: unknown)=>unknown) => {
            try {
              const data = query(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM
                (SELECT * FROM public.${table} ${filters.length?'WHERE '+filters.join(' AND '):''}
                ${orders.length?'ORDER BY '+orders.join(','):''} LIMIT ${cap} OFFSET ${start}) r`,user);
              return Promise.resolve(resolve({data,error:null}));
            } catch(error) {return Promise.resolve(resolve({data:null,error:{message:String(error)}})).catch(reject);}
          },
        };
        return q;
      },
    };
  }
  return {name,raw,query,client,close,heldTransaction};
}
