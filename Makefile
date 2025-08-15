DEV_FILES=-f docker-compose.yml -f docker-compose.dev.yml $(if $(USE_BIND),-f docker-compose.bind.yml,)
DEV_COMPOSE=docker compose $(DEV_FILES)

.PHONY: dev
dev:
	$(DEV_COMPOSE) up --watch --build

.PHONY: dev-clean
dev-clean:
	$(DEV_COMPOSE) down -v
	$(DEV_COMPOSE) build --no-cache
	$(DEV_COMPOSE) up --watch
