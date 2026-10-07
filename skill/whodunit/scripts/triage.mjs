#!/usr/bin/env node
import { dispatchCli, nativeCliIo } from "./lib/cli-api.js";

process.exitCode = await dispatchCli(process.argv.slice(2), nativeCliIo());
