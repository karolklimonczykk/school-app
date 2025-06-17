import React, { useEffect, useState } from "react";
import axios  from "axios";
// Typ szkoły (dopasuj do swojego modelu!)
type School = {
  id: number;
  name: string;
  ownerId: number;
};

const Schools: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  // Pobieranie szkół po załadowaniu komponentu
  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get<School[]>("http://localhost:4000/schools", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSchools(res.data);
    } catch {
      setMessage("Nie udało się pobrać szkół (upewnij się, że jesteś zalogowany/a)");
    }
  };

  // Dodawanie szkoły
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post<School>(
        "http://localhost:4000/schools",
        { name },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setSchools([...schools, res.data]);
      setName("");
      setMessage("Szkoła dodana!");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error || "Błąd dodawania szkoły");
      } else {
        setMessage("Błąd dodawania szkoły");
      }
    }
  };

  return (
    <div>
      <h2>Twoje szkoły</h2> 
      <ul>
        {schools.map((school) => (
          <li key={school.id}>{school.name}</li>
        ))}
      </ul>

      <h3>Dodaj nową szkołę</h3>
      <form onSubmit={handleAddSchool}>
        <input
          type="text"
          placeholder="Nazwa szkoły"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Dodaj szkołę</button>
      </form>
      {message && <div>{message}</div>}
    </div>
  );
};

export default Schools;
