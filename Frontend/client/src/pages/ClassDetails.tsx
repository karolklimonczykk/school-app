import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

// Typ ucznia
type Student = {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  order: number;
  classId: number;
};

const ClassDetails: React.FC = () => {
  const { schoolId, classId } = useParams<{ schoolId: string; classId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [message, setMessage] = useState("");
  const [newStudent, setNewStudent] = useState({ firstName: "", lastName: "", gender: "M" });

  // Pobierz uczniów po załadowaniu komponentu
  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line
  }, [schoolId, classId]);

  const fetchStudents = async () => {
    if (!schoolId || !classId) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<Student[]>(`http://localhost:4000/schools/${schoolId}/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd pobierania uczniów");
      } else {
        setMessage("Błąd pobierania uczniów");
      }
    }
  };

  // Dodaj ucznia
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || !classId) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<Student>(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
        newStudent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents([...students, res.data]);
      setNewStudent({ firstName: "", lastName: "", gender: "M" });
      setMessage("Uczeń dodany!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd dodawania ucznia");
      } else {
        setMessage("Błąd dodawania ucznia");
      }
    }
  };

  // Edytuj ucznia
  const handleEditStudent = async (student: Student) => {
    const firstName = prompt("Nowe imię:", student.firstName);
    const lastName = prompt("Nowe nazwisko:", student.lastName);
    const gender = prompt("Nowa płeć (M/K):", student.gender);
    if (!firstName || !lastName || !gender) return;
    const token = localStorage.getItem("token");
    try {
      const res = await axios.put<Student>(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${student.id}`,
        { firstName, lastName, gender },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(students.map(s => (s.id === student.id ? res.data : s)));
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            setMessage(err.response?.data?.error || "Błąd edycji ucznia");
        } else {
            setMessage("Błąd edycji ucznia");
        }
        }
  };

  // Usuń ucznia
  const handleDeleteStudent = async (studentId: number) => {
    if (!window.confirm("Na pewno usunąć ucznia?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(
        `http://localhost:4000/schools/${schoolId}/classes/${classId}/students/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(students.filter(s => s.id !== studentId));
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            setMessage(err.response?.data?.error || "Błąd usuwania ucznia");
        } else {
            setMessage("Błąd usuwania ucznia");
        }
        }
  };

  return (
    <div>
      <h2>Uczniowie w klasie (ID: {classId})</h2>
      <ul>
        {students.map(student => (
          <li key={student.id}>
            {student.firstName} {student.lastName} ({student.gender}){" "}
            <button onClick={() => handleEditStudent(student)}>Edytuj</button>{" "}
            <button onClick={() => handleDeleteStudent(student.id)}>Usuń</button>
          </li>
        ))}
      </ul>
      <h3>Dodaj ucznia</h3>
      <form onSubmit={handleAddStudent}>
        <input
          type="text"
          placeholder="Imię"
          value={newStudent.firstName}
          onChange={e => setNewStudent({ ...newStudent, firstName: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Nazwisko"
          value={newStudent.lastName}
          onChange={e => setNewStudent({ ...newStudent, lastName: e.target.value })}
          required
        />
        <select
          value={newStudent.gender}
          onChange={e => setNewStudent({ ...newStudent, gender: e.target.value })}
        >
          <option value="M">M</option>
          <option value="K">K</option>
        </select>
        <button type="submit">Dodaj ucznia</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default ClassDetails;
