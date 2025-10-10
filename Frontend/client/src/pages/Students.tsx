import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";

// Typy
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

const Students: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | "">("");
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [newStudent, setNewStudent] = useState({
    firstName: "",
    lastName: "",
    gender: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"" | "error" | "success">("");
  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editStudent, setEditStudent] = useState({
    firstName: "",
    lastName: "",
    gender: "M",
  });
  const [showAddInput, setShowAddInput] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

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
      setMessage("");
      setMessageType("");
      const token = localStorage.getItem("token");
      axios
        .get<Student[]>("http://localhost:4000/students", {
          headers: { Authorization: `Bearer ${token}` },
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
          setMessageType("error");
          setMessage("Błąd pobierania uczniów!");
          setStudents([]);
        })
        .finally(() => setLoading(false));
    } else if (selectedSchoolId && selectedClassId) {
      fetchStudents(selectedSchoolId, selectedClassId);
    } else if (!selectedSchoolId && !selectedClassId && schools.length > 0) {
      fetchAllStudents();
    } else setStudents([]);
  }, [selectedSchoolId, selectedClassId, schools]);

  // Zamykanie formularza po wyczyszczeniu filtrów
  useEffect(() => {
    if (!selectedSchoolId || !selectedClassId) {
      setShowAddInput(false);
      setNewStudent({ firstName: "", lastName: "", gender: "" });
    }
  }, [selectedSchoolId, selectedClassId]);

  // --- API CALLS ---
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

  const fetchClasses = async (schoolId: number | "") => {
    if (!schoolId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<SchoolClass[]>(
        `http://localhost:4000/schools/${schoolId}/classes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClasses(res.data);
    } catch {
      setMessageType("error");
      setMessage("Błąd pobierania klas!");
      setClasses([]);
    }
  };

  const fetchAllStudents = async () => {
    setLoading(true);
    setMessage("");
    setMessageType("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Student[]>("http://localhost:4000/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch {
      setMessageType("error");
      setMessage("Błąd pobierania uczniów!");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (schoolId: number | "", classId: number | "") => {
    if (!schoolId || !classId) return;
    setLoading(true);
    setMessage("");
    setMessageType("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Student[]>(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data);
    } catch {
      setMessageType("error");
      setMessage("Błąd pobierania uczniów!");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD STUDENTS ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      setMessageType("error");
      setMessage("Wybierz szkołę");
      return;
    }
    if (!selectedClassId) {
      setMessageType("error");
      setMessage("Wybierz klasę");
      return;
    }
    setMessage("");
    setMessageType("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<Student>(
        `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students`,
        newStudent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents([...students, res.data]);
      setNewStudent({ firstName: "", lastName: "", gender: "" });
      setShowAddInput(false);
      setMessageType("success");
      setMessage("Uczeń dodany!");
    } catch (err: unknown) {
      setMessageType("error");
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd dodawania ucznia");
      } else {
        setMessage("Błąd dodawania ucznia");
      }
    }
  };

  const handleStartEdit = (student: Student) => {
    setEditId(student.id);
    setEditStudent({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
    });
  };
  const handleSaveEdit = async (studentId: number, schoolId: number, classId: number) => {
  const token = localStorage.getItem("token");
  try {
    const res = await axios.put(
      `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${studentId}`,
      editStudent,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // KLUCZ: nie kasuj s.class – zachowaj ją po update
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, ...res.data, class: s.class } // <- zachowujemy relację
          : s
      )
    );

    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
    setMessageType("success");
    setMessage("Uczeń zaktualizowany!");
  } catch (err: unknown) {
    setMessageType("error");
    setMessage(
      axios.isAxiosError(err)
        ? err.response?.data?.error || "Błąd edycji ucznia"
        : "Błąd edycji ucznia"
    );
  }
};

  const handleCancelEdit = () => {
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
  };

  const handleDeleteStudent = async (
    studentId: number,
    schoolId: number,
    classId: number
  ) => {
    if (!window.confirm("Na pewno usunąć ucznia?")) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      await axios.delete(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(students.filter((s) => s.id !== studentId));
      setMessage("Uczeń usunięty!");
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.error || "Błąd usuwania ucznia"
          : "Błąd usuwania ucznia"
      );
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
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
    setMessage("");
    setMessageType("");
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
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
    setMessage("");
    setMessageType("");
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
              Students Table
            </h2>
            <div className="flex gap-2 flex-wrap justify-center items-center">
              {/* SELECT SZKOŁY */}
              <div className="relative inline-block">
                <select
                  className="appearance-none border border-gray-300 rounded-lg px-3 pr-10 py-2 bg-white font-medium text-sm
                             focus:outline-none focus:border-teal-400 truncate"
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

              {/* PRZYCISK DODAWANIA – nie wyłączamy; pokazujemy błąd jeśli brak wyboru */}
              <button
                onClick={() => {
                  if (!selectedSchoolId) {
                    setMessageType("error");
                    setMessage("Wybierz szkołę!");
                    return;
                  }
                  if (!selectedClassId) {
                    setMessageType("error");
                    setMessage("Wybierz klasę!");
                    return;
                  }
                  setMessage("");
                  setMessageType("");
                  setShowAddInput(true);
                }}
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                + Add Student
              </button>
            </div>
          </div>

          {/* Komunikaty */}
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

          {/* Dodawanie ucznia */}
          {showAddInput && selectedSchoolId && selectedClassId && (
            <form
              onSubmit={handleAddStudent}
              className="mb-7 w-full flex flex-col gap-2 md:flex-row md:items-end"
            >
              {/* Imię – full width na mobile, 1/4 od md */}
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

              {/* Nazwisko – full width na mobile, 1/2 od md */}
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

              {/* Płeć – full width na mobile, 1/4 od md; TE SAME style co inputy */}
              <div className="w-full md:basis-1/4 relative">
                <select
                  value={newStudent.gender}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, gender: e.target.value })
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

              {/* Akcje – zostawiamy obok na md+, a na mobile pod spodem */}
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
                    setNewStudent({ firstName: "", lastName: "", gender: "" });
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
                    STUDENT NAME
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    SCHOOL NAME
                  </th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    CLASS NAME
                  </th>
                  <th className="w-40"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-400">
                      No students to display.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr
                      key={student.id}
                      className={idx !== students.length - 1 ? "border-b" : ""}
                      style={{
                        borderColor: "#ececec",
                        borderWidth: idx !== students.length - 1 ? "0.5px" : 0,
                      }}
                    >
                      <td className="flex items-center gap-4 py-5 pl-6 min-w-[210px]">
                        {editId === student.id ? (
                          <div className="flex gap-2 items-center w-full flex-wrap">
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-28 focus:outline-none focus:border-teal-400"
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
                              className="border border-gray-300 rounded-lg px-3 py-1 w-28 focus:outline-none focus:border-teal-400"
                              value={editStudent.lastName}
                              onChange={(e) =>
                                setEditStudent({
                                  ...editStudent,
                                  lastName: e.target.value,
                                })
                              }
                            />
                            <select
                              className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400"
                              value={editStudent.gender}
                              onChange={(e) =>
                                setEditStudent({
                                  ...editStudent,
                                  gender: e.target.value,
                                })
                              }
                            >
                              <option value="M">M</option>
                              <option value="K">K</option>
                            </select>
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
                          <span className="text-gray-800 font-semibold text-base break-all">
                            {student.firstName} {student.lastName} (
                            {student.gender})
                          </span>
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
                        {editId === student.id ? null : (
                          <div className="flex gap-3 justify-end">
                            <button
                              className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                              onClick={() => handleStartEdit(student)}
                            >
                              Edit
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

export default Students;
