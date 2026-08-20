# Amaratv Krishi CRM — Call Duration & Lifecycle Architecture (Phase 2J)

## 1. Architecture Overview
Milestone 2J implements a robust, privacy-safe native call lifecycle state machine, unverified vs verified duration classification, multi-user call attribution, sync conflict resolution (verified duration priority), and Admin analytics aggregation methods.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │                NATIVE CALL LIFECYCLE FLOW                   │
       │                                                             │
       │   [Lead Profile / Card] ──► [CALL Button]                   │
       │                                   │                         │
       │                                   ▼                         │
       │                      [CallLifecycleService]                 │
       │                      (State: DIAL_INITIATED)                │
       │                                   │                         │
       │                                   ▼                         │
       │                       Intent.ACTION_DIAL (tel:)             │
       │                                   │                         │
       │                                   ▼                         │
       │                      [Native Android Dialer]                │
       │                      (State: APP_BACKGROUND)                │
       │                                   │                         │
       │                    User Places & Concludes Call             │
       │                                   │                         │
       │                                   ▼                         │
       │                    [App Resumes to Foreground]              │
       │                      (State: OUTCOME_PENDING)               │
       │                                   │                         │
       │                                   ▼                         │
       │                        [CallOutcomeModal]                   │
       │                        - Outcome: Connected/Busy/No Answer  │
       │                        - Duration: "Duration unavailable"   │
       │                        - Optional Reported Duration         │
       │                        - Quick Remarks / Custom Note        │
       │                        - Follow-up Scheduler                │
       │                                   │                         │
       │                                   ▼                         │
       │                    [Save Call Outcome Action]               │
       │                      (State: COMPLETED)                     │
       │                                   │                         │
       │         ┌─────────────────────────┴────────────────────────┐│
       │         ▼                                                  ▼│
       │   [Dexie callRecords]                            [Dexie outbox]
       │   (verificationStatus: UNVERIFIED)               (operation: CREATE)
       │   (durationSeconds: 0)                                     │
       │                                                            ▼
       │                                                  [Supabase call_records]
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Intent.ACTION_DIAL vs Invasive Permissions

| Approach | Permissions Required | Verification Level | Privacy & Play Store Impact | Implemented In CRM |
|---|---|---|---|---|
| **Intent.ACTION_DIAL (Current)** | **None** | `UNVERIFIED` | 100% Safe, zero permissions, standard Android intent | **YES (Active)** |
| **Intent.ACTION_CALL** | `CALL_PHONE` | `UNVERIFIED` | Places call directly without dialer confirmation; does NOT measure call talk time. | **NO (Rejected)** |
| **Call Log Query** | `READ_CALL_LOG` | `VERIFIED` | Invasive; strictly forbidden by Google Play for non-default dialers. | **NO (Rejected)** |
| **Telephony Callback** | `READ_PHONE_STATE` | `UNVERIFIED` / Approx | Detects ringing/off-hook state only; does not provide reliable connected talk duration without call logs. | **NO (Rejected)** |

---

## 3. Duration Verification & Accuracy Safeguards

1. **Zero Fabrication Policy**:
   - The application **never** calculates call duration from elapsed app lifecycle time (`Date.now() - dialLaunchTime`).
   - Elapsed background time measures user dialer interactions, lock screen intervals, and multitasking—**not phone conversation duration**.
2. **Explicit Verification Status**:
   - Standard phone calls launched via `Intent.ACTION_DIAL` record `verificationStatus = 'UNVERIFIED'` and `durationSeconds = 0`.
   - The UI explicitly renders `"Duration unavailable"` rather than displaying misleading estimates.
3. **User-Reported Duration**:
   - If an agent manually enters an estimated talk duration (e.g. 3 mins), it is stored as `reportedDurationSeconds = 180`.
   - `verificationStatus` remains strictly `UNVERIFIED`. It is never converted to `VERIFIED`.

---

## 4. Multi-User Calling & Ownership

- **Actor Attribution**:
  - `userId` is strictly derived from the authenticated session (`currentUser.id`).
  - When an Admin places a call, `userId = Admin.id`.
  - When an Agent places a call, `userId = Agent.id`.
- **Historical Immutability**:
  - `CallRecord` entries are append-only.
  - Reassigning a lead or deactivating an agent account does **not** delete or reassign historical call records.

---

## 5. Sync Conflict Resolution Rule
- **VERIFIED strictly wins over UNVERIFIED**:
  In `SyncConflictResolver.resolveCallRecord`:
  - If remote has `verificationStatus = 'VERIFIED'` and local has `UNVERIFIED`, remote wins.
  - If local has `verificationStatus = 'VERIFIED'` and remote has `UNVERIFIED`, local wins.
  - If verification levels match, timestamp Last-Write-Wins (LWW) is used.

---

## 6. Admin Analytics Foundation
Repository functions available for Milestone 2K/2L analytics:
- `getCallsForAgent(agentId)`
- `getCallsForLead(leadId)`
- `getVerifiedTalkTimeForAgent(agentId)` (Only verified calls contribute to talk time)
- `getCallCountForAgent(agentId)` (Returns `{ total, verified, unverified }`)
- `getAverageVerifiedCallDuration(agentId)` (Averages duration among verified calls only)
- `getOrganisationCallSummary()` (Returns full organization metrics and per-agent metrics)
