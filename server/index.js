const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
dotenv.config();

connectDB();
const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', require('./routes/authRoutes'));
app.use('/users', require('./routes/userRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

app.get("/api/ai/ping",async (req, res) => {
  try {
    const response = await axios.get(`${process.env.FASTAPI_URL}/ping`);
    res.status(200).json({ express:"alive", fastapi: response.data }); 
}catch(error){
    res.status(500).json({ error: "Error pinging FastAPI server" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});