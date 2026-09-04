import fs from 'fs';

const PROD_URL = process.env.PROD_SUPABASE_URL;
const PROD_ANON_KEY = process.env.PROD_SUPABASE_ANON_KEY;

const localSnapshot = JSON.parse(fs.readFileSync('docs/local_schema_snapshot.json', 'utf-8'));

async function probeCloud() {
  if (!PROD_URL || !PROD_ANON_KEY) {
    throw new Error('Set PROD_SUPABASE_URL and PROD_SUPABASE_ANON_KEY explicitly before probing a non-production test target.');
  }
  console.log('Probing Supabase Cloud Production database at', PROD_URL, '...');
  const results: any = {
    probedAt: new Date().toISOString(),
    prodUrl: PROD_URL,
    tables: {},
    columns: {},
    foreignKeys: {},
    rlsReadAccess: {},
    realtimeChannels: {},
    authSettings: {},
    rowCounts: {},
  };

  // 1. Probe Auth Settings
  try {
    const authRes = await fetch(`${PROD_URL}/auth/v1/settings`, {
      headers: { apikey: PROD_ANON_KEY },
    });
    if (authRes.ok) {
      results.authSettings = await authRes.json();
    } else {
      results.authSettings = { status: authRes.status, statusText: authRes.statusText };
    }
  } catch (err: any) {
    results.authSettings = { error: err.message };
  }

  // 2. Probe Table Existence and Row Counts
  for (const tableName of localSnapshot.tables) {
    try {
      const res = await fetch(`${PROD_URL}/rest/v1/${tableName}?limit=0`, {
        method: 'GET',
        headers: {
          apikey: PROD_ANON_KEY,
          Authorization: `Bearer ${PROD_ANON_KEY}`,
          Prefer: 'count=exact',
        },
      });

      const countHeader = res.headers.get('content-range');
      let count = null;
      if (countHeader) {
        const parts = countHeader.split('/');
        if (parts[1]) {
          count = parseInt(parts[1], 10);
        }
      }

      results.tables[tableName] = {
        exists: res.status === 200,
        status: res.status,
        statusText: res.statusText,
        rowCount: count,
      };
      results.rowCounts[tableName] = count;
      results.rlsReadAccess[tableName] = {
        anonSelectStatus: res.status,
        anonSelectAllowed: res.status === 200,
      };
    } catch (err: any) {
      results.tables[tableName] = { exists: false, error: err.message };
    }
  }

  // 3. Probe Every Local Column on Remote
  for (const col of localSnapshot.columns) {
    const { table_name, column_name } = col;
    if (!results.columns[table_name]) {
      results.columns[table_name] = {};
    }

    try {
      const res = await fetch(`${PROD_URL}/rest/v1/${table_name}?select=${column_name}&limit=0`, {
        method: 'GET',
        headers: {
          apikey: PROD_ANON_KEY,
          Authorization: `Bearer ${PROD_ANON_KEY}`,
        },
      });

      if (res.status === 200) {
        results.columns[table_name][column_name] = { exists: true };
      } else {
        const errText = await res.text();
        results.columns[table_name][column_name] = {
          exists: false,
          status: res.status,
          error: errText,
        };
      }
    } catch (err: any) {
      results.columns[table_name][column_name] = { exists: false, error: err.message };
    }
  }

  // 4. Probe Foreign Key Embeddings
  const fkProbes = [
    { table: 'profiles', embed: 'organization:organizations(id)', name: 'profiles_organization_id_fkey' },
    { table: 'leads', embed: 'organization:organizations(id)', name: 'leads_organization_id_fkey' },
    { table: 'leads', embed: 'created_by_profile:profiles!leads_created_by_fkey(id)', name: 'leads_created_by_fkey' },
    { table: 'leads', embed: 'assigned_to_profile:profiles!leads_assigned_to_fkey(id)', name: 'leads_assigned_to_fkey' },
    { table: 'call_records', embed: 'organization:organizations(id)', name: 'call_records_organization_id_fkey' },
    { table: 'call_records', embed: 'lead:leads(id)', name: 'call_records_lead_id_fkey' },
    { table: 'call_records', embed: 'user:profiles(id)', name: 'call_records_user_id_fkey' },
    { table: 'activities', embed: 'organization:organizations(id)', name: 'activities_organization_id_fkey' },
    { table: 'activities', embed: 'lead:leads(id)', name: 'activities_lead_id_fkey' },
    { table: 'remarks', embed: 'organization:organizations(id)', name: 'remarks_organization_id_fkey' },
    { table: 'remarks', embed: 'lead:leads(id)', name: 'remarks_lead_id_fkey' },
    { table: 'follow_ups', embed: 'organization:organizations(id)', name: 'follow_ups_organization_id_fkey' },
    { table: 'follow_ups', embed: 'lead:leads(id)', name: 'follow_ups_lead_id_fkey' },
    { table: 'message_history', embed: 'organization:organizations(id)', name: 'message_history_organization_id_fkey' },
    { table: 'message_history', embed: 'lead:leads(id)', name: 'message_history_lead_id_fkey' },
    { table: 'import_audits', embed: 'organization:organizations(id)', name: 'import_audits_organization_id_fkey' },
    { table: 'bulk_assignment_audits', embed: 'organization:organizations(id)', name: 'bulk_assignment_audits_organization_id_fkey' },
  ];

  for (const probe of fkProbes) {
    try {
      const res = await fetch(`${PROD_URL}/rest/v1/${probe.table}?select=id,${probe.embed}&limit=0`, {
        method: 'GET',
        headers: {
          apikey: PROD_ANON_KEY,
          Authorization: `Bearer ${PROD_ANON_KEY}`,
        },
      });
      results.foreignKeys[probe.name] = {
        table: probe.table,
        fkeyVerified: res.status === 200,
        status: res.status,
      };
    } catch (err: any) {
      results.foreignKeys[probe.name] = { table: probe.table, fkeyVerified: false, error: err.message };
    }
  }

  // 5. Probe Legacy / Candidate Other Tables
  const candidateExtraTables = [
    'gyms',
    'customers',
    'sales_reps',
    'lead_history',
    'telephony_logs',
    'whatsapp_logs',
    'templates',
    'audit_logs',
  ];
  results.candidateExtraTables = {};
  for (const t of candidateExtraTables) {
    try {
      const res = await fetch(`${PROD_URL}/rest/v1/${t}?limit=0`, {
        method: 'GET',
        headers: { apikey: PROD_ANON_KEY, Authorization: `Bearer ${PROD_ANON_KEY}` },
      });
      results.candidateExtraTables[t] = { exists: res.status === 200, status: res.status };
    } catch (err: any) {
      results.candidateExtraTables[t] = { exists: false, error: err.message };
    }
  }

  fs.writeFileSync('docs/cloud_schema_probe_results.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('✅ Exported docs/cloud_schema_probe_results.json');
}

probeCloud().catch(console.error);
