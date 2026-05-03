# ShotSpot

[![Node.js CI](https://github.com/pSecurIT/ShotSpot/actions/workflows/node.js.yml/badge.svg)](https://github.com/pSecurIT/ShotSpot/actions/workflows/node.js.yml)
[![Test Coverage](https://github.com/pSecurIT/ShotSpot/actions/workflows/test-coverage.yml/badge.svg)](https://github.com/pSecurIT/ShotSpot/actions/workflows/test-coverage.yml)
[![Docker](https://github.com/pSecurIT/ShotSpot/actions/workflows/docker.yml/badge.svg)](https://github.com/pSecurIT/ShotSpot/actions/workflows/docker.yml)
[![Backend Coverage](https://img.shields.io/codecov/c/github/pSecurIT/ShotSpot/main?flag=backend&label=backend%20coverage)](https://codecov.io/gh/pSecurIT/ShotSpot)
[![Frontend Coverage](https://img.shields.io/codecov/c/github/pSecurIT/ShotSpot/main?flag=frontend&label=frontend%20coverage)](https://codecov.io/gh/pSecurIT/ShotSpot)

ShotSpot is a korfball match intelligence platform for coaches, analysts, and teams that need fast live event capture, dependable sideline workflows, and post-match reporting that is useful immediately.

It combines a React and Capacitor frontend, an Express and PostgreSQL backend, live reporting APIs, export tooling, and mobile packaging so the same product can support match-day tracking, coaching review, and broader club workflows.

<p align="center">
  <img src="frontend/src/img/ShotSpot_logo.png" alt="ShotSpot logo" width="220" />
</p>

## Table of Contents

- [ShotSpot](#shotspot)
  - [Table of Contents](#table-of-contents)
  - [Why ShotSpot](#why-shotspot)
  - [Visuals](#visuals)
    - [Brand mark](#brand-mark)
    - [Court and tracking context](#court-and-tracking-context)
    - [Repository social preview asset](#repository-social-preview-asset)
  - [Core Capabilities](#core-capabilities)
  - [Navigation And Competition Enhancements](#navigation-and-competition-enhancements)
  - [Screenshots And GIFs](#screenshots-and-gifs)
  - [Architecture](#architecture)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Install and run locally](#install-and-run-locally)
    - [Docker path](#docker-path)
  - [Daily Development Commands](#daily-development-commands)
  - [Documentation Map](#documentation-map)
  - [Repository Layout](#repository-layout)
  - [Contributing](#contributing)
  - [Licensing](#licensing)
  - [Contact](#contact)

## Why ShotSpot

ShotSpot is designed for real-world sideline use. The product prioritizes:

- Fast match event capture with minimal input friction
- Offline-first behavior so tracking does not stop when connectivity does
- Live analytics and reporting that coaches can use during play
- Export and review workflows for after-match analysis
- A path to native mobile delivery through Capacitor for Android and iOS

## Visuals

### Brand mark

<p align="center">
  <img src="frontend/src/img/ShotSpot_icon.png" alt="ShotSpot app icon" width="128" />
</p>

### Court and tracking context

<p align="center">
  <img src="frontend/src/img/Korfbalveld-breed.PNG" alt="Korfball court visual used in ShotSpot" width="720" />
</p>

### Repository social preview asset

Use the existing ShotSpot logo and icon assets in `frontend/src/img/` when configuring a GitHub social preview image manually.

## Core Capabilities

- Team, player, lineup, and bench management before a match starts
- Real-time event capture for shots, fouls, substitutions, and other match actions
- Match log editing so operators can correct mistakes without losing context
- Reporting workflows for live dashboards, period views, momentum, player comparisons, and exports
- Offline queueing and sync behavior for unstable network conditions
- Mobile packaging and release workflows for Android and iOS
- Twizzit integration support for federation-connected workflows

## Navigation And Competition Enhancements

- Role-aware navigation grouped into Matches, Analytics, Data, and Settings
- New competition workflows for leagues and tournaments
- Added club and series management pages to support season setup
- Added report templates and scheduled reports in the settings flow
- Added advanced analytics and team analytics entry points in the main navigation

See the implementation guides:

- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [docs/NAVIGATION_GUIDE.md](docs/NAVIGATION_GUIDE.md)
- [docs/COMPETITION_MANAGEMENT.md](docs/COMPETITION_MANAGEMENT.md)

## Screenshots And GIFs

The following assets are included in this repository and referenced by the new guides.

![ShotSpot logo](frontend/src/img/ShotSpot_logo.png)
![ShotSpot icon](frontend/src/img/ShotSpot_icon.png)
![Korfball court context](frontend/src/img/Korfbalveld-breed.PNG)

## Architecture

- Frontend: React 19, TypeScript, Vite, Vitest, Cypress, Capacitor
- Backend: Express 5, PostgreSQL, direct `pg` queries, Jest
- Security: JWT auth, role-based authorization, CSP, rate limiting, security-focused middleware order
- Offline: service worker caching plus IndexedDB queueing and background sync patterns

## Quick Start

### Prerequisites

- Node.js 18+
- npm 10+
- PostgreSQL 14+

### Install and run locally

```bash
git clone https://github.com/pSecurIT/ShotSpot.git
cd ShotSpot
npm run install:all
```

Create your backend environment file:

```bash
cp backend/.env.example backend/.env
```

Set at least these values in `backend/.env`:

- `DB_PASSWORD`
- `JWT_SECRET`
- `TWIZZIT_ENCRYPTION_KEY`

Initialize the database:

```bash
npm run setup-db
```

Start the development servers:

```bash
npm run dev
```

Default local endpoints:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`

### Docker path

If you prefer containers, start with [DOCKER.md](DOCKER.md) and [docker-compose.yml](docker-compose.yml).

## Daily Development Commands

```bash
# Run both apps in development mode
npm run dev

# Set up or reset the database
npm run setup-db

# Lint backend and frontend
npm run lint

# Frontend tests
npm --prefix frontend run test:run

# Backend tests
npm --prefix backend run test

# Frontend production build
npm --prefix frontend run build
```

## Documentation Map

Start here based on what you are trying to do:

- Full index and categorized navigation: [DOCUMENTATION.md](DOCUMENTATION.md)

- Product and setup: [QUICKSTART.md](QUICKSTART.md), [INSTALLATION.md](INSTALLATION.md), [BUILD.md](BUILD.md)
- Deployment and operations: [DEPLOYMENT.md](DEPLOYMENT.md), [DOCKER.md](DOCKER.md), [SECURITY.md](SECURITY.md), [SECRETS.md](SECRETS.md)
- Offline and mobile: [OFFLINE.md](OFFLINE.md), [MOBILE.md](MOBILE.md), [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md), [MOBILE_RELEASE.md](MOBILE_RELEASE.md)
- Reporting and analytics: [REPORTS_API.md](REPORTS_API.md), [VISUALIZATION.md](VISUALIZATION.md)
- Twizzit and domain docs: [docs/README.md](docs/README.md), [docs/TWIZZIT_INTEGRATION.md](docs/TWIZZIT_INTEGRATION.md), [docs/DOMAIN.md](docs/DOMAIN.md), [docs/MIGRATIONS.md](docs/MIGRATIONS.md)
- Navigation and competition docs: [docs/USER_GUIDE.md](docs/USER_GUIDE.md), [docs/NAVIGATION_GUIDE.md](docs/NAVIGATION_GUIDE.md), [docs/ACCESSIBILITY_AUDIT.md](docs/ACCESSIBILITY_AUDIT.md), [docs/COMPETITION_MANAGEMENT.md](docs/COMPETITION_MANAGEMENT.md)

## Repository Layout

```text
.
|- frontend/        React, Vite, Capacitor application
|- backend/         Express API, migrations, scripts, tests
|- docs/            Focused feature and integration documentation
|- scripts/         Release and maintenance helpers
|- release/         Release deployment helpers
|- .github/         Workflows, templates, automation metadata
```

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality checks, migration rules, and pull request expectations.

## Licensing

ShotSpot is distributed under Business Source License 1.1 (BUSL-1.1), not a permissive open-source license. See [LICENSE](LICENSE) for the current terms, commercial-use restrictions, and contribution terms.

## Contact

- Maintainer: [pSecurIT](https://github.com/pSecurIT)
- Issues: https://github.com/pSecurIT/ShotSpot/issues
- Pull requests: https://github.com/pSecurIT/ShotSpot/pulls