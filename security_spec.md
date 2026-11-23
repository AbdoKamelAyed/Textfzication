# TEXTPRINT Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Isolation**: A user can only read, create, update, or delete documents under `/users/{userId}` when `request.auth.uid == userId` and `request.auth.token.email_verified == true` (unless admin).
2. **PII Protection**: Email addresses inside `/users/{userId}` are never readable via blanket `isSignedIn()` rules; strictly restricted to `isOwner(userId)` or `isAdmin()`.
3. **Immutable Ownership & Timestamps**: `uid` / `ownerUid` and `createdAt` are strictly immutable after creation, and `createdAt` / `updatedAt` must equal `request.time`.
4. **No Self-Assigned Privileges**: Users cannot write to `/admins/{adminId}` or inject `role`/`isAdmin` shadow fields into `/users/{userId}`.
5. **Relational Integrity**: Samples under `/users/{userId}/samples/{sampleId}` require the parent user profile or matching `ownerUid == userId`, bounded string sizes, and valid enum values.
6. **Terminal State Locking**: Once a sample's `validationStatus` reaches `'rejected'` or `'verified'` by non-admin, updates cannot silently flip `isSyntheticDemo` or `ownerUid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read of `/users/u1` -> `PERMISSION_DENIED`
2. Unverified email (`email_verified: false`) attempting create on `/users/u1` -> `PERMISSION_DENIED`
3. User `u2` attempting read of `/users/u1` (PII leak) -> `PERMISSION_DENIED`
4. User `u1` attempting to inject shadow field `isAdmin: true` in `/users/u1` -> `PERMISSION_DENIED`
5. User `u1` attempting to spoof `ownerUid: "u2"` in `/users/u1/notes/n1` -> `PERMISSION_DENIED`
6. User `u1` attempting to spoof past `createdAt` timestamp instead of `request.time` -> `PERMISSION_DENIED`
7. Oversized ID (`> 128` chars or invalid chars `../hack`) on `/users/u1/notes/{id}` -> `PERMISSION_DENIED`
8. Unbounded array (`tags` with 25 items > max 10, or non-string element) on `ResearchNote` -> `PERMISSION_DENIED`
9. Missing required fields (`license`, `version`) on `ResearchDataset` create -> `PERMISSION_DENIED`
10. Value poisoning: updating `WritingSample.text` with a 25,000-char payload (`> 20000`) -> `PERMISSION_DENIED`
11. Mutating immutable `createdAt` or `ownerUid` during update -> `PERMISSION_DENIED`
12. User `u1` attempting to write to `/admins/u1` to escalate privileges -> `PERMISSION_DENIED`
