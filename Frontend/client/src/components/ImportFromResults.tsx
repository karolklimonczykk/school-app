/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { useToast } from "./Toast";

type School = { id: number; name: string };
type SchoolClass = { id: number; name: string; schoolId: number };
type Student = {
  id: number;
  firstName: string;
  lastName: string;
  order: number;
  classId: number;
};

const getTokenHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const readStr = (v: any) => String(v ?? "").trim();
const canon = (v: any) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();

const mapGender = (g: string) => {
  const cg = canon(g);
  if (!cg) return "N";
  if (["m", "mezczyzna", "chlopiec", "male"].includes(cg)) return "M";
  if (["k", "kobieta", "dziewczynka", "female"].includes(cg)) return "F";
  if (["n", "nieznana", "unknown"].includes(cg)) return "N";
  return "N";
};
const keyName = (first: string, last: string) =>
  `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;

type Props = {
  onImported?: () => void; // <── po imporcie odświeżymy listę szkół
};

const ImportFromResults: React.FC<Props> = ({ onImported }) => {
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const click = () => fileRef.current?.click();

  const handleFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);

      // Znajdź arkusz zawierający wiersz "UCZNIOWIE"
      let rows: any[][] = [];
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const arr = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        }) as any[][];
        if (arr.some((r) => r.some((c) => canon(c) === "uczniowie"))) {
          rows = arr;
          break;
        }
      }
      if (!rows.length) {
        push({ type: "error", message: 'Nie znaleziono sekcji "UCZNIOWIE".' });
        e.target.value = "";
        return;
      }

      // Wiersz z napisem "UCZNIOWIE" i bezpośrednio pod nim – nagłówki
      const uczRow = rows.findIndex((r) =>
        r.some((c) => canon(c) === "uczniowie")
      );
      if (uczRow < 0 || uczRow + 1 >= rows.length) {
        push({
          type: "error",
          message: "Nie znaleziono wiersza nagłówków pod sekcją UCZNIOWIE.",
        });
        e.target.value = "";
        return;
      }

      const header = rows[uczRow + 1] as any[];

      // Mapowanie kolumn
      const idx: Partial<
        Record<
          "firstName" | "lastName" | "className" | "schoolName" | "gender",
          number
        >
      > = {};
      for (let i = 0; i < header.length; i++) {
        const c = canon(header[i]);
        if (/^imie|imiona$/.test(c)) idx.firstName = i;
        if (/^nazwisko$/.test(c)) idx.lastName = i;
        if (/^klasa|oddzial|oddz$/.test(c)) idx.className = i;
        if (c.includes("szkola") || c.includes("placowk")) idx.schoolName = i;
        if (c === "plec" || c === "gender" || c === "płeć") idx.gender = i;
      }
      if (
        idx.firstName == null ||
        idx.className == null ||
        idx.schoolName == null
      ) {
        push({
          type: "error",
          message:
            "Nie znaleziono nagłówków w sekcji UCZNIOWIE. Wymagane: 'Imię', 'Klasa', 'Szkoła/Placówka'.",
        });
        e.target.value = "";
        return;
      }
      if (
        idx.firstName == null ||
        idx.className == null ||
        idx.schoolName == null
      ) {
        push({
          type: "error",
          message:
            "Nie znaleziono nagłówków w sekcji UCZNIOWIE. Wymagane kolumny w jednym wierszu: 'Imię', 'Klasa', 'Szkoła/Placówka'.",
        });
        e.target.value = "";
        return;
      }

      // Zbierz -> drzewko: szkoła -> klasa -> uczniowie
      type ParsedStudent = {
        firstName: string;
        lastName: string;
        order: number;
        gender?: string;
      };
      
      const tree = new Map<string, Map<string, ParsedStudent[]>>();
      const counters = new Map<string, number>(); // (school|class) -> order

      for (let r = uczRow + 2; r < rows.length; r++) {
        const row = rows[r] || [];
        const firstName = readStr(row[idx.firstName]);
        const lastName = idx.lastName != null ? readStr(row[idx.lastName]) : "";
        const className = readStr(row[idx.className]);
        const schoolName = readStr(row[idx.schoolName]);
        const genderRaw = idx.gender != null ? readStr(row[idx.gender]) : "";
        const gender = mapGender(genderRaw); // <- tu normalizujemy/dopełniamy N
        // zakończ gdy dojdziemy do sekcji "ZADANIA"
        if (canon(row[0]) === "zadania") break;

        // pomiń puste
        if (!firstName && !lastName && !className && !schoolName) continue;
        if (!schoolName || !className) continue;
        if (!firstName && !lastName) continue;

        const key = `${schoolName}|${className}`;
        const nextOrder = (counters.get(key) ?? 0) + 1;
        counters.set(key, nextOrder);

        if (!tree.has(schoolName)) tree.set(schoolName, new Map());
        const byClass = tree.get(schoolName)!;
        if (!byClass.has(className)) byClass.set(className, []);
        byClass.get(className)!.push({ firstName, lastName, order: nextOrder });
      }

      if (!tree.size) {
        push({
          type: "error",
          message: "Nie znaleziono żadnych wierszy uczniów w sekcji UCZNIOWIE.",
        });
        e.target.value = "";
        return;
      }

      // ====== Import do API ======
      // istniejące szkoły (do deduplikacji po nazwie)
      const schoolsRes = await axios.get<School[]>(
        "http://localhost:4000/schools",
        {
          headers: getTokenHeader(),
        }
      );
      const existingSchools = new Map(
        (schoolsRes.data || []).map((s) => [s.name.trim().toLowerCase(), s])
      );

      let cSchools = 0,
        cClasses = 0,
        cStudents = 0;

      for (const [schoolName, classesMap] of tree.entries()) {
        const sKey = schoolName.trim().toLowerCase();
        let schoolId: number;
        if (existingSchools.has(sKey)) {
          schoolId = existingSchools.get(sKey)!.id;
        } else {
          const sRes = await axios.post<School>(
            "http://localhost:4000/schools",
            { name: schoolName },
            { headers: getTokenHeader() }
          );
          schoolId = sRes.data.id;
          existingSchools.set(sKey, sRes.data);
          cSchools++;
        }

        // istniejące klasy w tej szkole
        const clsRes = await axios.get<SchoolClass[]>(
          `http://localhost:4000/schools/${schoolId}/classes`,
          { headers: getTokenHeader() }
        );
        const existingClasses = new Map(
          (clsRes.data || []).map((c) => [c.name.trim().toLowerCase(), c])
        );

        for (const [className, studentsArr] of classesMap.entries()) {
          const cKey = className.trim().toLowerCase();
          let classId: number;
          if (existingClasses.has(cKey)) {
            classId = existingClasses.get(cKey)!.id;
          } else {
            const cRes = await axios.post<SchoolClass>(
              `http://localhost:4000/schools/${schoolId}/classes`,
              { name: className },
              { headers: getTokenHeader() }
            );
            classId = cRes.data.id;
            existingClasses.set(cKey, cRes.data);
            cClasses++;
          }

          // istniejący uczniowie w klasie
          const stuRes = await axios.get<Student[]>(
            `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
            { headers: getTokenHeader() }
          );
          const existing = new Set(
            (stuRes.data || []).map((s) => keyName(s.firstName, s.lastName))
          );

          for (const st of studentsArr) {
            const k = keyName(st.firstName, st.lastName);
            if (existing.has(k)) continue;

            try {
              await axios.post(
                `http://localhost:4000/schools/${schoolId}/classes/${classId}/students`,
                {
                  firstName: st.firstName,
                  lastName: st.lastName,
                  gender: st.gender ?? "N",
                  order: st.order,
                },
                { headers: getTokenHeader() }
              );
              cStudents++;
            } catch {
              /* pomiń pojedyncze błędy */
            }
          }
        }
      }

      push({
        type: "success",
        message: `Import zakończony. Szkoły: +${cSchools}, klasy: +${cClasses}, uczniowie: +${cStudents}.`,
      });

      // Odśwież listę szkół na stronie
      onImported?.();
    } catch (err) {
      push({
        type: "error",
        message:
          "Import nie powiódł się. Sprawdź, czy nagłówki w sekcji UCZNIOWIE są w jednym wierszu.",
      });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
        title="Importuj szkoły, klasy i uczniów z pliku 'Wyniki' (sekcja UCZNIOWIE)"
      >
        Import z wyników (XLSX)
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
};

export default ImportFromResults;
