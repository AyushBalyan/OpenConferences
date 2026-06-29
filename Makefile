.PHONY: dev infra-up infra-down db-migrate db-seed test build lint

dev:
	pnpm dev

infra-up:
	docker compose up -d

infra-down:
	docker compose down

db-migrate:
	pnpm db:migrate

db-seed:
	pnpm db:seed

test:
	pnpm test

build:
	pnpm build

lint:
	pnpm lint
