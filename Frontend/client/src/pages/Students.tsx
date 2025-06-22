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
  const [newStudent, setNewStudent] = useState({ firstName: "", lastName: "", gender: "M" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editStudent, setEditStudent] = useState({ firstName: "", lastName: "", gender: "M" });
  const [showAddInput, setShowAddInput] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // 1. Pobierz szkoły na start
  useEffect(() => { fetchSchools(); }, []);

  // 2. Ustaw pre-filtry na podstawie query stringa
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const schoolQuery = params.get("school");
    const classQuery = params.get("class");
    setSelectedSchoolId(schoolQuery ? Number(schoolQuery) : "");
    setSelectedClassId(classQuery ? Number(classQuery) : "");
    // eslint-disable-next-line
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
      if (classes.some(c => c.id === Number(classQuery))) {
        setSelectedClassId(Number(classQuery));
      } else {
        setSelectedClassId("");
      }
    }
    // eslint-disable-next-line
  }, [classes]);

  // 5. Pobieranie uczniów (w zależności od filtrów)
  useEffect(() => {
    if (selectedSchoolId && !selectedClassId) {
      setLoading(true); setMessage("");
      const token = localStorage.getItem("token");
      axios.get<Student[]>("http://localhost:4000/students", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        const filtered = res.data.filter(
          (s: Student) => s.class && s.class.school && s.class.school.id === selectedSchoolId
        );
        setStudents(filtered);
      }).catch(() => {
        setMessage("Błąd pobierania uczniów!");
        setStudents([]);
      }).finally(() => setLoading(false));
    }
    else if (selectedSchoolId && selectedClassId) {
      fetchStudents(selectedSchoolId, selectedClassId);
    }
    else if (!selectedSchoolId && !selectedClassId && schools.length > 0) {
      fetchAllStudents();
    }
    else setStudents([]);
    // eslint-disable-next-line
  }, [selectedSchoolId, selectedClassId, schools]);

  // --- API CALLS ---
  const fetchSchools = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchools(res.data);
    } catch { setMessage("Błąd pobierania szkół!"); }
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
    } catch { setMessage("Błąd pobierania klas!"); setClasses([]); }
  };

  const fetchAllStudents = async () => {
    setLoading(true); setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Student[]>(
        "http://localhost:4000/students",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data);
    } catch {
      setMessage("Błąd pobierania uczniów!");
      setStudents([]);
    } finally { setLoading(false); }
  };

  const fetchStudents = async (schoolId: number | "", classId: number | "") => {
    if (!schoolId || !classId) return;
    setLoading(true); setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Student[]>(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data);
    } catch {
      setMessage("Błąd pobierania uczniów!");
      setStudents([]);
    } finally { setLoading(false); }
  };

  // --- CRUD STUDENTS ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId || !selectedClassId) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<Student>(
        `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students`,
        newStudent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents([...students, res.data]);
      setNewStudent({ firstName: "", lastName: "", gender: "M" });
      setShowAddInput(false);
      setMessage("Uczeń dodany!");
    } catch (err: unknown) {
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
  const handleSaveEdit = async (studentId: number) => {
    if (!selectedSchoolId || !selectedClassId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await axios.put<Student>(
        `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students/${studentId}`,
        editStudent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(students.map((s) => (s.id === studentId ? res.data : s)));
      setEditId(null);
      setEditStudent({ firstName: "", lastName: "", gender: "M" });
      setMessage("Uczeń zaktualizowany!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd edycji ucznia");
      } else {
        setMessage("Błąd edycji ucznia");
      }
    }
  };
  const handleCancelEdit = () => {
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
  };

  const handleDeleteStudent = async (studentId: number) => {
    if (!selectedSchoolId || !selectedClassId) return;
    if (!window.confirm("Na pewno usunąć ucznia?")) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      await axios.delete(
        `http://localhost:4000/schools/${selectedSchoolId}/classes/${selectedClassId}/students/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(students.filter((s) => s.id !== studentId));
      setMessage("Uczeń usunięty!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd usuwania ucznia");
      } else {
        setMessage("Błąd usuwania ucznia");
      }
    }
  };

  // --- UTILS ---
  const getInitials = (firstName: string, lastName: string) =>
    (firstName[0] || "") + (lastName[0] || "");

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
  };
  const handleFilterClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedClassId(value ? Number(value) : "");
    if (value && selectedSchoolId) navigate(`/students?school=${selectedSchoolId}&class=${value}`);
    else if (selectedSchoolId) navigate(`/students?school=${selectedSchoolId}`);
    else navigate("/students");
    setShowAddInput(false);
    setEditId(null);
    setEditStudent({ firstName: "", lastName: "", gender: "M" });
    setMessage("");
  };

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px] overflow-hidden">
        <div className="w-full mx-auto">
          {/* Nagłówek + filtracja */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Students Table</h2>
            <div className="flex gap-2 flex-wrap justify-center">
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400"
                value={selectedSchoolId}
                onChange={handleFilterSchool}
              >
                <option value="">Wszystkie szkoły</option>
                {schools.map((school) => (
                  <option value={school.id} key={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400"
                value={selectedClassId}
                onChange={handleFilterClass}
                disabled={!selectedSchoolId}
              >
                <option value="">Wszystkie klasy</option>
                {classes.map((cls) => (
                  <option value={cls.id} key={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowAddInput(true)}
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
                disabled={!selectedSchoolId || !selectedClassId}
              >
                + Add Student
              </button>
            </div>
          </div>
          {/* Dodawanie ucznia */}
          {showAddInput && (
            <form onSubmit={handleAddStudent} className="mb-7 flex gap-2 items-end flex-wrap">
              <input
                type="text"
                placeholder="Imię"
                value={newStudent.firstName}
                onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-teal-400"
                disabled={!selectedSchoolId || !selectedClassId}
                autoFocus
              />
              <input
                type="text"
                placeholder="Nazwisko"
                value={newStudent.lastName}
                onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-teal-400"
                disabled={!selectedSchoolId || !selectedClassId}
              />
              <select
                value={newStudent.gender}
                onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white font-medium text-sm focus:outline-none focus:border-teal-400"
                disabled={!selectedSchoolId || !selectedClassId}
              >
                <option value="M">M</option>
                <option value="K">K</option>
              </select>
              <button
                type="submit"
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
                disabled={!selectedSchoolId || !selectedClassId}
              >
                Dodaj
              </button>
              <button
                type="button"
                className="ml-2 text-gray-400 font-semibold hover:bg-gray-100 rounded px-4 py-2 transition"
                onClick={() => {
                  setShowAddInput(false);
                  setNewStudent({ firstName: "", lastName: "", gender: "M" });
                }}
              >
                Anuluj
              </button>
            </form>
          )}

          {/* Wiadomości */}
          {message && (
            <div className="mb-4 text-center font-medium text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-4">
              {message}
            </div>
          )}
          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-md w-full overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">STUDENT NAME</th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">SCHOOL NAME</th>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">CLASS NAME</th>
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
                        <div className="w-12 h-12 bg-[#f7fafc] flex items-center justify-center rounded-xl text-teal-400 text-xl font-bold shadow-sm">
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        {editId === student.id ? (
                          <div className="flex gap-2 items-center w-full flex-wrap">
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-28 focus:outline-none focus:border-teal-400"
                              value={editStudent.firstName}
                              onChange={(e) => setEditStudent({ ...editStudent, firstName: e.target.value })}
                              autoFocus
                            />
                            <input
                              className="border border-gray-300 rounded-lg px-3 py-1 w-28 focus:outline-none focus:border-teal-400"
                              value={editStudent.lastName}
                              onChange={(e) => setEditStudent({ ...editStudent, lastName: e.target.value })}
                            />
                            <select
                              className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-teal-400"
                              value={editStudent.gender}
                              onChange={(e) => setEditStudent({ ...editStudent, gender: e.target.value })}
                            >
                              <option value="M">M</option>
                              <option value="K">K</option>
                            </select>
                            <button
                              className="text-teal-500 font-semibold px-2 py-1 hover:bg-teal-50 rounded transition"
                              onClick={() => handleSaveEdit(student.id)}
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
                            {student.firstName} {student.lastName} ({student.gender})
                          </span>
                        )}
                      </td>
                      <td className="pl-6 text-gray-500 min-w-[180px]">
                        {student.class?.school?.name ||
                          schools.find((s) => s.id === classes.find((c) => c.id === student.classId)?.schoolId)?.name ||
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
                              onClick={() => handleDeleteStudent(student.id)}
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
