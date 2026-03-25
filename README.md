# 🏫 Web System Supporting Teachers in Evaluation and Analysis of School Test Results

This project is a web application designed to support teachers in managing school data and analyzing test results. The system organizes the full workflow (from school and class structure to reporting), replacing manual spreadsheet-based operations.

The application automates statistical calculations and educational measurement indicators, enabling faster and more objective interpretation of outcomes. Thanks to per-user data separation, each teacher works on an isolated set of schools, classes, and results.

## ✨ Main Features

- User registration and login (JWT)
- School, class, and student management (CRUD)
- Test template and task creation
- Test session creation and management
- Student score entry per task
- Data import and export (CSV/XLSX)
- Test and task analysis (tables + charts)
- Statistical and psychometric indicators, including:
  - mean, median, mode,
  - variance and standard deviation,
  - item ease/difficulty index,
  - item discrimination power,
  - test reliability (Cronbach’s alpha),
  - standard error of measurement.

## 🧰 Technologies

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Axios
- PapaParse, XLSX

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT (`jsonwebtoken`), `bcryptjs`

### Database
- PostgreSQL

## 🏗️ System Architecture

The system follows a client–server architecture:
- frontend (SPA) communicates with backend through REST API,
- backend handles business logic, authentication, and validation,
- data is stored in a relational PostgreSQL database,
- data access is restricted to resource owners (`ownerId`).

### Domain Diagram

```mermaid
erDiagram
   User ||--o{ School : owns
   School ||--o{ Class : contains
   Class ||--o{ Student : contains
   User ||--o{ TestTemplate : creates
   TestTemplate ||--o{ TestTask : contains
   User ||--o{ Test : runs
   TestTemplate ||--o{ Test : base_for
   Test ||--o{ TestResult : has
   Student ||--o{ TestResult : receives
   TestTask ||--o{ TestResult : evaluates
```

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

## 🧪 Example Usage

### 1) Register a user
```http
POST /auth/register
Content-Type: application/json

{
   "email": "teacher@example.com",
   "password": "Password123!"
}
```

### 2) Login and get token
```http
POST /auth/login
Content-Type: application/json

{
   "email": "teacher@example.com",
   "password": "Password123!"
}
```

### 3) Add a school
```http
POST /schools
Authorization: Bearer <token>
Content-Type: application/json

{
   "name": "Primary School No. 1"
}
```

### 4) Fetch test result analysis
```http
GET /results/overview?testId=1&schoolId=1&classId=2
Authorization: Bearer <token>
```

## 🔮 Future Improvements

- PDF export and print-ready report templates
- Extended dashboards and additional chart types
- Role-based access control (e.g., teacher, principal, admin)
- Integration with e-journal/LMS platforms
- Multi-school organization configuration in one instance
- Automated testing (unit/integration/e2e) and CI/CD pipeline

## 👤 Author

**Karol Klimończyk**  
Engineering thesis project: *Web System Supporting Teachers in Evaluation and Analysis of School Test Results*
