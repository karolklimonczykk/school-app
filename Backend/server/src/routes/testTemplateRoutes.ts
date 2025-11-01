// src/routes/testTemplateRoutes.ts
import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

// GET: wszystkie szablony wraz z zadaniami (posortowane)
router.get("/", authenticateJWT, async (req, res) => {
  const templates = await prisma.testTemplate.findMany({
    where: { ownerId: req.userId },
    include: {
      tasks: { orderBy: { order: "asc" } },
    },
    orderBy: { id: "desc" },
  });
  res.json(templates);
});

// POST: nowy szablon
router.post("/", authenticateJWT, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Nazwa jest wymagana" });
    return;
  }
  if (typeof req.userId !== "number") {
    res.status(401).json({ error: "Brak autoryzacji użytkownika" });
    return;
  }
  const template = await prisma.testTemplate.create({
    data: { name, ownerId: req.userId },
  });
  res.status(201).json(template);
});

// PUT: edycja nazwy szablonu
router.put("/:id", authenticateJWT, async (req, res) => {
  const { name } = req.body;
  const id = Number(req.params.id);
  const result = await prisma.testTemplate.updateMany({
    where: { id, ownerId: req.userId },
    data: { name },
  });
  if (!result.count) {
    res.status(404).json({ error: "Nie znaleziono szablonu" });
    return;
  }
  res.json({ message: "Zaktualizowano" });
});

// DELETE: usuń szablon (zadania i wyniki polecą kaskadowo)
router.delete("/:id", authenticateJWT, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.testTemplate.deleteMany({
    where: { id, ownerId: req.userId },
  });
  res.json({ message: "Usunięto" });
});

// POST: dodaj zadanie do szablonu
router.post("/:templateId/tasks", authenticateJWT, async (req, res) => {
  const templateId = Number(req.params.templateId);
  const { description, order, minPoints, maxPoints, allowHalfPoints } =
    req.body;

  if (!description) {
    res.status(400).json({ error: "Brak opisu" });
    return;
  }
  const half = allowHalfPoints !== false;
  const task = await prisma.testTask.create({
    data: {
      description,
      order,
      minPoints,
      maxPoints,
      allowHalfPoints: half,
      templateId,
    },
  });
  res.status(201).json(task);
});

// PUT: edytuj zadanie
router.put("/:templateId/tasks/:taskId", authenticateJWT, async (req, res) => {
  const taskId = Number(req.params.taskId);
  const { description, order, minPoints, maxPoints, allowHalfPoints } = req.body;
   const half = allowHalfPoints !== false;
  const updated = await prisma.testTask.update({
    where: { id: taskId },
    data: { description, order, minPoints, maxPoints, allowHalfPoints },
  });
  res.json(updated);
});

// DELETE: usuń zadanie
router.delete(
  "/:templateId/tasks/:taskId",
  authenticateJWT,
  async (req, res) => {
    const taskId = Number(req.params.taskId);
    await prisma.testTask.delete({
      where: { id: taskId },
    });
    res.json({ message: "Usunięto zadanie" });
  }
);

export default router;
