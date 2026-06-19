#!/usr/bin/env node
/** @deprecated Используйте scripts/build-chick-portrait.js */
const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "build-chick-portrait.js");
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
