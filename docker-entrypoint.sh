#!/bin/sh
set -eu

node /app/server/index.js &
exec nginx -g 'daemon off;'
