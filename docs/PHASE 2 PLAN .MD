Yes. With all your requirements combined, I would **lock Phase 2 around one single app with two roles**:

- **ADMIN** → full CRM access
- **AGENT/SALESPERSON** → operational sales access
- **Same APK/app**
- **Same database**
- **Same lead records**
- **Offline-first**
- Cloud used only for **authentication + synchronisation**
- **Admin creates/deactivates agent accounts**
- No public registration
- Admin can also call, WhatsApp, remark and schedule follow-ups
- Call timing/duration is recorded and synced for reporting

# Amaratv Krishi CRM — Phase 2 Roadmap

## Phase 2 Execution Milestones

> **Golden Rule**: Execute step-by-step. After every milestone completion and verification, STOP and ASK the user before proceeding to the next milestone.

| Prompt | Milestone | Main purpose |
|---|---|---|
| **1** | Architecture & Data Model | Design only; no major implementation |
| **2** | Authentication | Login + session |
| **3** | Admin Agent Management | Admin creates/deactivates agents |
| **4** | Roles & Permissions | ADMIN vs AGENT access |
| **5** | Central Data Model | Prepare Supabase sync tables |
| **6** | Offline Sync Engine | Dexie ↔ central DB |
| **7** | Shared Lead Operations | Admin + agents work same leads |
| **8** | Call Tracking | Actual call timing/duration |
| **9** | Real-time Updates | New leads/activity appear across users |
| **10** | Admin CRM Dashboard | Admin operational dashboard |
| **11** | Analytics & Reports | Agent/lead/call performance |
| **12** | Security + Production QA | Full Phase 2 verification |


## Final architecture

```text
                         ONE ANDROID APP
                               │
                         LOGIN SCREEN
                               │
                ┌──────────────┴──────────────┐
                │                             │
              ADMIN                         AGENT
                │                             │
        Full CRM Access              Assigned/allowed work
                │                             │
        ┌───────┴────────┐             ┌──────┴────────┐
        │                │             │               │
     All Leads       All Activity   Leads          Activity
     All Agents      Reports        Calling        Calling
     Assignments     Analytics      WhatsApp       Follow-ups
        │                │             │               │
        └────────────────┴─────────────┴───────────────┘
                               │
                         LOCAL DATABASE
                           Dexie/IndexedDB
                               │
                         SYNC ENGINE
                               │
                         INTERNET ONLY
                               │
                         CENTRAL DATABASE
                         + AUTHENTICATION
```

The **central database is not replacing your local database**.

---

# Phase 2A — Freeze the existing Phase 1

Before adding login/cloud functionality:

### Do not change

- Excel import
- Lead database
- Calling
- WhatsApp
- Generic WhatsApp message
- Catalogue
- Remarks
- Follow-ups
- Notifications
- Dashboard
- Backup/restore

First create a clean baseline.

### Acceptance

```text
npm test
119+ tests passing
npm run build
npx cap sync android
```

Create a Git tag/branch such as:

```text
phase-1-stable
```

This gives you a safe rollback point.

---

# Phase 2B — Multi-user database design

Before login, modify the data model.

## Users

```text
users
├── id
├── name
├── email
├── phone
├── role
├── status
├── createdAt
├── createdBy
├── updatedAt
└── lastLoginAt
```

Roles:

```text
ADMIN
AGENT
```

Statuses:

```text
ACTIVE
INACTIVE
```

### Important

There is **NO public signup**.

The login screen only contains:

```text
Email / Login ID
Password
LOGIN
```

No:

```text
Create Account
Sign Up
Register
```

---

# Phase 2C — Admin-created agent accounts

This is one of your most important requirements.

Admin opens:

```text
ADMIN
 ↓
Team
 ↓
Add Agent
```

Form:

```text
Agent Name
Login ID / Email
Temporary Password
Phone
Status
```

Example:

```text
Name:
Rahul Sharma

Login ID:
rahul@amaratvkrishi.com

Temporary Password:
********

[CREATE AGENT]
```

The agent can then log in.

### Admin can:

- Create agent
- Activate agent
- Deactivate agent
- Reset password
- View last login
- View activity
- Assign leads
- Reassign leads

### Agent cannot:

- Create another agent
- Change own role to admin
- Create admin
- Delete another agent
- Access admin controls

---

# Phase 2D — Role-based application

Same app.

After login:

```text
Login
 ↓
Authenticate
 ↓
Get role
 ↓
┌───────────────┐
│               │
ADMIN          AGENT
│               │
▼               ▼
Admin Home    Sales Home
```

## Admin Home

```text
TOTAL LEADS
NEW LEADS
CALLS TODAY
CALL MINUTES
WHATSAPP
FOLLOW-UPS
INTERESTED
CUSTOMERS
AGENTS
```

## Agent Home

Keep the current sales dashboard, but make the data agent-specific.

---

# Phase 2E — Lead ownership and assignment

Every lead needs:

```text
createdBy
assignedTo
updatedBy
```

Example:

```text
Gold's Gym
Created by: Rahul
Assigned to: Rahul
```

Admin can change:

