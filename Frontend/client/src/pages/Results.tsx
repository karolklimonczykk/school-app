/* src/pages/Results.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import * as XLSX from "xlsx";
import CsvImportWizard from "../components/CsvImportWizard";

type School = { id: number; name: string };
type SchoolClass = { id: number; name: string; schoolId: number };
type Session = {
  id: number;
  name: string;
  date: string;
  templateId: number;
  template?: { id: number; name: string };
};

type ItemStat = {
  id: number;
  order: number;
  name?: string | null;
  activity?: string | null;
  content: string;
  minPoints: number;
  maxPoints: number;
  avgPoints: number;
  p: number;
  q: number;
  f: number;
  variance: number;
  discrimination: number;
};

type StudentRow = {
  studentId: number;
  firstName: string;
  lastName: string;
  codeNumber: string | null;
  className: string;
  schoolName: string;
  total: number;
  percent: number;
};

type Overview = {
  header: {
    testId: number;
    testName: string;
    templateName: string;
    n: number;
    totalMax: number;
    pTest: number;
  };
  students: StudentRow[];
  items: ItemStat[];
  summary: {
    mean: number;
    median: number;
    mode: number | null;
    min: number;
    max: number;
    range: number;
    variance: number;
    stdDev: number;
    alpha: number;
    stdError: number;
  };
};

type TaskMetric = "p" | "q" | "f" | "varianceRaw" | "discriminationRaw";

type StudentMetric = "percent" | "points";

// Legendy/metadane do opisów metryk
const metricLegend: Record<TaskMetric, string> = {
  p: "Współczynnik łatwości (p) [0–1]",
  q: "Trudność (q) [0–1]",
  f: "Frakcja opuszczeń (f) [0–1]",
  varianceRaw: "Wariancja (S²)",
  discriminationRaw: "Moc różnicująca (r) [-1,1]",
};

const fmt2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

// "Ładne" ticki osi
const niceNum = (range: number, round: boolean) => {
  const exponent = Math.floor(Math.log10(range || 1));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
};

const makeNiceTicks = (min: number, max: number, count = 5) => {
  const range = niceNum(max - min || 1, false);
  const step = niceNum(range / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + 1e-10; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return { ticks, niceMin, niceMax, step };
};

const Results: React.FC = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();

  // Filtry
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [selectedTestId, setSelectedTestId] = useState<number | "">("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">("");
  const [studentsForFilter, setStudentsForFilter] = useState<
    { id: number; firstName: string; lastName: string }[]
  >([]);
  // Dane analityczne
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  // Zakładki
  const [tab, setTab] = useState<"tasks" | "students">("tasks");
  const [taskMetric, setTaskMetric] = useState<TaskMetric>("p");
  const [studentMetric, setStudentMetric] = useState<StudentMetric>("percent");

  // --- OŚ Y dla wykresu zadań (zależna od taskMetric) ---
  const yAxisTasks = useMemo(() => {
    const items = overview?.items ?? [];
    const maxVar = items.length ? Math.max(...items.map((i) => i.variance)) : 1;
    const discMin = items.length
      ? Math.min(...items.map((i) => i.discrimination))
      : -1;
    const discMax = items.length
      ? Math.max(...items.map((i) => i.discrimination))
      : 1;

    if (["p", "q", "f"].includes(taskMetric)) {
      return {
        ticks: [0, 0.25, 0.5, 0.75, 1],
        toPct: (v: number) => v * 100,
        format: (v: number) => v.toFixed(2),
        title: metricLegend[taskMetric as TaskMetric],
        zeroPct: 0,
      };
    }

    if (taskMetric === "varianceRaw") {
      const safeMax = Math.max(0, maxVar);
      const { ticks, niceMin, niceMax } = makeNiceTicks(0, safeMax || 1, 5);
      const range = niceMax - niceMin || 1;
      return {
        ticks,
        toPct: (v: number) => ((v - niceMin) / range) * 100,
        format: (v: number) => v.toFixed(2),
        title: metricLegend.varianceRaw,
        zeroPct: ((0 - niceMin) / range) * 100,
      };
    }

    const dMin = Math.min(-1, discMin);
    const dMax = Math.max(1, discMax);
    const { ticks, niceMin, niceMax } = makeNiceTicks(dMin, dMax, 5);
    const range = niceMax - niceMin || 1;
    return {
      ticks,
      toPct: (v: number) => ((v - niceMin) / range) * 100,
      format: (v: number) => v.toFixed(2),
      title: metricLegend.discriminationRaw,
      zeroPct: ((0 - niceMin) / range) * 100,
    };
  }, [taskMetric, overview]);

  // --- OŚ Y dla wykresu uczniów ---
  const yAxisStudents = useMemo(() => {
    const max = overview?.header.totalMax ?? 0;
    if (!overview || max <= 0 || studentMetric === "percent") {
      return {
        ticks: [0, 25, 50, 75, 100],
        toPct: (v: number) => v,
        format: (v: number) => `${v}%`,
        title: "Procent wyniku [%]",
      };
    }
    const tickVals = [0, 0.25 * max, 0.5 * max, 0.75 * max, 1 * max];
    return {
      ticks: tickVals,
      toPct: (v: number) => (v / max) * 100,
      format: (v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(2)),
      title: `Suma punktów [0–${max}]`,
    };
  }, [overview, studentMetric]);

  // Prefiltry z URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get("school");
    const c = params.get("class");
    const t = params.get("test");
    const u = params.get("student");
    setSelectedSchoolId(s ? Number(s) : "");
    setSelectedClassId(c ? Number(c) : "");
    setSelectedTestId(t ? Number(t) : "");
    setSelectedStudentId(u ? Number(u) : "");
  }, [location.search]);

  // Szkoły + sesje
  useEffect(() => {
    const run = async () => {
      try {
        const [sch, tests] = await Promise.all([
          axios.get<School[]>("http://localhost:4000/schools", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get<Session[]>("http://localhost:4000/tests", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setSchools(sch.data);
        setSessions(tests.data || []);
      } catch {
        push({ type: "error", message: "Błąd pobierania szkół/sesji." });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Klasy dla szkoły
  useEffect(() => {
    const load = async () => {
      if (!selectedSchoolId) {
        setClasses([]);
        return;
      }
      try {
        const res = await axios.get<SchoolClass[]>(
          `http://localhost:4000/schools/${selectedSchoolId}/classes`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setClasses(res.data);
      } catch {
        setClasses([]);
        push({ type: "error", message: "Błąd pobierania klas." });
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId]);

  // Uczniowie dla szkoły+klasy (filtr)
  useEffect(() => {
    const loadStudentsForFilter = async () => {
      if (!selectedSchoolId || !selectedClassId) {
        setStudentsForFilter([]);
        return;
      }
      try {
        const res = await axios.get<
          { id: number; firstName: string; lastName: string }[]
        >(
          `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStudentsForFilter(
          res.data.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
          }))
        );

        // Jeśli wybrany uczeń nie należy do tej klasy – wyczyść także URL
        if (
          selectedStudentId &&
          !res.data.some((s) => s.id === selectedStudentId)
        ) {
          setSelectedStudentId("");
          const q = new URLSearchParams(location.search);
          q.delete("student");
          navigate(`/results?${q.toString()}`);
        }
      } catch {
        setStudentsForFilter([]);
      }
    };
    loadStudentsForFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, selectedClassId]);

  // Pobranie Overview
  const fetchOverview = async () => {
    if (!selectedTestId) {
      setOverview(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("testId", String(selectedTestId));
      if (selectedSchoolId) params.set("schoolId", String(selectedSchoolId));
      if (selectedClassId) params.set("classId", String(selectedClassId));
      if (selectedStudentId) params.set("studentId", String(selectedStudentId));
      const res = await axios.get<Overview>(
        `http://localhost:4000/results/overview?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOverview(res.data);
    } catch {
      setOverview(null);
      push({ type: "error", message: "Błąd analizy wyników." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(); /* eslint-disable-next-line */
  }, [selectedTestId, selectedSchoolId, selectedClassId, selectedStudentId]);

  // Normalizacja do wykresu słupkowego (0..100%)
  const taskBars = useMemo(() => {
    if (!overview) return [];
    const pickRaw = (i: ItemStat) => {
      if (taskMetric === "p") return i.p;
      if (taskMetric === "q") return i.q;
      if (taskMetric === "f") return i.f;
      if (taskMetric === "varianceRaw") return i.variance;
      if (taskMetric === "discriminationRaw") return i.discrimination;
      return 0;
    };
    return overview.items.map((i) => ({
      id: i.id,
      order: i.order,
      raw: pickRaw(i),
      label: i.order,
    }));
  }, [overview, taskMetric]);

  const studentBars = useMemo(() => {
    if (!overview) return [];
    const max = overview.header.totalMax || 1;

    if (studentMetric === "percent") {
      return overview.students.map((s, idx) => ({
        lp: idx + 1,
        value: (s.total / max) * 100,
        raw: (s.total / max) * 100,
        label: `${Math.round((s.total / max) * 100)}%`,
        tooltip: `Lp. ${idx + 1}: ${s.total.toFixed(2)} pkt (${(
          (s.total / max) *
          100
        ).toFixed(0)}%)`,
      }));
    }

    return overview.students.map((s, idx) => ({
      lp: idx + 1,
      value: (s.total / max) * 100,
      raw: s.total,
      label: s.total % 1 === 0 ? `${s.total}` : s.total.toFixed(2),
      tooltip: `Lp. ${idx + 1}: ${s.total.toFixed(2)} pkt`,
    }));
  }, [overview, studentMetric]);

  const safeFileName = (name: string) =>
    (name || "wyniki").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);

  const addr = (r1based: number, c0based: number) =>
    XLSX.utils.encode_cell({ r: r1based - 1, c: c0based });
  const interpretEase = (p: number): string => {
    if (p < 0.2) return "Bardzo trudna";
    if (p < 0.5) return "Trudna";
    if (p < 0.7) return "Umiarkowanie trudna";
    if (p < 0.9) return "Łatwa"; // 0.70–0.79 i 0.80–0.899 -> „Łatwa”
    return "Bardzo łatwa"; // 0.90–1.00
  };

  const interpretDiscrimination = (r: number): string => {
    if (r < 0) return "Ujemna (zadanie wadliwe)";
    if (r <= 0.2) return "Nie różnicują";
    if (r <= 0.4) return "Słabo różnicują";
    if (r <= 0.6) return "Średnio różnicują";
    if (r <= 0.8) return "Dobrze różnicują";
    return "Bardzo dobrze różnicują";
  };

  const interpretReliability = (alpha: number): string => {
    if (alpha < 0.5) return "Nierzetelny (nie wnioskować)";
    if (alpha < 0.8) return "Mało rzetelny";
    if (alpha < 0.9) return "Rzetelny";
    return "Bardzo rzetelny";
  };

  const exportXLSX = async () => {
    if (!overview) return;

    // ---------- ARKUSZ 1: „Wyniki” (jak dotąd) + interpretacje ----------
    const aoa: (string | number | null)[][] = [];

    // Meta
    aoa.push(["Sesja", overview.header.testName]);
    aoa.push(["Szablon", overview.header.templateName]);
    aoa.push(["Uczniów (n)", overview.header.n]);
    aoa.push(["Maksymalna suma punktów", overview.header.totalMax]);
    aoa.push(["Łatwość testu (p)", overview.header.pTest]);
    aoa.push([
      "Rzetelność (α)",
      overview.summary.alpha,
      "Interpretacja:" + interpretReliability(overview.summary.alpha),
    ]);
    aoa.push(["Średnia", overview.summary.mean]);
    aoa.push(["Mediana", overview.summary.median]);
    aoa.push(["Moda", overview.summary.mode ?? null]);
    aoa.push(["Min", overview.summary.min]);
    aoa.push(["Max", overview.summary.max]);
    aoa.push(["Rozstęp", overview.summary.range]);
    aoa.push(["Wariancja", overview.summary.variance]);
    aoa.push(["Odch. std.", overview.summary.stdDev]);
    aoa.push(["Błąd std.", overview.summary.stdError]);

    aoa.push([]);
    aoa.push(["UCZNIOWIE"]);

    // Uczniowie
    const studentsHeaderRow = aoa.push([
      "Lp.",
      "Nr z dziennika",
      "Imię",
      "Nazwisko",
      "Klasa",
      "Szkoła",
      "Suma",
      "Wynik (%)",
    ]);
    const studentsDataStart = studentsHeaderRow + 1;
    overview.students.forEach((s, i) => {
      aoa.push([
        i + 1,
        s.codeNumber || "",
        s.firstName,
        s.lastName,
        s.className,
        s.schoolName,
        Number(s.total.toFixed(2)),
        s.percent,
      ]);
    });
    const studentsDataEnd = aoa.length;

    aoa.push([]);
    aoa.push(["ZADANIA"]);

    // Zadania + interpretacje
    const itemsHeaderRow = aoa.push([
      "Lp.",
      "Nazwa zadania",
      "Opis czynności",
      "Treść zadania",
      "Min",
      "Max",
      "Śr. pkt",
      "p",
      "q",
      "f",
      "Wariancja",
      "Moc różnicująca (r)",
      "Interpretacja łatwości. Czynność okazała się:",
      "Interpretacja zadań wg. mocy różnicującej",
    ]);
    const itemsDataStart = itemsHeaderRow + 1;

    overview.items.forEach((it) => {
      aoa.push([
        it.order,
        it.name || "",
        it.activity || "",
        it.content,
        it.minPoints,
        it.maxPoints,
        it.avgPoints,
        it.p,
        it.q,
        it.f,
        it.variance,
        it.discrimination,
        interpretEase(it.p),
        interpretDiscrimination(it.discrimination),
      ]);
    });
    const itemsDataEnd = aoa.length;

    const ws1 = XLSX.utils.aoa_to_sheet(aoa);
    ws1["!cols"] = [
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 20 },
      { wch: 42 },
      { wch: 45 },
    ];

    // format uczniów
    for (let r = studentsDataStart; r <= studentsDataEnd - 1; r++) {
      const sumCell = addr(r, 6);
      const pctCell = addr(r, 7);
      if (ws1[sumCell]) ws1[sumCell].z = "0.00";
      if (ws1[pctCell]) {
        ws1[pctCell].t = "n";
        ws1[pctCell].z = "0.00%";
      }
    }
    // format zadań
    for (let r = itemsDataStart; r <= itemsDataEnd; r++) {
      const setFmt = (c: number, fmt: string) => {
        const a = addr(r, c);
        if (ws1[a]) ws1[a].z = fmt;
      };
      setFmt(2, "0.00");
      setFmt(3, "0.00"); // Min/Max
      setFmt(4, "0.0000");
      setFmt(5, "0.0000");
      setFmt(6, "0.0000"); // Śr, p, q
      setFmt(7, "0.0000");
      setFmt(8, "0.0000");
      setFmt(9, "0.0000"); // f, Var, r
    }

    // ---------- ARKUSZ 2: „Punkty” (fallback: po 1 zapytaniu na ucznia) ----------
    const taskCount = overview.items.length;
    const tasksOrdered = [...overview.items].sort((a, b) => a.order - b.order);
    const header2 = [
      "Nr z dziennika",
      "Imię",
      "Nazwisko",
      ...tasksOrdered.map((t) =>
        t.name && t.name.trim() ? t.name : String(t.order)
      ),
    ];

    type TaskRes = { tasks: { order: number; points: number | null }[] };
    const pointsRows: (string | number | "")[][] = await Promise.all(
      overview.students.map(async (s) => {
        try {
          const res = await axios.get<TaskRes>(
            `http://localhost:4000/tests/${overview.header.testId}/students/${s.studentId}/results`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const byOrder: Record<number, number | null> = {};
          res.data.tasks.forEach((t) => {
            byOrder[t.order] = t.points;
          });
          const cols = tasksOrdered.map((t) => {
            const v = byOrder[t.order];
            return v === null || v === undefined ? "" : Number(v);
          });
          return [s.codeNumber || "", s.firstName, s.lastName, ...cols];
        } catch {
          return [s.codeNumber || "", s.firstName, s.lastName, ...Array(taskCount).fill("-")];
        }
      })
    );
    const ws2 = XLSX.utils.aoa_to_sheet([header2, ...pointsRows]);
    ws2["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      ...Array(taskCount).fill({ wch: 6 }),
    ];

    // ---------- Skoroszyt + zapis ----------
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Wyniki");
    XLSX.utils.book_append_sheet(wb, ws2, "Punkty");
    XLSX.writeFile(wb, `${safeFileName(overview.header.testName)}.xlsx`, {
      bookType: "xlsx",
      compression: true,
    });
  };

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full mx-auto">
          {/* Nagłówek */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">
              Wyniki i analiza testów
            </h2>
            <div className="flex items-center gap-3">
              <CsvImportWizard />
              <button
                onClick={exportXLSX}
                disabled={!overview}
                className="bg-teal-400 hover:bg-teal-300 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                Eksportuj do Excela (XLSX)
              </button>
            </div>
          </div>

          {/* Filtr: „Wybierz uczniów” */}
          <div className="text-sm font-semibold text-gray-600 mb-2">
            Wybierz uczniów i sesję do analizy wyników
          </div>

          {/* Filtry zakresu + wybór sesji */}
          <div className="flex gap-3 flex-wrap items-center mb-5">
            {/* Szkoła */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-64 truncate appearance-none"
                value={selectedSchoolId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedSchoolId(val);
                  setSelectedClassId("");
                  const q = new URLSearchParams(location.search);
                  if (val) q.set("school", String(val));
                  else q.delete("school");
                  q.delete("class");
                  q.delete("student");
                  navigate(`/results?${q.toString()}`);
                }}
              >
                <option value="">Wszystkie szkoły</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>

            {/* Klasa */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 truncate appearance-none"
                value={selectedClassId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedClassId(val);
                  const q = new URLSearchParams(location.search);
                  if (val && selectedSchoolId) q.set("class", String(val));
                  else q.delete("class");
                  if (selectedSchoolId)
                    q.set("school", String(selectedSchoolId));
                  q.delete("student");
                  navigate(`/results?${q.toString()}`);
                }}
                disabled={!selectedSchoolId}
              >
                <option value="">Wszystkie klasy</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
            {/* Uczeń */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-[180px] truncate appearance-none"
                value={selectedStudentId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedStudentId(val);
                  const q = new URLSearchParams(location.search);
                  if (selectedSchoolId)
                    q.set("school", String(selectedSchoolId));
                  else q.delete("school");
                  if (selectedClassId) q.set("class", String(selectedClassId));
                  else q.delete("class");
                  if (selectedTestId) q.set("test", String(selectedTestId));
                  else q.delete("test");
                  if (val) q.set("student", String(val));
                  else q.delete("student");
                  navigate(`/results?${q.toString()}`);
                }}
                disabled={!selectedClassId}
                title="Filtruj po uczniu"
              >
                <option value="">Wszyscy uczniowie</option>
                {studentsForFilter.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>

            {/* Sesja */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-[320px] truncate appearance-none"
                value={selectedTestId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedTestId(val);
                  const q = new URLSearchParams(location.search);
                  if (val) q.set("test", String(val));
                  else q.delete("test");
                  if (selectedSchoolId)
                    q.set("school", String(selectedSchoolId));
                  if (selectedClassId) q.set("class", String(selectedClassId));
                  navigate(`/results?${q.toString()}`);
                }}
              >
                <option value="">— wybierz sesję —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.template?.name ?? "?"} —{" "}
                    {new Date(s.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
          </div>

          {/* KPI / Treść */}
          {loading ? (
            <div className="text-gray-500">Ładowanie analizy…</div>
          ) : !selectedTestId ? (
            <div className="text-gray-500">
              Wybierz sesję, aby zobaczyć wyniki.
            </div>
          ) : !overview ? (
            <div className="text-gray-500">Brak danych do wyświetlenia.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Sesja</div>
                  <div className="font-semibold">
                    {overview.header.testName}
                  </div>
                  <div className="text-xs text-gray-400">
                    {overview.header.templateName}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Uczniów (n)</div>
                  <div className="font-semibold">{overview.header.n}</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Łatwość testu (p)</div>
                  <div className="font-semibold">
                    {(overview.header.pTest * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">
                    Rzetelność testu α Cronbacha
                  </div>
                  <div className="font-semibold">
                    {overview.summary.alpha.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">
                    Odch. std. / Błąd std.
                  </div>
                  <div className="font-semibold">
                    {overview.summary.stdDev.toFixed(2)} /{" "}
                    {overview.summary.stdError.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Zakładki */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  className={`px-4 py-2 font-semibold ${
                    tab === "tasks"
                      ? "text-teal-600 border-b-2 border-teal-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => setTab("tasks")}
                >
                  Analiza zadań
                </button>
                <button
                  className={`px-4 py-2 font-semibold ${
                    tab === "students"
                      ? "text-teal-600 border-b-2 border-teal-500"
                      : "text-gray-500"
                  }`}
                  onClick={() => setTab("students")}
                >
                  Wyniki uczniów
                </button>
              </div>

              {/* Zawartość zakładek */}
              {tab === "tasks" ? (
                <div className="grid grid-cols-1 gap-6">
                  {/* Wykres (zadania) */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <h3 className="font-bold">Wykres (zadania)</h3>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {metricLegend[taskMetric]}
                        </div>
                        <div className="relative inline-block">
                          <select
                            className="border border-gray-300 rounded-lg px-3 pr-8 py-1.5 bg-white text-sm focus:outline-none focus:border-teal-400 appearance-none"
                            value={taskMetric}
                            onChange={(e) =>
                              setTaskMetric(e.target.value as TaskMetric)
                            }
                          >
                            <option value="p">Łatwość (p)</option>
                            <option value="q">Trudność (q)</option>
                            <option value="f">Frakcja opuszczeń (f)</option>
                            <option value="varianceRaw">Wariancja (S²)</option>
                            <option value="discriminationRaw">
                              Moc różnicująca (r)
                            </option>
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Siatka */}
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: "8px 1fr" }}
                    >
                      {/* Tytuł osi Y */}
                      <div className="relative h-74">
                        <div className="absolute inset-0 flex items-center justify-center pl-[4px]">
                          <div className="-rotate-90 text-xs text-gray-500 whitespace-nowrap">
                            {yAxisTasks.title}
                          </div>
                        </div>
                      </div>

                      {/* Pudełko wykresu */}
                      <div className="relative h-74 rounded-lg">
                        <div className="absolute inset-x-3 top-3 bottom-6">
                          <div className="relative h-full flex">
                            {/* Wartości osi Y */}
                            <div className="relative w-10 mr-2">
                              {yAxisTasks.ticks.map((t, i) => {
                                const pct = yAxisTasks.toPct(t);
                                const isZero = Math.abs(pct) < 1e-6;
                                return (
                                  <div
                                    key={i}
                                    className="absolute left-0 text-[10px] leading-[10px] text-gray-400 text-right w-full pr-1 pointer-events-none select-none"
                                    style={
                                      isZero
                                        ? {
                                            bottom: 0,
                                            transform: "translateY(1px)",
                                          }
                                        : { bottom: `calc(${pct}% - 3px)` }
                                    }
                                  >
                                    {yAxisTasks.format(t as number)}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Linie + słupki */}
                            <div className="relative flex-1">
                              {yAxisTasks.ticks.map((t, i) => {
                                const pct = yAxisTasks.toPct(t);
                                return (
                                  <div
                                    key={i}
                                    className="absolute left-0 right-0"
                                    style={{
                                      bottom: `${pct}%`,
                                      borderTop:
                                        pct === 0
                                          ? "2px solid #e5e7eb"
                                          : "1px dashed #eee",
                                    }}
                                  />
                                );
                              })}

                              <div
                                className="relative h-full grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.max(
                                    taskBars.length,
                                    1
                                  )}, minmax(0, 1fr))`,
                                }}
                              >
                                {taskBars.map((b) => {
                                  const pct = yAxisTasks.toPct(b.raw);
                                  const zero = yAxisTasks.zeroPct ?? 0;
                                  const bottom = Math.min(pct, zero);
                                  const height = Math.abs(pct - zero);

                                  return (
                                    <div
                                      key={b.id}
                                      className="flex flex-col items-center justify-end"
                                    >
                                      <div className="relative h-full w-full">
                                        <div
                                          className="absolute left-1/2 -translate-x-1/2 w-full max-w-[22px] mx-auto bg-teal-400 rounded"
                                          style={{
                                            bottom: `${bottom}%`,
                                            height: `${height}%`,
                                          }}
                                          title={`Zad. ${b.label}: ${fmt2(
                                            Number(b.raw)
                                          )}`}
                                        />
                                        <div
                                          className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-600"
                                          style={{
                                            bottom: `calc(${Math.max(
                                              pct,
                                              zero
                                            )}% + 4px)`,
                                          }}
                                        >
                                          {fmt2(Number(b.raw))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Oś X */}
                        <div className="absolute inset-x-3 bottom-0 h-6 flex">
                          <div className="w-10 mr-2" />
                          <div
                            className="flex-1 grid gap-2 h-full items-start text-center text-[10px] text-gray-500"
                            style={{
                              gridTemplateColumns: `repeat(${Math.max(
                                taskBars.length,
                                1
                              )}, minmax(0, 1fr))`,
                            }}
                          >
                            {taskBars.map((b) => (
                              <div key={b.id}>{b.label}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap w-[100%] text-center">
                      Numer zadania
                    </div>
                  </div>

                  {/* Tabela analizy zadań */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold">Analiza zadań</h3>
                      <div className="text-xs text-gray-400">
                        p – łatwość, q – trudność, f – frakcja opuszczeń, S² –
                        wariancja, r – moc różnicująca
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                      <table className="min-w-full ">
                        <thead>
                          <tr>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6 pr-6">
                              Lp.
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6 pr-6">
                              ZADANIE
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              TREŚĆ ZADANIA
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              ŚR.PKT
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              p
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              q
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              f
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              S²
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              r
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.items.map((it) => {
                            return (
                              <tr
                                key={it.id}
                                className="transition hover:bg-gray-50"
                                style={{
                                  borderColor: "#ececec",
                                  borderWidth: "0.2px",
                                }}
                              >
                                <td className="py-4 pl-6 pr-6 text-gray-800 font-semibold">
                                  {it.order}.
                                </td>
                                <td className="py-4 pl-6 pr-6 text-gray-800 font-semibold">
                                  {it.name}
                                </td>
                                <td className="py-4 pr-6 text-gray-700 max-w-[900px] break-words whitespace-pre-wrap">
                                  {it.content}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.avgPoints.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.p.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.q.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.f.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.variance.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {it.discrimination.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                          {overview.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="py-8 text-center text-gray-400"
                              >
                                Brak zadań.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {/* Wykres (uczniowie) */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                      <h3 className="font-bold">Wykres (uczniowie)</h3>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {studentMetric === "percent"
                            ? `Skala: 0–100% (MAX: ${overview.header.totalMax} pkt)`
                            : `Skala: 0–${overview.header.totalMax} pkt`}
                        </div>

                        <div className="relative inline-block">
                          <select
                            className="border border-gray-300 rounded-lg px-3 pr-8 py-1.5 bg-white text-sm focus:outline-none focus:border-teal-400 appearance-none"
                            value={studentMetric}
                            onChange={(e) =>
                              setStudentMetric(e.target.value as StudentMetric)
                            }
                          >
                            <option value="percent">% wyniku</option>
                            <option value="points">Suma punktów</option>
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="grid"
                      style={{ gridTemplateColumns: "8px 1fr" }}
                    >
                      {/* Tytuł osi Y */}
                      <div className="relative h-74">
                        <div className="absolute inset-0 flex items-center justify-center pl-[4px]">
                          <div className="-rotate-90 text-xs text-gray-500 whitespace-nowrap">
                            {yAxisStudents.title}
                          </div>
                        </div>
                      </div>

                      {/* Pudełko wykresu */}
                      <div className="relative h-74 rounded-lg">
                        <div className="absolute inset-x-3 top-3 bottom-6">
                          <div className="relative h-full flex">
                            {/* Wartości osi Y */}
                            <div className="relative w-10 mr-2">
                              {yAxisStudents.ticks.map((t) => {
                                const pct = yAxisStudents.toPct(t);
                                const isZero = Math.abs(pct) < 1e-6;
                                return (
                                  <div
                                    key={String(t)}
                                    className="absolute left-0 text-[10px] leading-[10px] text-gray-400 text-right w-full pr-1 pointer-events-none select-none"
                                    style={
                                      isZero
                                        ? {
                                            bottom: 0,
                                            transform: "translateY(1px)",
                                          }
                                        : { bottom: `calc(${pct}% - 3px)` }
                                    }
                                  >
                                    {yAxisStudents.format(
                                      typeof t === "number" ? t : Number(t)
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Linie + słupki */}
                            <div className="relative flex-1">
                              {yAxisStudents.ticks.map((t) => (
                                <div
                                  key={`g-${String(t)}`}
                                  className="absolute left-0 right-0"
                                  style={{
                                    bottom: `${yAxisStudents.toPct(
                                      typeof t === "number" ? t : Number(t)
                                    )}%`,
                                    borderTop:
                                      yAxisStudents.toPct(
                                        typeof t === "number" ? t : Number(t)
                                      ) === 0
                                        ? "2px solid #e5e7eb"
                                        : "1px dashed #eee",
                                  }}
                                />
                              ))}

                              <div
                                className="relative h-full grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.max(
                                    studentBars.length,
                                    1
                                  )}, minmax(0, 1fr))`,
                                }}
                              >
                                {studentBars.map((b) => (
                                  <div
                                    key={b.lp}
                                    className="flex flex-col items-center justify-end"
                                  >
                                    <div className="relative h-full w-full flex items-end">
                                      <div
                                        className="w-full max-w-[22px] mx-auto bg-teal-400 rounded-t"
                                        style={{
                                          height: `${Math.max(
                                            0,
                                            Math.min(100, b.value)
                                          )}%`,
                                        }}
                                        title={b.tooltip}
                                      />
                                      <div
                                        className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-600"
                                        style={{
                                          bottom: `calc(${Math.max(
                                            0,
                                            Math.min(100, b.value)
                                          )}% + 4px)`,
                                        }}
                                      >
                                        {b.label}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Oś X (Lp.) */}
                        <div className="absolute inset-x-3 bottom-0 h-6 flex">
                          <div className="w-10 mr-2" />
                          <div
                            className="flex-1 grid gap-2 h-full items-start text-center text-[10px] text-gray-500"
                            style={{
                              gridTemplateColumns: `repeat(${Math.max(
                                studentBars.length,
                                1
                              )}, minmax(0, 1fr))`,
                            }}
                          >
                            {studentBars.map((b) => (
                              <div key={b.lp}>{b.lp}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap w-[100%] text-center">
                      Uczniowie (Lp.)
                    </div>
                  </div>

                  {/* Tabela wyników uczniów */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold">Wyniki uczniów</h3>
                      <div className="text-xs text-gray-400">
                        Maks: {overview.header.totalMax} pkt
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6 pr-6">
                              Lp.
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              NR
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              Uczeń
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              Klasa
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              Suma
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              Wynik(%)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.students.map((r, idx) => {
                            const isLast = idx === overview.students.length - 1;
                            return (
                              <tr
                                key={r.studentId}
                                className="transition hover:bg-gray-50"
                                style={{
                                  borderColor: "#ececec",
                                  borderWidth: isLast ? 0 : "0.2px",
                                }}
                              >
                                <td className="py-4 pl-6 pr-6 text-gray-800 font-semibold">
                                  {idx + 1}
                                </td>
                                <td className="py-4 pr-6 text-gray-700">
                                  {r.codeNumber || "-"}
                                </td>
                                <td className="py-4 pr-6 text-gray-800 font-semibold break-words">
                                  {r.firstName} {r.lastName}
                                </td>
                                <td className="py-4 pr-6 text-gray-700">
                                  {r.className || "-"}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {r.total.toFixed(2)}
                                </td>
                                <td className="py-4 pr-6 text-gray-800">
                                  {(r.percent * 100).toFixed(0)}%
                                </td>
                              </tr>
                            );
                          })}
                          {overview.students.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-8 text-center text-gray-400"
                              >
                                Brak uczniów.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Podsumowania testu */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm text-gray-700">
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Średnia</div>
                        <div className="font-semibold">
                          {overview.summary.mean.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Mediana</div>
                        <div className="font-semibold">
                          {overview.summary.median.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Moda</div>
                        <div className="font-semibold">
                          {overview.summary.mode ?? "—"}
                        </div>
                      </div>
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Min / Max</div>
                        <div className="font-semibold">
                          {overview.summary.min.toFixed(2)} /{" "}
                          {overview.summary.max.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Rozstęp</div>
                        <div className="font-semibold">
                          {overview.summary.range.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-[#f7fafc] rounded-lg p-3">
                        <div className="text-xs text-gray-400">Wariancja</div>
                        <div className="font-semibold">
                          {overview.summary.variance.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Results;
