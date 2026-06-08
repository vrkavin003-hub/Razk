const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Copy .env.example to .env and set MONGO_URI.");
  }

  const connection = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 3000
  });
  console.log(`MongoDB connected: ${connection.connection.host}`);
};

module.exports = connectDB;
