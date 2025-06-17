import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Link } from "react-router-dom";
// Typ klasy (dopasuj do modelu w Prisma!)
type SchoolClass = {
  id: number;
  name: string;
  order: number;
  schoolId: number;
};

const SchoolDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [message, setMessage] = useState("");

  // Pobieranie klas
  useEffect(() => {
    fetchClasses();
    // eslint-disable-next-line
  }, [id]);

  const fetchClasses = async () => {
    if (!id) return;
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<SchoolClass[]>(`http://localhost:4000/schools/${id}/classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setClasses(res.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd pobierania klas");
      } else {
        setMessage("Błąd pobierania klas");
      }
    }
  };

  // Dodawanie klasy
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<SchoolClass>(
        `http://localhost:4000/schools/${id}/classes`,
        { name: newClassName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setClasses([...classes, res.data]);
      setNewClassName("");
      setMessage("Klasa dodana!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd dodawania klasy");
      } else {
        setMessage("Błąd dodawania klasy");
      }
    }
  };

  // Edycja klasy
    const handleEditClass = async (classId: number) => {
        const newName = prompt("Podaj nową nazwę klasy:");
        if (!newName) return;
        setMessage("");
        const token = localStorage.getItem("token");
        try {
        const res = await axios.put<SchoolClass>(
            `http://localhost:4000/schools/${id}/classes/${classId}`,
            { name: newName },
            {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        );
        setClasses(classes.map(cls => (cls.id === classId ? res.data : cls)));
        setMessage("Klasa zaktualizowana!");
        } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            setMessage(err.response?.data?.error || "Błąd edycji klasy");
        } else {
            setMessage("Błąd edycji klasy");
        }
        }
    };
    // Usuwanie klasy
    const handleDeleteClass = async (classId: number) => {
        if (!window.confirm("Na pewno usunąć tę klasę?")) return;
        setMessage("");
        const token = localStorage.getItem("token");
        try {
        await axios.delete(`http://localhost:4000/schools/${id}/classes/${classId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setClasses(classes.filter(cls => cls.id !== classId));
        setMessage("Klasa usunięta!");
        } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            setMessage(err.response?.data?.error || "Błąd usuwania klasy");
        } else {
            setMessage("Błąd usuwania klasy");
        }
        }
    };

  return (
    <div>
      <h2>Szczegóły szkoły (ID: {id})</h2>

      <h3>Lista klas</h3>
      <ul>
        {classes.map(cls => (
          <li key={cls.id}>
            <Link to={`/schools/${id}/classes/${cls.id}`}>{cls.name}</Link>
            <button onClick={() => handleEditClass(cls.id)}>Edytuj</button>{" "}
            <button onClick={() => handleDeleteClass(cls.id)}>Usuń</button>
          </li>
        ))}
      </ul>

      <h3>Dodaj nową klasę</h3>
      <form onSubmit={handleAddClass}>
        <input
          type="text"
          placeholder="Nazwa klasy"
          value={newClassName}
          onChange={e => setNewClassName(e.target.value)}
          required
        />
        <button type="submit">Dodaj klasę</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default SchoolDetails;
