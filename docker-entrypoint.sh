#!/bin/sh
set -e

# Substitute only ${BACKEND_HOST} — leave nginx's own $variables intact
envsubst '${BACKEND_HOST}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
