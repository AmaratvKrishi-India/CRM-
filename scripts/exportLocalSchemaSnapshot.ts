import { execSync } from 'child_process';
import fs from 'fs';

function runSql(query: string): any[] {
  const jsonQuery = `SELECT coalesce(json_agg(t), '[]'::json) FROM (${query}) t;`;
  const output = execSync(
    'docker exec -i supabase_db_calling_app psql -U postgres -d postgres -t -A',
    { input: jsonQuery, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  ).trim();
  if (!output || output === '') return [];
  try {
    return JSON.parse(output);
  } catch (err) {
    console.error('Failed to parse SQL output:', output);
    return [];
  }
}

async function exportLocalSchema() {
  console.log('Exporting Local Schema Snapshot from Docker PostgreSQL...');

  // 1. Tables & Columns
  const columnsQuery = `
    SELECT 
      table_name,
      column_name,
      ordinal_position,
      column_default,
      is_nullable,
      data_type,
      udt_name,
      character_maximum_length,
      numeric_precision,
      is_identity,
      identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;
  const columns = runSql(columnsQuery);

  // 2. Primary Keys
  const pkQuery = `
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position
  `;
  const primaryKeys = runSql(pkQuery);

  // 3. Foreign Keys
  const fkQuery = `
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `;
  const foreignKeys = runSql(fkQuery);

  // 4. Unique Constraints
  const uniqueQuery = `
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `;
  const uniqueConstraints = runSql(uniqueQuery);

  // 5. Check Constraints
  const checkQuery = `
    SELECT
      tc.table_name,
      tc.constraint_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
      AND tc.constraint_schema = cc.constraint_schema
    WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      AND tc.constraint_name NOT LIKE '%_not_null'
    ORDER BY tc.table_name, tc.constraint_name
  `;
  const checkConstraints = runSql(checkQuery);

  // 6. Indexes
  const indexQuery = `
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;
  const indexes = runSql(indexQuery);

  // 7. RLS Status and Policies
  const rlsStatusQuery = `
    SELECT
      tablename,
      rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const rlsStatus = runSql(rlsStatusQuery);

  const rlsPoliciesQuery = `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `;
  const rlsPolicies = runSql(rlsPoliciesQuery);

  // 8. Functions
  const functionsQuery = `
    SELECT
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS result_type,
      p.prosecdef AS is_security_definer,
      p.provolatile AS volatility,
      proconfig AS config_parameters,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `;
  const functions = runSql(functionsQuery);

  // 9. Triggers
  const triggersQuery = `
    SELECT
      event_object_table AS table_name,
      trigger_name,
      event_manipulation AS event,
      action_timing AS timing,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `;
  const triggers = runSql(triggersQuery);

  // 10. Realtime Publications
  const realtimeQuery = `
    SELECT
      pubname,
      schemaname,
      tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    ORDER BY tablename
  `;
  const realtime = runSql(realtimeQuery);

  // 11. Extensions
  const extQuery = `
    SELECT
      extname,
      extversion
    FROM pg_extension
    ORDER BY extname
  `;
  const extensions = runSql(extQuery);

  // 12. Migration History
  const migrationsQuery = `
    SELECT
      version,
      name,
      inserted_at
    FROM supabase_migrations.schema_migrations
    ORDER BY version
  `;
  const migrations = runSql(migrationsQuery);

  // 13. Data Row Counts
  const tables = ['organizations', 'profiles', 'leads', 'call_records', 'activities', 'remarks', 'follow_ups', 'message_history', 'import_audits', 'bulk_assignment_audits'];
  const rowCounts: Record<string, number> = {};
  for (const t of tables) {
    const cnt = runSql(`SELECT COUNT(*) AS count FROM public.${t}`);
    rowCounts[t] = parseInt(cnt[0]?.count || '0', 10);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    databaseVersion: runSql('SELECT version()')[0]?.version,
    migrations,
    tables: Array.from(new Set(columns.map((c: any) => c.table_name))),
    columns,
    primaryKeys,
    foreignKeys,
    uniqueConstraints,
    checkConstraints,
    indexes,
    rlsStatus,
    rlsPolicies,
    functions,
    triggers,
    realtime,
    extensions,
    rowCounts
  };

  fs.writeFileSync('docs/local_schema_snapshot.json', JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log('✅ Exported docs/local_schema_snapshot.json');
}

exportLocalSchema().catch(console.error);
