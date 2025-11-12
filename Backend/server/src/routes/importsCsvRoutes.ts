import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

/**
 * POST /imports/csv
 * Body:
 * {
 *   schoolId: number,
 *   classNameMap?: Record<string,string>,
 *   test: { name: string, date: string },
 *   templateId?: number,
 *   templateNew?: {
 *     name: string,
 *     items: {
 *       name: string,
 *       order: number,
 *       maxPoints: number,
 *       minPoints?: number,
 *       content?: string|null,
 *       activity?: string|null,
 *       allowHalfPoints?: boolean,   // preferowane pole
 *       step?: number                // (DEPRECATED) jeśli = 0.5 => allowHalfPoints = true
 *     }[]
 *   },
 *   rows: Array<{
 *     className?: string|null,
 *     roll?: number|null,
 *     firstName?: string|null,
 *     lastName?: string|null,
 *     gender?: string|null,
 *     taskPoints: (number|null)[]
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
    test: { name: string; date?: string };
    templateId?: number;
    templateNew?: {
      name: string;
      items: {
        name: string;
        order: number;
        maxPoints: number;
        minPoints?: number;
        content?: string | null;
        activity?: string | null;
        allowHalfPoints?: boolean;
        step?: number; // deprecated
      }[];
    };
    rows: {
      className?: string | null;
      roll?: number | null;
      firstName?: string | null;
      lastName?: string | null;
      gender?: string | null;
      taskPoints: Array<number | null>;
    }[];
  };

  if (!schoolId || !test?.name || !rows?.length) {
    res.status(400).json({ error: "Brakuje wymaganych pól (schoolId, test.name, rows)." });
    return;
  }

  // Szkoła + owner
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || school.ownerId !== userId) {
    res.status(403).json({ error: "Brak dostępu do szkoły." });
    return;
  }

  // Unikalność nazwy testu (per owner)
  const testDup = await prisma.test.findFirst({ where: { ownerId: userId, name: test.name } });
  if (testDup) {
    res.status(409).json({ error: "Test o takiej nazwie już istnieje." });
    return;
  }

  // Szablon
  let tplId = templateId ?? null;
  if (!tplId) {
    if (!templateNew || !templateNew.items?.length) {
      res.status(400).json({ error: "Brak templateId i templateNew.items." });
      return;
    }
    // Unikalność nazwy szablonu (per owner)
    const tplDup = await prisma.testTemplate.findFirst({
      where: { ownerId: userId, name: templateNew.name },
      select: { id: true },
    });
    if (tplDup) {
      res.status(409).json({ error: "Szablon o takiej nazwie już istnieje." });
      return;
    }

    const tpl = await prisma.testTemplate.create({
      data: {
        name: templateNew.name || `Szablon z CSV ${new Date().toLocaleString()}`,
        ownerId: userId,
        tasks: {
          create: templateNew.items.map((it) => {
            // kompatybilność: jeśli klient przyśle "step: 0.5" => allowHalfPoints = true
            const allowHalf =
              typeof it.allowHalfPoints === "boolean"
                ? it.allowHalfPoints
                : Number((it as any).step) === 0.5;

            const minP = it.minPoints ?? 0;
            const maxP = Math.max(it.maxPoints, minP);

            return {
              name: it.name,
              order: it.order,
              minPoints: minP,
              maxPoints: maxP,
              content: it.content ?? it.name,
              activity: it.activity ?? null,
              allowHalfPoints: allowHalf,
              // UWAGA: nie zapisujemy "step" do Prisma — w modelu go nie ma
            };
          }),
        },
      },
      include: { tasks: true },
    });
    tplId = tpl.id;
  }

  // Sesja testu
  const testSession = await prisma.test.create({
    data: {
      name: test.name,
      date: test.date ? new Date(test.date) : new Date(),
      ownerId: userId,
      templateId: tplId!,
    },
  });

  // Mapa zadań (order -> taskId) z wybranego/utworzonego szablonu
  const tasks = await prisma.testTask.findMany({
    where: { templateId: tplId! },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const orderToTaskId = new Map<number, number>();
  tasks.forEach((t) => orderToTaskId.set(t.order, t.id));

  // Przygotowanie nazw klas
  const norm = (s?: string | null) => (s ?? "").toString().trim();
  const classNamesFromCsv = Array.from(
    new Set(
      rows
        .map((r) => norm(r.className))
        .filter(Boolean)
        .map((c) => classNameMap?.[c] || c)
    )
  );

  // Sprawdź, które klasy już istnieją w tej szkole
  const existingClasses = await prisma.class.findMany({
    where: { schoolId, name: { in: classNamesFromCsv } },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existingClasses.map((c) => [c.name, c.id]));

  // Reguła: jeśli choć JEDNA klasa z CSV już istnieje — NIE tworzymy żadnych klas/uczniów.
  const structureBlocked = existingClasses.length > 0;

  // Pomocnicze
  const findStudentInClass = async (classId: number, row: any) => {
    const roll = typeof row.roll === "number" && Number.isFinite(row.roll) ? row.roll : null;
    const firstName = norm(row.firstName);
    const lastName = norm(row.lastName);

    let student = null;
    if (roll != null) {
      student = await prisma.student.findFirst({ where: { classId, order: roll }, select: { id: true } });
    }
    if (!student && firstName && lastName) {
      student = await prisma.student.findFirst({ where: { classId, firstName, lastName }, select: { id: true } });
    }
    return student?.id ?? null;
  };

  // Jeżeli struktura NIE jest zablokowana — utwórz brakujące klasy i uczniów
  const classCache = new Map<string, number>(); // name->id
  let createdClasses = 0;
  let createdStudents = 0;

  const ensureClass = async (name: string): Promise<number | null> => {
    const key = name.trim();
    if (!key) return null;
    if (classCache.has(key)) return classCache.get(key)!;

    // jeżeli struktura zablokowana — nie tworzymy
    if (structureBlocked) {
      const id = existingByName.get(key) ?? null;
      if (id) classCache.set(key, id);
      return id;
    }

    // próbuj znaleźć
    let cls = await prisma.class.findFirst({ where: { name: key, schoolId }, select: { id: true } });
    if (!cls) {
      const agg = await prisma.class.aggregate({ where: { schoolId }, _max: { order: true } });
      const nextOrder = (agg._max.order ?? 0) + 1;
      cls = await prisma.class.create({
        data: { name: key, schoolId, order: nextOrder },
        select: { id: true },
      });
      createdClasses++;
    }
    classCache.set(key, cls.id);
    return cls.id;
  };

  const findOrCreateStudent = async (classId: number, row: any) => {
    const roll = typeof row.roll === "number" && Number.isFinite(row.roll) ? row.roll : null;
    const firstName = norm(row.firstName);
    const lastName = norm(row.lastName);
    const gender = ["M", "F"].includes((row.gender || "N").toString()) ? row.gender : "N";

    // jeśli struktura zablokowana — znajdź tylko istniejącego
    if (structureBlocked) {
      return await findStudentInClass(classId, row);
    }

    // spróbuj znaleźć
    let studentId = await findStudentInClass(classId, row);
    if (studentId) {
      // ewentualny update drobnych pól
      await prisma.student.update({
        where: { id: studentId },
        data: {
          gender: gender as any,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
      });
      return studentId;
    }

    // utwórz nowego
    const created = await prisma.student.create({
      data: {
        classId,
        order: roll ?? 0,
        firstName: firstName || "",
        lastName: lastName || "",
        gender: (gender as any) || "N",
      },
      select: { id: true },
    });
    createdStudents++;
    return created.id;
  };

  // Zapis wyników
  let createdResults = 0;
  const skippedRows: number[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const rawClassName = norm(r.className);
    if (!rawClassName) { skippedRows.push(idx); continue; }

    const mappedName = classNameMap?.[rawClassName] || rawClassName;
    const classId = await ensureClass(mappedName);

    if (!classId) { // struktura zablokowana i brak takiej klasy -> pomiń
      skippedRows.push(idx);
      continue;
    }

    const studentId = await findOrCreateStudent(classId, r);
    if (!studentId) { // struktura zablokowana i nie znaleziono ucznia
      skippedRows.push(idx);
      continue;
    }

    // wpisy per zadanie
    for (let i = 0; i < r.taskPoints.length; i++) {
      const points = r.taskPoints[i];
      if (points == null) continue;
      const taskId = orderToTaskId.get(i + 1);
      if (!taskId) continue;
      await prisma.testResult.upsert({
        where: { testId_studentId_taskId: { testId: testSession.id, studentId, taskId } },
        update: { points },
        create: { testId: testSession.id, studentId, taskId, points },
      });
      createdResults++;
    }
  }

  res.json({
    testId: testSession.id,
    createdClasses,
    createdStudents,
    createdResults,
    structure_blocked: structureBlocked,
    reasons: structureBlocked ? ["Wykryto klasy z CSV, które już istnieją w szkole."] : [],
    skippedRows,
  });
  return;
});

export default router;
