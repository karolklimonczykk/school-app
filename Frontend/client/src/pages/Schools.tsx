/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar/Sidebar";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { useToast } from "../components/Toast";

// Typy
type School = { id: number; name: string; ownerId: number };
type SchoolClass = { id: number; name: string; schoolId: number };
type Student = {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  order: number;
  classId: number;
};

const safeFilename = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);

const getTokenHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// --- Pomocnicze parsowanie kolumn ---
const readStr = (v: any) => String(v ?? "").trim();
const readNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const Schools: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // toast
  const { push } = useToast();

  // input do importu
  const importSchoolRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pobierz szkoły
  const fetchSchools = async () => {
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: getTokenHeader(),
      });
      setSchools(res.data);
    } catch {
      push({
        type: "error",
        message:
          "Nie udało się pobrać szkół (upewnij się, że jesteś zalogowany/a).",
      });
    }
  };

  // Dodaj szkołę (proste dodanie z widoku)
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();

    const exists = schools.some(
      (s) => (s.name || "").trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (exists) {
      push({ type: "error", message: "Szkoła o takiej nazwie już istnieje." });
      return;
    }

    try {
      const res = await axios.post<School>(
        "http://localhost:4000/schools",
        { name },
        { headers: getTokenHeader() }
      );
      setSchools([...schools, res.data]);
      setName("");
      setShowForm(false);
      push({ type: "success", message: "Szkoła dodana!" });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        push({
          type: "error",
          message: err.response?.data?.error || "Błąd dodawania szkoły",
        });
      } else {
        push({ type: "error", message: "Błąd dodawania szkoły" });
      }
    }
  };

  // Edycja
  const handleStartEdit = (school: School) => {
    setEditId(school.id);
    setEditName(school.name);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;

    const exists = schools.some(
      (s) =>
        s.id !== id &&
        (s.name || "").trim().toLowerCase() === editName.trim().toLowerCase()
    );
    if (exists) {
      push({ type: "error", message: "Szkoła o takiej nazwie już istnieje." });
      return;
    }

    try {
      await axios.put(
        `http://localhost:4000/schools/${id}`,
        { name: editName },
        { headers: getTokenHeader() }
      );
      setSchools(
        schools.map((s) => (s.id === id ? { ...s, name: editName } : s))
      );
      setEditId(null);
      setEditName("");
      push({ type: "success", message: "Nazwa szkoły została zmieniona." });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        push({
          type: "error",
          message: err.response?.data?.error || "Błąd edycji szkoły",
        });
      } else {
        push({ type: "error", message: "Błąd edycji szkoły" });
      }
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // Usuń szkołę
  const handleDeleteSchool = async (id: number) => {
    if (!window.confirm("Na pewno usunąć szkołę?")) return;
    try {
      await axios.delete(`http://localhost:4000/schools/${id}`, {
        headers: getTokenHeader(),
      });
      setSchools(schools.filter((s) => s.id !== id));
      push({ type: "success", message: "Szkoła została usunięta." });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        push({
          type: "error",
          message: err.response?.data?.error || "Błąd usuwania szkoły",
        });
      } else {
        push({ type: "error", message: "Błąd usuwania szkoły" });
      }
    }
  };

  // =========================
  //  EKSPORT JEDNEJ SZKOŁY
  // =========================
  const exportOneSchoolXlsx = async (school: School) => {
    try {
      // 1) Klasy
      const classesRes = await axios.get<SchoolClass[]>(
        `http://localhost:4000/schools/${school.id}/classes`,
        { headers: getTokenHeader() }
      );
      const classes = classesRes.data || [];

      // 2) Uczniowie per klasa
      const allStudentsRows: Array<{
        ClassName: string;
        FirstName: string;
        LastName: string;
        Gender: string;
        Order: number | "";
      }> = [];

      for (const c of classes) {
        const studentsRes = await axios.get<Student[]>(
          `http://localhost:4000/schools/${school.id}/classes/${c.id}/students`,
          { headers: getTokenHeader() }
        );
        const stus = studentsRes.data || [];
        for (const s of stus) {
          allStudentsRows.push({
            ClassName: c.name,
            FirstName: s.firstName ?? "",
            LastName: s.lastName ?? "",
            Gender: s.gender ?? "",
            Order:
              typeof s.order === "number" && Number.isFinite(s.order)
                ? s.order
                : "",
          });
        }
      }

      // 3) Arkusze
      const wsSchool = XLSX.utils.json_to_sheet([{ Name: school.name }], {
        header: ["Name"],
      });
      const wsClasses = XLSX.utils.json_to_sheet(
        classes.length
          ? classes.map((c) => ({ ClassName: c.name }))
          : [{ ClassName: "" }],
        { header: ["ClassName"] }
      );
      const wsStudents = XLSX.utils.json_to_sheet(
        allStudentsRows.length
          ? allStudentsRows
          : [
              {
                ClassName: "",
                FirstName: "",
                LastName: "",
                Gender: "",
                Order: "",
              },
            ],
        { header: ["ClassName", "FirstName", "LastName", "Gender", "Order"] }
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSchool, "School");
      XLSX.utils.book_append_sheet(wb, wsClasses, "Classes");
      XLSX.utils.book_append_sheet(wb, wsStudents, "Students");

      XLSX.writeFile(wb, `school-${safeFilename(school.name)}.xlsx`);
      push({ type: "success", message: "Eksport zakończony." });
    } catch {
      push({ type: "error", message: "Nie udało się wyeksportować szkoły." });
    }
  };

  // =========================
  //  IMPORT SZKOŁY (STRUKTURA)
  // =========================
  const importSchoolsClick = () => importSchoolRef.current?.click();

  const importSchoolsXlsx: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);

      const wsSchool = wb.Sheets["School"];
      if (!wsSchool) {
        push({ type: "error", message: 'Brak arkusza "School".' });
        e.target.value = "";
        return;
      }
      const schoolRows: any[] = XLSX.utils.sheet_to_json(wsSchool, {
        defval: "",
      });
      if (!schoolRows.length) {
        push({ type: "error", message: 'Arkusz "School" jest pusty.' });
        e.target.value = "";
        return;
      }

      const importedSchoolName = readStr(
        schoolRows[0].Name ||
          schoolRows[0]["School Name"] ||
          schoolRows[0]["Nazwa"]
      );
      if (!importedSchoolName) {
        push({
          type: "error",
          message: 'W arkuszu "School" pole "Name" jest wymagane.',
        });
        e.target.value = "";
        return;
      }

      // Walidacja duplikatu NAZWY szkoły
      const exists = schools.some(
        (s) =>
          (s.name || "").trim().toLowerCase() ===
          importedSchoolName.trim().toLowerCase()
      );
      if (exists) {
        push({
          type: "error",
          message: `Szkoła "${importedSchoolName}" już istnieje — import pominięty.`,
        });
        e.target.value = "";
        return;
      }

      // Wczytaj arkusze (opcjonalne)
      const wsClasses = wb.Sheets["Classes"];
      const wsStudents = wb.Sheets["Students"];

      const classRows: any[] = wsClasses
        ? XLSX.utils.sheet_to_json(wsClasses, { defval: "" })
        : [];
      const studentRows: any[] = wsStudents
        ? XLSX.utils.sheet_to_json(wsStudents, { defval: "" })
        : [];

      // 1) Utwórz szkołę
      const createSchoolRes = await axios.post<School>(
        "http://localhost:4000/schools",
        { name: importedSchoolName },
        { headers: getTokenHeader() }
      );
      const schoolId = createSchoolRes.data.id;

      // 2) Utwórz klasy (zmapuj nazwa -> id)
      const classNameToId = new Map<string, number>();

      // a) klasy z arkusza "Classes"
      for (const r of classRows) {
        const cname = readStr(r.ClassName || r["Class Name"] || r["Klasa"]);
        if (!cname) continue;
        if (classNameToId.has(cname.toLowerCase())) continue; // duplikat w pliku

        const cRes = await axios.post<SchoolClass>(
          `http://localhost:4000/schools/${schoolId}/classes`,
          { name: cname },
          { headers: getTokenHeader() }
        );
        classNameToId.set(cname.toLowerCase(), cRes.data.id);
      }

      // helper: zapewnij klasę przy potrzebie
      const ensureClass = async (cname: string) => {
        const key = cname.toLowerCase();
        if (classNameToId.has(key)) return classNameToId.get(key)!;
        const cRes = await axios.post<SchoolClass>(
          `http://localhost:4000/schools/${schoolId}/classes`,
          { name: cname },
          { headers: getTokenHeader() }
        );
        classNameToId.set(key, cRes.data.id);
        return cRes.data.id;
      };

      // 3) Uczniowie
      let createdStudents = 0;
      for (const r of studentRows) {
        const cname = readStr(r.ClassName || r["Class Name"] || r["Klasa"]);
        const firstName = readStr(r.FirstName || r["First Name"] || r["Imię"]);
        const lastName = readStr(r.LastName || r["Last Name"] || r["Nazwisko"]);
        const gender = readStr(r.Gender || r["Płeć"]);
        const order = readNum(r.Order ?? r["Kolejność"], 0);

        // pomiń kompletnie puste rzędy
        if (!cname && !firstName && !lastName && !gender && !order) continue;
        if (!cname) continue; // bez klasy nie ma gdzie wstawić
        if (!firstName && !lastName) continue; // min.: imię lub nazwisko

        const classId = await ensureClass(cname);
        try {
          await axios.post(
            `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
            { firstName, lastName, gender, order },
            { headers: getTokenHeader() }
          );
          createdStudents++;
        } catch {
          // opcjonalnie log per rekord
        }
      }

      await fetchSchools();
      push({
        type: "success",
        message:
          `Zaimportowano szkołę "${importedSchoolName}". ` +
          `Klasy: ${classNameToId.size}` +
          (studentRows.length
            ? `, uczniowie: ${createdStudents}.`
            : "."),
      });
    } catch {
      push({ type: "error", message: "Nie udało się zaimportować pliku." });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f7fafc]">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:px-8 md:ml-[230px]">
        <div className="w-full max-w-100% mx-auto">
          {/* Header + Akcje (import, dodanie) */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-7 gap-4">
            <h2 className="text-2xl font-bold text-[#222B45]">Schools Table</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={importSchoolsClick}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
                type="button"
              >
                Importuj szkołę z Excela
              </button>
              <input
                ref={importSchoolRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={importSchoolsXlsx}
              />
              <button
                onClick={() => setShowForm(true)}
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                + Add School
              </button>
            </div>
          </div>

          {/* Formularz dodawania */}
          {showForm && (
            <form
              onSubmit={handleAddSchool}
              className="mb-7 flex gap-2 items-end"
            >
              <input
                type="text"
                placeholder="Nazwa szkoły"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="bg-teal-400 hover:bg-teal-300 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                Dodaj
              </button>
              <button
                type="button"
                className="ml-2 text-gray-400 font-semibold hover:bg-gray-100 rounded px-4 py-2 transition"
                onClick={() => {
                  setShowForm(false);
                }}
              >
                Anuluj
              </button>
            </form>
          )}

          {/* Tabela szkół */}
          <div className="bg-white rounded-xl shadow-md overflow-x-auto w-full">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-xs font-bold text-gray-400 uppercase text-left py-3 pl-6">
                    SCHOOL NAME
                  </th>
                  <th className="w-64"></th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, idx) => (
                  <tr
                    key={school.id}
                    className="transition hover:bg-gray-50"
                    style={{
                      borderColor: "#ececec",
                      borderWidth: idx !== schools.length - 1 ? "0.2px" : 0,
                    }}
                  >
                    <td className="flex items-center gap-4 py-5 pl-6 min-w-[250px]">
                      {editId === school.id ? (
                        <div className="w-full -my-1">
                          <input
                            className="border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:border-teal-400 w-full"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                          />
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
                      {editId === school.id ? (
                        <div className="flex gap-3 justify-center">
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
                        <div className="flex gap-2 justify-end">
                          <button
                            className="text-teal-400 font-semibold hover:bg-teal-50 rounded-md px-3 py-1 transition"
                            onClick={() => handleStartEdit(school)}
                          >
                            Edytuj
                          </button>
                          <button
                            className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                            onClick={() => handleDeleteSchool(school.id)}
                          >
                            Usuń
                          </button>
                          <button
                            className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-300 transition group"
                            onClick={() => exportOneSchoolXlsx(school)}
                            type="button"
                            title="Eksportuj tę szkołę wraz z klasami i uczniami"
                            aria-label="Eksportuj tę szkołę wraz z klasami i uczniami"
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
                              {/* strzałka w górę */}
                              <path d="M12 3v10" />
                              <path d="M8.5 6.5 12 3l3.5 3.5" />
                              {/* pudełko */}
                              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                            </svg>
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
