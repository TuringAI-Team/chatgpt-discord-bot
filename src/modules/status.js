import express from "express";
const app = express();
import rateLimit from "express-rate-limit";
import chalk from "chalk";
import { getStatus } from "./gpt-api.js";
import cors from "cors";
const limiter = rateLimit({
  windowMs: 10000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Endpoints
app.get("/", async (req, res) => {
  var abled = await getStatus();
  console.log(abled);
  if (abled) {
    res.json({
      abled: true,
    });
  } else {
    res.status(403).send("Something went wrong");
  }
});
app.get("/test", (req, res) => {
  res.json({
    abled: true,
  });
});
// Init server
app.listen(5522, () => {
  console.log(chalk.white(`Server is running on port `) + chalk.cyan(5522));
});
