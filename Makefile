DEV_FILES=-f docker-compose.yml -f docker-compose.dev.yml $(if $(USE_BIND),-f docker-compose.bind.yml,)
DEV_COMPOSE=docker compose $(DEV_FILES)

.PHONY: dev
dev:
	@# Use compose --watch if available; otherwise fall back to bind mounts
	@if docker compose up --help 2>/dev/null | grep -q -- '--watch'; then \
		echo "Using compose --watch with file sync"; \
		docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch --build; \
	else \
		echo "compose --watch not supported; falling back to bind mounts"; \
		docker compose -f docker-compose.yml -f docker-compose.bind.yml up --build; \
	fi

.PHONY: dev-clean
dev-clean:
	@if docker compose up --help 2>/dev/null | grep -q -- '--watch'; then \
		docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v; \
		docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache; \
		docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch; \
	else \
		docker compose -f docker-compose.yml -f docker-compose.bind.yml down -v; \
		docker compose -f docker-compose.yml -f docker-compose.bind.yml build --no-cache; \
		docker compose -f docker-compose.yml -f docker-compose.bind.yml up; \
	fi

.PHONY: dev-bind
dev-bind:
	docker compose -f docker-compose.yml -f docker-compose.bind.yml up --build
