// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        throw new Error("MONGO_URI is required.");
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 3000,
        });

        console.log("MongoDB connected successfully");
        return mongoose.connection;
    } catch (error) {
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
};

module.exports = connectDB;
