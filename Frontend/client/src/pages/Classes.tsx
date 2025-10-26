import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { Link, useLocation, useNavigate } from "react-router-dom";

// Typy
type School = {
  id: number;
  name: string;
  ownerId: number;
};

type SchoolClass = {
  id: number;
  name: string;
  order: number;
  schoolId: number;
  school?: { id: number; name: string };
  schoolName?: string;
};

const Classes: React.FC = () => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [newClassName, setNewClassName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"" | "error" | "success">("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);

  const location = useLocation();

  // Obsługa "prefiltracji" przez query string (np. /classes?school=3)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const schoolQuery = searchParams.get("school");
    if (schoolQuery) setSelectedSchoolId(Number(schoolQuery));
  }, [location.search]);

  // Pobierz szkoły użytkownika (do selecta) + klasy
  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    // Przy pierwszym wejściu, jeśli jeszcze nie masz szkół, poczekaj!
    if (schools.length === 0) return;
    // Jeśli filtr ustawiony na daną szkołę i nie masz szkół, poczekaj!
    if (selectedSchoolId !== "" && schools.length === 0) return;
    fetchClasses();
    // eslint-disable-next-line
  }, [schools, selectedSchoolId]);

  // Pobierz szkoły
  const fetchSchools = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchools(res.data);
    } catch {
      setMessageType("error");
      setMessage("Błąd pobierania szkół!");
    }
  };

  // Pobierz klasy (wszystkie lub tylko dla danej szkoły)
  const fetchClasses = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    setMessage("");
    try {
      if (selectedSchoolId) {
        // Filtr po szkole (bez zmian)
        const res = await axios.get<SchoolClass[]>(
          `http://localhost:4000/schools/${selectedSchoolId}/classes`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setClasses(
          res.data.map((cls) => ({
            ...cls,
            schoolName:
              cls.schoolName ||
              schools.find((s) => s.id === selectedSchoolId)?.name ||
              "",
          }))
        );
      } else {
        // Pobierz klasy dla wszystkich szkół użytkownika
        const res = await axios.get<SchoolClass[]>(
          "http://localhost:4000/classes",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setClasses(
          res.data.map((cls) => ({
            ...cls,
            schoolName:
              cls.school?.name ||
              cls.schoolName ||
              schools.find((s) => s.id === cls.schoolId)?.name ||
              "",
          }))
        );
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessageType("error");
        setMessage(err.response?.data?.error || "Błąd pobierania klasy");
      } else {
        setMessageType("error");
        setMessage("Błąd pobierania klasy");
      }
    } finally {
      setLoading(false);
    }
  };

  // Dodaj klasę
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      setMessage("Najpierw wybierz szkołę do której chcesz dodać klasę!");
      return;
    }
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<SchoolClass>(
        `http://localhost:4000/schools/${selectedSchoolId}/classes`,
        { name: newClassName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClasses([
        ...classes,
        {
          ...res.data,
          schoolName:
            schools.find((s) => s.id === selectedSchoolId)?.name || "",
        },
      ]);
      setNewClassName("");
      setMessage("Klasa dodana!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessageType("error");
        setMessage(err.response?.data?.error || "Błąd dodawania klasy");
      } else {
        setMessageType("error");
        setMessage("Błąd dodawania klasy");
      }
    }
  };

  // Edytuj klasę
  const handleStartEdit = (cls: SchoolClass) => {
    setEditId(cls.id);
    setEditName(cls.name);
  };
  const handleSaveEdit = async (classId: number, schoolId: number) => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.put(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}`,
        { name: editName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClasses(
        classes.map((cls) =>
          cls.id === classId
            ? { ...res.data, schoolName: cls.schoolName || cls.school?.name }
            : cls
        )
      );
      setEditId(null);
      setEditName("");
      setMessage("Klasa zaktualizowana!");
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.error || "Błąd edycji klasy"
          : "Błąd edycji klasy"
      );
    }
  };
  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // Usuń klasę
  const handleDeleteClass = async (classId: number, schoolId: number) => {
    if (!window.confirm("Na pewno usunąć tę klasę?")) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      await axios.delete(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setClasses(classes.filter((cls) => cls.id !== classId));
      setMessage("Klasa usunięta!");
    } catch {
      setMessage("Błąd usuwania klasy");
    }
  };

  // Po zmianie filtra od razu zmień url
  const handleFilterSchool = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSchoolId(value ? Number(value) : "");
    // Podmień query string
    if (value) {
      navigate(`/classes?school=${value}`);
    } else {
      navigate("/classes");
    }
  };
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full max-w-10xl mx-auto">
          {/* Nagłówek + filtracja */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Classes Table</h2>
            <div className="flex gap-2">
              <div className="relative inline-block">
                <select
                  className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm
                  focus:outline-none focus:border-teal-400 block w-64 md:w-80 truncate appearance-none"
                  value={selectedSchoolId}
                  onChange={handleFilterSchool}
                  title={
                    selectedSchoolId
                      ? schools.find((s) => s.id === selectedSchoolId)?.name ??
                        ""
                      : "Wszystkie szkoły"
                  }
                >
                  <option value="">Wszystkie szkoły</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
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
              <button
                onClick={() => {
                  if (!selectedSchoolId) {
                    setMessageType("error");
                    setMessage("Wybierz szkołę, do której chcesz dodać klasę!");
                    return;
                  }
                  setMessageType(""); // czyść poprzedni typ
                  setMessage("");
                  setShowAddInput(true);
                }}
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                + Add Class
              </button>
            </div>
          </div>
          {/* Dodawanie klasy */}
          {showAddInput && selectedSchoolId && (
            <form
              onSubmit={handleAddClass}
              className="mb-7 flex gap-2 items-end"
            >
              <input
                type="text"
                placeholder="Nazwa klasy"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-teal-400"
                disabled={!selectedSchoolId}
                autoFocus
              />
              <button
                type="submit"
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
                disabled={!selectedSchoolId}
              >
                Dodaj
              </button>
              <button
                type="button"
                className="ml-2 text-gray-400 font-semibold hover:bg-gray-100 rounded px-4 py-2 transition"
                onClick={() => {
                  setShowAddInput(false);
                  setNewClassName("");
                }}
              >
                Anuluj
              </button>
            </form>
          )}

          {/* Wiadomości */}
          {message && (
            <div
              className={`mb-4 text-center font-medium text-sm rounded-lg py-2 px-4 ${
                messageType === "error"
                  ? "text-red-600 bg-red-50"
                  : "text-teal-600 bg-teal-50"
              }`}
            >
              {message}
            </div>
          )}
          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-md overflow-x-auto w-full">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    CLASS NAME
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    SCHOOL NAME
                  </th>
                  <th className="w-40"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : classes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-gray-400">
                      No classes to display.
                    </td>
                  </tr>
                ) : (
                  classes.map((cls, idx) => (
                    <tr
                      key={cls.id}
                      className="transition hover:bg-gray-50"
                      style={{
                        borderColor: "#ececec",
                        borderWidth: idx !== classes.length - 1 ? "0.2px" : 0,
                      }}
                    >
                      <td className="flex items-center gap-4 py-5 pl-6 min-w-[210px]" onDoubleClick={() => navigate(`/students?school=${cls.schoolId}&class=${cls.id}`)}>
                        {editId === cls.id ? (
                          <div className="flex gap-2 items-center w-full">
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-52 focus:outline-none focus:border-teal-400"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                            />
                            <button
                              className="text-teal-500 font-semibold px-2 py-1 hover:bg-teal-50 rounded transition"
                              onClick={() =>
                                handleSaveEdit(cls.id, cls.schoolId)
                              }
                              type="button"
                            >
                              Save
                            </button>
                            <button
                              className="text-gray-400 font-semibold px-2 py-1 hover:bg-gray-100 rounded transition"
                              onClick={handleCancelEdit}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <Link
                            to={`/students?school=${cls.schoolId}&class=${cls.id}`}
                            className="hover:underline text-gray-800 font-semibold text-base"
                          >
                            {cls.name}
                          </Link>
                        )}
                      </td>
                      <td className="pl-6 text-gray-500 min-w-[180px]">
                        {cls.schoolName ||
                          schools.find((s) => s.id === cls.schoolId)?.name ||
                          ""}
                      </td>
                      <td className="pr-6 text-right">
                        {editId === cls.id ? null : (
                          <div className="flex gap-3 justify-end">
                            <button
                              className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                              onClick={() => handleStartEdit(cls)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                              onClick={() =>
                                handleDeleteClass(cls.id, cls.schoolId)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Classes;
