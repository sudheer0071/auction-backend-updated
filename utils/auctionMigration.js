/**
 * Migration Utility: Auction Model Normalization
 * 
 * This utility helps migrate from embedded documents to normalized structure
 * Run this after deploying the new auction model structure
 */

import mongoose from "mongoose";
import Auction from "../models/auction.js";
import AuctionSettings from "../models/auctionSettings.js";
import Questionnaire from "../models/questionnaire.js";
import EventDocument from "../models/eventDocument.js";
import EventLot from "../models/eventLot.js";
import EventParticipant from "../models/eventParticipant.js";

/**
 * Migrate embedded auction settings to separate AuctionSettings documents
 */
async function migrateAuctionSettings() {
  console.log("🔄 Migrating auction settings...");
  
  const auctions = await Auction.find({
    "auction_settings.start_date": { $exists: true }
  });
  
  for (const auction of auctions) {
    if (auction.auction_settings && typeof auction.auction_settings === 'object' && !mongoose.Types.ObjectId.isValid(auction.auction_settings)) {
      // Create new AuctionSettings document
      const auctionSettings = new AuctionSettings({
        event_id: auction.event_id,
        ...auction.auction_settings
      });
      
      const savedSettings = await auctionSettings.save();
      
      // Update auction to reference the new document
      await Auction.updateOne(
        { _id: auction._id },
        { auction_settings: savedSettings._id }
      );
      
      console.log(`✅ Migrated auction settings for auction: ${auction._id}`);
    }
  }
}

/**
 * Migrate embedded questionnaires to separate Questionnaire documents
 */
async function migrateQuestionnaires() {
  console.log("🔄 Migrating questionnaires...");
  
  const auctions = await Auction.find({
    "questionnaires.0": { $exists: true }
  });
  
  for (const auction of auctions) {
    if (Array.isArray(auction.questionnaires) && auction.questionnaires.length > 0) {
      const questionnaireIds = [];
      
      for (const questionnaire of auction.questionnaires) {
        if (!mongoose.Types.ObjectId.isValid(questionnaire._id)) {
          // Create new Questionnaire document
          const newQuestionnaire = new Questionnaire({
            event_id: auction.event_id,
            ...questionnaire
          });
          
          const savedQuestionnaire = await newQuestionnaire.save();
          questionnaireIds.push(savedQuestionnaire._id);
        } else {
          questionnaireIds.push(questionnaire._id);
        }
      }
      
      // Update auction to reference the new documents
      await Auction.updateOne(
        { _id: auction._id },
        { questionnaires: questionnaireIds }
      );
      
      console.log(`✅ Migrated questionnaires for auction: ${auction._id}`);
    }
  }
}

/**
 * Migrate embedded event documents to separate EventDocument documents
 */
async function migrateEventDocuments() {
  console.log("🔄 Migrating event documents...");
  
  const auctions = await Auction.find({
    "event_documents.0": { $exists: true }
  });
  
  for (const auction of auctions) {
    if (Array.isArray(auction.event_documents) && auction.event_documents.length > 0) {
      const documentIds = [];
      
      for (const document of auction.event_documents) {
        if (!mongoose.Types.ObjectId.isValid(document._id)) {
          // Create new EventDocument document
          const newDocument = new EventDocument({
            event_id: auction.event_id,
            ...document
          });
          
          const savedDocument = await newDocument.save();
          documentIds.push(savedDocument._id);
        } else {
          documentIds.push(document._id);
        }
      }
      
      // Update auction to reference the new documents
      await Auction.updateOne(
        { _id: auction._id },
        { event_documents: documentIds }
      );
      
      console.log(`✅ Migrated event documents for auction: ${auction._id}`);
    }
  }
}

/**
 * Migrate embedded event lots to separate EventLot documents
 */
async function migrateEventLots() {
  console.log("🔄 Migrating event lots...");
  
  const auctions = await Auction.find({
    "event_lots.0": { $exists: true }
  });
  
  for (const auction of auctions) {
    if (Array.isArray(auction.event_lots) && auction.event_lots.length > 0) {
      const lotIds = [];
      
      for (const lot of auction.event_lots) {
        if (!mongoose.Types.ObjectId.isValid(lot._id)) {
          // Create new EventLot document
          const newLot = new EventLot({
            event_id: auction.event_id,
            ...lot
          });
          
          const savedLot = await newLot.save();
          lotIds.push(savedLot._id);
        } else {
          lotIds.push(lot._id);
        }
      }
      
      // Update auction to reference the new documents
      await Auction.updateOne(
        { _id: auction._id },
        { event_lots: lotIds }
      );
      
      console.log(`✅ Migrated event lots for auction: ${auction._id}`);
    }
  }
}

