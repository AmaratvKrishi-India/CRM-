# 27 - BACKUP & RESTORE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `src/services/backupService.ts`, `src/components/backup/BackupRestoreModal.tsx`, `tests/backupRestoreIntegrity.test.ts`, `tests/realBackupService.test.ts`
- **SCOPE:** Complete backup and restore implementation
- **RELATED_DOCUMENTS:** 17_OFFLINE_FIRST.md, 21_ERROR_HANDLING.md, 23_QA_TEST_MATRIX.md

---

## Backup & Restore Overview

The CRM implements **full JSON backup/restore** with **Last-Write-Wins (LWW) merge strategy** for conflict resolution during restore. All 13 entity types are included.

### Key Files
| File | Size | Purpose |
|------|------|---------|
| `backupService.ts` | 23,489 bytes | Core backup/restore logic |
| `BackupRestoreModal.tsx` | 23,021 bytes | UI for backup/restore |
| `backupRestoreIntegrity.test.ts` | 4,871 bytes | Integrity tests (5 tests) |
| `realBackupService.test.ts` | 4,757 bytes | Integration tests (3 tests) |

---

## Backup

### What Gets Backed Up (13 Entity Types)
```typescript
const BACKUP_ENTITIES = [
  'leads',
  'call_records',
  'activities',
  'remarks',
  'follow_ups',
  'message_history',
  'message_templates',
  'users',
  'import_audits',
  'bulk_assignment_audits',
  'call_history',      // Legacy call history
  'outbox',            // Pending sync items
  'sync_state',        // Sync cursors
];
```

### Backup Format (JSON)
```json
{
  "version": 1,
  "timestamp": "2026-08-25T10:30:00.000Z",
  "deviceId": "uuid-v4",
  "organizationId": "uuid-v4",
  "entityCounts": {
    "leads": 141,
    "call_records": 87,
    "activities": 234,
    "remarks": 12,
    "follow_ups": 5,
    "message_history": 8,
    "message_templates": 5,
    "users": 3,
    "import_audits": 2,
    "bulk_assignment_audits": 1,
    "call_history": 87,
    "outbox": 3,
    "sync_state": 1
  },
  "data": {
    "leads": [...],
    "call_records": [...],
    // ... all entities
  }
}
```

### Backup Process
```typescript
async function createBackup(): Promise<BackupData> {
  // 1. Read all entities from Dexie
  const entityData = {};
  for (const entity of BACKUP_ENTITIES) {
    entityData[entity] = await db[entity].toArray();
  }

  // 2. Build metadata
  const backup = {
    version: 1,
    timestamp: new Date().toISOString(),
    deviceId: getDeviceId(),
    organizationId: getCurrentOrgId(),
    entityCounts: Object.fromEntries(
      Object.entries(entityData).map(([k, v]) => [k, v.length])
    ),
    data: entityData,
  };

  // 3. Serialize to JSON
  return backup;
}
```

### Download Flow
1. User clicks "Create Backup" in Settings
2. `BackupRestoreModal` calls `backupService.createBackup()`
3. JSON blob created → `URL.createObjectURL()`
4. `<a download="backup-2026-08-25.json">` triggered
5. File saved to device Downloads

---

## Restore

### LWW Merge Strategy
**Rule:** For each entity, compare `updatedAt` timestamps. **Remote (backup) wins on tie.**

```typescript
async function restoreEntity(entityType: string, backupRecords: any[]): Promise<RestoreResult> {
  const localRecords = await db[entityType].toArray();
  const localMap = new Map(localRecords.map(r => [r.id, r]));
  
  let created = 0, updated = 0, skipped = 0, conflicts = 0;

  for (const backupRecord of backupRecords) {
    const localRecord = localMap.get(backupRecord.id);
    
    if (!localRecord) {
      // New record - insert
      await db[entityType].put(backupRecord);
      created++;
    } else {
      const localTime = new Date(localRecord.updatedAt).getTime();
      const backupTime = new Date(backupRecord.updatedAt).getTime();
      
      if (backupTime > localTime) {
        // Backup newer - overwrite
        await db[entityType].put(backupRecord);
        updated++;
      } else if (backupTime === localTime) {
        // Tie - REMOTE WINS (LWW tie-break)
        await db[entityType].put(backupRecord);
        conflicts++;
      } else {
        // Local newer - keep local
        skipped++;
      }
    }
  }
  
  return { created, updated, skipped, conflicts };
}
```

### Restore Process
```typescript
async function restoreFromBackup(backupJson: string): Promise<RestoreSummary> {
  const backup = JSON.parse(backupJson);
  
  // 1. Validate backup format
  validateBackupFormat(backup);
  
  // 2. Version check
  if (backup.version > CURRENT_BACKUP_VERSION) {
    throw new Error('Backup version too new');
  }
  
  // 3. Organization check (optional - allow cross-org with warning)
  if (backup.organizationId !== getCurrentOrgId()) {
    console.warn('Backup from different organization');
  }
  
  // 4. Transactional restore per entity
  const results = {};
  for (const entityType of BACKUP_ENTITIES) {
    const records = backup.data[entityType] || [];
    results[entityType] = await restoreEntity(entityType, records);
  }
  
  // 5. Rebuild outbox for restored data
  await rebuildOutboxFromRestoredData();
  
  // 6. Reset sync state
  await resetSyncState();
  
  return { results, timestamp: backup.timestamp };
}
```

### Restore UI Flow
1. User clicks "Restore from Backup" in Settings
2. File picker → selects `.json` file
3. `BackupRestoreModal` reads file → `FileReader`
4. Preview shows: timestamp, entity counts, org ID
5. User confirms → `backupService.restoreFromBackup()`
6. Progress shown per entity
7. Summary: created/updated/skipped/conflicts per entity
8. Auto-triggers full sync

