# 🏫 School App – Full Stack Test Management Platform

A full-stack application for managing schools, classes, students, test templates, test sessions, and result analytics.

## 🚀 Overview

This project is a monorepo with two main parts:
- `Backend/server` — REST API (Express + TypeScript + Prisma + PostgreSQL)
- `Frontend/client` — web UI (React + Vite + TypeScript + Tailwind)

The app allows users to:
- manage the school structure (school → class → student),
- create test templates with task-level scoring rules,
- run test sessions and enter student scores,
- analyze outcomes with psychometric-style statistics,
- import CSV/XLSX data and export XLSX reports.

## 🧠 Features

### 🔐 Authentication
- User registration and login with JWT.
- Protected API routes via auth middleware.

### 🏫 School Structure
- Full CRUD for schools, classes, and students.
- Filtering by school/class.
- Optional student code number (`codeNumber`).

### 📝 Tests and Templates
- Test templates with tasks (`minPoints`, `maxPoints`, `allowHalfPoints`).
- Test session management (create, load, rename, delete).
- Per-student, per-task score entry with range validation.

### 📊 Result Analytics
- Student and item summaries.
- Item metrics: `p`, `q`, `f`, variance, discrimination power.
- Test metrics: mean, median, mode, min/max, range, variance, standard deviation, Cronbach's alpha, standard error.
- XLSX export for reports.

### 📥 Data Import
- CSV/XLSX import workflow from the frontend wizard.
- Option to use an existing template or create a new one during import.
- Import results into a newly created test session.

## 🖥️ Tech Stack

### Backend
- TypeScript
- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT (`jsonwebtoken`) and password hashing (`bcryptjs`)

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS 4
- Axios
- PapaParse + XLSX

### Dev Tools
- Docker Compose (PostgreSQL)
- Prisma Migrate

## ▶️ Getting Started

### 1) Clone the repository
```bash
git clone <repository-url>
cd school-app
```

### 2) Start the database (Docker)
```bash
docker compose up -d
```

### 3) Run backend
```bash
cd Backend/server
npm install
npx prisma migrate dev
npm run dev
```

Backend default URL: `http://localhost:4000`.

### 4) Run frontend
```bash
cd Frontend/client
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`.

## ⚙️ Configuration

Create/update `Backend/server/.env`:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/your_database"
JWT_SECRET="replace_with_a_strong_secret"
```

## 🔌 API (REST) – Main Route Groups

- `POST /auth/register`, `POST /auth/login`
- `GET/POST/PUT/DELETE /schools`
- `GET /classes`, `GET/POST/PUT/DELETE /schools/:schoolId/classes`
- `GET /students`, `GET/POST/PUT/DELETE /schools/:schoolId/classes/:classId/students`
- `GET/POST/PUT/DELETE /test-templates`
- `POST/PUT/DELETE /test-templates/:templateId/tasks/:taskId`
- `GET/POST/PUT/DELETE /tests`
- `GET/PUT /tests/:testId/students/:studentId/results`
- `GET /tests/:testId/progress`
- `GET /results/overview`, `GET /results/points`
- `POST /imports/csv`

## 📂 Project Structure

```text
school-app/
├─ Backend/
│  └─ server/
│     ├─ prisma/
│     └─ src/
└─ Frontend/
   └─ client/
      └─ src/
```
