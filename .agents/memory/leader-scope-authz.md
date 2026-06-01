---
name: Leader SPU-scope authorization
description: How to correctly scope "leader can edit X across their SPUs" endpoints without privilege escalation
---

# Leader SPU-scoped edit endpoints

When granting an SPU **leader** edit rights over records (OKRs, scores) across
all SPUs they manage, the managed set is: `primary spuId` + every `spuId` from
`storage.getStaffSpuAssignments(sessionStaffId)`. Super_admins get
`req.session.isAdmin = true` on profile selection (so they pass admin gates);
leaders get `isAdmin = false` with `selectedStaffId` set.

**Rule: validate BOTH source and destination scope on any mutable record.**
- **Why:** an update payload can change `spuId`/`subUnitId`. Checking only the
  *existing* record's SPU lets a leader pivot an in-scope record INTO an
  unmanaged SPU in a single PUT (real escalation found in review). Always also
  check the *destination* `spuId` (`parsed.data.spuId ?? existing.spuId`) is in
  the managed set, and that any destination `subUnitId` belongs to that SPU.
- **How to apply:** for leader-edit PUT routes, after schema parse, recompute
  managedSpuIds and reject if destination SPU not managed / sub-unit mismatch.

**Audit integrity for leader edits:** require a non-empty `reason`, and derive
`editedBy`/`editedByName` from the session staff — never trust client-supplied
actor fields for the leader path.
