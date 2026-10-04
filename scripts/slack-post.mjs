#!/usr/bin/env node
// Posts SLACK_TEXT to the ops channel: the same call, the same secrets and
// the same rule as dd-repo-registry's estate sweep (bin/sweep.mjs, slack()).
// A message that could not be sent exits 1, so the run is red where someone
// can see it: an alert that fails quietly is no alert.
//
// Secrets (repo settings, Actions): SLACK_BOT_TOKEN and SLACK_OPS_CHANNEL,
// from Doppler dd-workers/prd, as on dd-repo-registry.

const { SLACK_BOT_TOKEN, SLACK_OPS_CHANNEL, SLACK_TEXT } = process.env;

if (!SLACK_TEXT) {
  console.error("slack-post: SLACK_TEXT is empty; nothing to send.");
  process.exit(2);
}
if (!SLACK_BOT_TOKEN || !SLACK_OPS_CHANNEL) {
  console.error(`slack-post: SLACK_BOT_TOKEN or SLACK_OPS_CHANNEL missing, so this was not sent:\n${SLACK_TEXT}`);
  process.exit(1);
}

const res = await fetch("https://slack.com/api/chat.postMessage", {
  method: "POST",
  headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ channel: SLACK_OPS_CHANNEL, text: SLACK_TEXT, unfurl_links: false }),
});
const body = await res.json();
if (!body.ok) {
  console.error(`slack-post: Slack said ${body.error}; the message was not sent:\n${SLACK_TEXT}`);
  process.exit(1);
}
console.log("slack-post: sent.");
