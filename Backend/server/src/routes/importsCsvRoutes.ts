import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

/**
 * POST /imports/csv
 * Body:
 * {
 *   schoolId: number,
 *   classNameMap?: Record<string,string>, // np. {"A":"3A","B":"3B"}
 *   test: { name: string, date: string },
 *   templateId?: number,
 *   templateNew?: { name: string, items: { name: string, order: number, maxPoints: number, minPoints?: number }[] },
 *   rows: Array<{
 *     pesel?: string|null,
 *     className?: string|null,  // po mapowaniu z classNameMap
 *     roll?: number|null,       // nr w dzienniku
 *     firstName?: string|null,
 *     lastName?: string|null,
 *     gender?: string|null,     // gdy brak -> 'N'
 *     taskPoints: Array<number|null> // w kolejności items (po mapowaniu w FE)
 *   }>
 * }
 */
router.post("/csv", authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const {
    schoolId,
    classNameMap,
    test,
    templateId,
    templateNew,
    rows,
  } = req.body as {
    schoolId: number;
    classNameMap?: Record<string, string>;
    test: { name: string; date: string };
    templateId?: number;
    templateNew?: {
      name: string;
      items: { name: string; order: number; maxPoints: number; minPoints?: number }[];
    };
    rows: {
      pesel?: string | null;
      className?: string | null;
      roll?: number | null;
      firstName?: string | null;
      lastName?: string | null;
      gender?: string | null;
      taskPoints: Array<number | null>;
    }[];
  };

  if (!schoolId || !test?.name || !test?.date || !rows?.length) {
    res.status(400).json({ error: "Brakuje wymaganych pól (schoolId, test, rows)." });
    return ;
  }

  // 0) Szkoła + owner
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || school.ownerId !== userId) {
    res.status(403).json({ error: "Brak dostępu do szkoły." });
    return ;
  }

  // 1) Szablon
  let tplId = templateId ?? null;
  if (!tplId) {
    if (!templateNew || !templateNew.items?.length) {
      res.status(400).json({ error: "Brak templateId i templateNew.items." });
        return ;
    }
    const tpl = await prisma.testTemplate.create({
      data: {
        name: templateNew.name || `Szablon z CSV ${new Date().toLocaleString()}`,
        ownerId: userId,
        tasks: {
          create: templateNew.items.map((it) => ({
            name: it.name,
            order: it.order,
            minPoints: it.minPoints ?? 0,
            maxPoints: it.maxPoints,
            content: it.name,
            activity: null,
          })),
        },
      },
      include: { tasks: true },
    });
    tplId = tpl.id;
  }

  // 2) Sesja testu
  const testSession = await prisma.test.create({
    data: {
      name: test.name,
      date: new Date(test.date),
      ownerId: userId,
      templateId: tplId!,
    },
  });

  // Mapa tasków (order->taskId)
  const tasks = await prisma.testTask.findMany({
    where: { templateId: tplId! },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const orderToTaskId = new Map<number, number>();
  tasks.forEach((t) => orderToTaskId.set(t.order, t.id));

  // 3) Zapewnienie klas + uczniów; identyfikacja ucznia:
  //    preferujemy (className, roll) lub (className, first+last) – PESEL-a w modelu nie mamy.
  const classCache = new Map<string, number>(); // name->id

  async function ensureClass(name: string): Promise<number> {
  const key = name.trim();
  if (!key) throw new Error("Pusta nazwa klasy");
  if (classCache.has(key)) return classCache.get(key)!;

  // Spróbuj znaleźć istniejącą
  let cls = await prisma.class.findFirst({
    where: { name: key, schoolId },
    select: { id: true },
  });

  if (!cls) {
    // Wyznacz kolejny order w danej szkole
    const agg = await prisma.class.aggregate({
      where: { schoolId },
      _max: { order: true },
    });
    const nextOrder = (agg._max.order ?? 0) + 1;

    // UTWÓRZ z wymaganym 'order'
    cls = await prisma.class.create({
      data: { name: key, schoolId, order: nextOrder },
      select: { id: true },
    });
  }

  classCache.set(key, cls.id);
  return cls.id;
}


  async function findOrCreateStudent(classId: number, row: any) {
    const roll = typeof row.roll === "number" && Number.isFinite(row.roll) ? row.roll : null;
    const firstName = (row.firstName || "").trim();
    const lastName = (row.lastName || "").trim();
    const gender = (row.gender || "N").trim() || "N";

    let student = null;

    if (roll != null) {
      student = await prisma.student.findFirst({
        where: { classId, order: roll },
        select: { id: true },
      });
    }

    if (!student && firstName && lastName) {
      student = await prisma.student.findFirst({
        where: { classId, firstName, lastName },
        select: { id: true },
      });
    }

    if (!student) {
      student = await prisma.student.create({
        data: {
          classId,
          order: roll ?? 0,
          firstName: firstName || "",
          lastName: lastName || "",
          gender: ["M", "F"].includes(gender) ? gender : "N",
        },
        select: { id: true },
      });
    } else if (roll != null) {
      // uzupełnij brakujące dane (np. płeć)
      await prisma.student.update({
        where: { id: student.id },
        data: {
          gender: ["M", "F"].includes(gender) ? gender : "N",
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
      });
    }

    return student.id;
  }

  // 4) Zapis wyników
  let createdResults = 0;
  const createdStudentsSet = new Set<number>();
  const createdClassesSet = new Set<number>();

  for (const r of rows) {
    const rawClassName = (r.className || "").toString().trim();
    if (!rawClassName) continue;
    const mappedName = classNameMap?.[rawClassName] || rawClassName;
    const classId = await ensureClass(mappedName);
    createdClassesSet.add(classId);

    const studentId = await findOrCreateStudent(classId, r);
    createdStudentsSet.add(studentId);

    // wpisy per zadanie
    for (let i = 0; i < r.taskPoints.length; i++) {
      const points = r.taskPoints[i];
      if (points == null) continue; // puste lub "?"
      const taskId = orderToTaskId.get(i + 1);
      if (!taskId) continue;
      await prisma.testResult.upsert({
        where: {
          testId_studentId_taskId: { testId: testSession.id, studentId, taskId },
        },
        update: { points },
        create: { testId: testSession.id, studentId, taskId, points },
      });
      createdResults++;
    }
  }

   res.json({
    testId: testSession.id,
    classes: createdClassesSet.size,
    students: createdStudentsSet.size,
    results: createdResults,
  });
  return;
});

export default router;
