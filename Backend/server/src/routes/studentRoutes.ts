import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

// Pobierz wszystkich uczniów
router.get(
  "/students",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const students = await prisma.student.findMany({
        where: {
          class: { school: { ownerId: req.userId } },
        },
        include: {
          class: { include: { school: true } },
        },
        orderBy: [{ classId: "asc" }, { order: "asc" }],
      });
      res.json(students);
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy pobieraniu uczniów." });
    }
  }
);

// Dodaj ucznia do klasy
router.post(
  "/schools/:schoolId/classes/:classId/students",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const { firstName, lastName, gender } = req.body;
    const classId = parseInt(req.params.classId, 10);
    const schoolId = parseInt(req.params.schoolId, 10);

    if (!firstName || !lastName || !gender) {
      res.status(400).json({ error: "Imię, nazwisko i płeć są wymagane." });
      return;
    }

    // Sprawdź czy szkoła należy do użytkownika
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    // Opcjonalnie: sprawdź czy klasa należy do szkoły
    const klass = await prisma.class.findUnique({ where: { id: classId } });
    if (!klass || klass.schoolId !== schoolId) {
      res.status(400).json({ error: "Klasa nie należy do tej szkoły." });
      return;
    }

    try {
      const count = await prisma.student.count({ where: { classId } });
      const student = await prisma.student.create({
        data: { firstName, lastName, gender, classId, order: count + 1 },
      });
      res.status(201).json(student);
    } catch {
      res.status(500).json({ error: "Błąd serwera przy dodawaniu ucznia." });
    }
  }
);

// Pobierz uczniów z klasy
router.get(
  "/schools/:schoolId/classes/:classId/students",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);
    const classId = parseInt(req.params.classId, 10);

    // Sprawdź czy szkoła należy do użytkownika
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    // Sprawdź czy klasa należy do szkoły
    const klass = await prisma.class.findUnique({ where: { id: classId } });
    if (!klass || klass.schoolId !== schoolId) {
      res.status(400).json({ error: "Klasa nie należy do tej szkoły." });
      return;
    }

    try {
      const students = await prisma.student.findMany({
        where: { classId },
        orderBy: { order: "asc" },
      });
      res.json(students);
    } catch {
      res.status(500).json({ error: "Błąd serwera przy pobieraniu uczniów." });
    }
  }
);

// Edytuj ucznia
router.put(
  "/schools/:schoolId/classes/:classId/students/:studentId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);
    const classId = parseInt(req.params.classId, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const { firstName, lastName, gender } = req.body;

    // Sprawdź czy szkoła należy do użytkownika
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    // Sprawdź czy klasa należy do szkoły
    const klass = await prisma.class.findUnique({ where: { id: classId } });
    if (!klass || klass.schoolId !== schoolId) {
      res.status(400).json({ error: "Klasa nie należy do tej szkoły." });
      return;
    }

    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: { firstName, lastName, gender },
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Błąd serwera przy edycji ucznia." });
    }
  }
);

// Usuń ucznia
router.delete(
  "/schools/:schoolId/classes/:classId/students/:studentId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);
    const classId = parseInt(req.params.classId, 10);
    const studentId = parseInt(req.params.studentId, 10);

    // Sprawdź czy szkoła należy do użytkownika
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    // Sprawdź czy klasa należy do szkoły
    const klass = await prisma.class.findUnique({ where: { id: classId } });
    if (!klass || klass.schoolId !== schoolId) {
      res.status(400).json({ error: "Klasa nie należy do tej szkoły." });
      return;
    }

    try {
      await prisma.student.delete({ where: { id: studentId } });
      res.json({ message: "Uczeń został usunięty." });
    } catch {
      res.status(500).json({ error: "Błąd serwera przy usuwaniu ucznia." });
    }
  }
);

export default router;
