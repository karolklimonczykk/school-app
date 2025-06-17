import express from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/protected", authenticateJWT, (req, res) => {
  res.json({ message: "Jesteś zalogowany!", userId: req.userId });
});

export default router;
