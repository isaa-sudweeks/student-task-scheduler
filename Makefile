DEV_COMPOSE=docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: dev
dev:
	$(DEV_COMPOSE) up --watch