```text
Assigned to:
[ Amit ▼ ]
```

### Important distinction

**Admin has access to every lead.**

Agent has access to the leads permitted for that agent.

---

# Phase 2F — Admin can operate leads

This is where your requirement differs from a normal reporting dashboard.

Admin must have the same operational controls.

Admin opens:

```text
Leads
 ↓
Gold's Gym
```

and gets:

```text
CALL
WHATSAPP
REMARK
FOLLOW-UP
STATUS
ASSIGN
```

So admin is not merely watching the team.

**Admin can directly work the leads.**

---

# Phase 2G — Central activity/event system

This is extremely important.

Instead of only updating the current lead:

```text
status = CONTACTED
```

we record every action.

For example:

```text
ACTIVITY

AGENT: Rahul
ACTION: CALL
LEAD: Gold's Gym
TIME: 20 Aug 2026 11:32
DURATION: 04:27
OUTCOME: INTERESTED
REMARK: Asked for sample
```

Then:

```text
ADMIN
ACTION: WHATSAPP
TIME: 20 Aug 2026 12:10
TEMPLATE: Sample Offer
```

Then:

```text
AGENT: Amit
ACTION: FOLLOW_UP
TIME: 21 Aug 2026 10:00
```

Nothing should overwrite previous history.

---

# Phase 2H — CALL DURATION TRACKING

This deserves its own milestone because you specifically need **actual call timing and duration**.

## Important limitation of your current architecture

Your current app deliberately uses:

```text
Intent.ACTION_DIAL
```

and does **not** have:

```text
READ_CALL_LOG
CALL_PHONE
```

That was good for the privacy/security design.

But if you want **automatic actual call duration**, we need to change the implementation.

### The correct architecture

When the agent presses:

```text
CALL
```

we create a local pending call:

```text
callAttemptId
leadId
agentId
dialStartedAt
```

Then launch the Android dialler.

When the app returns:

```text
callReturnedAt
```

But **return time alone is not guaranteed to equal actual talk duration**.

Therefore, for true call duration, Phase 2 should investigate/use an Android-supported call-state/call-log mechanism appropriate to your distribution requirements.

The desired record is:

```text
Call
├── id
├── leadId
├── agentId
├── startedAt
├── answeredAt
├── endedAt
├── durationSeconds
├── outcome
├── remark
└── createdAt
```

Example:

```text
Gold's Gym

Agent: Rahul
Call started: 11:32:14
Call ended:   11:36:41
Duration:     04:27
Outcome:      Interested
```

---

# Phase 2I — Agent call analytics

Now the admin can see:

## Today's team activity

```text
AGENT PERFORMANCE

Rahul
Calls: 38
Total call time: 2h 14m
Average call: 3m 32s

Amit
Calls: 31
Total call time: 1h 47m
Average call: 3m 27s

Priya
Calls: 24
Total call time: 1h 21m
Average call: 3m 22s
```

---

# Individual call analytics

Admin opens Rahul:

```text
RAHUL — ACTIVITY

Total Calls             38
Total Call Time         2h 14m
Average Call            3m 32s
Longest Call            11m 42s
Shortest Call           00m 08s
```

Then:

```text
CALL HISTORY

Gold's Gym
20 Aug
11:32 AM
04:27
Interested

Fitness World
20 Aug
12:10 PM
02:51
Follow-up

ABC Wellness
20 Aug
01:22 PM
05:13
Sample Requested
```

---

# Phase 2J — Real-time synchronisation

Now we connect the local databases to the central database.

Example:

```text
Agent phone

CALL
 ↓
Dexie
 ↓
Sync Queue
 ↓
Internet
 ↓
Central DB
```

Admin receives:

```text
NEW ACTIVITY

Rahul called Gold's Gym
Duration: 04:27
Outcome: Interested
```

### If agent is offline

```text
CALL
 ↓
Dexie
 ↓
PENDING SYNC
```

Later:

```text
Internet available
 ↓
SYNC
 ↓
Central DB
 ↓
Admin updated
```

No activity should disappear.

---

# Phase 2K — Conflict handling

This is necessary because both Admin and Agents can modify the same lead.

Example:

```text
Admin:
Status → INTERESTED

Agent:
Status → SAMPLE_REQUESTED
```

We should not blindly overwrite data.

Use:

### Activity = append-only

Every action stays.

### Lead current state = controlled update

For conflicting updates, define deterministic rules.

For example:

```text
updatedAt
updatedBy
version
```

and server-side conflict resolution.

---

# Phase 2L — Admin dashboard

Now build the complete Admin dashboard.

### Top KPIs

```text
Total Leads
New Leads
Calls Today
Total Call Time
WhatsApp Today
Follow-ups
Interested
Samples
Customers
Active Agents
```

### Agent leaderboard

```text
Agent     Calls   Time      Leads   Interested
Rahul      38     2h14m       41       8
Amit       31     1h47m       35       6
Priya      24     1h21m       28       4
```

### Pipeline

```text
NEW
CONTACTED
INTERESTED
SAMPLE REQUESTED
FOLLOW-UP
NEGOTIATION
CUSTOMER
NOT INTERESTED
```

