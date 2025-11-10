// routes/testsRoutes.ts
import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

/**
 * GET /tests
 * Zwraca wszystkie sesje użytkownika (z nazwą szablonu), posortowane malejąco po dacie.
 */
router.get("/", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const tests = await prisma.test.findMany({
      where: { ownerId: req.userId! },
      orderBy: { date: "desc" },
      select: {
        id: true,
        name: true,
        date: true,
        templateId: true,
        template: { select: { id: true, name: true } },
      },
    });
    res.json(tests);
  } catch {
    res.status(500).json({ error: "Błąd pobierania sesji testów." });
  }
});

/**
 * POST /tests
 * Tworzy nową sesję testu (twardy unikat: ownerId + templateId + name).
 * Body: { templateId: number, name: string, date?: string }
 */
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
  const { templateId, name, date } = req.body as {
    templateId: number;
    name?: string;
    date?: string;
  };
  if (!templateId || !req.userId) {
    res.status(400).json({ error: "Brak templateId lub użytkownika." });
    return;
  }
  const label = (name ?? "").trim();
  if (!label) {
    res.status(400).json({ error: "Podaj nazwę sesji." });
    return;
  }

  try {
    const exists = await prisma.test.findFirst({
      where: { ownerId: req.userId!, templateId, name: label },
      select: { id: true },
    });
    if (exists) {
      res.status(409).json({
        error: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
      });
      return;
    }

    const test = await prisma.test.create({
      data: {
        name: label,
        date: date ? new Date(date) : new Date(),
        ownerId: req.userId!,
        templateId,
      },
      select: { id: true, name: true, date: true, templateId: true },
    });

    res.json(test);
  } catch (e: any) {
    if (e?.code === "P2002") {
      res.status(409).json({
        error: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
      });
      return;
    }
    res.status(500).json({ error: "Błąd tworzenia sesji." });
  }
});

/**
 * PUT /tests/:testId
 * Zmiana nazwy (i opcjonalnie daty) sesji — z walidacją konfliktu w obrębie szablonu.
 */
router.put("/:testId", authenticateJWT, async (req: Request, res: Response) => {
  const testId = Number(req.params.testId);
  const { name, date } = req.body as { name?: string; date?: string };

  try {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || test.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu." });
      return;
    }

    if (name && name.trim()) {
      const conflict = await prisma.test.findFirst({
        where: {
          ownerId: req.userId!,
          templateId: test.templateId,
          name: name.trim(),
          NOT: { id: testId },
        },
        select: { id: true },
      });
      if (conflict) {
        res.status(409).json({
          error: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
        });
        return;
      }
    }

    const updated = await prisma.test.update({
      where: { id: testId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(date ? { date: new Date(date) } : {}),
      },
      select: { id: true, name: true, date: true },
    });
    res.json(updated);
  } catch (e: any) {
    if (e?.code === "P2002") {
      res.status(409).json({
        error: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
      });
      return;
    }
    res.status(500).json({ error: "Błąd aktualizacji sesji." });
  }
});

/**
 * DELETE /tests/:testId
 * Usuwa sesję (i jej wyniki).
 */
router.delete(
  "/:testId",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const testId = Number(req.params.testId);
    try {
      const test = await prisma.test.findUnique({ where: { id: testId } });
      if (!test || test.ownerId !== req.userId) {
        res.status(403).json({ error: "Brak dostępu." });
        return;
      }

      // Jeśli nie masz onDelete: Cascade w schema.prisma, odkomentuj:
      // await prisma.testResult.deleteMany({ where: { testId } });

      await prisma.test.delete({ where: { id: testId } });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Błąd usuwania sesji." });
    }
  }
);

/**
 * GET /tests/:testId/students/:studentId/results
 * Zwraca zadania szablonu z doczepionymi punktami.
 */
