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

    // 8. Handle participants - send invitations (only if status is not draft)
    if (participants && participants.length > 0 && status !== "draft") {
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
              await sendAuctionConfirmationEmail(email, savedAuction.title, null, "", invitation.token, savedAuction._id, auctionDetailsHtml, eventDocuments, auction_settings);
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

    // Participants already contain questionnaire_answers from the EventParticipant model
    // No additional processing needed

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
      // Get old lots BEFORE updating them
      const oldLots = auction.event_lots?.length > 0
        ? await EventLot.find({ _id: { $in: auction.event_lots } })
        : [];

      const oldLotsMap = new Map();
      oldLots.forEach(lot => {
        // Use lot name as identifier since lots don't have stable external IDs
        oldLotsMap.set(lot.name, lot);
      });

      const lotIds = [];
      const currentLotNames = lots.map(l => l.name);

      // Find lots to remove (those not in the new list)
      const lotsToRemove = oldLots.filter(oldLot => !currentLotNames.includes(oldLot.name));
      if (lotsToRemove.length > 0) {
        const idsToRemove = lotsToRemove.map(l => l._id);
        await EventLot.deleteMany({ _id: { $in: idsToRemove } });
        console.log(`Removed ${idsToRemove.length} lots:`, lotsToRemove.map(l => l.name));
      }

      // Update existing lots or create new ones
      for (const lot of lots) {
        const existingLot = oldLotsMap.get(lot.name);

        if (existingLot) {
          // Update existing lot - preserve the ID
          existingLot.quantity = lot.quantity || existingLot.quantity;
          existingLot.unit_of_measure = lot.unit_of_measure || existingLot.unit_of_measure;
          existingLot.current_price = lot.current_price !== undefined ? lot.current_price : existingLot.current_price;
          existingLot.qualification_price = lot.qualification_price !== undefined ? lot.qualification_price : existingLot.qualification_price;
          existingLot.current_value = lot.current_value !== undefined ? lot.current_value : existingLot.current_value;
          existingLot.qualification_value = lot.qualification_value !== undefined ? lot.qualification_value : existingLot.qualification_value;

          await existingLot.save();
          lotIds.push(existingLot._id);
          console.log(`Updated existing lot: ${lot.name} (ID: ${existingLot._id})`);
        } else {
          // Create new lot
          const lotDoc = new EventLot({
            event_id: auction._id,
            ...lot
          });
          const savedLot = await lotDoc.save();
          lotIds.push(savedLot._id);
          console.log(`Created new lot: ${lot.name} (ID: ${savedLot._id})`);
        }
      }

      auction.event_lots = lotIds;
    }

    // 7. Update EventParticipants
    console.log("participants  ", participants);

    // Get old participants BEFORE updating them to compare
    const oldAuction = await Auction.findById(auction._id).populate('participants');
    const oldParticipantsMap = new Map();
    const oldEmails = [];

    if (oldAuction?.participants) {
      oldAuction.participants.forEach(p => {
        const email = p.participant?.email;
        if (email) {
          oldParticipantsMap.set(email, p);
          oldEmails.push(email);
        }
      });
    }

    console.log("old Auction//////// ", oldAuction);
    console.log("old participants//////// ", oldAuction?.participants);
    console.log("old emails//////// ", oldEmails);

    if (participants?.length > 0) {
      const participantIds = [];
      const currentEmails = participants.map(p => p.participant?.email).filter(email => email);

      // Find participants to remove (those not in the new list)
      const emailsToRemove = oldEmails.filter(email => !currentEmails.includes(email));
      if (emailsToRemove.length > 0) {
        const idsToRemove = emailsToRemove.map(email => oldParticipantsMap.get(email)?._id).filter(id => id);
        if (idsToRemove.length > 0) {
          await EventParticipant.deleteMany({ _id: { $in: idsToRemove } });
          console.log(`Removed ${idsToRemove.length} participants:`, emailsToRemove);
        }
      }

      // Update existing participants or create new ones
      for (const participant of participants) {
        const email = participant.participant?.email;
        if (!email) continue;

        const existingParticipant = oldParticipantsMap.get(email);

        if (existingParticipant) {
          // Update existing participant - preserve their data
          existingParticipant.participant.name = participant.participant?.name || existingParticipant.participant.name;
          existingParticipant.participant.company = participant.participant?.company || existingParticipant.participant.company;
          existingParticipant.status = participant.status || existingParticipant.status;
          // Keep existing: auctionStatus, approved, questionnaires_completed, lots_entered, questionnaire_answers

          await existingParticipant.save();
          participantIds.push(existingParticipant._id);
          console.log(`Updated existing participant: ${email}`);
        } else {
          // Create new participant
          const participantDoc = new EventParticipant({
            event_id: auction._id,
            ...participant
          });
          const savedParticipant = await participantDoc.save();
          participantIds.push(savedParticipant._id);
          console.log(`Created new participant: ${email}`);
        }
      }

      auction.participants = participantIds;

      // Update legacy invitedSupplierEmail field
      auction.invitedSupplierEmail = participants.map(p => p.participant.email) || [];
    }
   
    await auction.save();

    // 8. Handle participant invitations - only send to new participants (only if status is not draft)
    if (participants && participants.length > 0 && status !== "draft") {
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

// Approve participant bid for auction access
export const approveParticipantBid = async (req, res) => {
  console.log("Approving participant bid for auction access");

  try {
    const { id: auctionId } = req.params;
    const { supplierEmail } = req.body;

    if (!supplierEmail) {
      return res.status(400).json({ message: "Supplier email is required" });
    }

    // 1. Find the auction
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // 2. Find the participant in EventParticipant collection
    const participant = await EventParticipant.findOne({
      event_id: auctionId,
      "participant.email": supplierEmail
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant not found in this auction"
      });
    }

    // 3. Check if participant has submitted bids (lots_entered should be true)
    // if (!participant.lots_entered) {
    //   return res.status(400).json({
    //     message: "Participant has not submitted any bids yet"
    //   });
    // }

    // 4. Check if already approved
    if (participant.approved) {
      return res.status(400).json({
        message: "Participant is already approved"
      });
    }

    // 5. Update the participant's approved status
    participant.approved = true;
    await participant.save();

    // 6. Send approval email notification
    const { sendBidApprovalEmail } = await import("../utils/mailer.js");

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const auctionLink = `${frontendUrl}/supplier/event/${auctionId}`;

    try {
      await sendBidApprovalEmail(
        supplierEmail,
        auction.title || "Auction",
        auctionLink,
        participant.participant.name || "Supplier"
      );
      console.log(`Approval email sent to ${supplierEmail}`);
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
      // Don't fail the request if email fails, just log it
    }

    // 7. Return updated participant
    res.status(200).json({
      message: "Participant approved successfully",
      participant: {
        email: participant.participant.email,
        name: participant.participant.name,
        company: participant.participant.company,
        approved: participant.approved,
        lots_entered: participant.lots_entered,
        questionnaires_completed: participant.questionnaires_completed
      }
    });

  } catch (error) {
    console.error("Error approving participant:", error);
    res.status(500).json({
      message: "Error approving participant",
      error: error.message
    });
  }
};

