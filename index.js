const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const path = require("path");
const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");

const { init } = require("./config/socketConfig");
const dbconnection = require("./config/database");
const cloudinary = require("./utils/cloudinary");
const router = require("./routes/router");
const mainrouter = require("./routes/mainrouter");

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------
// Middleware
// ----------------------------------------

// JSON parser
app.use(express.json());

// CORS
const corsOptions = {
  origin: [
    "https://nationwide-motors-llc.com",
    "https://www.nationwide-motors-llc.com",
  ],
  methods: ["GET", "POST"],
  credentials: true,
};

// const corsOptions = {
//   origin: [
// 'http://localhost:3000','http://localhost:3001','http://localhost:4000'
//   ],
//   methods: ["GET", "POST"],
//   credentials: true,
// };



app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please slow down.",
  },
  skip: (req) => req.method === "OPTIONS",
});

// Security middleware
app.use(helmet());
app.use(xss());
app.use(mongoSanitize());

// Apply limiter to API
app.use("/api", apiLimiter);
app.use("/api/v2", apiLimiter);

// Cookie parser
app.use(cookieParser());

// File upload
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// ----------------------------------------
// Database + Cloudinary
// ----------------------------------------
dbconnection();
cloudinary.cloudinaryConnect();

// ----------------------------------------
// Routes
// ----------------------------------------
app.use("/api", router);
app.use("/api/v2", mainrouter);

// Test route
app.get("/", (req, res) => {
  res.send("API is working");
});

// ----------------------------------------
// 404 Handler
// ----------------------------------------
app.all("*", (req, res, next) => {
  const err = new Error(`Cannot find ${req.originalUrl} on this server`);
  err.statusCode = 404;
  next(err);
});

// ----------------------------------------
// Global Error Handler
// ----------------------------------------
app.use((err, req, res, next) => {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
  });
});

// ----------------------------------------
// HTTP Server + Socket.io
// ----------------------------------------
const server = http.createServer(app);
init(server);

// ----------------------------------------
// Start Server
// ----------------------------------------
server.listen(PORT, () => {
  console.log("App is listening on port:", PORT);
});