router.get(
  "/:testId/students/:studentId/results",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const testId = parseInt(req.params.testId, 10);
    const studentId = parseInt(req.params.studentId, 10);

    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || test.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do testu." });
      return;
    }

    const tasks = await prisma.testTask.findMany({
      where: { templateId: test.templateId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        activity: true,
        content: true,
        order: true,
        minPoints: true,
        maxPoints: true,
        allowHalfPoints: true,
      },
    });

    const results = await prisma.testResult.findMany({
      where: { testId, studentId },
    });
    const map = new Map(results.map((r) => [r.taskId, r.points]));

    res.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        activity: t.activity,
        content: t.content, // <-- tu jest treść
        order: t.order,
        minPoints: t.minPoints,
        maxPoints: t.maxPoints,
        allowHalfPoints: t.allowHalfPoints,
        points: map.get(t.id) ?? null,
      })),
    });
  }
);

/**
 * PUT /tests/:testId/students/:studentId/results
 * Body: { results: Array<{ taskId:number, points:number|null }> }
 * Upsert wyników; null => usuń wynik.
 */
router.put(
  "/:testId/students/:studentId/results",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const testId = parseInt(req.params.testId, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const payload = (req.body?.results ?? []) as Array<{
      taskId: number;
      points: number | null;
    }>;

    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || test.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do testu." });
      return;
    }

    const tasks = await prisma.testTask.findMany({
      where: { templateId: test.templateId },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    try {
      for (const r of payload) {
        const task = taskMap.get(r.taskId);
        if (!task) continue;

        if (r.points === null || Number.isNaN(r.points)) {
          await prisma.testResult.deleteMany({
            where: { testId, studentId, taskId: r.taskId },
          });
        } else {
          if (r.points < task.minPoints || r.points > task.maxPoints) {
            res.status(400).json({
              error: `Punkty dla zad.${task.order} poza zakresem (${task.minPoints}-${task.maxPoints}).`,
            });
            return;
          }

          const existing = await prisma.testResult.findFirst({
            where: { testId, studentId, taskId: r.taskId },
          });
          if (existing) {
            await prisma.testResult.update({
              where: { id: existing.id },
              data: { points: r.points },
            });
          } else {
            await prisma.testResult.create({
              data: { testId, studentId, taskId: r.taskId, points: r.points },
            });
          }
        }
      }

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Błąd zapisu wyników." });
    }
  }
);

/**
 * GET /tests/:testId/progress?schoolId=&classId=
 * Zwraca mapę: studentId -> liczba wypełnionych zadań.
 */
router.get(
  "/:testId/progress",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const testId = parseInt(req.params.testId, 10);
    const schoolId = req.query.schoolId
      ? parseInt(String(req.query.schoolId), 10)
      : null;
    const classId = req.query.classId
      ? parseInt(String(req.query.classId), 10)
      : null;

    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || test.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu do testu." });
      return;
    }

    const students = await prisma.student.findMany({
      where: {
        class: {
          ...(classId ? { id: classId } : {}),
          school: {
            ...(schoolId ? { id: schoolId } : {}),
            ownerId: req.userId,
          },
        },
      },
      select: { id: true },
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      res.json({});
      return;
    }

    const grouped = await prisma.testResult.groupBy({
      by: ["studentId"],
      where: { testId, studentId: { in: studentIds } },
      _count: { _all: true },
    });

    const progress: Record<number, number> = {};
    for (const g of grouped) {
      progress[g.studentId] = g._count._all;
    }
    res.json(progress);
  }
);

/**
 * GET /test-templates/:templateId/tasks
 * Zwraca zadania szablonu o danym templateId.
 */
router.get(
  "/test-templates/:templateId/tasks",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const tplId = parseInt(req.params.templateId, 10);
    if (!tplId) {
      res.status(400).json({ error: "Nieprawidłowe templateId." });
      return;
    }
    try {
      const tasks = await prisma.testTask.findMany({
        where: { templateId: tplId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          activity: true,
          content: true,
          order: true,
          minPoints: true,
          maxPoints: true,
        },
      });
      res.json(tasks);
    } catch (e) {
      console.error("GET /test-templates/:templateId/tasks error:", e);
      res.status(500).json({ error: "Błąd pobierania zadań szablonu." });
    }
  }
);

export default router;
