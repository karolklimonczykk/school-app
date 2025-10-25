/* src/pages/Results.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";

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
  description: string;
  minPoints: number;
  maxPoints: number;
  avgPoints: number;
  p: number; // łatwość
  q: number; // trudność
  f: number; // frakcja opuszczeń
  variance: number;
  discrimination: number;
};

type StudentRow = {
  studentId: number;
  firstName: string;
  lastName: string;
  className: string;
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

type TaskMetric = "p" | "q" | "f" | "variance" | "discrimination";
type StudentMetric = "percent" | "points";

// Legendy/metadane do opisów metryk
const metricLegend: Record<TaskMetric, string> = {
  p: "Współczynnik łatwości (p)",
  q: "Trudność (q)",
  f: "Frakcja opuszczeń (f)",
  variance: "Wariancja (wykres: znormalizowana do 0–100%)",
  discrimination:
    "Moc różnicująca (wykres: znormalizowana do 0–100%)",
};
// Konfiguracja osi Y dla wykresu zadań

const fmt2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

const Results: React.FC = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();

  // Filtry
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [selectedTestId, setSelectedTestId] = useState<number | "">("");

  // Dane analityczne
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Zakładki na stronie
  const [tab, setTab] = useState<"tasks" | "students">("tasks");
  const [taskMetric, setTaskMetric] = useState<TaskMetric>("p");
  const [studentMetric, setStudentMetric] = useState<StudentMetric>("percent");

  // --- OŚ Y dla wykresu zadań (zależna od taskMetric) ---
  const yAxisTasks = useMemo(() => {
    if (["p", "q", "f"].includes(taskMetric)) {
      return {
        ticks: [0, 0.25, 0.5, 0.75, 1],
        toPct: (v: number) => v * 100, // pozycjonowanie linii/etykiet w %
        format: (v: number) => v.toFixed(2), // opis przy liniach
        title: metricLegend[taskMetric],
      };
    }
    // metryki normalizowane do 0–100%
    return {
      ticks: [0, 25, 50, 75, 100],
      toPct: (v: number) => v,
      format: (v: number) => `${v}%`,
      title: metricLegend[taskMetric],
    };
  }, [taskMetric]);

  // --- OŚ Y dla wykresu uczniów (zależna od trybu + MAX pkt) ---
  const yAxisStudents = useMemo(() => {
    const max = overview?.header.totalMax ?? 0;
    if (!overview || max <= 0 || studentMetric === "percent") {
      return {
        ticks: [0, 25, 50, 75, 100],
        toPct: (v: number) => v, // 0..100
        format: (v: number) => `${v}%`,
        title: "Procent wyniku [%]",
      };
    }
    // tryb punktowy: 0..MAX pkt, pięć równych podziałek
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
    setSelectedSchoolId(s ? Number(s) : "");
    setSelectedClassId(c ? Number(c) : "");
    setSelectedTestId(t ? Number(t) : "");
  }, [location.search]);

  // Szkoły + sesje (bez filtrowania)
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
        setMessage({ type: "error", text: "Błąd pobierania szkół/sesji." });
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
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId]);

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
      const res = await axios.get<Overview>(
        `http://localhost:4000/results/overview?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOverview(res.data);
    } catch {
      setOverview(null);
      setMessage({ type: "error", text: "Błąd analizy wyników." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(); /* eslint-disable-next-line */
  }, [selectedTestId, selectedSchoolId, selectedClassId]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedTestId) || null,
    [sessions, selectedTestId]
  );

  // Normalizacja do wykresu słupkowego (0..100%)
  const taskBars = useMemo(() => {
    if (!overview) return [];
    if (overview.items.length === 0) return [];

    if (taskMetric === "variance") {
      const maxVar = Math.max(
        ...overview.items.map((i) => i.variance),
        0.00001
      );
      return overview.items.map((i) => ({
        id: i.id,
        order: i.order,
        value: (i.variance / maxVar) * 100,
        raw: i.variance,
        label: i.order,
      }));
    }
    if (taskMetric === "discrimination") {
      // mapowanie [-1..1] -> [0..1]
      return overview.items.map((i) => ({
        id: i.id,
        order: i.order,
        value: ((i.discrimination + 1) / 2) * 100,
        raw: i.discrimination,
        label: i.order,
      }));
    }
    const pick = (i: ItemStat) =>
      taskMetric === "p" ? i.p : taskMetric === "q" ? i.q : i.f;
    return overview.items.map((i) => ({
      id: i.id,
      order: i.order,
      value: Math.max(0, Math.min(100, pick(i) * 100)),
      raw: pick(i),
      label: i.order,
    }));
  }, [overview, taskMetric]);

  const studentBars = useMemo(() => {
    if (!overview) return [];
    const max = overview.header.totalMax || 1;

    if (studentMetric === "percent") {
      return overview.students.map((s, idx) => ({
        lp: idx + 1,
        value: (s.total / max) * 100, // wysokość w %
        raw: (s.total / max) * 100, // wartość do etykiety
        label: `${Math.round((s.total / max) * 100)}%`,
        tooltip: `Lp. ${idx + 1}: ${s.total.toFixed(2)} pkt (${(
          (s.total / max) *
          100
        ).toFixed(0)}%)`,
      }));
    }

    // tryb punktowy
    return overview.students.map((s, idx) => ({
      lp: idx + 1,
      value: (s.total / max) * 100, // wysokość nadal w %
      raw: s.total, // wartość do etykiety
      label: s.total % 1 === 0 ? `${s.total}` : s.total.toFixed(2),
      tooltip: `Lp. ${idx + 1}: ${s.total.toFixed(2)} pkt`,
    }));
  }, [overview, studentMetric]);

  // Eksport CSV (jednym plikiem; sekcja STUDENTS i ITEMS)
  const exportCSV = () => {
    if (!overview) return;

    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const head = [
      ["Session", overview.header.testName],
      ["Template", overview.header.templateName],
      ["Students (n)", overview.header.n],
      ["Total max points", overview.header.totalMax],
      ["Test easiness (p)", overview.header.pTest.toFixed(4)],
      ["Mean", overview.summary.mean.toFixed(4)],
      ["Median", overview.summary.median.toFixed(4)],
      ["Mode", overview.summary.mode ?? ""],
      ["Min", overview.summary.min.toFixed(4)],
      ["Max", overview.summary.max.toFixed(4)],
      ["Range", overview.summary.range.toFixed(4)],
      ["Variance", overview.summary.variance.toFixed(4)],
      ["StdDev", overview.summary.stdDev.toFixed(4)],
      ["Cronbach alpha", overview.summary.alpha.toFixed(4)],
      ["Std error", overview.summary.stdError.toFixed(4)],
    ]
      .map((row) => row.map(esc).join(";"))
      .join("\n");

    const studentsPart = [
      "",
      "STUDENTS",
      ["Lp.", "First name", "Last name", "Class", "Total", "Percent"].join(";"),
      ...overview.students.map((s, i) =>
        [
          i + 1,
          s.firstName,
          s.lastName,
          s.className,
          s.total.toFixed(2),
          (s.percent * 100).toFixed(2) + "%",
        ]
          .map(esc)
          .join(";")
      ),
    ].join("\n");

    const itemsPart = [
      "",
      "ITEMS",
      [
        "Order",
        "Description",
        "Min",
        "Max",
        "Avg points",
        "p",
        "q",
        "f",
        "Variance",
        "Discrimination",
      ].join(";"),
      ...overview.items.map((it) =>
        [
          it.order,
          it.description,
          it.minPoints,
          it.maxPoints,
          it.avgPoints.toFixed(4),
          it.p.toFixed(4),
          it.q.toFixed(4),
          it.f.toFixed(4),
          it.variance.toFixed(4),
          it.discrimination.toFixed(4),
        ]
          .map(esc)
          .join(";")
      ),
    ].join("\n");

    const csv = head + "\n" + studentsPart + "\n" + itemsPart + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (overview.header.testName || "results").replace(
      /[^\w\d-_]+/g,
      "_"
    );
    a.href = url;
    a.download = `${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full mx-auto">
          {/* Nagłówek */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Wyniki i analiza testów</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                disabled={!overview}
                className="bg-teal-400 hover:bg-teal-300 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                Eksport CSV
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

          {message && (
            <div
              className={`mb-4 text-center font-medium text-sm rounded-lg py-2 px-4 ${
                message.type === "error"
                  ? "text-red-600 bg-red-50"
                  : message.type === "success"
                  ? "text-teal-600 bg-teal-50"
                  : "text-gray-600 bg-gray-100"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* KPI */}
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
                  <div className="text-xs text-gray-400">Rzetelność testu α Cronbacha</div>
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

              {/* Zakładki strony */}
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

              {/* Zawartość zakładek – pełna szerokość */}
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
                            <option value="variance">Wariancja (norm.)</option>
                            <option value="discrimination">
                              Moc różnicująca (norm.)
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

                    {/* Siatka: [kolumna tytułu Y | pudełko wykresu] */}
                    <div
                      className="grid gap-x-3"
                      style={{ gridTemplateColumns: "56px 1fr" }}
                    >
                      {/* Tytuł osi Y (bez obramowania) */}
                      <div className="relative h-64">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                          <div className="-rotate-90 text-xs text-gray-500 whitespace-nowrap">
                            {yAxisTasks.title}
                          </div>
                        </div>
                      </div>

                      {/* Pudełko wykresu */}
                      <div className="relative h-64 border border-gray-100 rounded-lg">
                        {/* Obszar roboczy: padding + rezerwa 24px na X-etykiety */}
                        <div className="absolute inset-x-3 top-3 bottom-6">
                          <div className="relative h-full flex">
                            {/* Kolumna wartości Y – ta sama wysokość co linie i słupki */}
                            <div className="relative w-10 mr-2">
                              {yAxisTasks.ticks.map((t, i) => {
                                const pct = yAxisTasks.toPct(t); // 0..100
                                const isZero = Math.abs(pct) < 1e-6; // 0%
                                return (
                                  <div
                                    key={i}
                                    className="absolute left-0 text-[10px] leading-[10px] text-gray-400 text-right w-full pr-1 pointer-events-none select-none"
                                    style={
                                      isZero
                                        ? // 0.00 stoi NA linii bazowej
                                          {
                                            bottom: 0,
                                            transform: "translateY(1px)",
                                          }
                                        : // pozostałe ticki – środek etykiety dokładnie na linii
                                          { bottom: `calc(${pct}% - 3px)` }
                                    }
                                  >
                                    {yAxisTasks.format(t as number)}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Warstwa linii + słupki */}
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

                              {/* Słupki */}
                              <div
                                className="relative h-full grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.max(
                                    taskBars.length,
                                    1
                                  )}, minmax(0, 1fr))`,
                                }}
                              >
                                {taskBars.map((b) => (
                                  <div
                                    key={b.id}
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
                                        title={`Zad. ${b.label}: ${fmt2(
                                          Number(b.raw)
                                        )}`}
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
                                        {fmt2(Number(b.raw))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Etykiety X – w obrębie pudełka, wyrównane z siatką słupków */}
                        <div className="absolute inset-x-3 bottom-0 h-6 flex">
                          {/* „pusta” kolumna o szerokości kolumny Y (w-10 mr-2), żeby Z1 nie wchodziło pod wartości Y */}
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
                              <div key={b.id}>Z{b.label}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabela analizy zadań */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold">Analiza zadań</h3>
                      <div className="text-xs text-gray-400">
                        p – łatwość, q – trudność, f – opuszczenia
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                              ZAD.
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              OPIS
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              ŚR.PKT
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              p
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              q
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              f
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              VAR
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              MOC
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.items.map((it, idx) => (
                            <tr
                              key={it.id}
                              className={`${
                                idx !== overview.items.length - 1
                                  ? "border-b"
                                  : ""
                              }`}
                              style={{
                                borderColor: "#ececec",
                                borderWidth:
                                  idx !== overview.items.length - 1
                                    ? "0.2px"
                                    : 0,
                              }}
                            >
                              <td className="py-4 pl-6 text-gray-800 font-semibold">
                                {" "}
                                {it.order}{" "}
                              </td>
                              <td className="py-4 pr-3 text-gray-700 max-w-[900px] break-words whitespace-pre-wrap">
                                {it.description}
                              </td>
                              <td className="py-4 text-gray-800">
                                {it.avgPoints.toFixed(2)}
                              </td>
                              <td className="py-4 text-gray-800">
                                {it.p.toFixed(2)}
                              </td>
                              <td className="py-4 text-gray-800">
                                {it.q.toFixed(2)}
                              </td>
                              <td className="py-4 text-gray-800">
                                {it.f.toFixed(2)}
                              </td>
                              <td className="py-4 text-gray-800">
                                {it.variance.toFixed(2)}
                              </td>
                              <td className="py-4 pr-6 text-gray-800">
                                {it.discrimination.toFixed(2)}
                              </td>
                            </tr>
                          ))}
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
                  {/* Wykres (uczniowie wg Lp.) */}
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                      <h3 className="font-bold">Wykres (uczniowie wg Lp.)</h3>

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
                      className="grid gap-x-3"
                      style={{ gridTemplateColumns: "56px 1fr" }}
                    >
                      {/* Tytuł osi Y */}
                      <div className="relative h-64">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                          <div className="-rotate-90 text-xs whitespace-nowrap">
                            {yAxisStudents.title}
                          </div>
                        </div>
                      </div>

                      {/* Pudełko wykresu */}
                      <div className="relative h-64 border border-gray-100 rounded-lg">
                        {/* Obszar roboczy (rezerwa na X-etykiety) */}
                        <div className="absolute inset-x-3 top-3 bottom-6">
                          <div className="relative h-full flex">
                            {/* Wartości osi Y – idealnie na liniach (ten sam fix co wcześniej) */}
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
                                        : { bottom: `calc(${pct}% - 5px)` }
                                    }
                                  >
                                    {yAxisStudents.format(
                                      typeof t === "number" ? t : Number(t)
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Linie pomocnicze + słupki */}
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
                                        ? "1px solid #e5e7eb"
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
                                        className="w-full max-w-[22px] mx-auto bg-[#222B45] rounded-t"
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
                        {/* Oś X (Lp.) – wyrównana do słupków: lewy spacer = szerokość osi Y */}
                        <div className="absolute inset-x-3 bottom-0 h-6 flex">
                          {/* lewy spacer = tyle, co kolumna z wartościami osi Y (w-10 mr-2) */}
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
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                              Lp.
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              Uczeń
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              Klasa
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                              Suma pkt
                            </th>
                            <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">
                              % wyniku
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.students.map((r, idx) => (
                            <tr
                              key={r.studentId}
                              className={`${
                                idx !== overview.students.length - 1
                                  ? "border-b"
                                  : ""
                              }`}
                              style={{
                                borderColor: "#ececec",
                                borderWidth:
                                  idx !== overview.students.length - 1
                                    ? "0.2px"
                                    : 0,
                              }}
                            >
                              <td className="py-4 pl-6 text-gray-800 font-semibold">
                                {idx + 1}
                              </td>
                              <td className="py-4 text-gray-800 font-semibold break-words">
                                {r.firstName} {r.lastName}
                              </td>
                              <td className="py-4 text-gray-700">
                                {r.className || "-"}
                              </td>
                              <td className="py-4 text-gray-800">
                                {r.total.toFixed(2)}
                              </td>
                              <td className="py-4 pr-6 text-gray-800">
                                {(r.percent * 100).toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                          {overview.students.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
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
