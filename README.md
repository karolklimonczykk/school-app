# 🏫 School Test Analysis System

This project is a web application designed to support teachers in managing school data and analyzing test results. The system organizes the full workflow (from school and class structure to reporting), replacing manual spreadsheet-based operations.

The application automates statistical calculations and educational measurement indicators, enabling faster and more objective interpretation of outcomes. Thanks to per-user data separation, each teacher works on an isolated set of schools, classes, and results.

## ✨ Main Features

### Authentication and account
- User registration and login (JWT)
- Protected routes in frontend and backend
- Stateless API authorization via `Authorization: Bearer <token>`

### School structure management
- Full CRUD for schools, classes, and students
- Filtering by school and class

### Test templates and tasks
- Template CRUD with ordered tasks
- Task configuration: name, activity, content, min/max points
- Optional half-point scoring
- Template import/export support (XLSX in UI workflows)

### Test sessions and scoring
- Create/load/rename/delete test sessions
- Enter and edit points per student and per task
- Validation against template scoring rules
- Progress tracking for score completion

### Import/export and interoperability
- CSV/XLSX import wizard with:
   - automatic header detection,
   - manual mapping override,
   - preview before import,
   - support for existing template or new template creation.
- XLSX export of analytical results and summaries

### Analysis and visualization
- Task-level analysis with charts and tables
- Student-level analysis with points/percent views
- Dynamic filtering by school, class, and student
- Statistical and psychometric indicators (see section below)

## 📊 Implemented Statistical & Psychometric Indicators

The system calculates indicators at both test level and item level.

### Test-level
- Mean, median, mode
- Min, max, range
- Variance, standard deviation
- Test easiness index (`pTest`)
- Reliability: Cronbach’s alpha (`alpha`)
- Standard error of measurement (`SEM` / `stdError`)

### Item-level
- Average points per task
- Easiness index (`p`) and difficulty index (`q = 1 - p`)
- Omission fraction (`f`)
- Variance
- Discrimination power (`r`) using Pearson correlation against corrected total score

## 🖥️ Tech Stack

### 🎨 Frontend
- React 19 (Typescript + Vite)
- Tailwind CSS 4
- Axios
- PapaParse, XLSX

### 🔙 Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT (`jsonwebtoken`), `bcryptjs`

### 🗄️ Database
- PostgreSQL
  
### ⚙️ DevOps / Tools / Environments used
- Docker (database)
- Postman (API)
- Visual Studio Code
  
## 🏗️ System Architecture

The system follows a client–server architecture:
- frontend (SPA) communicates with backend through REST API,
- backend handles business logic, authentication, and validation,
- data is stored in a relational PostgreSQL database,
- data access is restricted to resource owners (`ownerId`).

### Database Diagram
<p align="center"><img src="https://i.imgur.com/eOLLHWT.png" alt="diagram-erd" /></p>

## 🔐 Security and Data Isolation

- Each protected request is authenticated with JWT.
- Backend verifies ownership (`ownerId`) for accessed resources.
- Users can only view and modify their own schools, classes, students, templates, tests, and results.
- Data model and API logic enforce tenant separation at query level.

## 🚀 Getting Started (Step by Step)

### 1. Clone the repository
```bash
git clone <repository-url>
cd school-app
```

### 2. Start the database (Docker)
```bash
docker compose up -d
```

### 3. Configure backend
Go to the backend folder and fill in `.env`:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/your_database"
JWT_SECRET="strong_secret_key"
```

### 4. Run backend
```bash
cd Backend/server
npm install
npx prisma migrate dev
npm run dev
```

Backend default URL: `http://localhost:4000`.

### 5. Run frontend
```bash
cd Frontend/client
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`.

## 🧭 Typical User Workflow

1. Register and log in.
2. Create school structure (schools → classes → students).
3. Build a test template with tasks and scoring rules.
4. Create/load a test session.
5. Enter scores manually or import CSV/XLSX.
6. Analyze metrics and export report data to XLSX.

## 📁 Project Structure

```text
school-app/
├─ Backend/
│  └─ server/
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ migrations/
│     └─ src/
│        ├─ controllers/
│        ├─ middlewares/
│        ├─ routes/
│        └─ index.ts
├─ Frontend/
│  └─ client/
│     └─ src/
│        ├─ pages/
│        ├─ components/
│        ├─ context/
│        └─ routes/
└─ docker-compose.yml
```

