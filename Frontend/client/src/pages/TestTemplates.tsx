import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import axios from "axios";

// --- Typy (bez kategorii) ---
type TaskDraft = {
  description: string;
  minPoints: number;
  maxPoints: number;
};

type TaskView = {
  id?: number;
  description: string;
  minPoints: number;
  maxPoints: number;
};

type TestTemplate = {
  id: number;
  name: string;
  tasks: TaskView[];
};

const TestTemplates: React.FC = () => {
  // Lista szablonów
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Komunikaty
  const [message, setMessage] = useState("");

  // --- Dodawanie (blok na stronie) ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTasks, setAddTasks] = useState<TaskDraft[]>([
    { description: "", minPoints: 0, maxPoints: 1 },
  ]);

  // --- Edycja (MODAL) ---
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState<TaskDraft[]>([
    { description: "", minPoints: 0, maxPoints: 1 },
  ]);

  // ---------------------------------
  // Pobranie szablonów
  // ---------------------------------
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get("/test-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTemplates([]);
      setMessage("Błąd pobierania szablonów.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------
  // Utils formularzy
  // ---------------------------------
  const resetAddForm = () => {
    setAddName("");
    setAddTasks([{ description: "", minPoints: 0, maxPoints: 1 }]);
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditName("");
    setEditTasks([{ description: "", minPoints: 0, maxPoints: 1 }]);
  };

  // ---------------------------------
  // Dodawanie szablonu (blok na stronie)
  // ---------------------------------
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
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
      setMessage("Szablon testu został zapisany!");
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Błąd zapisu szablonu!");
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
          }))
        : [{ description: "", minPoints: 0, maxPoints: 1 }]
    );
    setEditOpen(true);
  };

  // ---------------------------------
  // Zapis edycji (MODAL)
  // ---------------------------------
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setMessage("");
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
      setMessage("Zapisano zmiany w szablonie.");
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Błąd zapisu zmian szablonu!");
    }
  };

  // ---------------------------------
  // Usuwanie szablonu
  // ---------------------------------
  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm("Na pewno usunąć szablon?")) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`/test-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setMessage("Szablon został usunięty.");
    } catch {
      setMessage("Błąd usuwania szablonu.");
    }
  };

  // ---------------------------------
  // Helpers UI (dodawanie/edycja zadań)
  // ---------------------------------
  const addAddTask = () =>
    setAddTasks((s) => [...s, { description: "", minPoints: 0, maxPoints: 1 }]);
  const removeAddTask = (idx: number) =>
    setAddTasks((s) => (s.length === 1 ? s : s.filter((_, i) => i !== idx)));
  const updateAddTask = (idx: number, key: keyof TaskDraft, value: any) =>
    setAddTasks((s) =>
      s.map((t, i) => (i === idx ? { ...t, [key]: value } : t))
    );

  const addEditTask = () =>
    setEditTasks((s) => [
      ...s,
      { description: "", minPoints: 0, maxPoints: 1 },
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
          {/* Nagłówek + akcja */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">
              Twoje szablony testów
            </h2>
            <button
              className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              onClick={() => {
                setShowAddForm(true);
                setMessage("");
                resetAddForm();
              }}
            >
              + Dodaj nowy szablon
            </button>
          </div>

          {/* Komunikaty (nad blokiem tworzenia nowego szablonu) */}
          {message && (
            <div className="mb-4 text-center font-medium text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-4">
              {message}
            </div>
          )}

          {/* Formularz DODAWANIA (blok pojawia się po kliknięciu) */}
          {showAddForm && (
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <h3 className="text-lg font-bold mb-4">Nowy szablon testu</h3>
              <form onSubmit={handleAddSubmit}>
                <label className="block mb-2 font-semibold">
                  Nazwa szablonu
                </label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-5 focus:outline-none focus:border-teal-400"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />

                <label className="font-semibold block mb-2">Zadania</label>
                <div>
                  {addTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap gap-3 items-end mb-3 bg-[#f7fafc] rounded-lg px-4 py-3"
                    >
                      <span className="font-bold mr-2 min-w-[80px]">
                        Zadanie {idx + 1}.
                      </span>

                      <input
                        type="text"
                        placeholder="Opis zadania"
                        value={task.description}
                        onChange={(e) =>
                          updateAddTask(idx, "description", e.target.value)
                        }
                        className="border border-gray-300 rounded-lg px-3 py-2 w-full max-w-[320px] focus:outline-none focus:border-teal-400"
                        required
                      />

                      <div>
                        <label className="block text-xs mb-1">
                          Punkty min/max
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={task.minPoints}
                            onChange={(e) =>
                              updateAddTask(
                                idx,
                                "minPoints",
                                Number(e.target.value)
                              )
                            }
                            className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                            required
                          />
                          <span className="mx-1 text-gray-500">/</span>
                          <input
                            type="number"
                            min={task.minPoints}
                            step={0.5}
                            value={task.maxPoints}
                            onChange={(e) =>
                              updateAddTask(
                                idx,
                                "maxPoints",
                                Number(e.target.value)
                              )
                            }
                            className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                            required
                          />
                        </div>
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
                  className="bg-white rounded-xl shadow p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
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
                              ({task.minPoints}-{task.maxPoints} pkt)
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3 sm:mt-0">
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
                  </div>
                </div>
              ))}
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
              className="border border-gray-300 rounded-lg px-4 py-2 w-full mb-5 focus:outline-none focus:border-teal-400"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <label className="font-semibold block mb-2">Zadania</label>
            <div className="overflow-y-auto max-h-[40vh] block">
              {editTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap gap-3 items-end mb-3 bg-[#f7fafc] rounded-lg px-4 py-3"
                >
                  <span className="font-bold mr-2 min-w-[80px]">
                    Zadanie {idx + 1}.
                  </span>

                  <input
                    type="text"
                    placeholder="Opis zadania"
                    value={task.description}
                    onChange={(e) =>
                      updateEditTask(idx, "description", e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2 w-full max-w-[320px] focus:outline-none focus:border-teal-400"
                    required
                  />

                  <div>
                    <label className="block text-xs mb-1">Punkty min/max</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={task.minPoints}
                        onChange={(e) =>
                          updateEditTask(
                            idx,
                            "minPoints",
                            Number(e.target.value)
                          )
                        }
                        className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                        required
                      />
                      <span className="mx-1 text-gray-500">/</span>
                      <input
                        type="number"
                        min={task.minPoints}
                        step={0.5}
                        value={task.maxPoints}
                        onChange={(e) =>
                          updateEditTask(
                            idx,
                            "maxPoints",
                            Number(e.target.value)
                          )
                        }
                        className="border border-gray-300 rounded-lg px-2 py-2 w-16 focus:outline-none focus:border-teal-400"
                        required
                      />
                    </div>
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
        className="absolute top-2 right-4 text-gray-400 hover:text-teal-400 text-2xl font-bold transition"
        aria-label="Zamknij"
      >
        &times;
      </button>
      {children}
    </div>
  </div>
);