// Submit questionnaire/terms acceptance
export const submitQuestionnaire = async (req, res) => {
  console.log("Submitting questionnaire/terms acceptance");

  try {
    const { id: auctionId } = req.params;
    const { supplierEmail, answers, cartons } = req.body;

    if (!supplierEmail) {
      return res.status(400).json({ message: "Supplier email is required" });
    }

    if (!answers) {
      return res.status(400).json({ message: "Answers are required" });
    }

    // 1. Find the auction
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // 2. Find the participant in EventParticipant collection
    const participant = await EventParticipant.findOne({
      event_id: auctionId,
      "participant.email": supplierEmail
    });

    if (!participant) {
      return res.status(404).json({
        message: "Participant not found in this auction"
      });
    }

    // 3. Save answers to participant's questionnaire_answers array
    // answers object structure: { [questionId]: value }
    const questionnaireAnswers = [];

    for (const [questionId, answer] of Object.entries(answers)) {
      try {
        // Find questionnaire by ID or order_index
        const questionnaire = await Questionnaire.findOne({
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(questionId) ? questionId : null },
            { order_index: parseInt(questionId) }
          ],
          event_id: auctionId
        });

        if (questionnaire) {
          questionnaireAnswers.push({
            questionnaire_id: questionnaire._id,
            question_text: questionnaire.question_text,
            question_type: questionnaire.question_type,
            order_index: questionnaire.order_index,
            answer: answer
          });
          console.log(`Prepared answer for questionnaire ${questionId}:`, answer);
        } else {
          console.warn(`Questionnaire not found for ID/index: ${questionId}`);
        }
      } catch (saveError) {
        console.error(`Error processing answer for questionnaire ${questionId}:`, saveError);
        // Continue with other answers even if one fails
      }
    }

    // 4. Update the participant with answers, cartons, and questionnaires_completed status
    participant.questionnaire_answers = questionnaireAnswers;
    participant.questionnaires_completed = true;

    // Save cartons if provided
    if (cartons !== undefined && cartons !== null) {
      participant.cartons = parseInt(cartons) || 0;
    }

    await participant.save();

    console.log(`Updated questionnaires_completed to true, saved ${questionnaireAnswers.length} answers, and cartons: ${participant.cartons} for participant: ${supplierEmail}`);

    // 5. Return updated participant
    res.status(200).json({
      message: "Questionnaire submitted successfully",
      participant: {
        email: participant.participant.email,
        name: participant.participant.name,
        company: participant.participant.company,
        approved: participant.approved,
        lots_entered: participant.lots_entered,
        questionnaires_completed: participant.questionnaires_completed,
        questionnaire_answers: participant.questionnaire_answers
      }
    });

  } catch (error) {
    console.error("Error submitting questionnaire:", error);
    res.status(500).json({
      message: "Error submitting questionnaire",
      error: error.message
    });
  }
};

export default {
  createCompleteEventNormalized,
  updateCompleteEventNormalized,
  getAuctionByIdNormalized,
  approveParticipantBid,
  submitQuestionnaire
};
