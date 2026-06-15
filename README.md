# StoreFlow — Retail Operations Platform

## Architecture Overview

StoreFlow is a modular monolith built with **Java 21 / Spring Boot 3.3** (backend) and **React 18 / TypeScript / Vite** (frontend), backed by **PostgreSQL 16** and optional **Redis 7**.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/TS)                    │
│  Login ─ Onboarding Wizard ─ Admin Dashboard ─ Public    │
└─────────────┬───────────────────────────────┬───────────┘
              │ REST/JSON                      │ PDF downloads
┌─────────────┴───────────────────────────────┴───────────┐
│                  Backend (Spring Boot)                    │
│ ┌──────┐ ┌───────┐ ┌─────┐ ┌────┐ ┌──────┐ ┌─────────┐│
│ │ Auth │ │Catalog│ │ CRM │ │ HR │ │ Docs │ │Reporting││
│ └──┬───┘ └──┬────┘ └──┬──┘ └─┬──┘ └──┬───┘ └────┬────┘│
│    │        │         │      │       │           │      │
│ ┌──┴────────┴─────────┴──────┴───────┴───────────┴────┐ │
│ │              Spring Data JPA / Hibernate             │ │
│ └────────────────────────┬────────────────────────────┘ │
│                          │ Flyway                       │
└──────────────────────────┼──────────────────────────────┘
                    ┌──────┴──────┐
                    │ PostgreSQL  │
                    └─────────────┘
```

## Modules

| Module | Description | Key Endpoints |
|--------|-------------|---------------|
| **Auth** | JWT auth, RBAC with permissions | `/api/auth/login`, `/api/auth/refresh`, `/api/admin/users` |
| **Onboarding** | Zero-code first-run setup wizard | `/api/onboarding/status`, `/api/onboarding/initialize` |
| **Catalog** | Products and categories CRUD | `/api/public/products`, `/api/admin/products`, `/api/admin/categories` |
| **CRM** | Client management | `/api/public/clients`, `/api/admin/clients` |
| **HR** | Employees, attendance, schedules | `/api/employee/checkin`, `/api/admin/hr/employees`, `/api/admin/hr/schedules` |
| **Documents** | Warranties, issuance acts, templates, PDF | `/api/admin/warranties`, `/api/admin/issuances`, `/api/admin/templates` |
| **Settings** | Key-value store settings, module toggles | `/api/admin/settings`, `/api/admin/settings/modules` |
| **Reporting** | Dashboard summary stats | `/api/admin/reports/summary` |
| **Audit** | Action audit log | `/api/admin/audit` |

## Tech Stack

- **Backend:** Java 21, Spring Boot 3.3.5, Spring Security, Spring Data JPA
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Database:** PostgreSQL 16 with Flyway migrations
- **Auth:** JWT (access + refresh tokens), BCrypt, RBAC
- **PDF:** OpenHTMLToPDF + Thymeleaf templates
- **Build:** Maven (backend), npm (frontend), Docker Compose
- **CI:** GitHub Actions

## Quick Start

Detailed operational guide for launch, rebuild, shutdown, and reset:

- `RUN_AND_RESET.md`

### Docker Compose (recommended)

```bash
cd "Store Flow"
docker compose up -d
```

Services:
- Frontend: http://localhost
- Backend API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html
- PostgreSQL: localhost:5432

### Local Development

**Backend:**
```bash
cd "Store Flow/backend"
# Requires Java 21 and a running PostgreSQL
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/storeflow
export SPRING_DATASOURCE_USERNAME=storeflow
export SPRING_DATASOURCE_PASSWORD=storeflow
mvn spring-boot:run
```

**Frontend:**
```bash
cd "Store Flow/frontend"
npm install
npm run dev
```
Frontend dev server runs on http://localhost:5173 with API proxy to :8080.

### Legacy Data Migration

To import data from the legacy JSON database:

```bash
cd "Store Flow/backend"
mvn spring-boot:run -Dspring-boot.run.profiles=migrate \
  -Dlegacy.data.path=../../database
```

This imports admins, products, clients, employees, attendance, warranties, issuances, and settings into PostgreSQL.

## Project Structure

```
Store Flow/
├── backend/
│   ├── src/main/java/com/storeflow/
│   │   ├── StoreFlowApplication.java
│   │   ├── config/                  # Security, CORS
│   │   ├── common/                  # DTOs, exceptions, base entity
│   │   ├── store/                   # Store entity & repo
│   │   ├── auth/                    # JWT, users, roles, permissions
│   │   ├── onboarding/              # First-run wizard
│   │   ├── catalog/                 # Products, categories, images
│   │   ├── crm/                     # Clients
│   │   ├── hr/                      # Employees, attendance, schedules
│   │   ├── documents/               # Warranties, acts, templates, PDF
│   │   ├── settings/                # Key-value settings, modules
│   │   ├── reporting/               # Summary stats
│   │   ├── audit/                   # Audit log
│   │   └── migration/               # Legacy JSON importer
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── db/migration/            # Flyway SQL
│   │   └── templates/               # Thymeleaf PDF templates
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/api.ts               # Axios + JWT interceptor
│   │   ├── contexts/AuthContext.tsx
│   │   ├── layouts/DashboardLayout.tsx
│   │   ├── pages/                   # Login, Onboarding, admin pages
│   │   └── types/index.ts
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Configuration

All backend config is in `application.yml`. Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/storeflow` | DB connection |
| `SPRING_DATASOURCE_USERNAME` | `storeflow` | DB user |
| `SPRING_DATASOURCE_PASSWORD` | `storeflow` | DB password |
| `JWT_SECRET` | random | JWT signing key (set in production!) |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis host |

## First-Run Setup

1. Start the application
2. Navigate to http://localhost/onboarding
3. Fill in: store name, admin credentials, module selection
4. System creates store, roles, admin user, and module configs
5. Login with your admin credentials

## API Documentation

Interactive API docs available at `/swagger-ui.html` when the backend is running.

## Security

- Stateless JWT authentication
- BCrypt(10) password hashing
- Role-Based Access Control with fine-grained permissions
- CORS configured per environment
- All admin endpoints require authentication
- `@PreAuthorize` permission checks on every admin endpoint
