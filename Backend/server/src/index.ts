import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import protectedRoutes from "./routes/protectedRoutes";
import schoolRoutes from "./routes/schoolRoutes";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api", protectedRoutes);
app.use("/schools", schoolRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));
