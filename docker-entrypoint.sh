#!/bin/sh
# Fix /data volume permissions (Railway mounts as root; container runs as node).
if [ -d /data ]; then
  chown -R node:node /data
fi
exec gosu node "$@"
