/* src/pages/Results.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";

type School = { id: number; name: string };
type SchoolClass = { id: number; name: string; schoolId: number };
type Session = { id: number; name: string; date: string; templateId: number; template?: { id: number; name: string } };

type ItemStat = {
  id: number;
  order: number;
  description: string;
  minPoints: number;
  maxPoints: number;
  avgPoints: number;
  p: number;  // łatwość
  q: number;  // trudność
  f: number;  // frakcja opuszczeń
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
  header: { testId: number; testName: string; templateName: string; n: number; totalMax: number; pTest: number };
  students: StudentRow[];
  items: ItemStat[];
  summary: {
    mean: number; median: number; mode: number | null;
    min: number; max: number; range: number;
    variance: number; stdDev: number; alpha: number; stdError: number;
  };
};

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
  const [message, setMessage] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

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
          axios.get<School[]>("http://localhost:4000/schools", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get<Session[]>("http://localhost:4000/tests", { headers: { Authorization: `Bearer ${token}` } }),
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
      if (!selectedSchoolId) { setClasses([]); return; }
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
    if (!selectedTestId) { setOverview(null); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("testId", String(selectedTestId));
      if (selectedSchoolId) params.set("schoolId", String(selectedSchoolId));
      if (selectedClassId) params.set("classId", String(selectedClassId));
      const res = await axios.get<Overview>(`http://localhost:4000/results/overview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverview(res.data);
    } catch {
      setOverview(null);
      setMessage({ type: "error", text: "Błąd analizy wyników." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); /* eslint-disable-next-line */ }, [selectedTestId, selectedSchoolId, selectedClassId]);

  // Wygodne etykiety
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedSession = useMemo(() => sessions.find(s => s.id === selectedTestId) || null, [sessions, selectedTestId]);

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full mx-auto">

          {/* Nagłówek */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Results</h2>
          </div>

          {/* Filtr: „Wybierz uczniów” */}
          <div className="text-sm font-semibold text-gray-600 mb-2">Wybierz uczniów</div>

          {/* Filtry zakresu + wybór sesji */}
          <div className="flex gap-3 flex-wrap items-center mb-5">
            {/* Szkoła */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-64 truncate appearance-none"
                value={selectedSchoolId}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedSchoolId(val);
                  setSelectedClassId("");
                  const q = new URLSearchParams(location.search);
                  if (val) q.set("school", String(val)); else q.delete("school");
                  q.delete("class");
                  navigate(`/results?${q.toString()}`);
                }}
              >
                <option value="">Wszystkie szkoły</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </div>

            {/* Klasa */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 truncate"
                value={selectedClassId}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedClassId(val);
                  const q = new URLSearchParams(location.search);
                  if (val && selectedSchoolId) q.set("class", String(val)); else q.delete("class");
                  if (selectedSchoolId) q.set("school", String(selectedSchoolId));
                  navigate(`/results?${q.toString()}`);
                }}
                disabled={!selectedSchoolId}
              >
                <option value="">Wszystkie klasy</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </div>

            {/* Sesja */}
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-[320px] truncate appearance-none"
                value={selectedTestId}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : "";
                  setSelectedTestId(val);
                  const q = new URLSearchParams(location.search);
                  if (val) q.set("test", String(val)); else q.delete("test");
                  if (selectedSchoolId) q.set("school", String(selectedSchoolId));
                  if (selectedClassId) q.set("class", String(selectedClassId));
                  navigate(`/results?${q.toString()}`);
                }}
              >
                <option value="">— wybierz sesję —</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.template?.name ?? "?"} — {new Date(s.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </div>
          </div>

          {message && (
            <div className={`mb-4 text-center font-medium text-sm rounded-lg py-2 px-4 ${
              message.type === "error" ? "text-red-600 bg-red-50"
              : message.type === "success" ? "text-teal-600 bg-teal-50"
              : "text-gray-600 bg-gray-100"}`}>
              {message.text}
            </div>
          )}

          {/* Główna treść */}
          {loading ? (
            <div className="text-gray-500">Ładowanie analizy…</div>
          ) : !selectedTestId ? (
            <div className="text-gray-500">Wybierz sesję, aby zobaczyć wyniki.</div>
          ) : !overview ? (
            <div className="text-gray-500">Brak danych do wyświetlenia.</div>
          ) : (
            <>
              {/* KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Sesja</div>
                  <div className="font-semibold">{overview.header.testName}</div>
                  <div className="text-xs text-gray-400">{overview.header.templateName}</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Uczniów (n)</div>
                  <div className="font-semibold">{overview.header.n}</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Łatwość testu (p)</div>
                  <div className="font-semibold">{(overview.header.pTest * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">α Cronbacha</div>
                  <div className="font-semibold">{overview.summary.alpha.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="text-xs text-gray-400">Odch. std. / Błąd std.</div>
                  <div className="font-semibold">
                    {overview.summary.stdDev.toFixed(2)} / {overview.summary.stdError.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Analiza zadań */}
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">Analiza zadań</h3>
                    <div className="text-xs text-gray-400">p – łatwość, q – trudność, f – opuszczenia</div>
                  </div>

                  {/* „Wykres” – słupki p dla każdego zadania */}
                  <div className="space-y-2 mb-4 max-h-[34vh] overflow-y-auto pr-1">
                    {overview.items.map(it => (
                      <div key={it.id} className="flex items-center gap-3">
                        <div className="text-xs text-gray-500 w-14 shrink-0">Zad. {it.order}</div>
                        <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                          <div className="h-3 bg-teal-400" style={{ width: `${Math.max(0, Math.min(100, it.p*100))}%` }} />
                        </div>
                        <div className="w-28 text-xs text-gray-600 shrink-0">
                          p {(it.p*100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tabela jak na innych stronach */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">ZAD.</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">OPIS</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">ŚR.PKT</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">p</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">q</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">f</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">VAR</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">MOC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.items.map((it, idx) => (
                          <tr key={it.id}
                              className={`${idx !== overview.items.length - 1 ? "border-b" : ""}`}
                              style={{ borderColor: "#ececec", borderWidth: idx !== overview.items.length - 1 ? "0.2px" : 0 }}>
                            <td className="py-4 pl-6 text-gray-800 font-semibold"> {it.order} </td>
                            <td className="py-4 pr-3 text-gray-700 max-w-[420px] break-words whitespace-pre-wrap">{it.description}</td>
                            <td className="py-4 text-gray-800">{it.avgPoints.toFixed(2)}</td>
                            <td className="py-4 text-gray-800">{it.p.toFixed(2)}</td>
                            <td className="py-4 text-gray-800">{it.q.toFixed(2)}</td>
                            <td className="py-4 text-gray-800">{it.f.toFixed(2)}</td>
                            <td className="py-4 text-gray-800">{it.variance.toFixed(2)}</td>
                            <td className="py-4 pr-6 text-gray-800">{it.discrimination.toFixed(2)}</td>
                          </tr>
                        ))}
                        {overview.items.length === 0 && (
                          <tr><td colSpan={8} className="py-8 text-center text-gray-400">Brak zadań.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Wyniki uczniów */}
                <div className="bg-white rounded-xl shadow-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">Wyniki uczniów</h3>
                    <div className="text-xs text-gray-400">Maks: {overview.header.totalMax} pkt</div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">Uczeń</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">Klasa</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">Suma pkt</th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pr-6">% wyniku</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.students.map((r, idx) => (
                          <tr key={r.studentId}
                              className={`${idx !== overview.students.length - 1 ? "border-b" : ""}`}
                              style={{ borderColor: "#ececec", borderWidth: idx !== overview.students.length - 1 ? "0.2px" : 0 }}>
                            <td className="py-4 pl-6 text-gray-800 font-semibold break-words">{r.firstName} {r.lastName}</td>
                            <td className="py-4 text-gray-700">{r.className || "-"}</td>
                            <td className="py-4 text-gray-800">{r.total.toFixed(2)}</td>
                            <td className="py-4 pr-6 text-gray-800">{(r.percent * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                        {overview.students.length === 0 && (
                          <tr><td colSpan={4} className="py-8 text-center text-gray-400">Brak uczniów.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Podsumowania testu */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm text-gray-700">
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Średnia</div>
                      <div className="font-semibold">{overview.summary.mean.toFixed(2)}</div>
                    </div>
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Mediana</div>
                      <div className="font-semibold">{overview.summary.median.toFixed(2)}</div>
                    </div>
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Moda</div>
                      <div className="font-semibold">{overview.summary.mode ?? "—"}</div>
                    </div>
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Min / Max</div>
                      <div className="font-semibold">
                        {overview.summary.min.toFixed(2)} / {overview.summary.max.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Rozstęp</div>
                      <div className="font-semibold">{overview.summary.range.toFixed(2)}</div>
                    </div>
                    <div className="bg-[#f7fafc] rounded-lg p-3">
                      <div className="text-xs text-gray-400">Wariancja</div>
                      <div className="font-semibold">{overview.summary.variance.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Results;
