#!/usr/bin/env node
import { runCli } from '../src/index.js';

runCli(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
