const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in .env');
  }

  await mongoose.connect(uri);
  isConnected = true;
  console.log('[db] Connected to MongoDB');
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[db] Disconnected from MongoDB');
}

module.exports = { connectDB, disconnectDB };
