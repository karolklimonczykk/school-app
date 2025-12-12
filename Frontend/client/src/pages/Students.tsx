import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

// Typy
type School = { id: number; name: string };
type SchoolClass = { id: number; name: string; schoolId: number };
type Student = {
  id: number;
  firstName: string;
  lastName: string;
    gender?: "M" | "K" | "N" | null;
  codeNumber?: string | null;
  order: number;
  classId: number;
  class?: { id: number; name: string; school: School };
};

const Students: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [newStudent, setNewStudent] = useState({
    firstName: "",
    lastName: "",
    gender: "N" as "M" | "K" | "N",
    codeNumber: "",
  });

  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editStudent, setEditStudent] = useState({
    firstName: "",
    lastName: "",
     gender: "N" as "M" | "K" | "N",
    codeNumber: "",
  });
  const [showAddInput, setShowAddInput] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { push } = useToast();

  const tokenHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // 1. Pobierz szkoły na start
  useEffect(() => {
    fetchSchools();
  }, []);

  // 2. Ustaw pre-filtry na podstawie query stringa
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const schoolQuery = params.get("school");
    const classQuery = params.get("class");
    setSelectedSchoolId(schoolQuery ? Number(schoolQuery) : "");
    setSelectedClassId(classQuery ? Number(classQuery) : "");
  }, [location.search]);

  // 3. Po wybraniu szkoły pobierz klasy
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const classQuery = params.get("class");
    if (!classQuery) setSelectedClassId("");
    if (selectedSchoolId) fetchClasses(selectedSchoolId);
    else setClasses([]);
    // eslint-disable-next-line
  }, [selectedSchoolId]);

  // 4. Synchronizacja selectedClassId z klasami (ważne!)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const classQuery = params.get("class");
    if (classQuery && classes.length > 0) {
      if (classes.some((c) => c.id === Number(classQuery))) {
        setSelectedClassId(Number(classQuery));
      } else {
        setSelectedClassId("");
      }
    }
  }, [classes, location.search]);

  // 5. Pobieranie uczniów (w zależności od filtrów)
  useEffect(() => {
    if (selectedSchoolId && !selectedClassId) {
      setLoading(true);
      axios
        .get<Student[]>("http://localhost:4000/students", {
          headers: tokenHeader(),
        })
        .then((res) => {
          const filtered = res.data.filter(
            (s: Student) =>
              s.class &&
              s.class.school &&
              s.class.school.id === selectedSchoolId
          );
          setStudents(filtered);
        })
        .catch(() => {
          push({ type: "error", message: "Błąd pobierania uczniów!" });
          setStudents([]);
        })
        .finally(() => setLoading(false));
    } else if (selectedSchoolId && selectedClassId) {
      fetchStudents(selectedSchoolId, selectedClassId);
    } else if (!selectedSchoolId && !selectedClassId && schools.length > 0) {
      fetchAllStudents();
    } else setStudents([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, selectedClassId, schools]);

  // Zamykanie formularza po wyczyszczeniu filtrów
  useEffect(() => {
    if (!selectedSchoolId || !selectedClassId) {
      setShowAddInput(false);
      setNewStudent({ firstName: "", lastName: "", gender: "N", codeNumber: "" });
    }
  }, [selectedSchoolId, selectedClassId]);

  // --- API CALLS ---
  const fetchSchools = async () => {
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: tokenHeader(),
      });
      setSchools(res.data);
    } catch {
      push({ type: "error", message: "Błąd pobierania szkół!" });
    }
  };

  const fetchClasses = async (schoolId: number | "") => {
    if (!schoolId) return;
    try {
      const res = await axios.get<SchoolClass[]>(
        `http://localhost:4000/schools/${schoolId}/classes`,
        { headers: tokenHeader() }
      );
      setClasses(res.data);
    } catch {
      push({ type: "error", message: "Błąd pobierania klas!" });
      setClasses([]);
    }
  };

  const fetchAllStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Student[]>("http://localhost:4000/students", {
        headers: tokenHeader(),
      });
      setStudents(res.data);
    } catch {
      push({ type: "error", message: "Błąd pobierania uczniów!" });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (schoolId: number | "", classId: number | "") => {
    if (!schoolId || !classId) return;
    setLoading(true);
    try {
      const res = await axios.get<Student[]>(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
        { headers: tokenHeader() }
      );
      setStudents(res.data);
    } catch {
      push({ type: "error", message: "Błąd pobierania uczniów!" });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD STUDENTS ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      push({ type: "error", message: "Wybierz szkołę!" });
      return;
    }
    if (!selectedClassId) {
      push({ type: "error", message: "Wybierz klasę!" });
      return;
    }
    try {
      const res = await axios.post<Student>(
        `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students`,
        newStudent,
        { headers: tokenHeader() }
      );
      setStudents([...students, res.data]);
      setNewStudent({ firstName: "", lastName: "", gender: "N", codeNumber: "" });
      setShowAddInput(false);
      push({ type: "success", message: "Uczeń dodany!" });
    } catch (err: unknown) {
      push({
        type: "error",
        message: axios.isAxiosError(err)
          ? err.response?.data?.error || "Błąd dodawania ucznia"
          : "Błąd dodawania ucznia",
      });
    }
  };

  const handleStartEdit = (student: Student) => {
    setEditId(student.id);
    setEditStudent({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: (student.gender ?? "N") as "M" | "K" | "N",
      codeNumber: student.codeNumber ?? "",
    });
  };

  const handleSaveEdit = async (
    studentId: number,
    schoolId: number,
    classId: number
  ) => {
    try {
      const res = await axios.put(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${studentId}`,
        editStudent,
        { headers: tokenHeader() }
      );

      // Zachowaj relację 'class' (żeby nie znikła w tabeli)
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, ...res.data, class: s.class } : s
        )
      );

      setEditId(null);
      setEditStudent({ firstName: "", lastName: "", gender: "M", codeNumber: "" });
      push({ type: "success", message: "Uczeń zaktualizowany!" });
    } catch (err: unknown) {
      push({
        type: "error",
        message: axios.isAxiosError(err)
          ? err.response?.data?.error || "Błąd edycji ucznia"
          : "Błąd edycji ucznia",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "N", codeNumber: "" });
  };

  const handleDeleteStudent = async (
    studentId: number,
    schoolId: number,
    classId: number
  ) => {
    if (!window.confirm("Na pewno usunąć ucznia?")) return;
    try {
      await axios.delete(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${studentId}`,
        { headers: tokenHeader() }
      );
      setStudents(students.filter((s) => s.id !== studentId));
      push({ type: "success", message: "Uczeń usunięty!" });
    } catch (err: unknown) {
      push({
        type: "error",
        message: axios.isAxiosError(err)
          ? err.response?.data?.error || "Błąd usuwania ucznia"
          : "Błąd usuwania ucznia",
      });
    }
  };

  // Obsługa filtracji i query stringa
  const handleFilterSchool = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSchoolId(value ? Number(value) : "");
    setSelectedClassId("");
    if (value) navigate(`/students?school=${value}`);
    else navigate("/students");
    setShowAddInput(false);
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M", codeNumber: "" });
  };

  const handleFilterClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedClassId(value ? Number(value) : "");
    if (value && selectedSchoolId)
      navigate(`/students?school=${selectedSchoolId}&class=${value}`);
    else if (selectedSchoolId) navigate(`/students?school=${selectedSchoolId}`);
    else navigate("/students");
    setShowAddInput(false);
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M", codeNumber: "" });
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
          {/* Nagłówek + filtracja */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">
              Tabela uczniów
            </h2>
            <div className="flex gap-2 flex-wrap justify-center items-center">
              {/* SELECT SZKOŁY */}
              <div className="relative inline-block">
                <select
                  className="border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm
                  focus:outline-none focus:border-teal-400 block w-64 md:w-80 truncate appearance-none"
                  value={selectedSchoolId}
                  onChange={handleFilterSchool}
                  title={currentSchoolName}
                >
                  <option value="">Wszystkie szkoły</option>
                  {schools.map((school) => (
                    <option value={school.id} key={school.id}>
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

              {/* SELECT KLASY */}
              <div className="relative inline-block">
                <select
                  className="appearance-none border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm
                             focus:outline-none focus:border-teal-400 truncate"
                  value={selectedClassId}
                  onChange={handleFilterClass}
                  title={currentClassName}
                  disabled={!selectedSchoolId}
                >
                  <option value="">Wszystkie klasy</option>
                  {classes.map((cls) => (
                    <option value={cls.id} key={cls.id}>
                      {cls.name}
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

              {/* PRZYCISK DODAWANIA */}
              <button
                onClick={() => {
                  if (!selectedSchoolId) {
                    push({ type: "error", message: "Wybierz szkołę!" });
                    return;
                  }
                  if (!selectedClassId) {
                    push({ type: "error", message: "Wybierz klasę!" });
                    return;
                  }
                  setShowAddInput(true);
                }}
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                + Dodaj ucznia
              </button>
            </div>
          </div>

          {/* Dodawanie ucznia */}
          {showAddInput && selectedSchoolId && selectedClassId && (
            <form
              onSubmit={handleAddStudent}
              className="mb-7 w-full flex flex-col gap-2 md:flex-row md:items-end"
            >
              {/* Imię */}
              <div className="w-full md:basis-1/4">
                <input
                  type="text"
                  placeholder="Imię"
                  value={newStudent.firstName}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, firstName: e.target.value })
                  }
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-teal-400"
                  autoFocus
                />
              </div>

              {/* Nazwisko */}
              <div className="w-full md:basis-1/2">
                <input
                  type="text"
                  placeholder="Nazwisko"
                  value={newStudent.lastName}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, lastName: e.target.value })
                  }
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Numer z dziennika */}
              <div className="w-full md:basis-1/6">
                <input
                  type="text"
                  placeholder="Nr z dziennika"
                  value={newStudent.codeNumber}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, codeNumber: e.target.value })
                  }
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Płeć */}
              <div className="w-full md:basis-1/6 relative">
                <select
                  value={newStudent.gender ?? "N"}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, gender: e.target.value as "M" | "K" | "N" })
                  }
                  required
                  className="appearance-none border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-teal-400"
                  title="Płeć"
                >
                  <option value="" disabled hidden>
                    Wybierz płeć
                  </option>
                  <option value="M">Mężczyzna</option>
                  <option value="K">Kobieta</option>
                  <option value="N">Nieznana</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>

              {/* Akcje */}
              <div className="flex gap-2 md:ml-2">
                <button
                  type="submit"
                  className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
                >
                  Dodaj
                </button>
                <button
                  type="button"
                  className="text-gray-400 font-semibold hover:bg-gray-100 rounded px-4 py-2 transition"
                  onClick={() => {
                    setShowAddInput(false);
                    setNewStudent({ firstName: "", lastName: "", gender: "N", codeNumber: "" });
                  }}
                >
                  Anuluj
                </button>
              </div>
            </form>
          )}

          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-md w-full overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    UCZEŃ
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    NR
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    NAZWA SZKOŁY
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    NAZWA KLASY
                  </th>
                  <th className="w-40"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      Ładowanie...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      Brak uczniów do wyświetlenia.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr
                      key={student.id}
                      className="transition hover:bg-gray-50"
                      style={{
                        borderColor: "#ececec",
                        borderWidth: idx !== students.length - 1 ? "0.2px" : 0,
                      }}
                    >
                      <td className="flex items-center gap-4 py-5 pl-6 min-w-[210px]">
                        {editId === student.id ? (
                          <div className="flex gap-2 items-center w-full flex-wrap">
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-32 focus:outline-none focus:border-teal-400"
                              value={editStudent.firstName}
                              onChange={(e) =>
                                setEditStudent({
                                  ...editStudent,
                                  firstName: e.target.value,
                                })
                              }
                              autoFocus
                            />
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-40 focus:outline-none focus:border-teal-400"
                              value={editStudent.lastName}
                              onChange={(e) =>
                                setEditStudent({
                                  ...editStudent,
                                  lastName: e.target.value,
                                })
                              }
                            />
                            <div className="relative inline-block">
                              <select
                                className="border border-gray-300 rounded-lg px-2 pr-6 py-1 w-16 focus:outline-none focus:border-teal-400 appearance-none"
                                value={editStudent.gender}
                                onChange={(e) =>
                                  setEditStudent({
                                    ...editStudent,
                                    gender: e.target.value as "M"|"K"|"N",
                                  })
                                }
                              >
                                <option value="M">M</option>
                                <option value="K">K</option>
                                <option value="N">N</option>
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
                        ) : (
                          <span className="text-gray-800 font-semibold text-base break-all">
                            {student.firstName} {student.lastName}
                            {student.gender && student.gender !== "N" ? ` (${student.gender})` : ""}
                          </span>
                        )}
                      </td>
                      <td className="pl-6 text-gray-500 min-w-[60px]">
                        {editId === student.id ? (
                          <input
                            className="border border-gray-300 rounded-lg px-2 py-1 w-16 focus:outline-none focus:border-teal-400"
                            value={editStudent.codeNumber}
                            onChange={(e) =>
                              setEditStudent({
                                ...editStudent,
                                codeNumber: e.target.value,
                              })
                            }
                            placeholder="Nr"
                          />
                        ) : (
                          student.codeNumber || "-"
                        )}
                      </td>
                      <td className="pl-6 text-gray-500 min-w-[180px]">
                        {student.class?.school?.name ||
                          schools.find(
                            (s) =>
                              s.id ===
                              classes.find((c) => c.id === student.classId)
                                ?.schoolId
                          )?.name ||
                          ""}
                      </td>
                      <td className="pl-6 text-gray-500 min-w-[140px]">
                        {student.class?.name ||
                          classes.find((c) => c.id === student.classId)?.name ||
                          ""}
                      </td>
                      <td className="pr-6 text-right">
                        <div className="flex gap-3 justify-center">
                          {editId === student.id ? (
                            <>
                              <button
                                className="text-teal-500 font-semibold px-2 py-1 hover:bg-teal-50 rounded transition"
                                onClick={() =>
                                  handleSaveEdit(
                                    student.id,
                                    student.class?.school?.id ??
                                      (classes.find(
                                        (c) => c.id === student.classId
                                      )?.schoolId as number),
                                    student.classId
                                  )
                                }
                                type="button"
                              >
                                Zapisz
                              </button>
                              <button
                                className="text-gray-400 font-semibold px-2 py-1 hover:bg-gray-100 rounded transition"
                                onClick={handleCancelEdit}
                                type="button"
                              >
                                Anuluj
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                                onClick={() => handleStartEdit(student)}
                              >
                                Edytuj
                              </button>
                              <button
                                className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                                onClick={() =>
                                  handleDeleteStudent(
                                    student.id,
                                    student.class?.school?.id ??
                                      (classes.find(
                                        (c) => c.id === student.classId
                                      )?.schoolId as number),
                                    student.classId
                                  )
                                }
                              >
                                Usuń
                              </button>
                            </>
                          )}
                        </div>
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

export default Students;
