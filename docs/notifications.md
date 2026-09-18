# Slack Sign-In Notifications

## Pipeline

Scheduled detectors create typed sign-in events. The notifications domain resolves exactly one team leader, renders a channel-neutral message, sends it through the Slack adapter, and writes the delivery outcome to `notification_log`.

`notification_log.channel_target` stores the Slack user ID used at the time of the attempt. This intentionally preserves delivery history if a leader's Slack ID changes later.

The public notification boundary is `backend/src/domains/notifications/index.ts`. To add a notification type, add its event type, template, and emitting detector logic. Do not import Slack code outside `channels/slack-channel.ts`.

## Detection Rules

Both detectors start with active `scholar_shift_assignments`; they never inspect unmatched logs as anomalies. An Entry matches an assignment when it falls within the scheduled time plus the shared 15-minute grace window. Ad hoc sessions outside all assignment windows are ignored.

- `npm --prefix backend run start:signin-detector` checks today's assignments every five minutes in Railway. Once an assignment is 25 minutes past its start without an Entry, it sends a check-in prompt.
- `npm --prefix backend run start:reconciliation-detector` runs daily. It evaluates yesterday and the preceding six calendar days, skips dates before `NOTIFICATIONS_LAUNCH_DATE`, and classifies each assignment as complete, incomplete, or missing.
- Reconciliation does not send an incomplete notification if a missing notification already exists for that occurrence.
- Scholars with zero or multiple team leaders are skipped. Missing Slack IDs are recorded as `skipped_missing_slack_id`; provider failures as `failed`; successful sends as `sent`.

The daily reconciliation provides recovery for a missed fast-detector run. Neither detector changes the read-time compliance behavior in `session-log.service.ts`.

## Railway Setup

Create two Railway Cron Job services from the built backend image. Use the corresponding commands above after running the normal backend build.

- Fast detector schedule: every 5 minutes.
- Reconciliation schedule: daily.

Each service needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_BOT_TOKEN`, and `NOTIFICATIONS_LAUNCH_DATE`. The service-role key is required because cron jobs have no request JWT and `notification_log` is protected by RLS. Do not set this key in browser-facing environments.

Create and install a Slack app in the target workspace with the `chat:write` scope, then populate `profiles.slack_user_id` for each eligible leader. Record the deployed Slack app and workspace names here before enabling either cron service.

Slack rate limits are retried up to three attempts using the provider's `Retry-After` header. The environment variables shown in `backend/.env.example` can override the documented defaults.
