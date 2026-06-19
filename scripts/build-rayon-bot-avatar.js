#!/usr/bin/env node
/** Портрет «Районного» — python3 scripts/build-rayon-bot-avatar.py */
const { spawnSync } = require("child_process");
const path = require("path");

const py = path.join(__dirname, "build-rayon-bot-avatar.py");
const args = process.argv.slice(2);
const r = spawnSync("python3", [py, ...args], { stdio: "inherit" });
process.exit(r.status ?? 1);
