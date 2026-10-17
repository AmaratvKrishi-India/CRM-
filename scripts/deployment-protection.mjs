export function knownVercelProtection(value, base) {
  try {
    const url=new URL(value,base);
    return url.protocol==='https:' && ['vercel.com','www.vercel.com'].includes(url.hostname) && /^\/(?:login|sso|sso-api)(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}
export function approvedBypassHeaders(env) {
  if (!env.VERCEL_AUTOMATION_BYPASS) return {};
  if(env.GITHUB_EVENT_NAME!=='workflow_dispatch' || env.GITHUB_REF!=='refs/heads/main' || env.CRM_BROWSER_PROTECTION_VERIFIED!=='1') throw new Error('Bypass requires reviewed main-only protected manual execution.');
  return {'x-vercel-protection-bypass':env.VERCEL_AUTOMATION_BYPASS,'x-vercel-set-bypass-cookie':'true'};
}
