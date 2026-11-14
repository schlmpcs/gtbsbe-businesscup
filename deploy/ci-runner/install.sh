#!/usr/bin/env bash
# Installs the CI runners on the team server (deploy/README.md, "CI runners"). Run it as the CI user
# (`lgci`), which must not be in the docker group: CI jobs run pull-request code, so they get their
# own rootless Docker and cannot reach the live app's containers.
#
#   REPO_URL=https://github.com/<owner>/<repo> RUNNER_TOKEN=<registration token> \
#     deploy/ci-runner/install.sh [count]
#
# RUNNER_TOKEN is a one-hour repository registration token (Settings, Actions, Runners, "New
# self-hosted runner", or `gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token`).
# It is only needed for runners that are not registered yet and is never written to disk. The script
# is safe to re-run: it keeps what is already installed and registered.
set -euo pipefail

COUNT=${1:-3}
RUNNER_VERSION=2.338.2
RUNNER_SHA256=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40
LABEL=lifeguessr-ci
BASE_PORT=3100 # runner <n> serves its Playwright app on 3100+n (E2E_PORT)
HERE=$(cd "$(dirname "$0")" && pwd)

fail() {
  echo "install.sh: $*" >&2
  exit 1
}

[ "$(id -u)" -ne 0 ] || fail "run this as the CI user, not as root"
if id -nG | tr ' ' '\n' | grep -qx docker; then
  fail "$(id -un) is in the docker group, which can control every container on the server; CI must use rootless Docker only"
fi
case $COUNT in '' | *[!0-9]* | 0) fail "count must be a positive number, got '$COUNT'" ;; esac

export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}
[ -d "$XDG_RUNTIME_DIR" ] || fail "$XDG_RUNTIME_DIR is missing: run 'sudo loginctl enable-linger $(id -un)'"

# 1. Rootless Docker, as the user unit docker.service. Published ports bind to 127.0.0.1 only, so a
#    job's Postgres is never reachable from the network. Ubuntu's docker.io keeps the setup tool and
#    dockerd-rootless.sh in its contrib folder, and the tool expects the docker CLI next to them, so
#    they are linked side by side in one folder first. Needs uidmap, rootlesskit and slirp4netns
#    (deploy/README.md).
contrib=/usr/share/docker.io/contrib
shim=~/.local/lib/docker-rootless
mkdir -p "$shim" ~/.config/docker
ln -sfn "$contrib/dockerd-rootless.sh" "$shim/dockerd-rootless.sh"
ln -sfn "$contrib/dockerd-rootless-setuptool.sh" "$shim/dockerd-rootless-setuptool.sh"
ln -sfn "$(command -v docker)" "$shim/docker"
export PATH=$shim:$PATH
[ -f ~/.config/docker/daemon.json ] || printf '{ "ip": "127.0.0.1" }\n' >~/.config/docker/daemon.json
if [ ! -f ~/.config/systemd/user/docker.service ]; then
  dockerd-rootless-setuptool.sh install
fi
systemctl --user enable --now docker.service
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break || sleep 1; done
docker info --format '{{json .SecurityOptions}}' | grep -q rootless || fail "the Docker daemon at $DOCKER_HOST is not rootless"

# 2. The runner release, checked against its published SHA-256.
mkdir -p ~/ci-runners
tarball=~/ci-runners/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz
if [ ! -f "$tarball" ]; then
  curl -fsSL -o "$tarball.part" \
    "https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz"
  mv "$tarball.part" "$tarball"
fi
echo "$RUNNER_SHA256  $tarball" | sha256sum --check --quiet || fail "checksum mismatch for $tarball"

# 3. The unit template.
mkdir -p ~/.config/systemd/user
install -m 644 "$HERE/lifeguessr-ci@.service" ~/.config/systemd/user/
systemctl --user daemon-reload

# 4. Runners 1..COUNT: register the new ones, give each its Docker socket and its own e2e port, start.
for n in $(seq 1 "$COUNT"); do
  dir=~/ci-runners/$n
  if [ ! -f "$dir/.runner" ]; then
    : "${REPO_URL:?set REPO_URL to register runner $n}" "${RUNNER_TOKEN:?set RUNNER_TOKEN to register runner $n}"
    mkdir -p "$dir"
    tar -xzf "$tarball" -C "$dir"
    (cd "$dir" && ./config.sh --unattended --url "$REPO_URL" --token "$RUNNER_TOKEN" \
      --name "lifeguessr-ci-$n" --labels "$LABEL" --work _work --replace)
  fi
  # The runner exports .env to every job. config.sh writes its own lines there (LANG, ...): keep them.
  touch "$dir/.env"
  grep -vE '^(DOCKER_HOST|E2E_PORT)=' "$dir/.env" >"$dir/.env.new" || true
  printf 'DOCKER_HOST=%s\nE2E_PORT=%s\n' "$DOCKER_HOST" "$((BASE_PORT + n))" >>"$dir/.env.new"
  mv "$dir/.env.new" "$dir/.env"
  # --now starts a stopped runner and leaves a running one (and its job) alone; restart it by hand
  # after changing .env.
  systemctl --user enable --now "lifeguessr-ci@$n.service"
done

systemctl --user --no-pager --lines=0 status docker.service "lifeguessr-ci@*.service" || true
