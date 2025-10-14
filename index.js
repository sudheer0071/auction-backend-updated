import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import supplierRoutes from "./routes/supplier.js";
import userRoutes from "./routes/user.js";
import auctionRoutes from "./routes/auction.js";
import bidRoutes from "./routes/bid.js";
import invitationRoutes from "./routes/invitation.js";
import currencyRate from "./routes/currencyRate.js";
import countryTariffRoutes from "./routes/countryTariff.js";
import cron from "node-cron";
import Auction from "./models/auction.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import auctionQARoutes from "./routes/auctionQA.js";
import dutyRoutes from "./routes/dutyTable.js";
import awardNoticeRoutes from "./routes/awardNotice.js";
import messageRoutes from "./routes/message.js";
import uploadRoutes from "./routes/upload.js";
import { initAgenda } from './agenda.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173", 
      "https://auction-frontend-psi.vercel.app",
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  },
});
app.set("io", io);
initAgenda(io);

const PORT = process.env.PORT || 5001;

// CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173", 
    "https://auction-frontend-psi.vercel.app",
    "https://auction-frontend-psi.vercel.app/",
    process.env.FRONTEND_URL // Add this to your environment variables
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With", 
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control"
  ]
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Use Auth Routes
app.use("/api/auth", authRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/user", userRoutes);
app.use("/api/auction", auctionRoutes);
// app.use("/api/aution", auctionRoutes); // Handle typo in frontend URL
app.use("/api/bid", bidRoutes);
app.use("/api/invitation", invitationRoutes);
app.use("/api/auction-qa", auctionQARoutes);
app.use("/api/import-duty", dutyRoutes);
app.use("/api/currency-rate", currencyRate);
app.use("/api/country-tariff", countryTariffRoutes);
app.use("/api/award-notice", awardNoticeRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/upload", uploadRoutes);


// TODO: Import and use your route modules here
// Example: app.use("/api/users", userRoutes);
console.log(process.env.MONGODB_URI, "process.env.MONGODB_URI")
// MongoDB Connection
mongoose
  // .connect(process.env.MONGODB_URI, {
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true,
  //   // useCreateIndex: true, // Uncomment if needed for your Mongoose version
  // })
  .connect(process.env.MONGODB_URI)

  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Run every minute to update auction statuses
cron.schedule("* * * * *", async () => {
  const now = new Date();

  // Activate scheduled auctions
  await Auction.updateMany(
    { status: "published", startTime: { $lte: now }, endTime: { $gt: now } },
    { $set: { status: "Active" } }
  );

  // End active auctions
  await Auction.updateMany(
    { status: "Active", endTime: { $lte: now } },
    { $set: { status: "Ended" } }
  );
});

import { broadcastUpdatedRankings } from "./controllers/bidController.js";

io.on("connection", (socket) => {
  console.log("New socket connection:", socket.id);

  socket.on("joinAuction", async (auctionId) => {
    socket.join(auctionId);

    console.log(`User joined auction ${auctionId}`);

       await broadcastUpdatedRankings(io, auctionId, null, socket);
  });

  socket.on("leaveAuction", async (auctionId) => {
    // Optionally: socket.leave(auctionId);
    // Send current rankings to this socket only
    // await broadcastUpdatedRankings(io, auctionId, null, socket);

  });

  // Join event room for messaging (both admin and suppliers join)
  socket.on("joinEventMessages", ({ eventId, participantId }) => {
    // Join event room
    socket.join(`event_${eventId}`);

    // If participant ID provided (supplier), join participant-specific room
    if (participantId) {
      socket.join(`event_${eventId}_participant_${participantId}`);
      console.log(`Participant joined event ${eventId}, participant room: ${participantId}`);
    } else {
      // Admin joins to receive all messages for this event
      console.log(`Admin joined event ${eventId} messages`);
    }
  });

  // Leave event messaging room
  socket.on("leaveEventMessages", ({ eventId, participantId }) => {
    socket.leave(`event_${eventId}`);
    if (participantId) {
      socket.leave(`event_${eventId}_participant_${participantId}`);
    }
    console.log(`User left event ${eventId} messages`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});