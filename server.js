const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");

const paystackRoutes = require("./routes/paystackRoutes");

dotenv.config();
connectDB();

const app = express();

// IMPORTANT: Webhook needs raw body before JSON parser
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", paymentRoutes);
app.use("/api", expenseRoutes);
app.use("/api/paystack", paystackRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("MAISA Dues API Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
