/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import { useToast } from "./Toast";

type School = { id: number; name: string };

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const CAND = {
  class: ["oddzial", "odzial", "klasa", "class", "oddział"],
  roll: ["nr w dzienniku", "nr", "lp", "numer", "no", "number"],
  first: ["imie", "imiona", "first name", "first"],
  last: ["nazwisko", "last name", "last", "surname"],
  pesel: ["pesel", "nr dokumentu", "document", "id"],
  sum: ["suma punktow", "suma punktów", "suma", "total"],
  pct: ["procent", "procent punktow", "procent punktów", "percent"],
};

const isTaskHeader = (h: string) => /^[0-9]+([_\-][A-Za-z0-9]+)?$/.test(h.trim());

const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "?" || s === "-") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const CsvImportWizard: React.FC = () => {
  const { push } = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<number | "">("");

  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  const [colClass, setColClass] = useState<string>("");
  const [colRoll, setColRoll] = useState<string>("");
  const [colFirst, setColFirst] = useState<string>("");
  const [colLast, setColLast] = useState<string>("");
  const [colPesel, setColPesel] = useState<string>("");

  const [taskCols, setTaskCols] = useState<string[]>([]);
  const [useExistingTemplate, setUseExistingTemplate] = useState<boolean>(false);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [templateName, setTemplateName] = useState<string>("Szablon z CSV");
  const [testName, setTestName] = useState<string>("Test z CSV");
  const [testDate, setTestDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const fileRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await axios.get<School[]>("http://localhost:4000/schools", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setSchools(res.data);
      } catch {
        push({ type: "error", message: "Nie udało się pobrać szkół." });
      }
    })();
  }, [push]);

  const autoDetect = (hs: string[]) => {
    const N = hs.map((h) => normalize(h));
    const pick = (cands: string[]) => {
      const i = N.findIndex((n) => cands.some((c) => n.includes(c)));
      return i >= 0 ? hs[i] : "";
    };
    setColClass(pick(CAND.class));
    setColRoll(pick(CAND.roll));
    setColFirst(pick(CAND.first));
    setColLast(pick(CAND.last));
    setColPesel(pick(CAND.pesel));

    const guessedTasks = hs.filter((h) => isTaskHeader(String(h).trim()));
    setTaskCols(guessedTasks);
  };

  const openFile = () => fileRef.current?.click();

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h?.trim(),
      complete: (res: any) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setRows(res.data as any[]);
        autoDetect(hs);
      },
      error: () => push({ type: "error", message: "Błąd parsowania CSV." }),
    });
    e.currentTarget.value = "";
  };

  // Szacun max-ów i półpunktów
  const autoTemplateItems = useMemo(() => {
    const items = taskCols.map((h, i) => {
      let max = 0;
      let half = false;
      for (const r of rows) {
        const v = numOrNull(r[h]);
        if (v == null) continue;
        if (v % 1 !== 0) half = true;
        if (v > max) max = v;
      }
      return {
        name: h,
        order: i + 1,
        maxPoints: max || 1,
        minPoints: 0,
        step: half ? 0.5 : 1,
      };
    });
    return items;
  }, [rows, taskCols]);

  const importNow = async () => {
    if (!schoolId) {
      push({ type: "error", message: "Wybierz szkołę." });
      return;
    }
    if (!taskCols.length) {
      push({ type: "error", message: "Wybierz przynajmniej jedną kolumnę zadania." });
      return;
    }

    // zbuduj wiersze
    const payloadRows = rows.map((r) => {
      const className = String(r[colClass] ?? "").trim();
      const roll = numOrNull(r[colRoll]);
      const firstName = (r[colFirst] ?? "").toString().trim();
      const lastName = (r[colLast] ?? "").toString().trim();
      const pesel = (r[colPesel] ?? "").toString().trim();
      const gender = "N"; // domyślnie N (nieznana)

      const taskPoints = taskCols.map((h) => numOrNull(r[h]));
      return { pesel, className, roll, firstName, lastName, gender, taskPoints };
    });

    const body: any = {
      schoolId,
      classNameMap: {}, // tu można dodać mapowanie "A"->"3A" jeśli chcesz, zostawiam puste
      test: { name: testName || "Test z CSV", date: testDate },
      rows: payloadRows,
    };

    if (useExistingTemplate && templateId) {
      body.templateId = Number(templateId);
    } else {
      body.templateNew = {
        name: templateName || "Szablon z CSV",
        items: autoTemplateItems.map((it) => ({
          name: it.name,
          order: it.order,
          maxPoints: it.maxPoints,
          minPoints: it.minPoints,
        })),
      };
    }

    try {
      const res = await axios.post("http://localhost:4000/imports/csv", body, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      push({
        type: "success",
        message: `Zaimportowano. Klasy: ${res.data.classes}, uczniowie: ${res.data.students}, wyników: ${res.data.results}.`,
      });
    } catch (err: any) {
      push({
        type: "error",
        message: err?.response?.data?.error || "Import nie powiódł się.",
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Import wyników z CSV</h3>
        <button
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg"
          onClick={openFile}
          type="button"
        >
          Wybierz plik CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-gray-500">Szkoła</label>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value ? Number(e.target.value) : "")}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">— wybierz szkołę —</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Nazwa testu</label>
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Data testu</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs text-gray-500">Tryb szablonu</label>
            <div className="flex items-center gap-3 mt-1">
              <label className="flex gap-2 items-center">
                <input
                  type="radio"
                  checked={!useExistingTemplate}
                  onChange={() => setUseExistingTemplate(false)}
                />
                Utwórz nowy z CSV
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="radio"
                  checked={useExistingTemplate}
                  onChange={() => setUseExistingTemplate(true)}
                />
                Użyj istniejącego
              </label>
            </div>

            {!useExistingTemplate ? (
              <div className="mt-2">
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                  placeholder="Nazwa szablonu"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Zadania z CSV: {taskCols.join(", ") || "—"}
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full"
                  placeholder="ID istniejącego szablonu"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500">Plik: {fileName || "—"}</div>

          {/* Mapowanie kolumn */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Oddział / Klasa</div>
              <select className="border border-gray-300 rounded-lg px-2 py-1 w-full" value={colClass} onChange={(e) => setColClass(e.target.value)}>
                <option value="">— wybierz —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500">Nr w dzienniku</div>
              <select className="border border-gray-300 rounded-lg px-2 py-1 w-full" value={colRoll} onChange={(e) => setColRoll(e.target.value)}>
                <option value="">— wybierz —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500">Imię</div>
              <select className="border border-gray-300 rounded-lg px-2 py-1 w-full" value={colFirst} onChange={(e) => setColFirst(e.target.value)}>
                <option value="">— wybierz —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500">Nazwisko</div>
              <select className="border border-gray-300 rounded-lg px-2 py-1 w-full" value={colLast} onChange={(e) => setColLast(e.target.value)}>
                <option value="">— wybierz —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-500">PESEL / dokument (opcjonalnie)</div>
              <select className="border border-gray-300 rounded-lg px-2 py-1 w-full" value={colPesel} onChange={(e) => setColPesel(e.target.value)}>
                <option value="">— wybierz —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs text-gray-500">Kolumny zadań</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {headers.map((h) => {
                const selected = taskCols.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      setTaskCols((prev) =>
                        prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
                      )
                    }
                    className={`px-2 py-1 rounded border text-xs ${
                      selected ? "bg-teal-50 border-teal-300 text-teal-700" : "bg-white border-gray-300 text-gray-600"
                    }`}
                    title={selected ? "Kliknij, by odznaczyć" : "Kliknij, by traktować jako zadanie"}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Wskazówka: za zadania uznaję nagłówki pasujące do wzorca 1, 2, 15_1, 18_T itd. Możesz to zmienić klikając.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={importNow}
          className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-4 py-2 rounded-lg"
          type="button"
        >
          Importuj
        </button>
      </div>
    </div>
  );
};

export default CsvImportWizard;