---

# Phase 2M — Lead activity monitoring

Admin can open:

```text
All Leads
```

and see:

| Lead | Assigned | Status | Calls | Call Time | WhatsApp | Follow-up |
|---|---|---|---:|---:|---:|---|
| Gold's Gym | Rahul | Interested | 3 | 12m 31s | 2 | Tomorrow |
| XYZ Fitness | Amit | New | 0 | 0 | 0 | — |
| ABC Wellness | Priya | Sample | 4 | 18m 12s | 3 | Friday |

Then click the lead for the complete timeline.

---

# Phase 2N — Import tracking

This is particularly relevant because your leads originate from Excel.

Every import should record:

```text
Import ID
Uploaded by
Date/time
Filename
Total rows
Imported
Updated
Duplicates
Invalid
```

Admin can see:

```text
IMPORT HISTORY

20 Aug 2026
Uploaded by: Rahul
File: Lucknow-Gyms.xlsx
Total: 141
Imported: 137
Duplicates: 4
```

---

# Phase 2O — Free infrastructure strategy

You specifically want:

> Database only for login and data sync.

So **do not turn this into a cloud-dependent application**.

Use the cloud for:

```text
AUTHENTICATION
       +
CENTRAL CRM DATA
       +
SYNC
       +
REAL-TIME EVENTS
```

Keep local:

```text
Dexie
Call UI
WhatsApp UI
Templates
Follow-ups
Dashboard calculations/cache
Offline operations
Backup
```

The target architecture is:

```text
                    SUPABASE
                ┌──────────────┐
                │ Auth         │
                │ PostgreSQL   │
                │ Realtime     │
                └──────▲───────┘
                       │
                  Sync only
                       │
              ┌────────┴────────┐
              │                 │
          ADMIN DEVICE       AGENT DEVICE
              │                 │
            Dexie             Dexie
              │                 │
              └── Offline ──────┘
```

This minimises bandwidth and keeps the app usable offline.

Free-tier limits can change, so before production deployment we should verify the current provider limits rather than assume they are permanently free.

---

# Phase 2P — Security

Because you have employee accounts and business data:

### No public registration

```text
LOGIN
```

only.

### Admin creates accounts

```text
ADMIN
 ↓
CREATE AGENT
```

### Database security

Use role-based access control / RLS.

Agent:

```text
❌ users
❌ other agents' private data
❌ admin controls
```

Admin:

```text
✅ all agents
✅ all leads
✅ all calls
✅ all WhatsApp
✅ all follow-ups
✅ reports
```

But don't rely on frontend hiding alone.

---

# Phase 2Q — Backup strategy

Your existing local backup should remain.

For central data, add an admin-only export:

```text
ADMIN
 ↓
Backup
 ↓
Export CRM Data
```

Potentially:

```text
Excel
CSV
JSON
```

This gives you two layers of protection:

```text
Device Backup
+
Central Database
+
Admin Export
```

---

# Final Phase 2 roadmap

I would execute it in exactly this order:

```text
PHASE 2A
Freeze + Architecture
       ↓
PHASE 2B
User / Role Data Model
       ↓
PHASE 2C
Authentication
       ↓
PHASE 2D
Admin-created Agent Accounts
       ↓
PHASE 2E
Lead Ownership + Assignment
       ↓
PHASE 2F
Admin Lead Operations
       ↓
PHASE 2G
Central Activity/Event Model
       ↓
PHASE 2H
Actual Call Timing + Duration
       ↓
PHASE 2I
Offline Sync Engine
       ↓
PHASE 2J
Real-time Updates
       ↓
PHASE 2K
Admin Dashboard
       ↓
PHASE 2L
Agent Performance Analytics
       ↓
PHASE 2M
Lead/Activity Reports
       ↓
PHASE 2N
Import Monitoring
       ↓
PHASE 2O
Security + Conflict Testing
       ↓
PHASE 2P
Production QA
```

## The most important rule for your coding agent

Give it this constraint:

> **Do not create a second Android application. Do not create a separate salesperson application. Phase 2 must extend the existing Amaratv Krishi CRM into a single role-aware Android application. ADMIN and AGENT use the same APK and the same central data. ADMIN has global CRM access and can call, WhatsApp, remark, assign and follow up on any lead. AGENT has restricted operational access. There is no public registration; only ADMIN can create, activate, deactivate and manage AGENT accounts. Dexie/IndexedDB remains the local operational database. The central backend is used only for authentication, central synchronisation and real-time data exchange. The application must remain fully functional offline.**

### One additional rule I strongly recommend

For calls, **do not fake duration from the time the app leaves/returns to the dialler**. Phase 2H must explicitly verify how Android provides actual call start/end/duration information under the permissions and distribution model you intend to use. The admin reports should only display **verified call duration**, not an estimate labelled as actual duration.

**Start with Phase 2A only.** Don't let the coding agent simultaneously build login + Supabase + Admin dashboard + sync. That is exactly how a vibe-coded project becomes difficult to maintain.