## 🔌 API (REST)

### Authentication
- `POST /auth/register`
- `POST /auth/login`

### Schools, classes, students
- `GET/POST/PUT/DELETE /schools`
- `GET /classes`
- `GET/POST/PUT/DELETE /schools/:schoolId/classes`
- `GET /students`
- `GET/POST/PUT/DELETE /schools/:schoolId/classes/:classId/students`

### Tests and templates
- `GET/POST/PUT/DELETE /test-templates`
- `POST/PUT/DELETE /test-templates/:templateId/tasks/:taskId`
- `GET/POST/PUT/DELETE /tests`
- `GET/PUT /tests/:testId/students/:studentId/results`
- `GET /tests/:testId/progress`

### Reports and import
- `GET /results/overview`
- `GET /results/points`
- `POST /imports/csv`

> Most endpoints (except register/login) require:  
> `Authorization: Bearer <token>`

## 📝 Practical Notes

- The importer is optimized for real-world spreadsheet variability (different delimiters and column labels).
- During CSV import, the backend prevents accidental structure duplication in selected scenarios.
- Results can be analyzed globally or with narrowed scope (school/class/student) for diagnostic use.

## 📸 Screenshots

<p>Registration</p>
<p align="center"><img src="https://i.imgur.com/44uAWs0.png" /></p>
<p>Login</p>
<p align="center"><img src="https://i.imgur.com/2DnlywL.png" /> </p>
<p>Schools view</p>
<p align="center"><img src="https://i.imgur.com/UsC4qN7.png" /></p>
<p>Classes view</p>
<p align="center"><img src="https://i.imgur.com/xPpX0RF.png" /></p>
<p>Students view</p>
<p align="center"><img src="https://i.imgur.com/SKjTdAV.png" /></p>
<p align="center"><img src="https://i.imgur.com/PrPHWdf.png" /></p>
<p>Test template view</p>
<p align="center"><img src="https://i.imgur.com/xcmZV0L.png" /></p>
<p>Test template view - adding</p>
<p align="center"><img src="https://i.imgur.com/6Kjrqfw.png" /></p>
<p>Test template view - editing</p>
<p><img src="https://i.imgur.com/AWWV4Lg.png"/></p>
<p>Tests view - chosing session</p>
<p align="center"><img src="https://i.imgur.com/wEdtdcY.png" /></p>
<p>Tests view - adding session + example of validation</p>
<p align="center"><img src="https://i.imgur.com/9oK5fge.png" /></p>
<p>Tests view - completing the test</p>
<p align="center"><img src="https://i.imgur.com/j7Kd6CJ.png" /></p>
<p>Results view - tasks</p>
<p align="center"><img src="https://i.imgur.com/33bm67m.png" /></p>
<p align="center"><img src="https://i.imgur.com/EDOyz84.png" /></p>
<p>Results view - students</p>
<p align="center"><img src="https://i.imgur.com/KfPUZkl.png" /></p>
<p align="center"><img src="https://i.imgur.com/U8ELOZY.png" /></p>
<p>Import wizard modal</p>
<p align="center"><img src="https://i.imgur.com/U20J8mm.png" /></p>
<p align="center"><img src="https://i.imgur.com/i3diVfr.png" /></p>
<p align="center"><img src="https://i.imgur.com/I5obrAR.png" /></p>

## 🎬 Application Demo (click to watch)
[![Watch demo](https://i.imgur.com/2DnlywL.png)](https://youtu.be/qXW49vxAL9U)

## 🔮 Future Improvements

- PDF export and print-ready report templates
- Extended dashboards and additional chart types
- Role-based access control (e.g., teacher, principal, admin)
- Integration with e-journal/LMS platforms
- Multi-school organization configuration in one instance
- Automated testing (unit/integration/e2e) and CI/CD pipeline

## 👤 Author

**Karol Klimończyk**  
Engineering thesis project: *A web-based system supporting teachers in evaluating and analyzing school test results*

### Academic Information

- **University:** Cracow University of Technology (Politechnika Krakowska im. T. Kościuszki)
- **Faculty:** Faculty of Mechanical Engineering
- **Department:** Department of Applied Computer Science (Katedra Informatyki Stosowanej)
- **Degree program:** Applied Computer Science (Informatyka Stosowana), full-time engineering studies
- **Supervisor:** dr inż. Paweł Lempa
- **Academic year:** 2025/2026
