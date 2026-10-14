# Reconnection and deferred answer acceptance

- Offline learner events and original pending questions persist encrypted through
  refresh and reopening, with stable event/question/learner/lesson/concept IDs.
- Reconnect or Try school sync submits the durable ledger to the existing service.
- Only a validated server receipt marks submitted events/questions received;
  the checkpoint also survives reopening and does not mark questions answered.
- Failed/invalid/timed-out acknowledgements leave local work pending for retry.
- Retrying and concurrent requests do not duplicate events or overwrite newer work.
- If the school has a longer or different event sequence, the device may recover
  its validated received history automatically, preserving school order and
  appending unchanged local-only event IDs and questions. Changed content under
  an existing ID is a genuine conflict and must be rejected without replacement.
  The merged snapshot must save locally before retrying receipt-backed upload.
- Returned sourced guidance matches the original learner, question and concept;
  it merges into the latest local record without replacing new events or answers.
- The existing simulated prepared answer is labelled; no external AI is implied.
- Verify disconnect, A/B interaction, reopening, failed acknowledgement, reconnect,
  repeated sync, teacher return, answer retrieval in the player, and offline reopen.
