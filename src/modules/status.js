import express from "express";
const app = express();
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import chalk from "chalk";
import cors from "cors";
const limiter = rateLimit({
  windowMs: 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(helmet());
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Init server
app.listen(5522, () => {
  console.log(chalk.white(`Server is running on port `) + chalk.cyan(5522));
});

// Endpoints
app.get("/", (req, res) => {
  res.json({
    able: true,
  });
});
