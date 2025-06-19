import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

//Pobierz wszystkie klasy
router.get(
  "/classes",
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      // Pobierz klasy z nazwą szkoły (join school)
      const classes = await prisma.class.findMany({
        where: {
          school: { ownerId: req.userId },
        },
        include: {
          school: { select: { id: true, name: true } },
        },
        orderBy: [
          { schoolId: "asc" },
          { order: "asc" }
        ],
      });
      res.json(classes);
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy pobieraniu wszystkich klas." });
    }
  }
);

// Dodawanie klasy do wybranej szkoły
router.post(
  "/schools/:schoolId/classes",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const { name } = req.body;
    const schoolId = parseInt(req.params.schoolId, 10);

    if (!name) {
      res.status(400).json({ error: "Nazwa klasy jest wymagana." });
      return;
    }
    if (!schoolId) {
      res.status(400).json({ error: "Nie podano ID szkoły." });
      return;
    }

    // Sprawdź, czy szkoła należy do zalogowanego użytkownika
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    try {
      // Liczymy ile już jest klas w tej szkole (do sortowania)
      const count = await prisma.class.count({ where: { schoolId } });
      const newClass = await prisma.class.create({
        data: {
          name,
          schoolId,
          order: count + 1,
        },
      });
      res.status(201).json(newClass);
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy dodawaniu klasy." });
    }
  }
);

// Pobierz wszystkie klasy z wybranej szkoły
router.get(
  "/schools/:schoolId/classes",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);

    if (!schoolId) {
      res.status(400).json({ error: "Nie podano ID szkoły." });
      return;
    }

    // Sprawdź, czy szkoła należy do zalogowanego użytkownika
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    try {
      const classes = await prisma.class.findMany({
        where: { schoolId },
        orderBy: { order: "asc" },
      });
      res.json(classes);
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy pobieraniu klas." });
    }
  }
);

// Edycja klasy
router.put(
  "/schools/:schoolId/classes/:classId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);
    const classId = parseInt(req.params.classId, 10);
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Nazwa klasy jest wymagana." });
      return;
    }

    // Sprawdź czy szkoła należy do użytkownika
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    try {
      const updatedClass = await prisma.class.update({
        where: { id: classId },
        data: { name },
      });
      res.json(updatedClass);
    } catch {
      res.status(500).json({ error: "Błąd serwera przy edycji klasy." });
    }
  }
);

// Usuwanie klasy
router.delete(
  "/schools/:schoolId/classes/:classId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const schoolId = parseInt(req.params.schoolId, 10);
    const classId = parseInt(req.params.classId, 10);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do tej szkoły." });
      return;
    }

    try {
      await prisma.class.delete({ where: { id: classId } });
      res.json({ message: "Klasa została usunięta." });
    } catch {
      res.status(500).json({ error: "Błąd serwera przy usuwaniu klasy." });
    }
  }
);

export default router;
