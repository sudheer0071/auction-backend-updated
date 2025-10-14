/**
 * UPDATED AUCTION CONTROLLER - NORMALIZED STRUCTURE (NO TRANSACTIONS)
 * 
 * This demonstrates how to work with the normalized auction model
 * Key changes:
 * 1. Create separate documents for auction settings, questionnaires, etc.
 * 2. Use references instead of embedded documents
 * 3. Use populate() to fetch related data
 * 4. Removed transactions for compatibility with standalone MongoDB
 */

import Auction from "../models/auction.js";
import Event from "../models/event.js";
import AuctionSettings from "../models/auctionSettings.js";
import Questionnaire from "../models/questionnaire.js";
import EventDocument from "../models/eventDocument.js";
import EventLot from "../models/eventLot.js";
import EventParticipant from "../models/eventParticipant.js";
import mongoose from 'mongoose';
import User from "../models/user.js";
import Invitation from "../models/invitation.js";
import crypto from "crypto";
import path from 'path';
import { fileURLToPath } from 'url';
import { sendAuctionConfirmationEmail } from "../utils/mailer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Complete Event/Auction with Normalized Structure (No Transactions)
export const createCompleteEventNormalized = async (req, res) => {
  console.log("Creating auction with normalized structure with status  ,", req.body.status );
  
  try {
    const {
      name,
      category,
      default_currency,
      brief_text,
      include_auction,
      include_questionnaire,
      include_rfq,
      auction_settings,
      questionnaires,
      documents,
      lots,
      participants,
      auto_accept,
      status,
    } = req.body;

    // 1. Create the main auction document first
    const currentYear = new Date().getFullYear();
    const uniqueThreeDigitNumber = Math.floor(Math.random() * 900) + 100;
    const auctionId = `AUC-${currentYear}-CC-${uniqueThreeDigitNumber}`;

    const auction = new Auction({
      title: name,
      auctionId,
      category,
      brief_text,
      default_currency: default_currency || "GBP",
      include_auction: include_auction || false,
      include_questionnaire: include_questionnaire || false,
      include_rfq: include_rfq || false,
      status,
      auto_accept: auto_accept || false,
      createdBy: req.user.userId,
    });

    const savedAuction = await auction.save();

    // 2. Create AuctionSettings if auction is included
    let auctionSettingsId = null;
    if (include_auction && auction_settings) {
      const auctionSettingsDoc = new AuctionSettings({
        event_id: savedAuction._id, // Reference the auction instead of event
        ...auction_settings
      });
      const savedSettings = await auctionSettingsDoc.save();
      auctionSettingsId = savedSettings._id;
    }

    // 3. Create Questionnaires if included
    const questionnaireIds = [];
    if (include_questionnaire && questionnaires?.length > 0) {
      for (const questionnaire of questionnaires) {
        const questionnaireDoc = new Questionnaire({
          event_id: savedAuction._id,
          ...questionnaire
        });
        const savedQuestionnaire = await questionnaireDoc.save();
        questionnaireIds.push(savedQuestionnaire._id);
      }
    }

    // 4. Create EventDocuments if provided
    const documentIds = [];
    if (documents?.length > 0) {
      for (const document of documents) {
        const documentDoc = new EventDocument({
          event_id: savedAuction._id,
          ...document
        });
        const savedDocument = await documentDoc.save();
        documentIds.push(savedDocument._id);
      }
    }

    // 5. Create EventLots if RFQ is included
    const lotIds = [];
    if (include_rfq && lots?.length > 0) {
      for (const lot of lots) {
        const lotDoc = new EventLot({
          event_id: savedAuction._id,
          ...lot
        });
        const savedLot = await lotDoc.save();
        lotIds.push(savedLot._id);
      }
    }

    // 6. Create EventParticipants
    const participantIds = [];
    if (participants?.length > 0) {
      for (const participant of participants) {
        const participantDoc = new EventParticipant({
          event_id: savedAuction._id,
          ...participant
        });
        const savedParticipant = await participantDoc.save();
        participantIds.push(savedParticipant._id);
      }
    }

    // 7. Update auction with all the references
    savedAuction.auction_settings = auctionSettingsId;
    savedAuction.questionnaires = questionnaireIds;
    savedAuction.event_documents = documentIds;
    savedAuction.event_lots = lotIds;
    savedAuction.participants = participantIds;
    
    // Legacy compatibility - also populate invitedSupplierEmail
    savedAuction.invitedSupplierEmail = participants?.map(p => p.participant.email) || [];

    await savedAuction.save();

    // 8. Handle participants - send invitations
    if (participants && participants.length > 0) {
      try {
        const emails = participants.map(p => p.participant?.email).filter(email => email);
        const normalizedEmails = [...new Set(emails)]; // Remove duplicates
        console.log("normalized emails: ////////////// ", normalizedEmails);

        if (normalizedEmails.length > 0) {
          // Check existing users
          const existingUsers = await User.find({
            email: { $in: normalizedEmails }
          });
          const existingEmails = existingUsers.map(user => user.email);
          const newEmails = normalizedEmails.filter(email => !existingEmails.includes(email));

          console.log("Existing Users:", existingEmails);
          console.log("New Users to Invite:", newEmails);

          // Fetch documents to attach to email
          const eventDocuments = documentIds.length > 0
            ? await EventDocument.find({ _id: { $in: documentIds } })
            : [];

          // Prepare auction details for email
          const auctionDetailsHtml = `
            <table style="width:100%; border-collapse:collapse; margin:18px 0 24px 0; font-size:15px;">
              <tr style="background:#f0f4f8;"><th colspan="2" style="padding:10px 0; font-size:16px; color:#1AAB74; text-align:left; border-radius:6px 6px 0 0;">Event Details</th></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Name</td><td style="padding:8px 12px; color:#222;">${name || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Category</td><td style="padding:8px 12px; color:#222;">${category || '-'}</td></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Description</td><td style="padding:8px 12px; color:#222;">${brief_text || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Currency</td><td style="padding:8px 12px; color:#222;">${default_currency || '-'}</td></tr>
              ${auction_settings?.start_date ? `<tr><td style="padding:8px 12px; color:#555; font-weight:500;">Start Time</td><td style="padding:8px 12px; color:#222;">${new Date(auction_settings.start_date).toLocaleString()}</td></tr>` : ''}
              ${auction_settings?.start_date && auction_settings?.minimum_duration ? `<tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">End Time</td><td style="padding:8px 12px; color:#222;">${new Date(new Date(auction_settings.start_date).getTime() + auction_settings.minimum_duration * 60000).toLocaleString()}</td></tr>` : ''}
            </table>
          `;

          // Send invitations
          for (const email of normalizedEmails) {
            try {
              // Check if invitation already exists for this email
              let invitation = await Invitation.findOne({
                email,
                used: false,
                response: { $in: ["pending", "yes"] }
              });
              console.log("Found existing invitation:", invitation);

              if (!invitation) {
                // Create new invitation only if one doesn't exist
                const token = crypto.randomBytes(32).toString("hex");
                invitation = new Invitation({
                  email,
                  token,
                  invitedBy: req.user.userId,
                });
                await invitation.save();
                console.log("Created new invitation for:", email);
              } else {
                console.log("Using existing invitation for:", email);
              }

              // Send invitation email with documents
              await sendAuctionConfirmationEmail(email, savedAuction.title, null, "", invitation.token, savedAuction._id, auctionDetailsHtml, eventDocuments);
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

    // 9. Fetch the complete auction with populated references
    const completeAuction = await Auction.findById(savedAuction._id)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: "Event created successfully",
      auction: completeAuction
    });

  } catch (error) {
    console.error("Error creating event:", error);
    
    // Basic cleanup: If there was an error, log it
    // Note: In production with replica sets, you'd use transactions instead
    res.status(500).json({ 
      message: "Error creating event", 
      error: error.message 
    });
  }
};

// Get auction with all populated references
export const getAuctionByIdNormalized = async (req, res) => {
  try {
    // console.log(" reqqqqqqqq" , req);
    
    const auctionId = req.params.id;
    
    const auction = await Auction.findById(auctionId)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants')
      .populate('createdBy', 'name email')
      .populate('lots'); // Legacy support

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.json(auction);
  } catch (error) {
    console.error("Error fetching auction:", error);
    res.status(500).json({ 
      message: "Error fetching auction", 
      error: error.message 
    });
  }
};

// Update Complete Event/Auction with Normalized Structure
export const updateCompleteEventNormalized = async (req, res) => {
  console.log("Updating auction with normalized structure with status:", req.body.status);

  try {
    const { id } = req.params;
    const {
      name,
      category,
      default_currency,
      brief_text,
      include_auction,
      include_questionnaire,
      include_rfq,
      auction_settings,
      questionnaires,
      documents,
      lots,
      participants,
      auto_accept,
      status,
    } = req.body;

    // 1. Find the existing auction
    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // 2. Update basic auction fields
    auction.title = name || auction.title;
    auction.category = category || auction.category;
    auction.brief_text = brief_text || auction.brief_text;
    auction.default_currency = default_currency || auction.default_currency;
    auction.include_auction = include_auction !== undefined ? include_auction : auction.include_auction;
    auction.include_questionnaire = include_questionnaire !== undefined ? include_questionnaire : auction.include_questionnaire;
    auction.include_rfq = include_rfq !== undefined ? include_rfq : auction.include_rfq;
    auction.status = status || auction.status;
    auction.auto_accept = auto_accept !== undefined ? auto_accept : auction.auto_accept;

    await auction.save();

    // 3. Update or create AuctionSettings if auction is included
    if (include_auction && auction_settings) {
      if (auction.auction_settings) {
        // Update existing settings
        await AuctionSettings.findByIdAndUpdate(
          auction.auction_settings,
          auction_settings,
          { new: true }
        );
      } else {
        // Create new settings
        const auctionSettingsDoc = new AuctionSettings({
          event_id: auction._id,
          ...auction_settings
        });
        const savedSettings = await auctionSettingsDoc.save();
        auction.auction_settings = savedSettings._id;
      }
    }

    // 4. Update Questionnaires
    if (include_questionnaire && questionnaires?.length > 0) {
      // Remove old questionnaires
      if (auction.questionnaires?.length > 0) {
        await Questionnaire.deleteMany({ _id: { $in: auction.questionnaires } });
      }

      // Create new questionnaires
      const questionnaireIds = [];
      for (const questionnaire of questionnaires) {
        const questionnaireDoc = new Questionnaire({
          event_id: auction._id,
          ...questionnaire
        });
        const savedQuestionnaire = await questionnaireDoc.save();
        questionnaireIds.push(savedQuestionnaire._id);
      }
      auction.questionnaires = questionnaireIds;
    }

    // 5. Update EventDocuments
    if (documents?.length > 0) {
      // Remove old documents
      if (auction.event_documents?.length > 0) {
        await EventDocument.deleteMany({ _id: { $in: auction.event_documents } });
      }

      // Create new documents
      const documentIds = [];
      for (const document of documents) {
        const documentDoc = new EventDocument({
          event_id: auction._id,
          ...document
        });
        const savedDocument = await documentDoc.save();
        documentIds.push(savedDocument._id);
      }
      auction.event_documents = documentIds;
    }

    // 6. Update EventLots
    if (include_rfq && lots?.length > 0) {
      // Remove old lots
      if (auction.event_lots?.length > 0) {
        await EventLot.deleteMany({ _id: { $in: auction.event_lots } });
      }

      // Create new lots
      const lotIds = [];
      for (const lot of lots) {
        const lotDoc = new EventLot({
          event_id: auction._id,
          ...lot
        });
        const savedLot = await lotDoc.save();
        lotIds.push(savedLot._id);
      }
      auction.event_lots = lotIds;
    }

    // 7. Update EventParticipants
    console.log("participants  ", participants);

    // Get old participants BEFORE deleting them to compare
    const oldAuction = await Auction.findById(auction._id).populate('participants');
    const oldEmails = oldAuction?.participants?.map(p => p.participant?.email).filter(email => email) || [];
    console.log("old Auction//////// ", oldAuction);
    console.log("old participants//////// ", oldAuction?.participants);
    console.log("old emails//////// ", oldEmails);

    if (participants?.length > 0) {
      // Remove old participants
      if (auction.participants?.length > 0) {
        await EventParticipant.deleteMany({ _id: { $in: auction.participants } });
      }

      // Create new participants
      const participantIds = [];
      for (const participant of participants) {
        const participantDoc = new EventParticipant({
          event_id: auction._id,
          ...participant
        });
        const savedParticipant = await participantDoc.save();
        participantIds.push(savedParticipant._id);
      }

      auction.participants = participantIds;

      // Update legacy invitedSupplierEmail field
      auction.invitedSupplierEmail = participants.map(p => p.participant.email) || [];
    }
   
    await auction.save();

    // 8. Handle participant invitations - only send to new participants
    if (participants && participants.length > 0) {
      try {
        const newEmails = participants.map(p => p.participant?.email).filter(email => email);
        const normalizedNewEmails = [...new Set(newEmails)];

        // Filter to get only emails that weren't in the old participants list
        const newParticipantEmails = normalizedNewEmails.filter(email => !oldEmails.includes(email));

        if (newParticipantEmails.length > 0) {
          console.log("New participants to invite:", newParticipantEmails);

          // Fetch documents to attach to email
          const eventDocuments = auction.event_documents?.length > 0
            ? await EventDocument.find({ _id: { $in: auction.event_documents } })
            : [];

          const auctionDetailsHtml = `
            <table style="width:100%; border-collapse:collapse; margin:18px 0 24px 0; font-size:15px;">
              <tr style="background:#f0f4f8;"><th colspan="2" style="padding:10px 0; font-size:16px; color:#1AAB74; text-align:left; border-radius:6px 6px 0 0;">Event Details</th></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Name</td><td style="padding:8px 12px; color:#222;">${name || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Category</td><td style="padding:8px 12px; color:#222;">${category || '-'}</td></tr>
              <tr><td style="padding:8px 12px; color:#555; font-weight:500;">Description</td><td style="padding:8px 12px; color:#222;">${brief_text || '-'}</td></tr>
              <tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">Currency</td><td style="padding:8px 12px; color:#222;">${default_currency || '-'}</td></tr>
              ${auction_settings?.start_date ? `<tr><td style="padding:8px 12px; color:#555; font-weight:500;">Start Time</td><td style="padding:8px 12px; color:#222;">${new Date(auction_settings.start_date).toLocaleString()}</td></tr>` : ''}
              ${auction_settings?.start_date && auction_settings?.minimum_duration ? `<tr style="background:#fafbfc;"><td style="padding:8px 12px; color:#555; font-weight:500;">End Time</td><td style="padding:8px 12px; color:#222;">${new Date(new Date(auction_settings.start_date).getTime() + auction_settings.minimum_duration * 60000).toLocaleString()}</td></tr>` : ''}
            </table>
          `;

          // Only send emails to new participants
          for (const email of newParticipantEmails) {
            try {
              let invitation = await Invitation.findOne({
                email,
                used: false,
                response: { $in: ["pending", "yes"] }
              });

              if (!invitation) {
                const token = crypto.randomBytes(32).toString("hex");
                invitation = new Invitation({
                  email,
                  token,
                  invitedBy: req.user.userId,
                });
                await invitation.save();
                console.log("Created new invitation for:", email);
              } else {
                console.log("Using existing invitation for:", email);
              }

              // Send invitation email with documents
              await sendAuctionConfirmationEmail(email, auction.title, null, "", invitation.token, auction._id, auctionDetailsHtml, eventDocuments);
              console.log("Invitation email sent to:", email);
            } catch (emailError) {
              console.error(`Failed to send invitation to ${email}:`, emailError);
            }
          }
        } else {
          console.log("No new participants to invite");
        }
      } catch (participantError) {
        console.error('Failed to process participants:', participantError);
      }
    }

    // 9. Fetch the complete updated auction with populated references
    const completeAuction = await Auction.findById(auction._id)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants')
      .populate('createdBy', 'name email');

    res.status(200).json({
      message: "Event updated successfully",
      auction: completeAuction
    });

  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      message: "Error updating event",
      error: error.message
    });
  }
};

export default {
  createCompleteEventNormalized,
  updateCompleteEventNormalized,
  getAuctionByIdNormalized
};
