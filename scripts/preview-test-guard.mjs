// Fail before any browser can execute hosted writes. No bypass or identity is inferred.
export function assertPreviewTestTarget(env) {
  const preview = 'https://crm-git-chore-post-release-maintenance-amaratv-krishi.vercel.app';
  if (env.PLAYWRIGHT_BASE_URL !== preview || env.VITE_SUPABASE_URL !== 'https://dhoinifpzijqyobcamlv.supabase.co') throw new Error('Hosted E2E requires the exact approved Preview and Staging backend. Production test writes are prohibited.');
  let claim;
  try { claim=JSON.parse(Buffer.from(env.VITE_SUPABASE_ANON_KEY.split('.')[1],'base64url').toString()); } catch { throw new Error('Staging public key scope cannot be verified.'); }
  if(claim.role!=='anon' || claim.ref!=='dhoinifpzijqyobcamlv') throw new Error('Hosted E2E key is not the Staging public anon key.');
}
