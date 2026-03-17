#!/bin/bash
set -e
npm install
# Feed a newline to answer any drizzle-kit interactive prompts (selects default "No, don't truncate")
# --force skips other confirmations
printf '\n' | npm run db:push -- --force 2>&1 | cat
