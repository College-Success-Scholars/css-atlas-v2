// backend/src/domains/notifications/__manual_test__/send-test-dm.ts
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { SlackChannel } from "../channels/slack-channel.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

// Requires the SLACK_BOT_TOKEN to be set in backend/.env
// Run a manual test with the following command
// npm --prefix backend exec -- tsx backend/src/domains/notifications/__manual_test__/send-test-dm.ts

const result = await new SlackChannel().send("MEMBER_ID", {
    text: "TEST MESSAGE HERE",
});

if (!result.ok) {
  console.error(`Slack delivery failed after ${result.attempts} attempt(s): ${result.error}`);
  process.exitCode = 1;
} else {
  console.log(`Slack delivery accepted after ${result.attempts} attempt(s).`);
}
