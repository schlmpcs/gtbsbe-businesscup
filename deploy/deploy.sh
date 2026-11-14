#!/usr/bin/env bash
# Deploy a committed git ref of LifeGuessr to the team server as a Docker image.
#
#   DEPLOY_HOST=user@host deploy/deploy.sh [ref]   # from your machine, over SSH
#   DEPLOY_HOST=local     deploy/deploy.sh [ref]   # on the server itself (the CI runner does this)
#   DEPLOY_HOST=...       deploy/deploy.sh --rollback   # put the previous image back
#
# ref defaults to HEAD; any branch, tag or commit works. Uncommitted changes are not deployed.
# DEPLOY_HOST has no default on purpose: this repo is public and the server's address is not.
# What happens on the server is in deploy/remote.sh. Setup and rollback notes: deploy/README.md.
set -euo pipefail

HOST=${DEPLOY_HOST:-}
[ -n "$HOST" ] || { echo "deploy: set DEPLOY_HOST (user@host, or 'local' on the server itself)" >&2; exit 1; }

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$(git -C "$HERE" rev-parse --show-toplevel)"

b64() { printf '%s' "$1" | base64 | tr -d '\n'; }
# Run remote.sh on the server. Every argument travels as base64 (remote.sh decodes them), and over
# SSH so does the script text, so the server's login shell has nothing to unquote. Stdin (the
# build context) passes through.
run_remote() {
  local enc=() a
  for a in "$@"; do enc+=("$(b64 "$a")"); done
  if [ "$HOST" = local ]; then
    bash "$HERE/remote.sh" "${enc[@]}"
  else
    local args=''
    for a in "${enc[@]}"; do args="$args '$a'"; done
    ssh -o BatchMode=yes "$HOST" "bash -c \"\$(echo $(base64 < "$HERE/remote.sh" | tr -d '\n') | base64 -d)\" remote $args"
  fi
}

if [ "${1:-}" = --rollback ]; then
  run_remote rollback "$(whoami)" < /dev/null
  exit
fi

REF=${1:-HEAD}
SHA=$(git rev-parse --verify --quiet "${REF}^{commit}") || { echo "deploy: unknown ref '$REF'" >&2; exit 1; }
SUBJECT=$(git log -1 --format=%s "$SHA")
if [ "$REF" = HEAD ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "deploy: note: the working tree has uncommitted changes; only commit ${SHA:0:12} is deployed" >&2
fi
for f in deploy/Dockerfile deploy/compose.yaml package.json pnpm-lock.yaml; do
  git cat-file -e "$SHA:$f" 2>/dev/null || { echo "deploy: $f is missing at ${SHA:0:12}" >&2; exit 1; }
done

COMPOSE=$(git show "$SHA:deploy/compose.yaml")
DEPLOYER=${GITHUB_ACTOR:-$(git config user.name || echo unknown)}

git archive --format=tar "$SHA" | run_remote deploy "$SHA" "$REF" "$SUBJECT" "$DEPLOYER" "$COMPOSE"
