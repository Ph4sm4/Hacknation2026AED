.PHONY: install schema data branding dev api web test screenshots build

install:
	pip install -r backend/requirements.txt
	cd frontend && npm ci

schema:        ## XLSX + Table Schema + JSON Schema + CSV templates
	cd backend && python -m aed.build_schema

data:          ## aggregate sources -> data/out
	cd backend && python -m aed.pipeline

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
