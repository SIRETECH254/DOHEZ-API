import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import "dotenv/config"; // Loads environment variables
import path from "path";
import passport from "passport";
import "./config/passport";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerConfig from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import roleRoutes from "./routes/roleRoutes";
import userRoutes from "./routes/userRoutes";
import taskRoutes from "./routes/taskRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import vendorCategoryRoutes from "./routes/vendorCategoryRoutes";
import vendorTypeRoutes from "./routes/vendorTypeRoutes";
import vendorRoutes from "./routes/vendorRoutes";
import branchRoutes from "./routes/branchRoutes";
import productTypeRoutes from "./routes/productTypeRoutes";
import productCategoryRoutes from "./routes/productCategoryRoutes";
import variantRoutes from "./routes/variantRoutes";
import productModifierRoutes from "./routes/productModifierRoutes";
import productRoutes from "./routes/productRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import couponRoutes from "./routes/couponRoutes";
import packagingRoutes from "./routes/packagingRoutes";
import invoiceRoutes from "./routes/invoiceRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import addressRoutes from "./routes/addressRoutes";
import locationRoutes from "./routes/locationRoutes";
import breakRoutes from "./routes/breakRoutes";
import availabilityRoutes from "./routes/availabilityRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import ticketRoutes from "./routes/ticketRoutes";
import receiptRoutes from "./routes/receiptRoutes";
import laundryRoutes from "./routes/laundryRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";

// Initialize application
const app = express();
const PORT = process.env.PORT || 3500;

app.use(passport.initialize());

// CORS Configuration with explicit origins
const allowedOrigins: string[] = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:8084",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3500",
  "https://dohez-admin.onrender.com",
  "https://dohez-api.onrender.com",
  "https://dohez-client.onrender.com"
];

// Add CALLBACK_URL if it exists
if (process.env.CALLBACK_URL) {
  allowedOrigins.push(process.env.CALLBACK_URL);
}

// CORS middleware configuration
app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.options(/.*/, cors() as any); // Enable pre-flight across all routes

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// DB CONNECTION
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("DB CONNECTED"))
    .catch((err) => console.log("DB Connection Error:", err.message));
} else {
  console.warn("⚠️ MONGO_URI not found in environment variables");
}

// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "E-Commerce API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  });
});

// CORS debug endpoint (helpful for troubleshooting)
app.get("/api/debug/cors", (req, res) => {
  res.json({
    allowedOrigins,
    requestOrigin: req.get("origin") || "No origin header",
    corsEnabled: true,
    environmentVariable: process.env.CORS_ORIGIN ? "Set" : "Not Set",
    timestamp: new Date().toISOString()
  });
});

// Swagger Documentation
app.use(
  "/api/docs",
  swaggerConfig.swaggerUi.serve,
  swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.options)
);

// Route Registrations
app.use("/api/auth", authRoutes);

app.use("/api/roles", roleRoutes);

app.use("/api/users", userRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/services", serviceRoutes);

app.use("/api/vendor-categories", vendorCategoryRoutes);

app.use("/api/vendor-types", vendorTypeRoutes);

app.use("/api/vendors", vendorRoutes);

app.use("/api/branches", branchRoutes);

app.use("/api/product-types", productTypeRoutes);

app.use("/api/product-categories", productCategoryRoutes);

app.use("/api/variants", variantRoutes);

app.use("/api/product-modifiers", productModifierRoutes);

app.use("/api/products", productRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/coupons", couponRoutes);

app.use("/api/packaging", packagingRoutes);

app.use("/api/invoices", invoiceRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/addresses", addressRoutes);

app.use("/api/locations", locationRoutes);

app.use("/api/breaks", breakRoutes);

app.use("/api/availability", availabilityRoutes);

app.use("/api/appointments", appointmentRoutes);

app.use("/api/tickets", ticketRoutes);

app.use("/api/receipts", receiptRoutes);

app.use("/api/laundries", laundryRoutes);

app.use("/api/dashboard", dashboardRoutes);

// Socket.io setup for real-time features
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

const socketConnections = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

socket.on("authenticate", (userId: string) => {
    socketConnections.set(userId, socket.id);
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [key, value] of socketConnections.entries()) {
      if (value === socket.id) {
        socketConnections.delete(key);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io);
app.set("socketConnections", socketConnections);

// Main API endpoint
app.get("/api", (_req, res) => {
  res.json({
    message: "Welcome to E-Commerce API",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      health: "/api/health"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack
      })
    });
  }
);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 E-Commerce API Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔒 CORS Origins: ${allowedOrigins.join(", ")}`);
  console.log("🔌 Socket.io enabled for real-time features");
});
