import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { Link } from "react-router-dom";

// Typ szkoły
type School = {
  id: number;
  name: string;
  ownerId: number;
};

const Schools: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    fetchSchools();
  }, []);

  // Pobierz szkoły
  const fetchSchools = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchools(res.data);
    } catch {
      setMessage("Nie udało się pobrać szkół (upewnij się, że jesteś zalogowany/a)");
    }
  };

  // Dodaj szkołę
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<School>(
        "http://localhost:4000/schools",
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSchools([...schools, res.data]);
      setName("");
      setShowForm(false);
      setMessage("Szkoła dodana!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd dodawania szkoły");
      } else {
        setMessage("Błąd dodawania szkoły");
      }
    }
  };

  // Rozpocznij edycję
  const handleStartEdit = (school: School) => {
    setEditId(school.id);
    setEditName(school.name);
  };

  // Zapisz edycję
  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    const token = localStorage.getItem("token");
    try {
      await axios.put(
        `http://localhost:4000/schools/${id}`,
        { name: editName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSchools(schools.map(s => (s.id === id ? { ...s, name: editName } : s)));
      setEditId(null);
      setEditName("");
      setMessage("Nazwa szkoły została zmieniona.");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd edycji szkoły");
      } else {
        setMessage("Błąd edycji szkoły");
      }
    }
  };

  // Anuluj edycję
  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // Usuń szkołę
  const handleDeleteSchool = async (id: number) => {
    if (!window.confirm("Na pewno usunąć szkołę?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`http://localhost:4000/schools/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchools(schools.filter(s => s.id !== id));
      setMessage("Szkoła została usunięta.");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd usuwania szkoły");
      } else {
        setMessage("Błąd usuwania szkoły");
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px]">
        <div className="w-full max-w-100% mx-auto">
          {/* Header + Dodaj szkołę */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Schools Table</h2>
            <button
              onClick={() => setShowForm(f => !f)}
              className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
            >
              + Add School
            </button>
          </div>
          {/* Form dodawania */}
          {showForm && (
            <form onSubmit={handleAddSchool} className="mb-7 flex gap-2 items-end">
              <input
                type="text"
                placeholder="Nazwa szkoły"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                Dodaj
              </button>
            </form>
          )}
          {/* Info */}
          {message && (
            <div className="mb-4 text-center font-medium text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-4">
              {message}
            </div>
          )}
          {/* Karta z tabelą */}
          <div className="bg-white rounded-xl shadow-md overflow-x-auto w-full">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">SCHOOL NAME</th>
                  <th className="w-40"></th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, idx) => (
                  <tr
                    key={school.id}
                    className={`${
                      idx !== schools.length - 1
                        ? "border-b"
                        : ""
                    } transition`}
                    style={{
                      borderColor: "#ececec",
                      borderWidth: idx !== schools.length - 1 ? "0.2px" : 0,
                    }}
                  >
                    <td className="flex items-center gap-4 py-5 pl-6 min-w-[250px]">
                      {editId === school.id ? (
                        <div className="flex gap-2 items-center w-full">
                          <input
                            className="border border-gray-300 rounded-lg px-3 py-1 w-52 focus:outline-none focus:border-teal-400"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                          />
                          <button
                            className="text-teal-500 font-semibold px-2 py-1 hover:bg-teal-50 rounded transition"
                            onClick={() => handleSaveEdit(school.id)}
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
                          to={`/classes?school=${school.id}`}
                          className="text-gray-800 font-semibold text-base hover:underline break-all"
                        >
                          {school.name}
                        </Link>
                      )}
                    </td>
                    <td className="pr-6 text-right">
                      {editId === school.id ? null : (
                        <div className="flex gap-3 justify-end">
                          <button
                            className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                            onClick={() => handleStartEdit(school)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                            onClick={() => handleDeleteSchool(school.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {schools.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-10 text-center text-gray-400">
                      No schools to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Schools;
