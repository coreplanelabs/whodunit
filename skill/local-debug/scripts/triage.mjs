#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { dispatchCli, readBounded } from "./lib/cli-api.js";

process.exitCode = await dispatchCli(process.argv.slice(2), {
	read: readBounded,
	write: (path, text) => writeFileSync(path, text, { flag: "wx" }),
	out: (s) => process.stdout.write(s),
	error: (s) => process.stderr.write(s),
});
