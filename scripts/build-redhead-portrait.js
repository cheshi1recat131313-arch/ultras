#!/usr/bin/env node
/** @deprecated Используйте: python3 scripts/build-redhead-portrait.py */
const { spawnSync } = require("child_process");
const path = require("path");

const py = path.join(__dirname, "build-redhead-portrait.py");
const r = spawnSync("python3", [py, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
