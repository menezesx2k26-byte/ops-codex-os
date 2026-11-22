#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Usage: ditto-run https://authorized-public-site.example/" >&2
  exit 64
fi
python3 - "$URL" <<'PY'
import ipaddress, socket, sys, urllib.parse
u = urllib.parse.urlsplit(sys.argv[1])
if u.scheme != "https" or not u.hostname or u.username or u.password or u.port not in (None, 443) or u.query or u.fragment or len(sys.argv[1]) > 4096:
    raise SystemExit("DENIED: require plain public HTTPS URL (no auth, query, or fragment)")
host = u.hostname.lower()
if host in ("localhost", "localhost.localdomain") or host.endswith((".internal", ".local", ".test")):
    raise SystemExit("DENIED: local host")
try:
    ips = {a[4][0] for a in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise SystemExit("DENIED: private/non-global DNS destination")
except OSError:
    raise SystemExit("DENIED: DNS lookup failed")
print("PRECHECK_ALLOWED_HOST=" + host)
PY
available_kib="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
free_kib="$(df -Pk /opt/ditto-vps | awk 'NR==2 {print $4}')"
if (( available_kib < 2000000 || free_kib < 8000000 )); then
  echo "BLOCKED_RESOURCE: MemAvailable=${available_kib}KiB FreeDisk=${free_kib}KiB" >&2
  exit 75
fi
exec 9>/run/lock/ditto-vps.lock
if ! flock -n 9; then echo "BLOCKED_BUSY: another clone is already running" >&2; exit 75; fi
JOB_ID="ditto-$(date -u +%Y%m%dT%H%M%SZ)-$$"
BASE=/opt/ditto-vps
mkdir -p "$BASE/work" "$BASE/logs"
chown 1000:1000 "$BASE/work"
IMAGE="mcr.microsoft.com/playwright@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a"
printf 'JOB_ID=%s\nIMAGE=%s\n' "$JOB_ID" "$IMAGE"
timeout --signal=TERM --kill-after=20s 900s docker run --rm --name "$JOB_ID" \
  --init --cpus=1 --memory=1500m --memory-swap=1500m \
  --pids-limit=192 --shm-size=128m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=128m \
  --user=1000:1000 --network=bridge \
  --mount type=bind,src="$BASE/source",dst=/source,readonly \
  --mount type=bind,src="$BASE/work",dst=/work \
  -e HOME=/work -e npm_config_cache=/work/.npm -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e TARGET_URL="$URL" -e JOB_ID="$JOB_ID" \
  "$IMAGE" /bin/bash -lc '
    set -Eeuo pipefail
    if [[ ! -f /work/repo/node_modules/.package-lock.json ]]; then
      mkdir -p /work/repo
      tar --exclude=.git -C /source -cf - . | tar -C /work/repo -xf -
      cd /work/repo
      npm ci --ignore-scripts --no-audit --no-fund
    fi
    cd /work/repo
    npm run clone -- "$TARGET_URL" --out="/work/jobs/$JOB_ID/output"
  ' 2>&1 | tee "$BASE/logs/$JOB_ID.log"
echo "FINISHED_JOB=$JOB_ID"
find "$BASE/work/jobs/$JOB_ID/output" -type f -name package.json -print | head -8
