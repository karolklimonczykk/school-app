/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import axios from "axios";
import { useToast } from "./Toast";

const API = "http://localhost:4000";

// Ujednolicona wysokość selecta i caret jak w reszcie aplikacji
const clsSelect =
  "h-10 border border-gray-300 rounded-lg px-3 pr-10 bg-white font-medium text-sm focus:outline-none focus:border-teal-400 truncate appearance-none";
const clsInput =
  "border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:border-teal-400";
const clsLabel = "text-xs font-semibold text-gray-500 mb-1";
const caret =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500";

const auth = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

type TemplateLite = { id: number; name: string; tasksCount?: number };
type School = { id: number; name: string };

type TaskMapRow = { header: string; taskName: string };
type Mapping = {
  classCol?: string;
  journalCol?: string;
  codeNumberCol?: string;
  firstNameCol?: string;
  lastNameCol?: string;
  genderCol?: string;
  taskContentCol?: string;
  taskActivityCol?: string;
  tasks: TaskMapRow[];
};

type Parsed = {
  headers: string[];
  rows: Array<Record<string, any>>;
  delimiter: string;
};

const guessDelimiter = (txt: string) => {
  const semis = (txt.match(/;/g) || []).length;
  const commas = (txt.match(/,/g) || []).length;
  return semis > commas ? ";" : ",";
};

const norm = (s: any) => (s ?? "").toString().trim();
const lower = (s: string) => norm(s).toLowerCase();

const looksLikeTask = (h: string) => {
  const x = norm(h);
  if (/^\d+$/.test(x)) return true;
  if (/^\d+[A-Za-z]+$/.test(x)) return true;
  if (/^\d+(?:\.\d+)+$/.test(x)) return true;
  if (/^\d+(_[A-Za-z0-9]+)+$/.test(x)) return true;
  return false;
};

const halfLike = (v: number) =>
  Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 && Math.round(v * 2) % 2 === 1;

const defaultGender = "N";

const pickFirstNonEmpty = (rows: any[], header?: string) => {
  if (!header) return "";
  for (const r of rows) {
    const v = norm(r[header]);
    if (v) return v;
  }
  return "";
};

// <<< KLUCZOWE: wartości per-zadanie z jednej kolumny, pionowo (i-ta niepusta komórka -> zadanie i) >>>
const perTaskFromVerticalColumn = (
  header: string | undefined,
  tasksCount: number,
  rows: Array<Record<string, any>>
): (string | undefined)[] => {
  const out: (string | undefined)[] = Array(tasksCount).fill(undefined);
  if (!header) return out;

  let k = 0;
  for (const r of rows) {
    const v = norm(r[header]);
    if (!v) continue;
    if (k < tasksCount) {
      out[k] = v;
      k++;
      if (k >= tasksCount) break;
    }
  }

  // Fallback: jeśli nadal puste — użyj pierwszej niepustej wartości dla wszystkich
  if (out.every((x) => x == null)) {
    const single = pickFirstNonEmpty(rows, header);
    if (single) {
      for (let i = 0; i < tasksCount; i++) out[i] = single;
    }
  }

  return out;
};

