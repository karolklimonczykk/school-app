import express, { Request, Response } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { prisma } from "../prisma";

const router = express.Router();

/**
 * GET /results/overview?testId=...&schoolId=&classId=
 * Zwraca:
 *  - listę uczniów z sumami/%,
 *  - statystyki per zadanie (p, q, f, wariancja, moc różnicująca),
 *  - statystyki testu (średnia, mediana, moda, min/max, rozstęp, wariancja, odchylenie,
 *    łatwość testu, alfa Cronbacha, błąd standardowy).
 */
router.get(
  "/overview",
  authenticateJWT,
  async (req: Request, res: Response): Promise<void> => {
    const testId = Number(req.query.testId);
    if (!testId) {
      res.status(400).json({ error: "Brak testId." });
      return;
    }

    const schoolId = req.query.schoolId ? Number(req.query.schoolId) : null;
    const classId = req.query.classId ? Number(req.query.classId) : null;
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;

    // 1) Test + kontrola właściciela
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { template: true },
    });
    if (!test || test.ownerId !== req.userId) {
      res.status(403).json({ error: "Brak dostępu." });
      return;
    }

    // 2) Zadania w teście (kolejność)
    const tasks = await prisma.testTask.findMany({
      where: { templateId: test.templateId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        description: true,
        order: true,
        minPoints: true,
        maxPoints: true,
      },
    });
    const k = tasks.length;
    if (k === 0) {
      res.json({
        header: {
          testId: test.id,
          testName: test.name,
          templateName: test.template.name,
          n: 0,
          totalMax: 0,
          pTest: 0,
        },
        students: [],
        items: [],
        summary: {},
      });
      return;
    }
    const totalMax = tasks.reduce((a, t) => a + t.maxPoints, 0);

    // 3) Lista uczniów w scope (jak w /tests/:id/progress) :contentReference[oaicite:0]{index=0}
    const students = await prisma.student.findMany({
      where: {
        ...(studentId ? { id: studentId } : {}),
        class: {
          ...(classId ? { id: classId } : {}),
          school: {
            ...(schoolId ? { id: schoolId } : {}),
            ownerId: req.userId,
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ classId: "asc" }, { order: "asc" }, { lastName: "asc" }],
    });
    const studentIds = students.map((s) => s.id);
    const n = studentIds.length;
    if (n === 0) {
      res.json({
        header: {
          testId: test.id,
          testName: test.name,
          templateName: test.template.name,
          n: 0,
          totalMax,
          pTest: 0,
        },
        students: [],
        items: tasks.map((t) => ({
          ...t,
          p: 0,
          q: 1,
          f: 0,
          variance: 0,
          discrimination: 0,
          avgPoints: 0,
        })),
        summary: {
          mean: 0,
          median: 0,
          mode: null,
          min: 0,
          max: 0,
          range: 0,
          variance: 0,
          stdDev: 0,
          alpha: 0,
          stdError: 0,
        },
      });
      return;
    }

    // 4) Wszystkie wyniki tych uczniów w tym teście
    const results = await prisma.testResult.findMany({
      where: { testId, studentId: { in: studentIds } },
      select: { studentId: true, taskId: true, points: true },
    });

    // Mapy pomocnicze
    const byStudent: Record<number, Record<number, number>> = {}; // studentId -> taskId -> points
    for (const sId of studentIds) byStudent[sId] = {};
    for (const r of results) {
      byStudent[r.studentId][r.taskId] = r.points ?? 0;
    }

    // 5) Suma per uczeń
    const totals: number[] = [];
    const studentRows = students.map((s) => {
      let sum = 0;
      for (const t of tasks) {
        const v = byStudent[s.id][t.id] ?? 0;
        sum += v;
      }
      totals.push(sum);
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.class?.name ?? "",
        total: sum,
        percent: totalMax ? sum / totalMax : 0,
      };
    });

    // Funkcje statystyczne
    const mean = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const variancePop = (arr: number[]) => {
      if (!arr.length) return 0;
      const m = mean(arr);
      return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    };
    const stdPop = (arr: number[]) => Math.sqrt(variancePop(arr));
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const a = [...arr].sort((x, y) => x - y);
      const mid = Math.floor(a.length / 2);
      return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    };
    const mode = (arr: number[]) => {
      if (!arr.length) return null as number | null;
      const map = new Map<number, number>();
      for (const x of arr) map.set(x, (map.get(x) || 0) + 1);
      const max = Math.max(...map.values());
      const modes = [...map.entries()]
        .filter(([, c]) => c === max)
        .map(([v]) => v);
      if (modes.length > 2) return null; // brak modalnej przy wielu równolicznych
      if (modes.length === 2 && modes[0] === modes[1]) return modes[0];
      return modes.length === 1 ? modes[0] : null;
    };
    const corr = (x: number[], y: number[]) => {
      const n = x.length;
      if (!n) return 0;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumX2 = x.reduce((a, b) => a + b * b, 0);
      const sumY2 = y.reduce((a, b) => a + b * b, 0);
      const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
      );
      return den === 0 ? 0 : num / den;
    };

    // 6) Statystyki per zadanie
    const items = tasks.map((t) => {
      const itemScores: number[] = [];
      let omitted = 0;
      for (const sId of studentIds) {
        const has = Object.prototype.hasOwnProperty.call(byStudent[sId], t.id);
        const pts = byStudent[sId][t.id] ?? 0;
        if (!has) omitted += 1; // brak wpisu -> opuszczenie
        itemScores.push(pts);
      }
      const sumPts = itemScores.reduce((a, b) => a + b, 0);
      const p = t.maxPoints ? sumPts / (n * t.maxPoints) : 0; // łatwość
      const q = 1 - p; // trudność
      const f = n ? omitted / n : 0; // frakcja opuszczeń
      const varItem = variancePop(itemScores);

      // moc różnicująca – korelacja z wynikiem skorygowanym (total minus to zadanie)
      const totalsCorrected = studentIds.map(
        (sId, i) => totals[i] - (byStudent[sId][t.id] ?? 0)
      );
      const rxi = corr(itemScores, totalsCorrected);

      return {
        id: t.id,
        order: t.order,
        description: t.description,
        minPoints: t.minPoints,
        maxPoints: t.maxPoints,
        avgPoints: n ? sumPts / n : 0,
        p,
        q,
        f,
        variance: varItem,
        discrimination: rxi,
      };
    });

    // 7) Statystyki całego testu
    const meanTotal = mean(totals);
    const varTotal = variancePop(totals);
    const stdTotal = Math.sqrt(varTotal);
    const minTotal = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const medTotal = median(totals);
    const modeTotal = mode(totals);
    const range = maxTotal - minTotal;

    // alfa Cronbacha
    const sumItemVar = items.reduce((a, it) => a + it.variance, 0);
    const alpha =
      k > 1 && varTotal > 0 ? (k / (k - 1)) * (1 - sumItemVar / varTotal) : 0;

    // łatwość testu = suma wszystkich punktów / (n * totalMax)
    const pTest =
      n && totalMax ? totals.reduce((a, b) => a + b, 0) / (n * totalMax) : 0;

    // błąd standardowy (δe = δx * sqrt(1 - α))
    const stdError = stdTotal * Math.sqrt(Math.max(0, 1 - alpha));

    res.json({
      header: {
        testId: test.id,
        testName: test.name,
        templateName: test.template.name,
        n,
        totalMax,
        pTest,
      },
      students: studentRows,
      items,
      summary: {
        mean: meanTotal,
        median: medTotal,
        mode: modeTotal,
        min: minTotal,
        max: maxTotal,
        range,
        variance: varTotal,
        stdDev: stdTotal,
        alpha,
        stdError,
      },
    });
  }
);

