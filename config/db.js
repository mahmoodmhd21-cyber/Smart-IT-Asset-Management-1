// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.warn("MONGO_URI is missing. API routes that need the database will fail until it is configured.");
        return null;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 3000,
        });

        console.log("MongoDB connected successfully");
        return mongoose.connection;
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        return null;
    }
};

module.exports = connectDB;
