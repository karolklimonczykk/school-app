import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import protectedRoutes from "./routes/protectedRoutes";
import schoolRoutes from "./routes/schoolRoutes";
import classRoutes from "./routes/classRoutes";
import studentRoutes from "./routes/studentRoutes";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api", protectedRoutes);
app.use("/schools", schoolRoutes);
app.use("/", classRoutes);
app.use("/", studentRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
