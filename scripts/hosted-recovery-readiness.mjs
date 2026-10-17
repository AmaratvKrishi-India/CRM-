// Contract validation only: deliberately has no database, upload, secret or process API.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function validateRecoveryContract(value) {
  const projects={staging:'dhoinifpzijqyobcamlv',production:'lahvcodvgubplzfshare'};
  const missing=[];
  for(const [name,ref] of Object.entries(projects)) {
    const project=value?.[name];
    if(project?.projectRef!==ref) missing.push(`${name}:project-mapping`);
    for(const gate of ['reviewerProtection','mainOnly','approvedPostgresBinding','verifyFullTls','trustedCa','privateRetention','independentKeyCustody','authAndMigrationMetadata','storageObjectPlan','isolatedPg17Restore','sideEffectsBlocked','downloadIntegrity','restoreAndRollbackEvidence','providerPatchReview']) if(project?.[gate]!==true) missing.push(`${name}:${gate}`);
  }
  return { status:missing.length?'BLOCKED':'CONTRACT_VALID_NOT_EXECUTED',missing,backupCreated:false,restorePerformed:false,hostedMutation:false };
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const report=validateRecoveryContract(JSON.parse(await readFile(process.argv[2]||'docs/database/hosted-recovery-contract.example.json','utf8')));
  console.log(JSON.stringify(report,null,2));if(report.status==='BLOCKED') process.exitCode=2;
}
