# infrastructure

Not yet populated. Planned home for per-service Dockerfiles once `apps/web`/`apps/worker` exist and need container builds.

`docker-compose.yml` intentionally stays at the repo root rather than here: `docker compose` resolves a root-level `.env` automatically by default, and nesting the compose file would require an explicit `--env-file` flag on every invocation. Revisit if/when this grows into multiple compose files.
