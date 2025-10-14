import Auction from "../models/auction.js";
import Lot from "../models/lot.js";
import Event from "../models/event.js";
import AuctionSettings from "../models/auctionSettings.js";
import Questionnaire from "../models/questionnaire.js";
import EventDocument from "../models/eventDocument.js";
import EventLot from "../models/eventLot.js";
import EventParticipant from "../models/eventParticipant.js";
import mongoose from 'mongoose';
import User from "../models/user.js";
import Bid from "../models/bid.js";
import { getAgendaInstance } from '../agenda.js'
import { inviteAuction, sendInvitationEmail, sendAuctionConfirmationEmail } from "../utils/mailer.js";
import Invitation from "../models/invitation.js";
import crypto from "crypto";

// Create Complete Event/Auction (new structure from frontend)
export const createCompleteEvent = async (req, res) => {
  try {
    console.log('Complete Event payload:', req.body);

    const {
      // Main event data
      name,
      category,
      default_currency,
      multi_currency,
      brief_text,
      include_auction,
      include_questionnaire,
      include_rfq,
      seal_results,
      status,

      // Auction settings
      auction_settings,

      // Questionnaires
      questionnaires,

      // Documents
      documents,

      // Lots (for RFQ)
      lots,

      // Participants
      participants,
      auto_accept,

      // Event ID for updates
      eventId,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: "Event name is required" });
    }

    if (!category) {
      return res.status(400).json({ message: "Event category is required" });
    }

    let auction;

    // Check if this is an update or creation
    if (eventId) {
      // Update existing auction
      auction = await Auction.findById(eventId);
      if (!auction) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user owns this auction
      if (auction.createdBy.toString() !== req.user.userId) {
        return res.status(403).json({ message: "Unauthorized to update this event" });
      }

      // Update auction fields
      auction.title = name;
      auction.description = brief_text;
      auction.category = category;
      auction.brief_text = brief_text;
      auction.default_currency = default_currency || auction.default_currency;
      auction.multi_currency = multi_currency !== undefined ? multi_currency : auction.multi_currency;
      auction.include_auction = include_auction !== undefined ? include_auction : auction.include_auction;
      auction.include_questionnaire = include_questionnaire !== undefined ? include_questionnaire : auction.include_questionnaire;
      auction.include_rfq = include_rfq !== undefined ? include_rfq : auction.include_rfq;
      auction.seal_results = seal_results !== undefined ? seal_results : auction.seal_results;
      auction.status = status || auction.status;
      auction.currency = default_currency || auction.currency;
      
      // Update nested objects
      auction.auction_settings = auction_settings || auction.auction_settings;
      auction.questionnaires = questionnaires || auction.questionnaires;
      auction.event_documents = documents || auction.event_documents;
      auction.event_lots = lots || auction.event_lots;
      auction.participants = participants || auction.participants;
      auction.auto_accept = auto_accept !== undefined ? auto_accept : auction.auto_accept;
      auction.invitedSupplierEmail = participants ? participants.map(p => p.participant.email) : auction.invitedSupplierEmail;

    } else {
      // Create new auction
      const currentYear = new Date().getFullYear();
      const uniqueThreeDigitNumber = Math.floor(Math.random() * 900) + 100;
      const auctionId = `AUC-${currentYear}-CC-${uniqueThreeDigitNumber}`;

      auction = new Auction({
        title: name,
        auctionId,
        description: brief_text,
        category,
        brief_text,
        default_currency: default_currency || "GBP",
        multi_currency: multi_currency || false,
        include_auction: include_auction || false,
        include_questionnaire: include_questionnaire || false,
        include_rfq: include_rfq || false,
        seal_results: seal_results !== undefined ? seal_results : true,
        status: status || "draft",
        
        // Legacy compatibility - set defaults for required fields
        reservePrice: 0, // Default reserve price
        currency: default_currency || "GBP",
        
        // Store auction settings inline for backward compatibility
        auction_settings: auction_settings || {},
        
        // Store questionnaires inline
        questionnaires: questionnaires || [],
        
        // Store documents inline
        event_documents: documents || [],
        
        // Store lots inline (for RFQ)
        event_lots: lots || [],
        
        // Store participants inline
        participants: participants || [],
        auto_accept: auto_accept || false,
        
        // Extract emails for legacy compatibility
        invitedSupplierEmail: participants ? participants.map(p => p.participant.email) : [],
        
        createdBy: req.user.userId,
      });
    }

    // Set timing from auction settings if provided
    if (auction_settings && include_auction) {
      if (auction_settings.start_date) {
        auction.startTime = new Date(auction_settings.start_date);
      }
      if (auction_settings.start_date && auction_settings.minimum_duration) {
        const endTime = new Date(auction_settings.start_date);
        endTime.setMinutes(endTime.getMinutes() + auction_settings.minimum_duration);
        auction.endTime = endTime;
      }
    }

    await auction.save();

    // If auction is enabled and has timing, schedule agenda jobs
    if (include_auction && auction.startTime && auction.endTime) {
      try {
        const agenda = getAgendaInstance();
        await agenda.schedule(new Date(auction.startTime), 'start auction', { auctionId: auction._id });
        await agenda.schedule(new Date(auction.endTime), 'end auction', { auctionId: auction._id });
        console.log('Auction jobs scheduled successfully');
      } catch (agendaError) {
        console.error('Failed to schedule auction jobs:', agendaError);
        // Don't fail the entire creation, just log the error
      }
    }

    // Handle participants - send invitations
    if (participants && participants.length > 0) {
      try {
        const emails = participants.map(p => p.participant.email).filter(email => email);
        const normalizedEmails = [...new Set(emails)]; // Remove duplicates

        if (normalizedEmails.length > 0) {
          // Check existing users
          const existingUsers = await User.find({
            email: { $in: normalizedEmails }
          });
          const existingEmails = existingUsers.map(user => user.email);
          const newEmails = normalizedEmails.filter(email => !existingEmails.includes(email));

          console.log("Existing Users:", existingEmails);
          console.log("New Users to Invite:", newEmails);

          // Prepare auction details for email
          const auctionDetailsHtml = `
            <table style="width:100%; border-collapse:collapse; margin:18px 0 24px 0; font-size:15px;">
              <tr style="background:#f0f4f8;"><th colspan="2" style="padding:10px 0; font-size:16px; color:#1AAB74; text-align:left; border-radius:6px 6px 0 0;">Event Details</th></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Name</td><td style="padding:8px 12px; color:#222;">${name || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Category</td><td style="padding:8px 12px; color:#222;">${category || '-'}</td></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Description</td><td style="padding:8px 12px; color:#222;">${brief_text || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Currency</td><td style="padding:8px 12px; color:#222;">${default_currency || '-'}</td></tr>
              ${auction.startTime ? `<tr><td style="padding:8px 12px; color:#555; font-weight:500;">Start Time</td><td style="padding:8px 12px; color:#222;">${auction.startTime.toLocaleString()}</td></tr>` : ''}
              ${auction.endTime ? `<tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">End Time</td><td style="padding:8px 12px; color:#222;">${auction.endTime.toLocaleString()}</td></tr>` : ''}
            </table>
          `;

          // Send invitations
          for (const email of normalizedEmails) {
            try {
              let invitation = await Invitation.findOne({ email, used: false, response: "pending" });
              if (!invitation) {
                const token = crypto.randomBytes(32).toString("hex");
                invitation = new Invitation({
                  email,
                  token,
                  invitedBy: req.user.userId,
                });
                await invitation.save();
              }
              
              // Send invitation email (you may need to create this function or modify existing one)
              await sendAuctionConfirmationEmail(email, auction.title, null, "", invitation.token, auction._id, auctionDetailsHtml);
            } catch (emailError) {
              console.error(`Failed to send invitation to ${email}:`, emailError);
              // Continue with other emails
            }
          }
        }
      } catch (participantError) {
        console.error('Failed to process participants:', participantError);
        // Don't fail the entire creation, just log the error
      }
    }

    res.status(201).json({ 
      message: "Event created successfully", 
      auction,
      id: auction._id 
    });
  } catch (err) {
    console.error('Complete event creation error:', err);
    res.status(500).json({ message: "Event creation failed", error: err.message });
  }
};

// Create Auction (with optional lots)
export const createAuction = async (req, res) => {
  try {
    console.log('Auction payload:', req.body); // <-- Add this line

    const {
      title,
      description,
      category,
      sapCodes,
      reservePrice,
      currency,
      startTime,
      endTime,
      autoExtension,
      extensionMinutes,
      invitedSuppliers,
      costParams,
      lots, // Array of lot objects
      previewEmail, // <-- add this
      // Remove draftedMessage
    } = req.body;

    // Handle auction-level documents
    const documents = req.files?.auctionDocs?.map(file => file.path) || [];
    const currentYear = new Date().getFullYear();
    const uniqueThreeDigitNumber = Math.floor(Math.random() * 900) + 100;
    const auctionId = `AUC-${currentYear}-CC-${uniqueThreeDigitNumber}`;

    // Build invitedSuppliersFinal: ObjectId for registered users, email for new ones
    const invitedSuppliersFinal = [];
    for (const email of invitedSuppliers) {
      const user = await User.findOne({ email });
      if (user) {
        invitedSuppliersFinal.push(user._id); // Registered user: push ObjectId
      } else {
        invitedSuppliersFinal.push(email);    // Not registered: push email
      }
    }

    // Create auction
    const auction = new Auction({
      title,
      auctionId,
      description,
      sapCodes,
      category,
      reservePrice,
      currency,
      startTime,
      endTime,
      autoExtension,
      extensionMinutes,
      invitedSuppliers: invitedSuppliersFinal,
      invitedSupplierEmail: invitedSuppliers,
      costParams,
      documents,
      createdBy: req.user.userId,
      previewEmail, // <-- store it
    });

    await auction.save();

    const agenda = getAgendaInstance();

// Schedule start job
await agenda.schedule(new Date(startTime), 'start auction', { auctionId: auction._id });

// Schedule end job
await agenda.schedule(new Date(endTime), 'end auction', { auctionId: auction._id });
console.log(invitedSuppliers, "iiiiiiiiiiiiiiiiiii")
console.log(auction, auction._id, "vvvvvvvvvvvvvvvvvvvvvv11111111")
const normalizedEmails = invitedSuppliers.map(email => email);
    // Validate invited suppliers
    // if (invitedSuppliers && invitedSuppliers.length > 0) {
      const existingUsers = await User.find({
        email: { $in: normalizedEmails },
        // role: "Supplier"
      });
      // if (validSuppliers.length !== invitedSuppliers.length) {
      //   return res.status(400).json({ message: "One or more invited users are not valid suppliers." });
      // }
    // }
    // Extract existing emails from DB results
const existingEmails = existingUsers.map(user => user.email);
console.log(existingUsers, "existingUsers")
// Determine which emails are *not* in DB
const newEmails = normalizedEmails.filter(email => !existingEmails.includes(email));

// Optionally validate existing users further (e.g., check if role is 'Supplier')
// const validSuppliers = existingUsers.filter(user => user.role === 'Supplier');

console.log("Existing Users:", existingEmails);
console.log("New Users to Invite:", newEmails);

let lotIds = [];
    // Handle lots (if any)
    if (lots && lots.length > 0) {
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        console.log(lot.dimensions, "vvvvvvvvvvvvvvvvvvvvvv333333333")

        // const lotDocs = req.files?.[`lotDocs${i}`]?.map(file => file.path) || [];
        const newLot = new Lot({
          auction: auction._id,
          lotId: lot.lotId,
          volume: lot.volume,
          name: lot.productName,
          hsCode: lot.hsCode,
          material: lot.material,
          prevCost: lot.prevCost,
          dimensions: lot.dimensions
          
          // description: lot.description,
          // specifications: lot.specifications,
          // documents: lotDocs,
          // reservePrice: lot.reservePrice,
          // currency: lot.currency,
        });
        await newLot.save();
       lotIds.push(newLot._id);
      }
        auction.lots = lotIds;
      await auction.save();
    }

    console.log(newEmails, "newEmails")
    console.log(existingEmails, "existingEmails")

    // Prepare auction details table HTML
    const auctionDetailsHtml = `
      <table style="width:100%; border-collapse:collapse; margin:18px 0 24px 0; font-size:15px;">
        <tr style="background:#f0f4f8;"><th colspan="2" style="padding:10px 0; font-size:16px; color:#1AAB74; text-align:left; border-radius:6px 6px 0 0;">Auction Details</th></tr>
        <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Description</td><td style="padding:8px 12px; color:#222;">${description || '-'}</td></tr>
        <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Category</td><td style="padding:8px 12px; color:#222;">${category || '-'}</td></tr>
        <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Reserve Price</td><td style="padding:8px 12px; color:#222;">${reservePrice || '-'}</td></tr>
        <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Currency</td><td style="padding:8px 12px; color:#222;">${currency || '-'}</td></tr>
        <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Start Time</td><td style="padding:8px 12px; color:#222;">${startTime ? new Date(startTime).toLocaleString() : '-'}</td></tr>
        <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">End Time</td><td style="padding:8px 12px; color:#222;">${endTime ? new Date(endTime).toLocaleString() : '-'}</td></tr>
      </table>
    `;
    // Send confirmation email to all suppliers (registered and new)
    for (const email of normalizedEmails) {
      // Check if invitation already exists for this email
      let invitation = await Invitation.findOne({ email, used: false, response: "pending" });
      if (!invitation) {
        // Generate unique token
        const token = crypto.randomBytes(32).toString("hex");
        invitation = new Invitation({
          email,
          token,
          invitedBy: req.user.userId,
        });
        await invitation.save();
      }
      // Build confirmation link (not used in email body anymore)
      await sendAuctionConfirmationEmail(email, auction.title, null, previewEmail, invitation.token, auction._id, auctionDetailsHtml);
    }
    res.status(201).json({ message: "Auction created successfully", auction });
  } catch (err) {
    console.error(err); // <-- Also add this for error details
    res.status(500).json({ message: "Auction creation failed", error: err.message });
  }
};

// List all auctions (EP members: all, Suppliers: only invited & active)
// export const listAuctions = async (req, res) => {
//   try {
//     console.log(req.user.userId, "req.user.userId")
//     let auctions;
//     if (["Admin", "Manager", "Viewer"].includes(req.user.role)) {
//       auctions = await Auction.find().populate("lots invitedSuppliers createdBy");
//     } else if (req.user.role === "Supplier") {
//       auctions = await Auction.find({
//         invitedSuppliers: req.user.userId,
//         status: { $in: ["Active", "Scheduled"] }
//       }).populate("lots invitedSuppliers createdBy");
//     // const  auctions = await Auction.find({
//     //     status: { $in: ["Active", "Scheduled"] }
//     //   }).populate("lots invitedSuppliers createdBy");
//     // } else {
//     //   return res.status(403).json({ message: "Access denied" });
//     // }
//     } else{
//       return res.status(403).json({ message: "Access denied" });
//     }
//     res.json(auctions);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch auctions", error: err.message });
//   }
// };

export const listAuctions = async (req, res) => {
  try {
    console.log(req.user, "req.user.userId");
    let auctions;
    // console.log(auctions, "auctions")
    // Fetch auctions based on user rol
    if (["Admin", "Manager", "Viewer"].includes(req.user.role)) {
      auctions = await Auction.find({createdBy: req.user.userId}).populate("lots invitedSuppliers createdBy");
      // Add noOfLots to each auction
      // const enrichedAuctions = auctions.map(auction => {
      //   const auctionObj = auction.toObject();
      //   auctionObj.noOfLots = auction.lots ? auction.lots.length : 0;
      //   return auctionObj;
      // });

      return res.json(auctions);
    }

    // Supplier-specific logic
    else if (req.user.role === "Supplier") {
      console.log("kkkkkkkkkkk");
      const supplierId = new mongoose.Types.ObjectId(req.user.userId);
      auctions = await Auction.find({
        invitedSuppliers: supplierId,
        // status: { $in: ["Active", "Scheduled"] }
      }).populate("lots invitedSuppliers createdBy");
      console.log(auctions, "kkkkkkkkkkk1111111111");

      const now = new Date();
      const upcoming = [];
      const live = [];
       const paused = [];
      const ended = [];

      for (const auction of auctions) {
        const auctionObj = auction.toObject();
        auctionObj.noOfLots = auction.lots ? auction.lots.length : 0;

        const start = new Date(auction.startTime);
        const end = new Date(auction.endTime);

        if (auction.status === "Paused") {
          paused.push(auctionObj);
        } else if (start > now) {
          upcoming.push(auctionObj);
        } else if (start <= now && end >= now) {
          live.push(auctionObj);
        } else {
          ended.push(auctionObj);
        }
      }

      return res.json({ upcoming, live, ended });
    }

    // Default deny
    else {
      return res.status(403).json({ message: "Access denied" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch auctions", error: err.message });
  }
};

export const listSingleAuctions = async (req, res) => {
  try {
    console.log("req.user.userId");
    // Supplier-specific logic
    if (req.user.role === "Supplier") {
      const auctions = await Auction.find({
        _id: req.params.id,
        // status: { $in: ["Active", "Scheduled"] }
      }).populate("lots invitedSuppliers createdBy");
      console.log(auctions, "kkkkkkkkkkk1111111111");


      // for (const auction of auctions) {
      //   const auctionObj = auction.toObject();
      //   auctionObj.noOfLots = auction.lots ? auction.lots.length : 0;
      // }

      return res.json({auctions});
    }

    // Default deny
    else {
      return res.status(403).json({ message: "Access denied" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch auctions", error: err.message });
  }
};



// Get auction details by ID
export const getAuctionDetails = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate("lots invitedSuppliers createdBy");
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    // Suppliers can only view auctions they're invited to
    if (
       req.user.role === "Supplier" &&
       !auction.invitedSuppliers.some(
        s => typeof s === 'object' && s._id && s._id.equals(req.user.userId)
      )
    ) {
      return res.status(403).json({ message: "Access denied" });
    }
      if (auction.lots && Array.isArray(auction.lots)) {
      auction.lots.sort((a, b) => {
        const idA = a.lotId || "";
        const idB = b.lotId || "";
        return idA.localeCompare(idB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    }

    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auction details", error: err.message });
  }
};

// Pause auction
export const pauseAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.status !== "Active") {
      return res.status(400).json({ message: "Only active auctions can be paused." });
    }

    auction.status = "Paused";
    await auction.save();

    // (Optional) Emit real-time update
    if (req.app.get("io")) {
      req.app.get("io").to(auction._id.toString()).emit("auctionStatusChanged", { status: "Paused" });
    }

    res.json({ message: "Auction paused", auction });
  } catch (err) {
    res.status(500).json({ message: "Failed to pause auction", error: err.message });
  }
};

// Resume auction
export const resumeAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.status !== "Paused") {
      return res.status(400).json({ message: "Only paused auctions can be resumed." });
    }

    auction.status = "Active";
    await auction.save();

    // (Optional) Emit real-time update
    if (req.app.get("io")) {
      req.app.get("io").to(auction._id.toString()).emit("auctionStatusChanged", { status: "Active" });
    }

    res.json({ message: "Auction resumed", auction });
  } catch (err) {
    res.status(500).json({ message: "Failed to resume auction", error: err.message });
  }
};

export const getAuctionMonitoring = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await Auction.findById(id).populate("lots invitedSuppliers");
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    // Get all bids for this auction
    const bids = await Bid.find({ auction: id });

    // Participation: unique suppliers who have placed bids
    const participatingSuppliers = [...new Set(bids.map(b => b.supplier.toString()))];

    // Bid activity timeline
    const bidTimeline = bids.map(b => ({
      supplier: b.supplier,
      amount: b.amount,
      createdAt: b.createdAt
    }));

    res.json({
      auction,
      participationCount: participatingSuppliers.length,
      bidTimeline
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch monitoring data", error: err.message });
  }
};