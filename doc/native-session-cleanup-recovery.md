# Native session cleanup quarantine recovery

`native_session_cleanup_quarantined` means Paperclip could not prove that the
prior native session cleanup finished safely. It is not permission to replay
the task turn: a provider tool call may already have produced an external side
effect.

## Recover one exact failed run

Use the board action only after identifying the exact failed run ID recorded
for the affected Issue. An authorized board operator with `runtime:manage` may
request cleanup-only reconciliation:

```http
POST /api/issues/{issueId}/recovery-actions/retry-native-session-cleanup
Content-Type: application/json

{"runId":"<exact failed run id>"}
```

This action does not retry the task turn, open or resume a provider, clear a
checkpoint, or infer the result of a provider tool call. It is deliberately
narrow: it accepts only an exact terminal native run with retained run/session
identity, a committed finalization and accepted result, and the supported local
Codex runner state. It requires proof that the original process is gone and
that no active session, environment lease, or maintenance owner still controls
the state. The current retained-state reconciler rejects Windows and requires
the exact supported POSIX Codex runner state. Missing,
ambiguous, changed, unsupported, or contradictory evidence fails closed.

When eligible, Paperclip inspects and reconciles the retained state through an
isolated maintenance copy while preserving the original quarantine and saved
run result. Only after verifying the reconciled state does it retire the exact
cleanup hold.

### Interpret the response

- `200` with `status: "settled"` means the exact cleanup reconciliation passed
  its evidence checks and the cleanup hold was retired. It does not mean the
  Issue was retried or that external effects from the failed run were undone.
  Review the saved run and reconcile any pending or uncertain external effects
  through their own recovery procedures. Use the ordinary Issue Retry action
  only after those effects are understood.
- Every `409` includes `details.runId`, `details.status`,
  `details.taskTurnReplayed: false`, and `details.taskRetried: false`.
- For `details.status: "deferred"`, wait for the reported `details.waitFor`
  condition (`process_exit`, `session_release`, `environment_release`,
  `maintenance_settlement`, or `lease_expiry`). A `lease_expiry` response also
  includes its ISO timestamp as `details.retryAt` and in the error message.
  Do not clear the lease, process record, session, checkpoint, or quarantine to
  force eligibility. Retry this exact cleanup action only after the named
  condition has resolved.
- `details.status: "not_eligible"` means this run does not satisfy the
  supported identity/state contract. `details.status: "operator_required"`
  means a maintenance attempt could not prove a safe settlement. Preserve all
  evidence and escalate for investigation; do not use a generic restart,
  delete retained state, or replay the task turn.

Every attempt is activity-logged against the Issue and exact run, including its
outcome and the invariant that the task turn was not replayed.

## Isolation and automation

Cleanup admission is scoped to the owning Issue, backend, and exact remote
cleanup resource. A failed cleanup for one Issue must not block unrelated
Issues using the same backend. The affected Issue remains gated until its own
cleanup and execution reconciliation pass.

The retained cleanup worker and this operator action use the same narrow,
evidence-gated reconciler. Do not broaden its candidate query or supported
runtime/state contract without equivalent proof. Keep recurring recovery
monitors paused and their triggers disabled until deployed-runtime checks prove
both cross-Issue isolation and exact-run recovery. The monitor must inspect
first and act only when the same evidence gate passes; it must never retry task
turns or clear uncertain state.
