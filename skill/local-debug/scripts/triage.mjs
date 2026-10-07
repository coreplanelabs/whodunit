#!/usr/bin/env node
import {dispatchCli,readBounded} from './lib/cli-api.js';
process.exitCode=await dispatchCli(process.argv.slice(2),{read:readBounded,out:s=>process.stdout.write(s),error:s=>process.stderr.write(s)});
