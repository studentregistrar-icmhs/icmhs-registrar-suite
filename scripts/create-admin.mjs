#!/usr/bin/env node
/**
 * Creates the first admin account for the Registrar Suite's per-user login.
 *
 * Why this exists: the in-app "Manage accounts" page (/admin/users) requires
 * being logged in as an admin — so there's no way to create the very first
 * account through the app itself. Run this once, from a machine with your
 * DATABASE_URL, to get that first account.
 *
 * Usage (interactive):
 *   DATABASE_URL="postgres://..." node scripts/create-admin.mjs
 *
 * Usage (non-interactive, e.g. scripted setup):
 *   DATABASE_URL="postgres://..." \
 *   ADMIN_USERNAME=kkiplangat ADMIN_DISPLAY_NAME="Kennedy Kiplangat" ADMIN_PASSWORD="..." \
 *   node scripts/create-admin.mjs
 *
 * Requires lib/auth/schema.sql to have already been run against this database
 * (creates the registrar_users table) — see AUTH.md.
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) before running this script.");
  process.exit(1);
}
const sql = neon(connectionString);

async function prompt(rl, question, { hidden = false } = {}) {
  if (!hidden) return (await rl.question(question)).trim();
  // Minimal hidden-input password prompt — good enough for a one-time setup
  // script; not trying to be a full TTY password-masking implementation.
  return new Promise((resolve) => {
    const onData = (char) => {
      char = char.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(buf.trim());
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f") {
        buf = buf.slice(0, -1);
      } else {
        buf += char;
      }
    };
    let buf = "";
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  let username = process.env.ADMIN_USERNAME;
  let displayName = process.env.ADMIN_DISPLAY_NAME;
  let password = process.env.ADMIN_PASSWORD;

  if (!username || !displayName || !password) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    console.log("Creating the first admin account for the Registrar Suite.\n");
    username = username || (await prompt(rl, "Username: "));
    displayName = displayName || (await prompt(rl, "Display name: "));
    if (!password) password = await prompt(rl, "Password (min 8 chars): ", { hidden: true });
    rl.close();
  }

  if (!username || !displayName || !password) {
    console.error("Username, display name, and password are all required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await sql`SELECT id FROM registrar_users WHERE lower(username) = lower(${username})`;
  if (existing.length > 0) {
    console.error(`A user named "${username}" already exists.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  // must_reset_password is false here — you typed this password yourself in
  // a trusted context (your own terminal), unlike accounts created through
  // the Manage Accounts page, which get a temp password someone else relays.
  await sql`
    INSERT INTO registrar_users (username, password_hash, display_name, role, campus_scope, must_reset_password)
    VALUES (${username}, ${hash}, ${displayName}, 'admin', 'ALL', false)
  `;

  console.log(`\nAdmin account "${username}" created. You can log in at /login now.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
