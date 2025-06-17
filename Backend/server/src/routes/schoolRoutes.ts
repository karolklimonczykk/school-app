import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

// Dodawanie nowej szkoły
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !req.userId) {
    res.status(400).json({ error: "Brak nazwy szkoły lub zalogowanego użytkownika." });
    return;
  }
  try {
    const school = await prisma.school.create({
      data: {
        name,
        ownerId: req.userId,
      },
    });
    res.status(201).json(school);
  } catch (err) {
    res.status(500).json({ error: "Błąd serwera przy dodawaniu szkoły." });
  }
});

// Pobieranie listy szkół dla zalogowanego użytkownika
router.get("/", authenticateJWT, async (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(400).json({ error: "Brak zalogowanego użytkownika." });
    return;
  }
  try {
    const schools = await prisma.school.findMany({
      where: { ownerId: req.userId },
    });
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: "Błąd serwera przy pobieraniu szkół." });
  }
});


// Edycja szkoły
router.put("/:id", authenticateJWT, async (req: Request, res: Response) => {
  const schoolId = parseInt(req.params.id, 10);
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: "Nazwa szkoły jest wymagana." });
    return;
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || school.ownerId !== req.userId) {
    res.status(403).json({ error: "Brak dostępu do tej szkoły." });
    return;
  }

  try {
    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: { name },
    });
    res.json(updatedSchool);
  } catch {
    res.status(500).json({ error: "Błąd serwera przy edycji szkoły." });
  }
});

// Usuwanie szkoły
router.delete("/:id", authenticateJWT, async (req: Request, res: Response) => {
  const schoolId = parseInt(req.params.id, 10);

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || school.ownerId !== req.userId) {
    res.status(403).json({ error: "Brak dostępu do tej szkoły." });
    return;
  }

  try {
    await prisma.school.delete({ where: { id: schoolId } });
    res.json({ message: "Szkoła została usunięta." });
  } catch {
    res.status(500).json({ error: "Błąd serwera przy usuwaniu szkoły." });
  }
});

export default router;
