.PHONY: install schema data branding dev api web test screenshots build mobile-snapshot geocode demo-alert

install:
	pip install -r backend/requirements.txt
	cd frontend && npm ci

schema:        ## XLSX + Table Schema + JSON Schema + CSV templates
	cd backend && python -m aed.build_schema

data:          ## aggregate sources -> data/out (uses the cached GUGiK geocoding, offline)
	cd backend && python -m aed.pipeline

geocode:       ## refresh the GUGiK reverse-geocoding cache (network; run `make data` afterwards)
	cd backend && python -m aed.geocode

branding:      ## logo SVG/PNG/JPG/PDF + brand book PDF
	python branding/build_logo.py && node branding/render.cjs

api:
	cd backend && uvicorn aed.api.main:app --reload --port 8000

web:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

test:
	cd backend && python -m pytest -q

screenshots:   ## requires running app on :8000
	node scripts/screenshots.cjs

mobile-snapshot: ## offline AED snapshot bundled with the mobile app (after `make data`)
	cd mobile && node scripts/build-aed-snapshot.mjs

# Demo with one phone: turn on "Tryb ratownika" in the app, then send an alert ~300 m from it
# (API must be running on :8000). Optional fixed point: make demo-alert POINT="52.2297 21.0122"
demo-alert:   ## send an "AED needed here" alert near the most recently active responder
	cd backend && python -m aed.api.demo_alert $(POINT)