router.get("/points", authenticateJWT, async (req: Request, res: Response) => {
  const testId = Number(req.query.testId);
  if (!testId) {
    res.status(400).json({ error: "Brak testId." });
    return;
  }

  const schoolId = req.query.schoolId ? Number(req.query.schoolId) : null;
  const classId = req.query.classId ? Number(req.query.classId) : null;
  const studentId = req.query.studentId ? Number(req.query.studentId) : null;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { template: true },
  });
  if (!test || test.ownerId !== req.userId) {
    res.status(403).json({ error: "Brak dostępu." });
    return;
  }

  const tasks = await prisma.testTask.findMany({
    where: { templateId: test.templateId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const orders = tasks.map((t) => t.order);
  const taskIds = tasks.map((t) => t.id);

  const students = await prisma.student.findMany({
    where: {
      ...(studentId ? { id: studentId } : {}),
      class: {
        ...(classId ? { id: classId } : {}),
        school: { ...(schoolId ? { id: schoolId } : {}), ownerId: req.userId },
      },
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ classId: "asc" }, { order: "asc" }, { lastName: "asc" }],
  });

  const results = await prisma.testResult.findMany({
    where: {
      testId,
      studentId: { in: students.map((s) => s.id) },
      taskId: { in: taskIds },
    },
    select: { studentId: true, taskId: true, points: true },
  });

  const byStudent: Record<number, (number | null)[]> = {};
  for (const s of students) byStudent[s.id] = Array(tasks.length).fill(null);
  const pos: Record<number, number> = {};
  tasks.forEach((t, i) => {
    pos[t.id] = i;
  });

  for (const r of results) {
    const i = pos[r.taskId];
    if (i != null) byStudent[r.studentId][i] = r.points ?? 0;
  }

  res.json({
    orders,
    rows: students.map((s) => ({
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      points: byStudent[s.id],
    })),
  });
});

export default router;
