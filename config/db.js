// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        console.log(`Connecting to database at: ${uri}`);
        
        if (!uri) {
            throw new Error("MONGO_URI is missing from your environment variables!");
        }

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Give up after 5 seconds instead of hanging
        });

        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;