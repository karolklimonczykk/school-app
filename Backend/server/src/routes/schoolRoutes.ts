import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

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

export default router;
