// Load environment variables
require("dotenv").config();
console.log("Test 1111111",process.env.MONGO_URI)

// Import express
const express = require("express");

// Import database connection
const connectDB = require("./config/db.js");
const authRoutes = require("./routes/authRoutes");
const allocationRoutes = require("./routes/allocationRoutes");
const assetRoutes = require("./routes/assetRoutes");
console.log("What is connectDB?", typeof connectDB, connectDB);

// Create express application
const app = express();

// Connect database
console.log('Starting database connection...');
connectDB()
  .then(() => console.log('connectDB resolved'))
  .catch((err) => console.error('connectDB rejected', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get("/", (req, res) => {
    res.send("Smart IT Asset Management API Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/allocations", allocationRoutes);
app.use("/api/assets", assetRoutes);

// Server Port$ brew install git
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
