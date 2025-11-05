/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import axios from "axios";
import * as XLSX from "xlsx";
import { useToast } from "../components/Toast";

// --- Typy (bez kategorii) ---
type TaskDraft = {
  description: string;
  minPoints: number;
  maxPoints: number;
  allowHalfPoints: boolean;
};

type TaskView = {
  id?: number;
  description: string;
  minPoints: number;
  maxPoints: number;
  allowHalfPoints: boolean;
};

type TestTemplate = {
  id: number;
  name: string;
  tasks: TaskView[];
};

const snapByRule = (v: number, halves: boolean) =>
  halves ? Math.round(v * 2) / 2 : Math.round(v);

const parseBool = (v: any) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "t" || s === "tak" || s === "y" || s === "yes";
};

const safeFilename = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);

const TestTemplates: React.FC = () => {
  const { push } = useToast();

  // Lista szablonów
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Dodawanie (blok na stronie) ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTasks, setAddTasks] = useState<TaskDraft[]>([
    { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
  ]);

  // --- Edycja (MODAL) ---
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState<TaskDraft[]>([
    { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
  ]);

  // --- Import XLSX (ref do file input) ---
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------
  // Pobranie szablonów
  // ---------------------------------
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get("/test-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTemplates([]);
      push({ type: "error", message: "Błąd pobierania szablonów." });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------
  // Utils formularzy
  // ---------------------------------
  const resetAddForm = () => {
    setAddName("");
    setAddTasks([
      { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
    ]);
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditName("");
    setEditTasks([
      { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
    ]);
  };

  // ---- WALIDACJA: duplikaty nazw (case-insensitive, trimmed) ----
  const duplicateAddName = React.useMemo(() => {
    const base = addName.trim().toLowerCase();
    if (!base) return false;
    return templates.some((t) => (t.name || "").trim().toLowerCase() === base);
  }, [addName, templates]);

  const isDuplicateRename = (id: number | null, name: string) => {
    const base = name.trim().toLowerCase();
    if (!base || id === null) return false;
    return templates.some(
      (t) => t.id !== id && (t.name || "").trim().toLowerCase() === base
    );
  };

  // ---------------------------------
  // Dodawanie szablonu (blok na stronie)
  // ---------------------------------
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateAddName) {
      push({ type: "error", message: "Szablon o takiej nazwie już istnieje." });
      return;
    }
    const token = localStorage.getItem("token");
    try {
      // 1) Tworzymy szablon
      const res = await axios.post(
        "/test-templates",
        { name: addName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const templateId = res.data.id;

      // 2) Dodajemy zadania (kolejno, z order)
      const createdTasks: TaskView[] = [];
      for (const [order, t] of addTasks.entries()) {
        const rt = await axios.post(
          `/test-templates/${templateId}/tasks`,
          {
            description: t.description,
            order: order + 1,
            minPoints: t.minPoints,
            maxPoints: t.maxPoints,
            allowHalfPoints: t.allowHalfPoints,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        createdTasks.push(rt.data);
      }

      // 3) Aktualizujemy lokalny stan listy
      setTemplates((prev) => [
        ...prev,
        { id: templateId, name: addName, tasks: createdTasks },
      ]);

      // 4) Sprzątamy
      resetAddForm();
      setShowAddForm(false);
      push({ type: "success", message: "Szablon testu został zapisany!" });
    } catch {
      push({ type: "error", message: "Błąd zapisu szablonu!" });
    }
  };

  // ---------------------------------
  // Start edycji (otwórz MODAL)
  // ---------------------------------
  const openEdit = (tpl: TestTemplate) => {
    setEditingId(tpl.id);
    setEditName(tpl.name);
    setEditTasks(
      tpl.tasks.length
        ? tpl.tasks.map((t) => ({
            description: t.description,
            minPoints: t.minPoints,
            maxPoints: t.maxPoints,
            allowHalfPoints: t.allowHalfPoints ?? true,
          }))
        : [
            {
              description: "",
              minPoints: 0,
              maxPoints: 1,
              allowHalfPoints: true,
            },
          ]
    );
    setEditOpen(true);
  };

  // ---------------------------------
  // Zapis edycji (MODAL)
  // ---------------------------------
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    if (isDuplicateRename(editingId, editName)) {
      push({ type: "error", message: "Szablon o takiej nazwie już istnieje." });
      return;
    }

    const token = localStorage.getItem("token");
    try {
      // 1) Zapis nazwy
      await axios.put(
        `/test-templates/${editingId}`,
        { name: editName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2) Zadania: aktualizacja / dodanie / usunięcie
      const prevTpl = templates.find((t) => t.id === editingId)!;

      const newTaskViews: TaskView[] = [];
      for (const [order, t] of editTasks.entries()) {
        if (prevTpl.tasks[order]) {
          // update istniejącego
          const taskId = prevTpl.tasks[order].id!;
          await axios.put(
            `/test-templates/${editingId}/tasks/${taskId}`,
            {
              description: t.description,
              order: order + 1,
              minPoints: t.minPoints,
              maxPoints: t.maxPoints,
              allowHalfPoints: t.allowHalfPoints,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          newTaskViews.push({ ...prevTpl.tasks[order], ...t });
        } else {
          // nowy
          const rt = await axios.post(
            `/test-templates/${editingId}/tasks`,
            {
              description: t.description,
              order: order + 1,
              minPoints: t.minPoints,
              maxPoints: t.maxPoints,
              allowHalfPoints: t.allowHalfPoints,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          newTaskViews.push(rt.data);
        }
      }

      // usuń nadmiarowe z końca
      if (prevTpl.tasks.length > editTasks.length) {
        for (let i = editTasks.length; i < prevTpl.tasks.length; i++) {
          const tid = prevTpl.tasks[i].id!;
          await axios.delete(`/test-templates/${editingId}/tasks/${tid}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      // 3) Zaktualizuj listę
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingId ? { ...t, name: editName, tasks: newTaskViews } : t
        )
      );

      // 4) Zamknij modal
      setEditOpen(false);
      resetEditForm();
      push({ type: "success", message: "Zapisano zmiany w szablonie." });
    } catch (err: any) {
      push({
        type: "error",
        message: err?.response?.data?.error || "Błąd zapisu zmian szablonu!",
      });
    }
  };

  // ---------------------------------
  // Usuwanie szablonu
  // ---------------------------------
  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm("Na pewno usunąć szablon?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`/test-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      push({ type: "success", message: "Szablon został usunięty." });
    } catch {
      push({
        type: "error",
        message:
          "Usuń sesje testów powiązanych z tym szablonem, aby móc usunąć szablon.",
      });
    }
  };

  // ---------------------------------
  // XLSX — EKSPORT POJEDYNCZEGO SZABLONU
  // ---------------------------------
  const exportOneTemplateXlsx = (tpl: TestTemplate) => {
    const rows =
      tpl.tasks.length === 0
        ? [
            {
              TemplateName: tpl.name,
              TaskOrder: "",
              Description: "",
              MinPoints: "",
              MaxPoints: "",
              AllowHalfPoints: "TRUE",
            },
          ]
        : tpl.tasks.map((task, idx) => ({
            TemplateName: tpl.name,
            TaskOrder: idx + 1,
            Description: task.description,
            MinPoints: task.minPoints,
            MaxPoints: task.maxPoints,
            AllowHalfPoints: task.allowHalfPoints ? "TRUE" : "FALSE",
          }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        "TemplateName",
        "TaskOrder",
        "Description",
        "MinPoints",
        "MaxPoints",
        "AllowHalfPoints",
      ],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `test-template-${safeFilename(tpl.name)}.xlsx`);
    push({ type: "success", message: "Eksport zakończony." });
  };

  // ---------------------------------
  // XLSX — IMPORT SZABLONÓW (walidacja nazw)
  // ---------------------------------
  const handleImportXlsx: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // grupuj po nazwie szablonu
      const groups = new Map<
        string,
        {
          order: number;
          description: string;
          minPoints: number;
          maxPoints: number;
          allowHalfPoints: boolean;
        }[]
      >();

      for (const r of rows) {
        const name = String(
          r.TemplateName || r["Template Name"] || r.Template || ""
        ).trim();
        if (!name) continue;

        const orderRaw = Number(r.TaskOrder || r.Order || r["Task #"] || 0);
        const description = String(r.Description || r.Task || "").trim();
        const minRaw = Number(r.MinPoints ?? r.Min ?? 0);
        const maxRaw = Number(r.MaxPoints ?? r.Max ?? 1);
        const allowHalfPoints = parseBool(r.AllowHalfPoints ?? r.Halves ?? true);

        const halves = !!allowHalfPoints;
        const minPoints = snapByRule(Number.isFinite(minRaw) ? minRaw : 0, halves);
        const maxPoints = snapByRule(
          Number.isFinite(maxRaw) ? Math.max(maxRaw, minPoints) : Math.max(1, minPoints),
          halves
        );

        const arr = groups.get(name) ?? [];
        arr.push({
          order:
            Number.isFinite(orderRaw) && orderRaw > 0 ? orderRaw : arr.length + 1,
          description,
          minPoints,
          maxPoints,
          allowHalfPoints: halves,
        });
        groups.set(name, arr);
      }

      const token = localStorage.getItem("token");
      const existingNames = new Set(
        templates.map((t) => (t.name || "").trim().toLowerCase())
      );

      let ok = 0;
      let skippedDuplicates = 0;
      let fail = 0;

      for (const [tplName, list] of groups) {
        const nameKey = tplName.trim().toLowerCase();
        // twarda walidacja: nazwa już istnieje -> pomijamy cały szablon
        if (!tplName || existingNames.has(nameKey)) {
          skippedDuplicates++;
          continue;
        }

        try {
          // utwórz szablon
          const res = await axios.post(
            "/test-templates",
            { name: tplName },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const templateId = res.data.id;

          // utwórz zadania
          const tasksSorted = [...list].sort((a, b) => a.order - b.order);
          for (let i = 0; i < tasksSorted.length; i++) {
            const t = tasksSorted[i];
            await axios.post(
              `/test-templates/${templateId}/tasks`,
              {
                description: t.description,
                order: i + 1,
                minPoints: t.minPoints,
                maxPoints: Math.max(t.maxPoints, t.minPoints),
                allowHalfPoints: t.allowHalfPoints,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }

          ok++;
          existingNames.add(nameKey);
        } catch {
          fail++;
        }
      }

      await fetchTemplates();
      push({
        type: (fail || skippedDuplicates) ? "error" : "success",
        message:
          `Zaimportowano ${ok} szablon(y).` +
          (skippedDuplicates ? ` Nazwa szablonu już istnieje.`: "") +
          (fail ? ` Błędy: ${fail}.` : ""),
      });
    } catch {
      push({ type: "error", message: "Nie udało się zaimportować pliku." });
    } finally {
      e.target.value = "";
    }
  };

  // ---------------------------------
  // Helpers UI (dodawanie/edycja zadań)
  // ---------------------------------
  const addAddTask = () =>
    setAddTasks((s) => [
      ...s,
      { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
    ]);

  const removeAddTask = (idx: number) =>
    setAddTasks((s) => (s.length === 1 ? s : s.filter((_, i) => i !== idx)));

  const updateAddTask = (idx: number, key: keyof TaskDraft, value: any) =>
    setAddTasks((s) =>
      s.map((t, i) => (i === idx ? { ...t, [key]: value } : t))
    );

  const addEditTask = () =>
    setEditTasks((s) => [
      ...s,
      { description: "", minPoints: 0, maxPoints: 1, allowHalfPoints: true },
    ]);

  const removeEditTask = (idx: number) =>
    setEditTasks((s) => (s.length === 1 ? s : s.filter((_, i) => i !== idx)));

  const updateEditTask = (idx: number, key: keyof TaskDraft, value: any) =>
    setEditTasks((s) =>
      s.map((t, i) => (i === idx ? { ...t, [key]: value } : t))
    );

  // ---------------------------------
  // Render
  // ---------------------------------
  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 md:ml-[230px] px-4 pt-10 pb-8">
        <div className="w-full max-w-100%">
          {/* Nagłówek + akcje (import globalny, eksport pojedynczy jest per-karta) */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">
              Twoje szablony testów
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
                onClick={() => importFileRef.current?.click()}
                type="button"
              >
                Importuj szablon z Excela
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportXlsx}
              />
              <button
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
                onClick={() => {
                  setShowAddForm(true);
                  resetAddForm();
                }}
              >
                + Dodaj nowy szablon
              </button>
            </div>
          </div>

          {/* Lista szablonów */}
          {loading ? (
            <div>Ładowanie...</div>
          ) : templates.length === 0 ? (
            <div className="mt-7 text-gray-400">Brak szablonów testów.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl shadow p-5 flex flex-col gap-3"
                >
                  <div className="flex-1">
                    <span className="font-bold text-lg">{template.name}</span>
                    <div className="mt-2">
                      {template.tasks.length === 0 ? (
                        <div className="text-gray-400 text-sm">Brak zadań</div>
                      ) : (
                        template.tasks.map((task, idx) => (
                          <div key={task.id || idx} className="text-sm my-1">
                            <span className="font-semibold">
                              Zadanie {idx + 1}.
                            </span>{" "}
                            {task.description}{" "}
                            <span className="text-xs text-gray-400">
                              ({task.minPoints}-{task.maxPoints} pkt,{" "}
                              {task.allowHalfPoints ? "połówki: TAK" : "połówki: NIE"}
                              )
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end self-end">
                    <button
                      className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                      onClick={() => openEdit(template)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      Delete
                    </button>

                    {/* Ikonowy przycisk eksportu */}
                    <button
                      className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-300 transition group"
                      onClick={() => exportOneTemplateXlsx(template)}
                      type="button"
                      title="Eksportuj ten szablon"
                      aria-label="Eksportuj ten szablon"
                    >
  <svg
    className="w-5 h-5 text-gray-600 group-hover:text-gray-800"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v10" />
    <path d="M8.5 6.5 12 3l3.5 3.5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formularz DODAWANIA */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mt-8">
              <h3 className="text-lg font-bold mb-4">Nowy szablon testu</h3>
              <form onSubmit={handleAddSubmit}>
                <label className="block mb-2 font-semibold">
                  Nazwa szablonu
                </label>
                <input
                  type="text"
                  className={`border rounded-lg px-4 py-2 w-full focus:outline-none ${
                    duplicateAddName
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-300 focus:border-teal-400"
                  }`}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />
                {duplicateAddName && (
                  <div className="text-xs text-red-600 mt-1">
                    Szablon o takiej nazwie już istnieje.
                  </div>
                )}

                <label className="font-semibold block mb-2 mt-5">Zadania</label>
                <div>
                  {addTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap gap-4 items-center mb-3 bg-[#f7fafc] rounded-lg px-4 py-3"
                    >
                      <span className="font-bold mr-2 min-w-[80px]">
                        Zadanie {idx + 1}.
                      </span>

                      <div className="min-w-[250px] flex-1">
                        <label className="block text-xs mb-1">
                          Opis zadania
                        </label>
                        <input
                          type="text"
                          placeholder="Opis zadania"
                          value={task.description}
                          onChange={(e) =>
                            updateAddTask(idx, "description", e.target.value)
                          }
                          className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:border-teal-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">
                          Punkty min/max{" "}
                          <span className="text-gray-500 ">
                            (krok: {task.allowHalfPoints ? "0.5" : "1"})
                          </span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={task.allowHalfPoints ? 0.5 : 1}
                          value={task.minPoints}
                          onChange={(e) =>
                            setAddTasks((s) =>
                              s.map((t, i) => {
                                if (i !== idx) return t;
                                const halves = t.allowHalfPoints;
                                const newMin = snapByRule(
                                  Number(e.target.value),
                                  halves
                                );
                                const newMax =
                                  newMin > t.maxPoints ? newMin : t.maxPoints;
                                return {
                                  ...t,
                                  minPoints: newMin,
                                  maxPoints: snapByRule(newMax, halves),
                                };
                              })
                            )
                          }
                          className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                          required
                        />
                        <span className="mx-1 mt-2 text-gray-500">/</span>
                        <input
                          type="number"
                          min={task.minPoints}
                          step={task.allowHalfPoints ? 0.5 : 1}
                          value={task.maxPoints}
                          onChange={(e) =>
                            setAddTasks((s) =>
                              s.map((t, i) => {
                                if (i !== idx) return t;
                                const halves = t.allowHalfPoints;
                                const raw = Number(e.target.value);
                                const clamped =
                                  raw < t.minPoints ? t.minPoints : raw;
                                return {
                                  ...t,
                                  maxPoints: snapByRule(clamped, halves),
                                };
                              })
                            )
                          }
                          className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                          required
                        />
                      </div>
                      <div className="min-h-[62px] text-center">
                        <label className="block text-xs mb-3">
                          Punkty połówkowe
                        </label>
                        <input
                          className="relative h-4 w-4 cursor-pointer transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-10 before:w-10 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-400 before:opacity-0 before:transition-opacity checked:bg-slate-800 checked:before:bg-slate-400 hover:before:opacity-10 "
                          type="checkbox"
                          checked={task.allowHalfPoints}
                          onChange={(e) => {
                            const halves = e.target.checked;
                            setAddTasks((s) =>
                              s.map((t, i) =>
                                i === idx
                                  ? {
                                      ...t,
                                      allowHalfPoints: halves,
                                      minPoints: snapByRule(
                                        t.minPoints,
                                        halves
                                      ),
                                      maxPoints: snapByRule(
                                        Math.max(t.maxPoints, t.minPoints),
                                        halves
                                      ),
                                    }
                                  : t
                              )
                            );
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-2 transition"
                        disabled={addTasks.length === 1}
                        onClick={() => removeAddTask(idx)}
                      >
                        Usuń
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addAddTask}
                  className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg mt-2 transition"
                >
                  + Dodaj zadanie
                </button>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="bg-[#222B45] hover:bg-teal-600 text-white font-semibold px-7 py-3 rounded-lg transition"
                    disabled={duplicateAddName}
                  >
                    Zapisz szablon testu
                  </button>
                  <button
                    type="button"
                    className="bg-gray-100 text-gray-600 font-semibold rounded-lg px-7 py-3 hover:bg-gray-200 transition"
                    onClick={() => {
                      setShowAddForm(false);
                      resetAddForm();
                    }}
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL EDYCJI SZABLONU --- */}
      {editOpen && (
        <Modal
          onClose={() => {
            setEditOpen(false);
            resetEditForm();
          }}
        >
          <h3 className="text-lg font-bold mb-4">Edytuj szablon testu</h3>
          <form onSubmit={handleEditSubmit}>
            <label className="block mb-2 font-semibold">Nazwa szablonu</label>
            <input
              type="text"
              className={`border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none ${
                isDuplicateRename(editingId, editName)
                  ? "border-red-400 focus:border-red-500"
                  : "border-gray-300 focus:border-teal-400"
              }`}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            {isDuplicateRename(editingId, editName) && (
              <div className="text-xs text-red-600 mt-1">
                Szablon o takiej nazwie już istnieje.
              </div>
            )}

            <label className="font-semibold block mb-2 mt-5">Zadania</label>
            <div className="overflow-y-auto max-h-[40vh] block">
              {editTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap gap-4 items-center mb-3 bg-[#f7fafc] rounded-lg px-4 py-3"
                >
                  <span className="font-bold mr-2 min-w-[80px]">
                    Zadanie {idx + 1}.
                  </span>
                  <div className="min-w-[250px] flex-1">
                    <label className="block text-xs mb-1">Opis zadania</label>
                    <input
                      type="text"
                      placeholder="Opis zadania"
                      value={task.description}
                      onChange={(e) =>
                        updateEditTask(idx, "description", e.target.value)
                      }
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:border-teal-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">
                      Punkty min/max{" "}
                      <span className="text-gray-500 ">
                        (krok: {task.allowHalfPoints ? "0.5" : "1"})
                      </span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={task.allowHalfPoints ? 0.5 : 1}
                      value={task.minPoints}
                      onChange={(e) =>
                        setEditTasks((s) =>
                          s.map((t, i) => {
                            if (i !== idx) return t;
                            const halves = t.allowHalfPoints;
                            const newMin = snapByRule(
                              Number(e.target.value),
                              halves
                            );
                            const newMax =
                              newMin > t.maxPoints ? newMin : t.maxPoints;
                            return {
                              ...t,
                              minPoints: newMin,
                              maxPoints: snapByRule(newMax, halves),
                            };
                          })
                        )
                      }
                      className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                      required
                    />
                    <span className="mx-1 text-gray-500">/</span>
                    <input
                      type="number"
                      min={task.minPoints}
                      step={task.allowHalfPoints ? 0.5 : 1}
                      value={task.maxPoints}
                      onChange={(e) =>
                        setEditTasks((s) =>
                          s.map((t, i) => {
                            if (i !== idx) return t;
                            const halves = t.allowHalfPoints;
                            const raw = Number(e.target.value);
                            const clamped =
                              raw < t.minPoints ? t.minPoints : raw;
                            return {
                              ...t,
                              maxPoints: snapByRule(clamped, halves),
                            };
                          })
                        )
                      }
                      className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                      required
                    />
                  </div>
                  <div className="min-h-[62px] text-center">
                    <label className="block text-xs mb-3">
                      Punkty połówkowe
                    </label>
                    <input
                      className="relative h-4 w-4 cursor-pointer transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-10 before:w-10 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-400 before:opacity-0 before:transition-opacity checked:bg-slate-800 checked:before:bg-slate-400 hover:before:opacity-10 "
                      type="checkbox"
                      checked={task.allowHalfPoints}
                      onChange={(e) => {
                        const halves = e.target.checked;
                        setEditTasks((s) =>
                          s.map((t, i) =>
                            i === idx
                              ? {
                                  ...t,
                                  allowHalfPoints: halves,
                                  minPoints: snapByRule(t.minPoints, halves),
                                  maxPoints: snapByRule(
                                    Math.max(t.maxPoints, t.minPoints),
                                    halves
                                  ),
                                }
                              : t
                          )
                        );
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-2 transition"
                    disabled={editTasks.length === 1}
                    onClick={() => removeEditTask(idx)}
                  >
                    Usuń
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addEditTask}
              className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg mt-2 transition"
            >
              + Dodaj zadanie
            </button>

            <div className="flex gap-4 mt-6">
              <button
                type="submit"
                className="bg-[#222B45] hover:bg-teal-600 text-white font-semibold px-7 py-3 rounded-lg transition"
                disabled={isDuplicateRename(editingId, editName)}
              >
                Zapisz zmiany
              </button>
              <button
                type="button"
                className="bg-gray-100 text-gray-600 font-semibold rounded-lg px-7 py-3 hover:bg-gray-200 transition"
                onClick={() => {
                  setEditOpen(false);
                  resetEditForm();
                }}
              >
                Anuluj
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TestTemplates;

// --- Prosty modal z lekkim przyciemnieniem jak w sidebarze (nie czarny) ---
const Modal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: "rgba(30,50,60,0.18)" }}
  >
    <div className="bg-white rounded-xl shadow-lg p-7 min-w-[640px] w-[70%] relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
        aria-label="Zamknij"
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
      {children}
    </div>
  </div>
);
