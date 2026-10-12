#!/bin/sh
set -e

case "$1" in
  migrate)
    exec node dist/shared/db/migrate.js
    ;;
  seed)
    exec node dist/scripts/seed.js
    ;;
  start | "")
    # Optional for single-instance hosts; with several replicas run `migrate` as a one-off job instead.
    if [ "$RUN_MIGRATIONS" = "true" ]; then
      node dist/shared/db/migrate.js
    fi
    exec node dist/index.js
    ;;
  *)
    exec "$@"
    ;;
esac
