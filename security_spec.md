# Security Specification & Threat Model

## 1. Data Invariants
1. **User Identity Boundary**: Every document in `repositories`, `pull_requests`, `issues`, `pseudo_builds`, `chat_messages`, and `settings` must belong to the authenticated user (`userId == request.auth.uid`). No user can read, list, write, modify, or delete another user's records.
2. **Strict Field Whitelist**: On creation and modification, only declared fields are allowed (`hasOnly`). Shadow injection of administrative or privilege escalation keys is strictly forbidden.
3. **Immutability of Key Identity Anchors**: In all updates, `userId` and parent resource identifiers (`repoId` where applicable) cannot be modified (`incoming().userId == existing().userId`).
4. **Path Sanitization**: All path variables must pass `isValidId()` ensuring max 128 characters and alphanumeric characters (`^[a-zA-Z0-9_\-]+$`).
5. **Length and Type Boundaries**: All string fields are guarded with explicit `.size()` limits.

## 2. The "Dirty Dozen" Malicious Payloads

1. **Payload 1 (Ghost Field Injection)**:
```json
{
  "id": "repo-1",
  "userId": "attacker-uid",
  "owner": "facebook",
  "repo": "react",
  "defaultBranch": "main",
  "createdAt": "2026-10-08T00:00:00Z",
  "updatedAt": "2026-10-08T00:00:00Z",
  "isAdmin": true
}
```
*Expected: PERMISSION_DENIED (unknown property `isAdmin`).*

2. **Payload 2 (User ID Impersonation)**:
```json
{
  "id": "repo-2",
  "userId": "victim-uid-123",
  "owner": "vercel",
  "repo": "next.js",
  "defaultBranch": "canary",
  "createdAt": "2026-10-08T00:00:00Z",
  "updatedAt": "2026-10-08T00:00:00Z"
}
```
*Expected: PERMISSION_DENIED (incoming userId does not match request.auth.uid).*

3. **Payload 3 (Oversized ID Denial-of-Wallet)**:
Target path: `/repositories/` + `'a'.repeat(250)`
*Expected: PERMISSION_DENIED (`isValidId` fails size <= 128).*

4. **Payload 4 (Regex Poisoning in Path ID)**:
Target path: `/repositories/repo$bad%path!`
*Expected: PERMISSION_DENIED (`isValidId` fails regex guard).*

5. **Payload 5 (Unauthenticated Cross-Read)**:
Unauthenticated user attempts `get(/repositories/repo-1)`.
*Expected: PERMISSION_DENIED (`request.auth == null`).*

6. **Payload 6 (Cross-Tenant List Operation)**:
User `attacker-uid` attempts `collection('repositories')` query without filtering `where('userId', '==', 'attacker-uid')`.
*Expected: PERMISSION_DENIED (`resource.data.userId == request.auth.uid` validation triggers).*

7. **Payload 7 (Oversized String Buffer Exhaustion)**:
```json
{
  "id": "pr-1",
  "userId": "test-uid",
  "repoId": "repo-1",
  "number": 101,
  "title": "A".repeat(2000),
  "ciStatus": "passing",
  "staticAnalysisStatus": "clean",
  "hasConflicts": false,
  "safeToMerge": true,
  "createdAt": "2026-10-08T00:00:00Z",
  "updatedAt": "2026-10-08T00:00:00Z"
}
```
*Expected: PERMISSION_DENIED (`title.size() <= 512` boundary violation).*

8. **Payload 8 (Type Spoofing on Boolean Flag)**:
```json
{
  "id": "pr-2",
  "userId": "test-uid",
  "repoId": "repo-1",
  "number": 102,
  "title": "Fix bug",
  "ciStatus": "passing",
  "staticAnalysisStatus": "clean",
  "hasConflicts": "no_conflicts_string",
  "safeToMerge": true,
  "createdAt": "2026-10-08T00:00:00Z",
  "updatedAt": "2026-10-08T00:00:00Z"
}
```
*Expected: PERMISSION_DENIED (`hasConflicts` is not boolean).*

9. **Payload 9 (Target Repository Hijacking in PR Update)**:
Updating existing PR to change `repoId` or `userId`:
```json
{
  "repoId": "different-target-repo"
}
```
*Expected: PERMISSION_DENIED (affectedKeys() allows only valid PR modification keys and immutability check).*

10. **Payload 10 (Settings Tampering for Foreign User)**:
Writing to `/settings/victim-uid-456` with `auth.uid = attacker-uid`.
*Expected: PERMISSION_DENIED (`request.auth.uid == userId` mismatch).*

11. **Payload 11 (Oversized PseudoBuild Summary Overflow)**:
```json
{
  "id": "pb-1",
  "userId": "test-uid",
  "repoId": "repo-1",
  "title": "Batch Merge",
  "selectedPrNumbers": "1,2,3",
  "canMergeAll": true,
  "riskLevel": "low",
  "summary": "S".repeat(5000),
  "createdAt": "2026-10-08T00:00:00Z"
}
```
*Expected: PERMISSION_DENIED (`summary.size() <= 2048`).*

12. **Payload 12 (Direct Document Deletion of Another User's PR)**:
User `attacker-uid` attempts `deleteDoc(doc(db, 'pull_requests', 'pr-victim'))`.
*Expected: PERMISSION_DENIED (`resource.data.userId == request.auth.uid`).*

## 3. Test Runner
Defined in `firestore.rules.test.ts`.
