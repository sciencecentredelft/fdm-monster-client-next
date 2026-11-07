# Docker deployment of the Science Centre client

The production client runs together with the Science Centre server in **one Docker
image**. The server serves the built client and API on port 4000; there is no Vite
process or separate frontend container. This avoids cross-origin configuration
and ensures both fork revisions are deployed together.

Use the [server Docker setup guide](https://github.com/sciencecentredelft/fdm-monster/blob/main/DOCKER_SETUP.md)
for the full procedure, backups, networking, farm testing and recovery.

## Setup

Install Git, Docker with Linux containers, and Compose 2.17+ with BuildKit.
Docker Desktop works on Windows/macOS; Docker Engine works on Linux.
Clone the forks into sibling folders:

```sh
git clone --branch main https://github.com/sciencecentredelft/fdm-monster.git
git clone --branch main https://github.com/sciencecentredelft/fdm-monster-client-next.git
cd fdm-monster
docker compose -f docker-compose.fork.yml config --quiet
docker compose -f docker-compose.fork.yml build
docker compose -f docker-compose.fork.yml up -d
docker compose -f docker-compose.fork.yml ps
```

Stop if a command fails. The server's dedicated `docker/Dockerfile.fork` receives
this checkout through the `client-source` additional build context. It builds the
client with Node 24 inside Docker and copies the result into the runtime image.
No host npm/Node installation is necessary. The client context ignores `.env`
files, dependencies, Git history and test artifacts; client credentials must
always be configured through the server, never embedded into a frontend build.

Open **http://localhost:4000** and complete first-time setup. For LAN access, follow
the server guide's `FDM_BIND_ADDRESS` and firewall instructions; the default bind
is host-only. The production client uses the server origin automatically. Do not
set `VITE_API_BASE` to a laptop or localhost address for farm browsers.

## Persistence and updates

Database/media are persistent named volumes. The container entrypoint installs the
image's client into the media volume each startup and verifies minimum version
compatibility. Do not use the application's upstream client-update controls:
they download the upstream frontend, not this fork. The server guide documents
the current auto-update flag caveat.

Back up and stop the farm before updates. From the server checkout:

```sh
git status --short
git -C ../fdm-monster-client-next status --short
git pull --ff-only origin main
git -C ../fdm-monster-client-next pull --ff-only origin main
docker compose -f docker-compose.fork.yml build
docker compose -f docker-compose.fork.yml up -d
docker compose -f docker-compose.fork.yml logs --tail=100 fdm-monster
```

Preserve local changes before pulling, stop on failures, and record both commit IDs.
Hard-refresh the browser (`Ctrl+F5`) after recreating the container. Test enabled
QoL settings, file browsing and API assignees on one supervised printer before
batch use. Pulling this repository without rebuilding the image does not update
the running client.

When the advanced file list is enabled, its **Column widths** menu adjusts each
visible column's relative width and saves the proportions in the current browser. Use
**Reset widths** to restore defaults. Narrow filenames are shortened in the middle;
hover to see the full path. Searching, sorting and file actions still use full
names/paths. Columns automatically scale to the panel width; action buttons wrap
when necessary rather than disappearing off the side. The normal file list is
unchanged.

Do not delete farm volumes or use `down -v`. Server migrations mean rollback may
require the pre-update database/media backup as well as the previous image; follow
the full server guide rather than deploying an older client alone.
