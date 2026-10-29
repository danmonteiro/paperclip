# Native session cleanup quarantine recovery

`native_session_cleanup_quarantined` means Paperclip did not accept the prior provider close as settled. It does not mean the old turn is safe to replay.

## Retry cleanup for one failed run

An authorized board operator with `runtime:manage` may request one close retry for the exact terminal run:

```http
POST /api/issues/{issueId}/recovery-actions/retry-native-session-cleanup
Content-Type: application/json

{"runId":"<exact failed run id>"}
```

The server verifies that the run belongs to this Issue and company, is a terminal native run, and still has the exact retained session and runner instance in this server process. It calls `close()` on that session once. It never opens a provider, retries the task turn, clears a checkpoint, or infers the outcome of a tool call.

`200` with `status: "settled"` means only that this exact session close returned successfully and its in-memory cleanup hold was retired. It does not dispatch or retry the Issue. Review the saved run and reconcile pending or unknown external effects through their existing recovery paths before using the ordinary Issue Retry action.

`409` means the exact close was not proven. The response gives a bounded status (`not_found`, `not_operator_required`, `busy`, `still_incomplete`, or `not_eligible`). Keep the task held. For `not_found`, this process has no retained session object to close; use the existing host/process and retained-checkpoint recovery procedure. Never clear session or checkpoint data to make the gate pass.

## Isolation and automation

Native cleanup admission is scoped to the owning Issue, backend, and any exact remote cleanup resource. A failed close on one Issue must not prevent unrelated Issues from using the same backend. The failed Issue remains gated until its own cleanup and execution reconciliation pass.

The retained native-session cleanup worker is a separate, evidence-gated path. It only acts on eligible committed runs and verifies the exact local process, provider state, retained files, and leases. Do not broaden its candidate query to sessions without those proofs. Keep recurring recovery monitors in verify-first mode until both cross-Issue isolation and same-Issue recovery have been demonstrated on the deployed runtime.
