import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../app.js");
const html = read("../index.html");
const css = read("../styles.css");
const config = read("../config.js");
const marketApi = read("../supabase/functions/market-api/index.ts");
const telegramAuth = read("../supabase/functions/telegram-auth/index.ts");

new Function(app);
new Function(config);

const unique = (values) => [...new Set(values)];
const actions = unique([...app.matchAll(/data-action="([a-z0-9-]+)"/g)].map((m) => m[1]));
for (const action of actions) {
  assert.match(app, new RegExp("action\\s*===\\s*[\"']" + action + "[\"']"),
    "Missing click handler for data-action=" + action);
}

const forms = unique([...app.matchAll(/data-form="([a-z0-9-]+)"/g)].map((m) => m[1]));
for (const form of forms) {
  assert.ok(app.includes('formType === "' + form + '"') ||
    app.includes('formType === "' + form + '" ||'),
    "Missing submit handler for data-form=" + form);
}

const apiActions = unique([...app.matchAll(/api\("([a-z0-9_]+)"/g)].map((m) => m[1]));
for (const action of apiActions) {
  assert.ok(marketApi.includes('action === "' + action + '"'),
    "Frontend calls API action with no server handler: " + action);
}

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const generatedIds = new Set(["price-chart", "admin-user-results"]);
for (const id of unique([...app.matchAll(/getElementById\("([^"]+)"/g)].map((m) => m[1]))) {
  assert.ok(htmlIds.has(id) || generatedIds.has(id),
    "Frontend references missing DOM id: " + id);
}

const tabs = unique([...html.matchAll(/data-tab="([a-z_]+)"/g)].map((m) => m[1]));
for (const tab of tabs) {
  assert.ok(app.includes('tab === "' + tab + '"'),
    "Navigation tab has no renderer: " + tab);
}

assert.ok(app.includes("HapticFeedback"), "Telegram haptic API not referenced");
assert.ok(app.includes("impactOccurred"), "Button impact feedback is missing");
assert.ok(app.includes("selectionChanged"), "Selection feedback is missing");
assert.ok(app.includes("notificationOccurred"), "Success/error feedback is missing");
assert.ok(app.includes('document.addEventListener("click"'), "Delegated button feedback missing");
assert.ok(telegramAuth.includes('Deno.env.get("TELEGRAM_BOT_TOKEN")'),
  "Telegram bot token is not read from server secrets");
assert.ok(telegramAuth.includes("verifyInitData"), "Telegram initData signature check missing");
assert.ok(telegramAuth.includes("market_resolve_admin_telegram"),
  "Owner Telegram account mapping missing");
assert.ok(marketApi.includes('withSupabase({ auth: "user" }'),
  "Market API must require an authenticated user");

assert.ok(config.includes("SUPABASE_URL"));
assert.ok(config.includes("SUPABASE_PUBLISHABLE_KEY"));
assert.ok(!/service_role|secret[_-]?key|TELEGRAM_BOT_TOKEN/i.test(config),
  "A server secret appears in frontend config");

for (const path of [
  "../index.html", "../app.js", "../styles.css", "../config.js",
  "../supabase/functions/telegram-auth/index.ts",
  "../supabase/functions/market-api/index.ts"
]) {
  assert.ok(existsSync(new URL(path, import.meta.url)), "Missing project file: " + path);
}

assert.ok(css.includes(":active"), "Missing button pressed state");

console.log("Smoke checks passed");
console.log("Buttons:", actions.length, "| Forms:", forms.length, "| API actions:", apiActions.length, "| Tabs:", tabs.length);