---

## Conflict Resolution During Restore

### LWW Tie-Break Rules
| Scenario | Resolution |
|----------|------------|
| Backup newer | Use backup |
| Local newer | Keep local |
| **Equal timestamps** | **Use backup (remote wins)** |
| Backup only | Insert |
| Local only | Keep local |

### Conflict Reporting
```typescript
interface RestoreResult {
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;  // LWW tie-breaks (remote won)
}
```

**UI shows:** "Restored: 141 leads (5 conflicts resolved - backup data used)"

---

## Sync Integration After Restore

### Outbox Rebuild
```typescript
async function rebuildOutboxFromRestoredData(): Promise<void> {
  // 1. Clear existing outbox
  await db.outbox.clear();
  
  // 2. For each restored entity with isSynced=0, enqueue
  for (const entityType of BACKUP_ENTITIES) {
    const unsynced = await db[entityType]
      .where('isSynced').equals(0)
      .toArray();
    
    for (const record of unsynced) {
      await db.outbox.put({
        entityType,
        entityId: record.id,
        operation: record.deletedAt ? 'DELETE' : 'UPDATE',
        payload: record,
        status: 'PENDING',
        // ...
      });
    }
  }
}
```

### Sync State Reset
```typescript
async function resetSyncState(): Promise<void> {
  await db.syncState.put({
    id: 'current',
    deviceId: getDeviceId(),
    organizationId: getCurrentOrgId(),
    lastSuccessfulSyncAt: null,
    lastPullCursor: null,
    lastPushAt: null,
    lastPullAt: null,
    lastSyncError: null,
    status: 'PENDING',
  });
}
```

**Result:** Next background sync will do full pull from cursor=null.

---

## Testing

### Unit Tests
| Test File | Tests | Coverage |
|-----------|-------|----------|
| `backupRestoreIntegrity.test.ts` | 5 | JSON validation, LWW merge, conflict tie-break, version check, org mismatch |
| `realBackupService.test.ts` | 3 | Full backup/restore cycle, data integrity, sync integration |

### Test Scenarios
| Scenario | Test Coverage |
|----------|---------------|
| Valid backup → restore | ✅ |
| Corrupt JSON | ✅ (validation error) |
| Version too new | ✅ (version error) |
| Version too old | ✅ (migration handled) |
| LWW: backup newer | ✅ (backup wins) |
| LWW: local newer | ✅ (local kept) |
| LWW: equal timestamps | ✅ (backup wins) |
| Cross-org restore | ✅ (warning only) |
| Restore → sync integration | ✅ (outbox rebuilt) |
| Large backup (1000+ records) | ✅ (performance) |

---

## UI: BackupRestoreModal

### Features
| Feature | Implementation |
|---------|----------------|
| **Create Backup** | One-click, auto-download |
| **Restore Preview** | Shows timestamp, entity counts, org ID |
| **Progress Indicator** | Per-entity progress bar |
| **Conflict Summary** | Created/Updated/Skipped/Conflicts |
| **Error Handling** | Validation errors, version mismatch, corrupt JSON |
| **Accessibility** | ARIA labels, keyboard nav, focus management |

### Modal Sections
```
┌─────────────────────────────────────┐
│  Backup & Restore          [×]      │
├─────────────────────────────────────┤
│  [ Create Backup ]                  │
│  ─────────────────────────────────  │
│  Restore from File                  │
│  [ Choose File ]  backup-2026.json  │
│                                     │
│  Preview:                           │
│  📅 2026-08-25 10:30:00             │
│  🏢 Amaratv Krishi Lucknow Central  │
│  📊 13 entities, 502 records        │
│                                     │
│  [ Cancel ]    [ Restore ]          │
└─────────────────────────────────────┘
```

---

## Security Considerations

### Backup Security
- **No encryption** (local-only, user-controlled)
- **No cloud upload** (user manages file)
- **Contains PII** (phones, names, addresses)
- **User responsibility** to secure backup file

### Restore Security
- **Org ID warning** (not enforced)
- **Version validation** (prevents future-version restore)
- **JSON schema validation** (prevents corrupt/restore attacks)
- **No code execution** (pure JSON data)

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No encryption | Backup file readable | User secures file |
| No cloud storage | Manual file management | User manages |
| No incremental backup | Full backup only | Acceptable for size |
| No scheduled backup | Manual only | User workflow |
| No restore preview diff | Can't see field-level changes | Summary only |
| Cross-org restore allowed | Data leakage risk | Warning only |

---

## Operational Procedures

### Recommended Backup Schedule
| Frequency | Trigger | Retention |
|-----------|---------|-----------|
| Daily | Manual (end of day) | 7 days |
| Weekly | Manual (Friday) | 4 weeks |
| Pre-major-change | Manual (before import/bulk assign) | 1 month |

### Restore Procedure
1. **Verify** backup file integrity (JSON valid)
2. **Confirm** user wants to restore (destructive)
3. **Execute** restore with progress
4. **Verify** summary matches expectations
5. **Trigger** full sync
6. **Confirm** cloud data matches

---

## Testing Checklist
- [ ] Create backup → verify JSON structure
- [ ] Restore backup → verify all entities
- [ ] LWW merge: backup newer → backup wins
- [ ] LWW merge: local newer → local kept
- [ ] LWW merge: equal timestamps → backup wins
- [ ] Corrupt JSON → validation error
- [ ] Version too new → version error
- [ ] Cross-org restore → warning shown
- [ ] Restore → sync triggered → cloud matches
- [ ] Large backup (1000+) → completes < 30s