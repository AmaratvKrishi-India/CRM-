---
name: project-memory
description: Recover and update durable CRM project context across Codex sessions using Git-tracked Markdown memory. Use at the start of substantial work and when a technical decision, completed milestone, or pending blocker should survive a session boundary.
---

# Persistent project memory

1. Read `docs/ai-toolkit/MEMORY.md` or run `python3 scripts/ai-toolkit/memory.py show` before substantial work.
2. Search for a topic with `python3 scripts/ai-toolkit/memory.py search "phrase"`.
3. Add only durable technical context, architecture decisions, completed work, and pending work:

   ```bash
   python3 scripts/ai-toolkit/memory.py append --section "Decisions" --text "Short durable decision"
   ```

4. Never store customer names, contact details, CRM records, authentication material, private keys, or secrets. The helper rejects common secret and contact patterns; still review the proposed entry manually.
5. Keep project memory in Git. Do not enable Claude-Mem cloud sync or copy session transcripts into memory.