const ImportFromResults: React.FC = () => {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ tasks: [] });

  const [testName, setTestName] = useState<string>("");
  const [rawNameFromCsv, setRawNameFromCsv] = useState<string>("");

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);
  const [selectedTemplateCount, setSelectedTemplateCount] = useState<number | undefined>(undefined);
  const [newTemplateName, setNewTemplateName] = useState<string>("");

  const [schools, setSchools] = useState<School[]>([]);
  const [targetSchoolId, setTargetSchoolId] = useState<number | "">("");

  const [existingTestNames, setExistingTestNames] = useState<string[]>([]);
  const testNameTaken = useMemo(
    () => !!testName && existingTestNames.some((n) => n.toLowerCase() === testName.toLowerCase()),
    [existingTestNames, testName]
  );

  // --- słowniki
  const tryFetch = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await axios.get<T>(url, auth());
      return res.data as any;
    } catch {
      return null;
    }
  };

  const fetchTemplates = async () => {
    const candidates = [
      `${API}/test-templates`,
      `${API}/templates`,
      `${API}/templates/list`,
      `${API}/testTemplates`,
    ];
    let data: any[] = [];
    for (const u of candidates) {
      const r = await tryFetch<any[]>(u);
      if (Array.isArray(r) && r.length) {
        data = r;
        break;
      }
    }
    const map = new Map<string, TemplateLite>();
    (data || []).forEach((t: any) => {
      const id = t.id ?? t.templateId ?? t?.template?.id;
      const name = t.name ?? t?.template?.name;
      const tasks = t.tasks ?? t?.template?.tasks;
      if (!id || !name) return;
      if (!map.has(name))
        map.set(name, {
          id,
          name,
          tasksCount: Array.isArray(tasks) ? tasks.length : undefined,
        });
    });
    if (!map.size) {
      const tests = await tryFetch<any[]>(`${API}/tests`);
      (tests || []).forEach((x) => {
        const id = x?.template?.id;
        const name = x?.template?.name;
        const tasks = x?.template?.tasks;
        if (id && name && !map.has(name))
          map.set(name, { id, name, tasksCount: tasks?.length });
      });
    }
    setTemplates([...map.values()]);
  };

  const fetchTemplateByName = async (name: string) => {
    setSelectedTemplateCount(undefined);
    setSelectedTemplateId(undefined);
    try {
      const res = await axios.get<any>(`${API}/templates/by-name`, {
        params: { name },
        ...auth(),
      });
      if (res?.data?.id) setSelectedTemplateId(res.data.id);
      if (res?.data?.tasks?.length != null)
        setSelectedTemplateCount(res.data.tasks.length);
      return;
    } catch {
      /* ignore */
    }
    const t = templates.find((x) => x.name === name);
    setSelectedTemplateId(t?.id);
    setSelectedTemplateCount(t?.tasksCount);
  };

  const fetchSchools = async () => {
    const data = await tryFetch<School[]>(`${API}/schools`);
    setSchools(data || []);
  };

  const fetchTestsNames = async () => {
    const data = await tryFetch<any[]>(`${API}/tests`);
    const names = (data || [])
      .map((t) => String(t?.name || ""))
      .filter(Boolean);
    setExistingTestNames(Array.from(new Set(names)));
  };

  useEffect(() => {
    if (!open) return;
    fetchTemplates();
    fetchSchools();
    fetchTestsNames();
  }, [open]);

  useEffect(() => {
    if (mode === "existing" && selectedTemplateName) {
      fetchTemplateByName(selectedTemplateName);
    } else {
      setSelectedTemplateCount(undefined);
      setSelectedTemplateId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateName, mode]);

  // --- CSV parsing + automapping
  const suggestName = (headers: string[], rows: any[]) => {
    const L = headers.map((h) => lower(h));
    const find = (...regs: RegExp[]) => {
      const i = L.findIndex((h) => regs.some((r) => r.test(h)));
      return i >= 0 ? headers[i] : undefined;
    };
    const hTemat = find(/^temat$/);
    const hNazwa = find(/^nazwa egzaminu$/);
    const hTyp = find(/^typ arkusza$/);
    const hKod = find(/^kod arkusza$/);

    const temat = hTemat ? pickFirstNonEmpty(rows, hTemat) : "";
    if (temat) return temat;

    const nazwa = hNazwa ? pickFirstNonEmpty(rows, hNazwa) : "";
    if (nazwa) return nazwa;

    const typ = hTyp ? pickFirstNonEmpty(rows, hTyp) : "";
    const kod = hKod ? pickFirstNonEmpty(rows, hKod) : "";
    if (typ || kod) return [typ, kod].filter(Boolean).join(" — ");

    const d = new Date();
    return `Test z CSV ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const autoMap = (headers: string[], rows: Array<Record<string, any>>) => {
    const L = headers.map((h) => lower(h));
    const find = (...cands: RegExp[]) => {
      const idx = L.findIndex((h) => cands.some((r) => r.test(h)));
      return idx >= 0 ? headers[idx] : undefined;
    };

    const sug = suggestName(headers, rows);
    setRawNameFromCsv(sug);
    if (!norm(testName)) setTestName(sug);

    const classCol = find(/^(oddział|oddzial|klasa)$/);
    const journalCol = find(/^(lp|pozycja|kolejność|kolejnosc|order|roll)$/);
    const codeNumberCol = find(
      /^(nr w dzienniku|numer w dzienniku|nr z dziennika|numer z dziennika|kod|code|codenumber|identyfikator|id)$/
    );
    const firstNameCol = find(/^(imiona|imię|imie|first ?name)$/);
    const lastNameCol = find(/^(nazwisko|last ?name)$/);
    const genderCol = find(/^(płeć|plec|gender|sex)$/);
    const taskContentCol = find(/^(treść zadania|tresc zadania|opis|temat)$/);
    const taskActivityCol = find(/^(czynność|czynnosc|opis czynności|opis czynnosc)$/);

    const banned = new Set([classCol,journalCol,codeNumberCol,firstNameCol,lastNameCol,genderCol,taskContentCol,
      taskActivityCol,].filter(Boolean) as string[]);
    const hinted = headers.filter((h) => !banned.has(h) && looksLikeTask(h));
    const tasks: TaskMapRow[] = hinted.length
      ? hinted.map((h) => ({ header: h, taskName: norm(h) }))
      : headers
          .filter((h) => !banned.has(h))
          .slice(0, 3)
          .map((h) => ({ header: h, taskName: norm(h) }));

    setMapping({classCol,journalCol,codeNumberCol,firstNameCol,lastNameCol,genderCol,taskContentCol,taskActivityCol,tasks,});
  };

  const parseXlsx = async (file: File): Promise<{ headers: string[]; rows: Record<string, any>[] } | null> => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        push({ type: "error", message: "Plik XLSX nie zawiera arkuszy." });
        return null;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
      if (!jsonData.length) {
        push({ type: "error", message: "Arkusz jest pusty." });
        return null;
      }
      const headers = Object.keys(jsonData[0]).map(String);
      return { headers, rows: jsonData };
    } catch (err) {
      push({ type: "error", message: `Błąd odczytu XLSX: ${err}` });
      return null;
    }
  };

  const parseCsv = async (file: File): Promise<{ headers: string[]; rows: Record<string, any>[]; delimiter: string } | null> => {
    const txt = await file.text();
    const delimiter = guessDelimiter(txt);
    const res = Papa.parse(txt, {header: true, delimiter, skipEmptyLines: "greedy",});
    if (res.errors?.length) {
      push({ type: "error", message: `Błąd CSV: ${res.errors[0].message}` });
      return null;
    }
    const headers = (res.meta.fields || []).map(String);
    const rows = (res.data as any[]).map((r) => r || {});
    if (!headers.length || !rows.length) {
      push({ type: "error", message: "Plik jest pusty lub bez nagłówka." });
      return null;
    }
    return { headers, rows, delimiter };
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = f.name.split(".").pop()?.toLowerCase();
    let headers: string[] = [];
    let rows: Record<string, any>[] = [];
    let delimiter = ",";

    if (ext === "xlsx" || ext === "xls") {
      const result = await parseXlsx(f);
      if (!result) return;
      headers = result.headers;
      rows = result.rows;
    } else {
      const result = await parseCsv(f);
      if (!result) return;
      headers = result.headers;
      rows = result.rows;
      delimiter = result.delimiter;
    }

    setParsed({ headers, rows, delimiter });
    autoMap(headers, rows);
  };

  const headerOptions = useMemo(() => parsed?.headers || [], [parsed]);

  const canImport = useMemo(() => {
    if (!parsed) return false;
    if (!mapping.tasks.length) return false;
    if (!mapping.firstNameCol && !mapping.lastNameCol && !mapping.journalCol)
      return false;
    if (!norm(testName) || testNameTaken) return false;
    if (!targetSchoolId) return false;
    if (!mapping.classCol) return false;

    if (
      mode === "existing" &&
      selectedTemplateName &&
      selectedTemplateCount != null
    ) {
      if (selectedTemplateCount !== mapping.tasks.length) return false;
    }
    if (mode === "new" && !norm(newTemplateName)) return false;

    return true;
  }, [
    parsed,
    mapping,
    testName,
    testNameTaken,
    mode,
    selectedTemplateName,
    selectedTemplateCount,
    targetSchoolId,
    newTemplateName,
  ]);

  const templateMismatch =
    mode === "existing" &&
    selectedTemplateName &&
    selectedTemplateCount != null &&
    parsed &&
    selectedTemplateCount !== mapping.tasks.length;

  // --- Import ---
  const submit = async () => {
    if (!parsed) return;

    try {
      const schoolId = Number(targetSchoolId);
      const taskHeaders = mapping.tasks.map((t) => t.header);

      // Dla nowego szablonu: maxima + połówki
      const maxima: number[] = Array.from(
        { length: taskHeaders.length },
        () => 0
      );
      const halves: boolean[] = Array.from(
        { length: taskHeaders.length },
        () => false
      );

      if (mode === "new") {
        for (let i = 0; i < taskHeaders.length; i++) {
          const h = taskHeaders[i];
          for (const r of parsed.rows) {
            const vRaw = r[h];
            if (vRaw === null || vRaw === undefined) continue;
            const v = Number(String(vRaw).replace(",", "."));
            if (!Number.isFinite(v)) continue;
            if (v > maxima[i]) maxima[i] = v;
            if (halfLike(v)) halves[i] = true;
          }
        }
      }

      // Treść/Czynność — PER ZADANIE z jednej kolumny (pionowo: i-ta niepusta komórka -> zadanie i)
      const contentByTask = perTaskFromVerticalColumn(
        mapping.taskContentCol,
        taskHeaders.length,
        parsed.rows
      );
      const activityByTask = perTaskFromVerticalColumn(
        mapping.taskActivityCol,
        taskHeaders.length,
        parsed.rows
      );

      // Wiersze (uczniowie + punkty)
      const payloadRows = parsed.rows.map((r) => {
        const className = norm(r[mapping.classCol!]);
        const rollRaw = mapping.journalCol
          ? Number(String(r[mapping.journalCol]).replace(",", "."))
          : NaN;
        const roll = Number.isFinite(rollRaw) ? rollRaw : null;
        const codeNumber = mapping.codeNumberCol
          ? norm(r[mapping.codeNumberCol]) || null
          : null;
        const firstName = mapping.firstNameCol
          ? norm(r[mapping.firstNameCol])
          : "";
        const lastName = mapping.lastNameCol ? norm(r[mapping.lastNameCol]) : "";
        const gender = mapping.genderCol
          ? norm(r[mapping.genderCol]) || defaultGender
          : defaultGender;

        const taskPoints = mapping.tasks.map((t) => {
          const val = r[t.header];
          if (val === null || val === undefined) return null;
          const n = Number(String(val).replace(",", "."));
          return Number.isFinite(n) ? n : null;
        });

        return { className, roll, codeNumber, firstName, lastName, gender, taskPoints };
      });

      const body: any = {
        schoolId,
        classNameMap: {},
        test: { name: norm(testName), date: new Date().toISOString().slice(0, 10) },
        rows: payloadRows,
      };

      if (mode === "existing") {
        if (!selectedTemplateId) {
          push({
            type: "error",
            message: "Nie udało się ustalić ID szablonu po nazwie.",
          });
          return;
        }
        body.templateId = selectedTemplateId;
      } else {
        body.templateNew = {
          name: norm(newTemplateName),
          items: mapping.tasks.map((t, idx) => ({
            name: norm(t.taskName) || `Zadanie ${idx + 1}`,
            order: idx + 1,
            maxPoints: maxima[idx] || 1,
            minPoints: 0,
            // per-zadanie:
            content: contentByTask[idx] ?? undefined,
            activity: activityByTask[idx] ?? undefined,
            // brak pola step w modelu — nie wysyłamy
            allowHalfPoints: !!halves[idx],
          })),
        };
      }

      const res = await axios.post(`${API}/imports/csv`, body, auth());

      if (res.data?.structure_blocked) {
        const reasons = Array.isArray(res.data.reasons)
          ? res.data.reasons.join("; ")
          : "wykryto istniejące rekordy";
        push({
          type: "success",
          message: `Utworzono tylko szablon/test — struktura zablokowana: ${reasons}.`,
        });
      } else {
        const classes = res.data.createdClasses ?? res.data.classes ?? 0;
        const students = res.data.createdStudents ?? res.data.students ?? 0;
        const results = res.data.createdResults ?? res.data.results ?? 0;
        push({
          type: "success",
          message: `Gotowe. Klasy: ${classes}, uczniowie: ${students}, wyników: ${results}.`,
        });
      }

      setOpen(false);
      setParsed(null);
      setMapping({ tasks: [] });
      setSelectedTemplateName("");
      setSelectedTemplateId(undefined);
      setSelectedTemplateCount(undefined);
      setNewTemplateName("");
      setTestName("");
      setRawNameFromCsv("");
      setTargetSchoolId("");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Import nie powiódł się.";
      push({ type: "error", message: String(msg) });
    }
  };

  const miniPreviewHeaders = useMemo(() => {
    const base = [
      { key: mapping.classCol, label: "Klasa", id: "class" },
      { key: mapping.journalCol, label: "Poz.", id: "journal" },
      { key: mapping.codeNumberCol, label: "Kod", id: "code" },
      { key: mapping.firstNameCol, label: "Imię", id: "fname" },
      { key: mapping.lastNameCol, label: "Nazwisko", id: "lname" },
      { key: mapping.genderCol, label: "Płeć", id: "gender" },
    ].filter((x) => x.key);
    const taskHeads = mapping.tasks
      .slice(0, 3)
      .map((t, i) => ({ key: t.header, label: `Zad${i + 1}: ${t.taskName}`, id: `task-${i}` }));
    return [...base, ...taskHeads] as { key: string; label: string; id: string }[];
  }, [mapping]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
        type="button"
      >
        Importuj wyniki
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(30,50,60,0.18)" }}
        >
          {/* Kontener modala: flex kolumna + scroll środka */}
          <div className="bg-white rounded-xl shadow-lg min-w-[640px] w-[70%] max-w-6xl max-h-[85vh] overflow-hidden relative flex flex-col">
            {/* X jak w TestTemplates */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              aria-label="Zamknij"
              title="Zamknij"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-7 pt-7 pb-4">
              <div className="text-lg font-bold text-[#222B45]">
                Import wyników z pliku
              </div>
              <div className="text-xs text-gray-500">
                Wybierz plik (CSV lub XLSX), ustaw mapowanie kolumn. Wyniki zapiszą się do
                wskazanej szkoły.
              </div>
            </div>

            {/* Body (przewijalny) */}
            <div className="px-7 pb-6 space-y-6 flex-1 overflow-y-auto">
              {/* Plik + sugestia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <div className={clsLabel}>Plik (CSV / XLSX)</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className={clsInput + " w-full"}
                    onChange={onPickFile}
                  />
                  <div className="text-[11px] text-gray-400 mt-1">
                    Obsługiwane formaty: CSV (średniki/przecinki) oraz Excel (XLSX, XLS).
                  </div>
                </div>
                <div>
                  <div className={clsLabel}>Sugerowana nazwa z pliku</div>
                  <div className="flex gap-2">
                    <input
                      className={clsInput + " flex-1"}
                      value={rawNameFromCsv}
                      readOnly
                      placeholder="— brak —"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                      onClick={() =>
                        rawNameFromCsv && setTestName(rawNameFromCsv)
                      }
                      title="Skopiuj do nazwy testu"
                    >
                      Użyj
                    </button>
                  </div>
                </div>
              </div>

              {/* Test + Szablon + Szkoła */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-[#f7fafc] rounded-xl p-4">
                  <div className={clsLabel}>Nazwa testu (unikalna)</div>
                  <input
                    className={clsInput + " w-full"}
                    placeholder="Np. Egzamin próbny — maj 2025"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                  />
                  <div className="text-[11px] text-gray-400 mt-1">
                    {testNameTaken ? (
                      <span className="text-red-500">
                        Taka nazwa testu już istnieje.
                      </span>
                    ) : (
                      <>Jeżeli taka nazwa istnieje, import się zatrzyma.</>
                    )}
                  </div>
                </div>

                <div className="bg-[#f7fafc] rounded-xl p-4">
                  <div className={clsLabel}>Tryb szablonu</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("existing")}
                      className={
                        "px-3 py-1.5 rounded-lg text-sm border " +
                        (mode === "existing"
                          ? "bg-teal-500 text-white border-teal-500"
                          : "bg-white text-gray-700 border-gray-300")
                      }
                    >
                      Użyj istniejącego
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("new")}
                      className={
                        "px-3 py-1.5 rounded-lg text-sm border " +
                        (mode === "new"
                          ? "bg-teal-500 text-white border-teal-500"
                          : "bg-white text-gray-700 border-gray-300")
                      }
                    >
                      Utwórz nowy
                    </button>
                  </div>

                  {mode === "existing" ? (
                    <div className="mt-3 relative">
                      <div className={clsLabel}>Wybierz szablon (po nazwie)</div>
                      <div className="relative">
                        <select
                          className={clsSelect + " w-full"}
                          value={selectedTemplateName}
                          onChange={(e) =>
                            setSelectedTemplateName(e.target.value)
                          }
                        >
                          <option value="">— wybierz —</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name}
                              {t.tasksCount != null ? ` — ${t.tasksCount} z.` : ""}
                            </option>
                          ))}
                        </select>
                        <span className={caret}>
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
                      {templateMismatch && (
                        <div className="mt-2 text-[12px] text-red-500">
                          Wybrany szablon ma {selectedTemplateCount} zadań, a w
                          CSV wskazano {mapping.tasks.length}. Dopasuj liczbę
                          kolumn zadań.
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500 mt-1">
                        W tym trybie treść, czynność, limity punktów i połówki
                        pochodzą z wybranego szablonu.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className={clsLabel}>
                        Nazwa nowego szablonu (unikalna)
                      </div>
                      <input
                        className={clsInput + " w-full"}
                        placeholder="Np. Język polski — próba A"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                      />
                      <div className="text-[11px] text-gray-500 mt-1">
                        Treść i czynność (jeśli wskażesz kolumny poniżej) zostaną
                        zapisane w zadaniach szablonu.
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#f7fafc] rounded-xl p-4">
                  <div className={clsLabel}>Szkoła docelowa</div>
                  <div className="relative">
                    <select
                      className={clsSelect + " w-full"}
                      value={targetSchoolId}
                      onChange={(e) =>
                        setTargetSchoolId(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                    >
                      <option value="">— wybierz —</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className={caret}>
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
                  <div className="text-[11px] text-gray-500 mt-1">
                    Wyniki zostaną przypisane do tej szkoły (jeśli klasy istnieją w danej szkole - nie zostaną ponownie utworzone). Zostanie stworzony jedynie nowy test z istniejącego, bądź nowego szablonu.
                  </div>
                </div>
              </div>

              {/* Mapowanie kolumn — Uczniowie */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="font-bold mb-3">
                  Mapowanie kolumn — Uczniowie
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  {[
                    { label: "Oddział/Klasa", key: "classCol" as const },
                    { label: "Nr w dzienniku (pozycja)", key: "journalCol" as const },
                    { label: "Nr z dziennika (kod)", key: "codeNumberCol" as const },
                    { label: "Imię (opcjonalnie)", key: "firstNameCol" as const },
                    { label: "Nazwisko (opcjonalnie)", key: "lastNameCol" as const },
                    { label: "Płeć (opcjonalnie)", key: "genderCol" as const },
                  ].map((f) => (
                    <div key={f.key} className="relative">
                      <div className={clsLabel}>{f.label}</div>
                      <div className="relative">
                        <select
                          className={clsSelect + " w-full"}
                          value={(mapping as any)[f.key] || ""}
                          onChange={(e) =>
                            setMapping((m) => ({
                              ...m,
                              [f.key]: e.target.value || undefined,
                            }))
                          }
                        >
                          <option value="">— wybierz —</option>
                          {headerOptions.map((h) => (
                            <option key={`${f.key}-${h}`} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <span className={caret}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mapowanie kolumn — Zadania */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold">
                    Zadania ({mapping.tasks.length})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        parsed && autoMap(parsed.headers, parsed.rows)
                      }
                      className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                      title="Wykryj ponownie z nagłówków CSV"
                    >
                      Auto-wykryj
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!parsed) return;
                        const firstAny = parsed.headers.find(
                          (h) => !mapping.tasks.some((t) => t.header === h)
                        );
                        if (!firstAny) {
                          push({
                            type: "error",
                            message: "Brak wolnych kolumn w CSV.",
                          });
                          return;
                        }
                        setMapping((m) => ({
                          ...m,
                          tasks: [
                            ...m.tasks,
                            { header: firstAny, taskName: norm(firstAny) },
                          ],
                        }));
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
                    >
                      Dodaj kolumnę zadania
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="text-[11px] font-bold text-gray-400 uppercase py-2 pr-6">
                          Kolumna CSV (dowolna)
                        </th>
                        <th className="text-[11px] font-bold text-gray-400 uppercase py-2">
                          Nazwa zadania (wymagana)
                        </th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapping.tasks.map((t, i) => (
                        <tr
                          key={`${t.header}-${i}`}
                          className="border-t border-gray-100"
                        >
                          <td className="py-2 pr-6">
                            <div className="relative">
                              <select
                                className={clsSelect + " w-full"}
                                value={t.header}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (
                                    mapping.tasks.some(
                                      (row, idx) =>
                                        idx !== i && row.header === val
                                    )
                                  ) {
                                    push({
                                      type: "error",
                                      message:
                                        "Ta kolumna CSV jest już użyta w innym zadaniu.",
                                    });
                                    return;
                                  }
                                  setMapping((m) => {
                                    const copy = [...m.tasks];
                                    copy[i] = {
                                      ...copy[i],
                                      header: val,
                                      taskName: norm(val),
                                    };
                                    return { ...m, tasks: copy };
                                  });
                                }}
                              >
                                {headerOptions.map((h) => (
                                  <option key={`opt-${i}-${h}`} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <span className={caret}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </span>
                            </div>
                          </td>
                          <td className="py-2">
                            <input
                              className={clsInput + " w-full"}
                              value={t.taskName}
                              placeholder="Np. 1a, 2b, 3.1…"
                              onChange={(e) => {
                                const v = e.target.value;
                                setMapping((m) => {
                                  const copy = [...m.tasks];
                                  copy[i] = { ...copy[i], taskName: v };
                                  return { ...m, tasks: copy };
                                });
                              }}
                            />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              className="text-red-400 font-semibold hover:bg-red-50 rounded-md px-3 py-1 transition"
                              onClick={() =>
                                setMapping((m) => ({
                                  ...m,
                                  tasks: m.tasks.filter((_, idx) => idx !== i),
                                }))
                              }
                              title="Usuń wiersz"
                            >
                              Usuń
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!mapping.tasks.length && (
                        <tr>
                          <td className="py-6 text-gray-400" colSpan={3}>
                            Brak wybranych kolumn zadań.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Opisy — jedna kolumna treści i jedna czynności (opcjonalnie) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="relative">
                    <div className={clsLabel}>Treść zadania (opcjonalnie)</div>
                    <div className="relative">
                      <select
                        className={clsSelect + " w-full"}
                        value={mapping.taskContentCol || ""}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            taskContentCol: e.target.value || undefined,
                          }))
                        }
                      >
                        <option value="">— wybierz —</option>
                        {headerOptions.map((h) => (
                          <option key={`tc-${h}`} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className={caret}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className={clsLabel}>Czynność (opcjonalnie)</div>
                    <div className="relative">
                      <select
                        className={clsSelect + " w-full"}
                        value={mapping.taskActivityCol || ""}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            taskActivityCol: e.target.value || undefined,
                          }))
                        }
                      >
                        <option value="">— wybierz —</option>
                        {headerOptions.map((h) => (
                          <option key={`ta-${h}`} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className={caret}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini-podgląd */}
              {parsed && miniPreviewHeaders.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="font-bold mb-3">
                    Podgląd mapowania (3 pierwsze wiersze)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          {miniPreviewHeaders.map((h) => (
                            <th
                              key={`mp-h-${h.id}`}
                              className="text-[11px] font-bold text-gray-400 uppercase py-2 pr-6 text-left"
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 3).map((r, i) => (
                          <tr
                            key={`mp-r-${i}`}
                            className="border-t border-gray-100"
                          >
                            {miniPreviewHeaders.map((h) => (
                              <td
                                key={`mp-c-${i}-${h.id}`}
                                className="py-1 pr-6 text-sm text-gray-700 whitespace-nowrap"
                              >
                                {String(r[h.key] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-5 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {mode === "existing" && selectedTemplateName
                  ? "Używasz istniejącego szablonu — treść/czynność i punktacja pochodzą z szablonu."
                  : "Tworzysz nowy szablon — nazwy zadań są wymagane; treść/czynność (jeśli podasz) trafią do zadań."}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                  type="button"
                >
                  Anuluj
                </button>
                <button
                  onClick={submit}
                  disabled={!canImport}
                  className={
                    "font-semibold px-5 py-2 rounded-lg transition " +
                    (canImport
                      ? "bg-teal-500 hover:bg-teal-400 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed")
                  }
                  type="button"
                >
                  Importuj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportFromResults;
