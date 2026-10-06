# Lifecycle command matrix

Core serializes mutations in user → enrollment → attempt order. Every adapter supplies an authenticated actor, validated command and idempotency key. Client IDs identify resources, never confer authority.

| Command                               | Required state                                                                 | Result                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Enroll                                | Published season; unfinished slot free                                         | Retained enrollment; slot reserved before setup                                                       |
| StartAttempt                          | Active enrollment without attempt                                              | Atomic initial revisions, timezone freeze, seed and started attempt                                   |
| CancelEnrollment                      | Active participation                                                           | Retain history; cancel current active attempt; release unfinished slot                                |
| ResumeEnrollment                      | Cancelled participation; unfinished slot available if needed                   | Continue cancelled attempt with unchanged progress                                                    |
| RestartAttempt                        | Current active or completed attempt; explicit actor/version-bound confirmation | Retain old attempt; expire its credits; start submitted setup; completed season becomes progress-only |
| Save/ArchiveGoal                      | Active attempt                                                                 | Append retained revision; seed and prior report facts unchanged                                       |
| Save/ArchiveMilestone                 | Active attempt; target report not accepted                                     | Append revision; lock applicable revision at target reporting index                                   |
| SubmitReport                          | Active attempt; no report on server-local date                                 | Accept one date; synchronous credits/completion; report 101 closes attempt                            |
| EditReport                            | Current local date; active or completed attempt                                | Replace latest text/values; preserve completion and milestone facts                                   |
| CorrectReport                         | Owner and valid resource-bound grant                                           | Overwrite existing report; preserve dates/count/completion; consume single-use grant atomically       |
| Issue/RevokeCorrectionGrant           | Administrator                                                                  | Metadata-only scope; raw token shown only at issuance                                                 |
| Create/Publish/Feature/TemplateSeason | Administrator                                                                  | Draft creation or versioned changes; featuring never controls eligibility                             |

Cancelled/restarted attempts reject ordinary edits. Completed-season progress-only attempts never create another entitlement and do not consume the unfinished-season slot. Goal and milestone edits reject on closed attempts. Historical corrections never insert or delete dates.

Replays compare actor, command, key and canonical payload hash, then reauthorize the result resource. Conflicting payloads reject. Store safe result references rather than private command bodies. Transaction rollback includes idempotency and outbox writes. Grant validity and server time are resolved within the resource transaction.
