/* src/pages/Tests.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

type School = { id: number; name: string };
type SchoolClass = { id: number; name: string; schoolId: number };
type Student = {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  order: number;
  classId: number;
  class?: { id: number; name: string; school: School };
};
type Template = { id: number; name: string };
type Task = {
  id: number;
  description: string;
  order: number;
  minPoints: number;
  maxPoints: number;
  points: number | null;
  allowHalfPoints: boolean;
};
type TestSession = {
  id: number;
  name: string;
  date: string;
  templateId: number;
  template?: { id: number; name: string };
};

const Tests: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const { push } = useToast();

  // —— Filtry i dane bazowe
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");

  // —— Sesja testu
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [sessionName, setSessionName] = useState<string>("Test session");
  const [testId, setTestId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [totalTasks, setTotalTasks] = useState<number>(0);

  // —— Edycja wyników
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskErrors, setTaskErrors] = useState<Record<number, string | null>>(
    {}
  );
  const [saving, setSaving] = useState(false);

  // —— Progress
  const [progress, setProgress] = useState<Record<number, number>>({}); // studentId -> liczba wypełnionych zadań

  // —— Modal zarządzania sesją
  const [showSessionModal, setShowSessionModal] = useState<boolean>(true);
  const [sessionTab, setSessionTab] = useState<"load" | "new">("load");
  const [selectedLoadId, setSelectedLoadId] = useState<number | "">("");

  // —— Edycja nazwy wiersza
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");

  // —— Walidacja duplikatów
  const duplicateName = React.useMemo(() => {
    if (!templateId || !sessionName.trim()) return false;
    const target = sessionName.trim().toLowerCase();
    return sessions.some(
      (s) =>
        s.templateId === templateId &&
        (s.name || "").trim().toLowerCase() === target
    );
  }, [sessions, templateId, sessionName]);

  // —— Duplikaty przy zmianie nazwy (w obrębie szablonu)
  const isDuplicateRename = (id: number, name: string) => {
    const base = name.trim().toLowerCase();
    const current = sessions.find((s) => s.id === id);
    if (!current || !base) return false;
    return sessions.some(
      (s) =>
        s.id !== id &&
        s.templateId === current.templateId &&
        (s.name || "").trim().toLowerCase() === base
    );
  };

  // Prefiltry z URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const schoolQuery = params.get("school");
    const classQuery = params.get("class");
    setSelectedSchoolId(schoolQuery ? Number(schoolQuery) : "");
    setSelectedClassId(classQuery ? Number(classQuery) : "");
  }, [location.search]);

  // Szkóły + szablony
  useEffect(() => {
    const fetchBase = async () => {
      try {
        const [schRes, tplRes] = await Promise.all([
          axios.get<School[]>("http://localhost:4000/schools", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get<any[]>("http://localhost:4000/test-templates", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setSchools(schRes.data);
        setTemplates(
          (tplRes.data || []).map((t: any) => ({ id: t.id, name: t.name }))
        );
      } catch {
        push({ type: "error", message: "Błąd ładowania szkół/szablonów." });
      }
    };
    fetchBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Klasy dla wybranej szkoły
  useEffect(() => {
    const run = async () => {
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
        push({ type: "error", message: "Błąd pobierania klas." });
        setClasses([]);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId]);

  // LISTA SESJI (do wczytywania)
  const fetchSessions = async () => {
    try {
      const res = await axios.get<TestSession[]>(
        "http://localhost:4000/tests",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSessions(res.data || []);
      setEditId(null);
      setEditName("");
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    if (showSessionModal) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSessionModal]);

  // UCZNIOWIE – po zamknięciu modala i posiadaniu testId
  useEffect(() => {
    const run = async () => {
      if (showSessionModal || !testId) return;
      try {
        if (selectedSchoolId && !selectedClassId) {
          const all = await axios.get<Student[]>(
            "http://localhost:4000/students",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setStudents(
            all.data.filter(
              (s) =>
                s.class &&
                s.class.school &&
                s.class.school.id === selectedSchoolId
            )
          );
        } else if (selectedSchoolId && selectedClassId) {
          const res = await axios.get<Student[]>(
            `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setStudents(res.data);
        } else {
          const res = await axios.get<Student[]>(
            "http://localhost:4000/students",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setStudents(res.data);
        }
      } catch {
        push({ type: "error", message: "Błąd pobierania uczniów." });
        setStudents([]);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showSessionModal,
    testId,
    selectedSchoolId,
    selectedClassId,
    schools.length,
  ]);

  // PROGRESS
  useEffect(() => {
    const fetchProgress = async () => {
      if (showSessionModal || !testId) return;
      try {
        const params = new URLSearchParams();
        if (selectedSchoolId) params.set("schoolId", String(selectedSchoolId));
        if (selectedClassId) params.set("classId", String(selectedClassId));
        const res = await axios.get<Record<number, number>>(
          `http://localhost:4000/tests/${testId}/progress?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setProgress(res.data || {});
      } catch {
        /* ignore */
      }
    };
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showSessionModal,
    testId,
    selectedSchoolId,
    selectedClassId,
    students.length,
  ]);

  // LICZBA ZADAŃ dla aktywnej sesji
  const fetchTasksCount = async (tplId: number) => {
    try {
      const res = await axios.get<any[]>(
        `http://localhost:4000/tests/test-templates/${tplId}/tasks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTotalTasks(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      setTotalTasks(0);
    }
  };

  // —— Operacje na sesji
  const handleCreate = async () => {
    if (!templateId || !sessionName.trim()) {
      push({ type: "error", message: "Wybierz szablon i wpisz nazwę." });
      return;
    }
    if (duplicateName) {
      push({
        type: "error",
        message: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
      });
      return;
    }
    try {
      const res = await axios.post(
        `http://localhost:4000/tests`,
        {
          templateId,
          name: sessionName.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestId(res.data.id);
      setShowSessionModal(false);
      setSessionName(res.data.name);
      await fetchTasksCount(res.data.templateId);
      push({ type: "success", message: "Utworzono sesję." });
    } catch (err: any) {
      const msg =
        err?.response?.status === 409
          ? "Sesja o tej nazwie i dla tego szablonu już istnieje."
          : "Nie udało się utworzyć sesji.";
      push({ type: "error", message: msg });
    }
  };

  const handleLoad = async () => {
    if (!selectedLoadId) return;
    const s = sessions.find((x) => x.id === selectedLoadId);
    if (!s) return;
    setTestId(s.id);
    setShowSessionModal(false);
    setSessionName(s.name);
    setTemplateId(s.templateId);
    await fetchTasksCount(s.templateId);
    push({ type: "success", message: "Wczytano sesję." });
  };

  const handleRename = async (id: number, newName: string) => {
    const label = newName.trim();
    if (!label) return;
    try {
      const res = await axios.put(
        `http://localhost:4000/tests/${id}`,
        { name: label },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: res.data.name } : s))
      );
      if (testId === id) setSessionName(res.data.name);
      push({ type: "success", message: "Zmieniono nazwę sesji." });
    } catch (err: any) {
      const msg =
        err?.response?.status === 409
          ? "Sesja o tej nazwie i dla tego szablonu już istnieje."
          : "Nie udało się zmienić nazwy.";
      push({ type: "error", message: msg });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Usunąć tę sesję wraz z jej wynikami?")) return;
    try {
      await axios.delete(`http://localhost:4000/tests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedLoadId === id) setSelectedLoadId("");
      if (testId === id) {
        setTestId(null);
        setTasks([]);
        setProgress({});
        setCurrentStudentId(null);
        setShowSessionModal(true);
      }
      push({ type: "success", message: "Usunięto sesję." });
    } catch {
      push({ type: "error", message: "Nie udało się usunąć sesji." });
    }
  };

  // —— Edycja wiersza
  const handleStartEdit = (s: TestSession) => {
    setEditId(s.id);
    setEditName(s.name);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const handleSaveEdit = async (id: number) => {
    const draft = editName.trim();
    if (!draft) return;
    if (isDuplicateRename(id, draft)) {
      push({
        type: "error",
        message: "Sesja o tej nazwie i dla tego szablonu już istnieje.",
      });
      return;
    }
    await handleRename(id, draft);
    handleCancelEdit();
  };

  // —— Wyniki bieżącego ucznia
  const selectStudent = async (studentId: number) => {
    if (!testId) {
      push({ type: "error", message: "Najpierw wybierz/utwórz sesję." });
      return;
    }
    try {
      const res = await axios.get<{ tasks: Task[] }>(
        `http://localhost:4000/tests/${testId}/students/${studentId}/results`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(res.data.tasks);
      setCurrentStudentId(studentId);
      if (!totalTasks && res.data.tasks?.length)
        setTotalTasks(res.data.tasks.length);
      setTaskErrors({});
    } catch {
      push({ type: "error", message: "Błąd pobierania zadań/wyników." });
    }
  };

  // Walidacja punktów per-zadanie (połówki vs całkowite) + zakres
  const normalizeForTask = (raw: string, halves: boolean): number | null => {
    if (raw.trim() === "") return null;
    const cleaned = raw.replace(",", ".").trim();
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return NaN as unknown as number;
    const val = Number(cleaned);
    if (!Number.isFinite(val)) return NaN as unknown as number;

    if (halves) {
      const isHalf = Math.abs(val * 2 - Math.round(val * 2)) < 1e-9;
      return isHalf ? val : (NaN as unknown as number);
    }
    return Number.isInteger(val) ? val : (NaN as unknown as number);
  };

  const setTaskPoints = (task: Task, raw: string) => {
    const val = normalizeForTask(raw, task.allowHalfPoints);
    let err: string | null = null;

    if (val === null) {
      // puste dozwolone -> ustawiamy null
      setTasks((prev) =>
        prev.map((p) => (p.id === task.id ? { ...p, points: null } : p))
      );
      setTaskErrors((prev) => ({ ...prev, [task.id]: null }));
      return;
    } else if (Number.isNaN(val)) {
      err = task.allowHalfPoints
        ? "Dozwolone wartości co 0.5."
        : "Dozwolone tylko liczby całkowite.";
    } else if (val < task.minPoints || val > task.maxPoints) {
      err = `Zakres ${task.minPoints}–${task.maxPoints}.`;
    }

    setTasks((prev) =>
      prev.map((p) =>
        p.id === task.id
          ? { ...p, points: Number.isNaN(val) ? p.points : val }
          : p
      )
    );
    setTaskErrors((prev) => ({ ...prev, [task.id]: err }));
  };

  const saveCurrent = async (goNext = false) => {
    if (!testId || !currentStudentId) return;
    if (Object.values(taskErrors).some(Boolean)) {
      push({ type: "error", message: "Popraw zaznaczone pola z punktami." });
      return;
    }
    setSaving(true);
    try {
      const results = tasks.map((t) => ({
        taskId: t.id,
        points:
          t.points === null || t.points === undefined ? null : Number(t.points),
      }));
      await axios.put(
        `http://localhost:4000/tests/${testId}/students/${currentStudentId}/results`,
        { results },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      push({ type: "success", message: "Zapisano." });

      const params = new URLSearchParams();
      if (selectedSchoolId) params.set("schoolId", String(selectedSchoolId));
      if (selectedClassId) params.set("classId", String(selectedClassId));
      const pr = await axios.get<Record<number, number>>(
        `http://localhost:4000/tests/${testId}/progress?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgress(pr.data || {});

      if (goNext) {
        const idx = students.findIndex((s) => s.id === currentStudentId);
        const next =
          idx >= 0 && idx + 1 < students.length ? students[idx + 1].id : null;
        if (next) selectStudent(next);
      }
    } catch (e: any) {
      push({
        type: "error",
        message: e?.response?.data?.error || "Błąd zapisu.",
      });
    } finally {
      setSaving(false);
    }
  };

  // UX: Enter -> następne pole
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = inputsRef.current[index + 1];
      if (next) next.focus();
    }
  };

  const currentSchoolName = selectedSchoolId
    ? schools.find((s) => s.id === selectedSchoolId)?.name ?? ""
    : "Wszystkie szkoły";
  const currentClassName = selectedClassId
    ? classes.find((c) => c.id === selectedClassId)?.name ?? ""
    : "Wszystkie klasy";

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full mx-auto">
          {/* Pasek nagłówka */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">
              Twoje sesje testów
            </h2>
            <button
              onClick={() => setShowSessionModal(true)}
              className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              Zmień/dodaj sesję
            </button>
          </div>

          {/* Wybierz uczniów – nad filtrami */}
          <div className="text-sm font-semibold text-gray-600 mb-2">
            Wybierz uczniów
          </div>

          {/* Filtry zakresu */}
          <div className="flex gap-3 flex-wrap items-center mb-5">
            <div className="relative inline-block">
              <select
                className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 block w-64 md:w-80 truncate appearance-none"
                value={selectedSchoolId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedSchoolId(value ? Number(value) : "");
                  setSelectedClassId("");
                  if (value) navigate(`/tests?school=${value}`);
                  else navigate("/tests");
                }}
                title={currentSchoolName}
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

            <div className="relative inline-block">
              <select
                className="appearance-none border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 truncate"
                value={selectedClassId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedClassId(value ? Number(value) : "");
                  if (value && selectedSchoolId)
                    navigate(
                      `/tests?school=${selectedSchoolId}&class=${value}`
                    );
                  else if (selectedSchoolId)
                    navigate(`/tests?school=${selectedSchoolId}`);
                  else navigate("/tests");
                }}
                title={currentClassName}
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
          </div>

          {/* 2-kolumnowy layout: uczniowie + panel ocen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LEWA: uczniowie */}
            <div className="bg-white rounded-xl shadow-md p-4">
              <h3 className="font-bold mb-3">Uczniowie</h3>
              {!testId || showSessionModal ? (
                <div className="text-gray-400 text-sm">
                  Najpierw wybierz lub utwórz sesję.
                </div>
              ) : students.length === 0 ? (
                <div className="text-gray-400 text-sm">
                  Brak uczniów do wyświetlenia.
                </div>
              ) : (
                <ul className="flex flex-col gap-2 overflow-y-auto max-h-[63vh]">
                  {students.map((s) => {
                    const done = progress[s.id] || 0;
                    return (
                      <li key={s.id}>
                        <button
                          className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between
                            ${
                              currentStudentId === s.id
                                ? "bg-teal-50 text-teal-600"
                                : "hover:bg-gray-50"
                            }
                          `}
                          onClick={() => selectStudent(s.id)}
                        >
                          <span className="font-medium">
                            {s.firstName} {s.lastName}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              done > 0
                                ? "bg-teal-100 text-teal-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {done} / {totalTasks || "?"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* PRAWA: panel z zadaniami */}
            <div className="md:col-span-2 bg-white rounded-xl shadow-md p-6">
              {!testId || showSessionModal ? (
                <div className="text-gray-500">
                  Wybierz lub utwórz sesję („Zmień/dodaj sesję”).
                </div>
              ) : !currentStudentId ? (
                <div className="text-gray-500">
                  Wybierz ucznia z listy po lewej.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">
                      Wyniki —{" "}
                      {
                        students.find((s) => s.id === currentStudentId)
                          ?.firstName
                      }{" "}
                      {
                        students.find((s) => s.id === currentStudentId)
                          ?.lastName
                      }
                    </h3>
                    <div className="text-sm text-gray-500">
                      Sesja:{" "}
                      <span className="font-semibold">{sessionName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[53vh]">
                    {tasks.map((t, idx) => {
                      const err = taskErrors[t.id];
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 bg-[#f7fafc] rounded-lg px-4 py-3"
                        >
                          <div className="min-w-[72px] font-bold mt-1">
                            Zad. {t.order}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium break-words whitespace-pre-wrap">
                              {t.description}
                            </div>
                            <div className="text-xs text-gray-400">
                              ({t.minPoints}–{t.maxPoints} pkt, krok{" "}
                              {t.allowHalfPoints ? "0.5" : "1"})
                            </div>
                          </div>
                          <div className="w-32">
                            <label className="block text-xs mb-1">Punkty</label>
                            <input
                              type="number"
                              step={t.allowHalfPoints ? 0.5 : 1}
                              min={t.minPoints}
                              max={t.maxPoints}
                              placeholder={
                                t.allowHalfPoints ? "np. 3 lub 3,5" : "np. 3"
                              }
                              value={t.points ?? ""}
                              onChange={(e) => setTaskPoints(t, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx)}
                              ref={(el) => {
                                inputsRef.current[idx] = el;
                              }}
                              className={`border rounded-lg px-3 py-2 w-full focus:outline-none ${
                                err
                                  ? "border-red-400 focus:border-red-500"
                                  : "border-gray-300 focus:border-teal-400"
                              }`}
                            />
                            {err && (
                              <div className="text-[11px] text-red-600 mt-1">
                                {err}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 justify-end mt-5">
                    <button
                      className="text-gray-500 font-semibold hover:bg-gray-100 rounded-md px-4 py-2 transition"
                      onClick={() => selectStudent(currentStudentId!)}
                      type="button"
                    >
                      Odrzuć zmiany
                    </button>
                    <button
                      className={`bg-[#222B45] hover:bg-teal-600 text-white font-semibold px-5 py-2 rounded-lg transition ${
                        saving ? "opacity-50" : ""
                      }`}
                      onClick={() => saveCurrent(false)}
                      disabled={saving}
                      type="button"
                    >
                      Zapisz
                    </button>
                    <button
                      className={`bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition ${
                        saving ? "opacity-50" : ""
                      }`}
                      onClick={() => saveCurrent(true)}
                      disabled={saving}
                      type="button"
                    >
                      Zapisz i dalej →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Wczytaj / Nowy test */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowSessionModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[96%] max-w-5xl max-h-[80vh] p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#222B45]">
                Wczytaj lub stwórz nowy test
              </h3>
              <button
                onClick={() => setShowSessionModal(false)}
                aria-label="Zamknij"
                className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Zakładki */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                className={`px-4 py-2 font-semibold ${
                  sessionTab === "load"
                    ? "text-teal-600 border-b-2 border-teal-500"
                    : "text-gray-500"
                }`}
                onClick={() => setSessionTab("load")}
              >
                Wczytaj
              </button>
              <button
                className={`px-4 py-2 font-semibold ${
                  sessionTab === "new"
                    ? "text-teal-600 border-b-2 border-teal-500"
                    : "text-gray-500"
                }`}
                onClick={() => setSessionTab("new")}
              >
                Nowy test
              </button>
            </div>

            {sessionTab === "load" ? (
              <div className="space-y-3">
                {/* Tabela */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden w-full">
                  <div className="max-h-[55vh] overflow-y-auto">
                    <table className="min-w-full">
                      <thead className="sticky top-0 bg-white">
                        <tr>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                            SESSION NAME
                          </th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                            TEMPLATE
                          </th>
                          <th className="text-xs font-bold text-gray-400 uppercase text-left py-3">
                            DATE
                          </th>
                          <th className="w-40"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s, idx) => {
                          const isLast = idx === sessions.length - 1;
                          const isEditing = editId === s.id;
                          const duplicate =
                            isEditing && isDuplicateRename(s.id, editName);
                          const selected = selectedLoadId === s.id;

                          return (
                            <tr
                              key={s.id}
                              className={`${!isLast ? "border-b" : ""} transition hover:bg-gray-50 ${
                                selected ? "bg-teal-50" : ""
                              }`}
                              style={{
                                borderColor: "#ececec",
                                borderWidth: !isLast ? "0.2px" : 0,
                                cursor: isEditing ? "default" : "pointer",
                              }}
                              onClick={() => {
                                if (!isEditing) setSelectedLoadId(s.id);
                              }}
                              aria-selected={selected}
                            >
                              {/* kolumna z nazwą / inputem */}
                              <td className="py-5 pl-6 min-w-[250px] pr-4">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1 w-full max-w-xs">
                                    <input
                                      className={`border rounded-lg px-3 py-1 focus:outline-none ${
                                        duplicate
                                          ? "border-red-300 focus:border-red-500"
                                          : "border-gray-300 focus:border-teal-400"
                                      }`}
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                    {duplicate && (
                                      <div className="text-[11px] text-red-600">
                                        Sesja o tej nazwie i dla tego szablonu już istnieje.
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-800 font-semibold text-base break-all">
                                    {s.name}
                                  </span>
                                )}
                              </td>

                              {/* Template */}
                              <td className="text-gray-800 py-5 pr-4">
                                {s.template?.name || "-"}
                              </td>

                              {/* Data */}
                              <td className="text-gray-800 py-5 pr-4">
                                {new Date(s.date).toLocaleDateString()}
                              </td>

                              {/* Akcje */}
                              <td className="pr-6 text-right">
                                {isEditing ? (
                                  <div className="flex gap-3 justify-end">
                                    <button
                                      className="text-teal-500 font-semibold px-3 py-1 hover:bg-teal-50 rounded transition disabled:opacity-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveEdit(s.id);
                                      }}
                                      type="button"
                                      disabled={!editName.trim() || !!duplicate}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="text-gray-400 font-semibold px-3 py-1 hover:bg-gray-100 rounded transition"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                      type="button"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-3 justify-end">
                                    <button
                                      className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(s);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(s.id);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {sessions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-gray-400">
                              No sessions to display.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pasek akcji pod tabelą */}
                  <div
                    className="flex items-center justify-between gap-3 p-4 border-t"
                    style={{ borderColor: "#ececec" }}
                  >
                    <div className="text-xs font-semibold text-gray-500">
                      {selectedLoadId
                        ? "Wybrano sesję do wczytania."
                        : "Wybierz sesję z listy powyżej."}
                    </div>
                    <button
                      className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
                      onClick={handleLoad}
                      disabled={!selectedLoadId}
                    >
                      Wczytaj sesję
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <label className="block text-xs text-gray-500 mb-1">
                    Szablon testu
                  </label>
                  <select
                    className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 w-full truncate appearance-none"
                    value={templateId}
                    onChange={(e) =>
                      setTemplateId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                  >
                    <option value="">Wybierz szablon…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 top-5 flex items-center text-gray-500">
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

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Nazwa testu
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      className={`border rounded-lg px-3 py-2 flex-1 focus:outline-none ${
                        duplicateName
                          ? "border-red-400 focus:border-red-500"
                          : "border-gray-300 focus:border-teal-400"
                      }`}
                      placeholder="Nazwa sesji (np. Sprawdzian z września)"
                    />
                    <button
                      onClick={handleCreate}
                      className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
                      disabled={
                        !templateId || !sessionName.trim() || duplicateName
                      }
                    >
                      Utwórz
                    </button>
                  </div>
                  {duplicateName && (
                    <div className="text-[11px] text-red-600 mt-1">
                      Sesja o tej nazwie i dla tego szablonu już istnieje.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Tests;