/**
 * Migrate embedded participants to separate EventParticipant documents
 */
async function migrateParticipants() {
  console.log("🔄 Migrating participants...");
  
  const auctions = await Auction.find({
    "participants.0": { $exists: true }
  });
  
  for (const auction of auctions) {
    if (Array.isArray(auction.participants) && auction.participants.length > 0) {
      const participantIds = [];
      
      for (const participant of auction.participants) {
        if (!mongoose.Types.ObjectId.isValid(participant._id)) {
          // Create new EventParticipant document
          const newParticipant = new EventParticipant({
            event_id: auction.event_id,
            ...participant
          });
          
          const savedParticipant = await newParticipant.save();
          participantIds.push(savedParticipant._id);
        } else {
          participantIds.push(participant._id);
        }
      }
      
      // Update auction to reference the new documents
      await Auction.updateOne(
        { _id: auction._id },
        { participants: participantIds }
      );
      
      console.log(`✅ Migrated participants for auction: ${auction._id}`);
    }
  }
}

/**
 * Main migration function
 */
export async function migrateAuctionToNormalizedStructure() {
  try {
    console.log("🚀 Starting auction model normalization migration...");
    
    await migrateAuctionSettings();
    await migrateQuestionnaires();
    await migrateEventDocuments();
    await migrateEventLots();
    await migrateParticipants();
    
    console.log("✅ Migration completed successfully!");
    console.log("📝 Remember to update your queries to use populate() for referenced documents");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback function - converts normalized structure back to embedded
 */
export async function rollbackAuctionNormalization() {
  try {
    console.log("🔄 Rolling back auction normalization...");
    
    const auctions = await Auction.find({})
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants');
    
    for (const auction of auctions) {
      const updateFields = {};
      
      // Convert references back to embedded documents
      if (auction.auction_settings && mongoose.Types.ObjectId.isValid(auction.auction_settings._id)) {
        updateFields.auction_settings = auction.auction_settings.toObject();
        delete updateFields.auction_settings._id;
        delete updateFields.auction_settings.event_id;
        delete updateFields.auction_settings.createdAt;
        delete updateFields.auction_settings.updatedAt;
      }
      
      if (auction.questionnaires && auction.questionnaires.length > 0) {
        updateFields.questionnaires = auction.questionnaires.map(q => {
          const obj = q.toObject();
          delete obj._id;
          delete obj.event_id;
          delete obj.createdAt;
          delete obj.updatedAt;
          return obj;
        });
      }
      
      if (auction.event_documents && auction.event_documents.length > 0) {
        updateFields.event_documents = auction.event_documents.map(d => {
          const obj = d.toObject();
          delete obj._id;
          delete obj.event_id;
          delete obj.createdAt;
          delete obj.updatedAt;
          return obj;
        });
      }
      
      if (auction.event_lots && auction.event_lots.length > 0) {
        updateFields.event_lots = auction.event_lots.map(l => {
          const obj = l.toObject();
          delete obj._id;
          delete obj.event_id;
          delete obj.createdAt;
          delete obj.updatedAt;
          return obj;
        });
      }
      
      if (auction.participants && auction.participants.length > 0) {
        updateFields.participants = auction.participants.map(p => {
          const obj = p.toObject();
          delete obj._id;
          delete obj.event_id;
          delete obj.createdAt;
          delete obj.updatedAt;
          return obj;
        });
      }
      
      await Auction.updateOne({ _id: auction._id }, updateFields);
      console.log(`✅ Rolled back auction: ${auction._id}`);
    }
    
    console.log("✅ Rollback completed successfully!");
    
  } catch (error) {
    console.error("❌ Rollback failed:", error);
    throw error;
  }
}

// Example usage:
// await migrateAuctionToNormalizedStructure();
// Or to rollback:
// await rollbackAuctionNormalization();
