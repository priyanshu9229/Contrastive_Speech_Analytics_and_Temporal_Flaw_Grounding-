.PHONY: help install data eval test run docker-up docker-down clean

PYTHON ?= python

help:
	@echo "SpeechFlaw Build & Execution System"
	@echo "Commands:"
	@echo "  make install     Install Python dependencies and package in editable mode"
	@echo "  make data        Generate baseline audios and contrastive flawed dataset"
	@echo "  make eval        Run statistical evaluation suite and generate figures"
	@echo "  make test        Execute full pytest unit test suite"
	@echo "  make run         Start FastAPI backend server"
	@echo "  make docker-up   Build and launch containerized stack via Docker Compose"
	@echo "  make docker-down Stop containerized stack"

install:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) -m pip install -e . --no-deps
	cd web && npm install

data:
	$(PYTHON) scripts/build_baselines.py
	$(PYTHON) -m speechflaw.inject

eval:
	$(PYTHON) -m speechflaw.evaluate

test:
	$(PYTHON) -m pytest tests/ -v

run:
	uvicorn api.main:app --reload --host 127.0.0.1 --port 8000

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	rm -rf cache/* __pycache__ src/*/__pycache__ tests/__pycache__
