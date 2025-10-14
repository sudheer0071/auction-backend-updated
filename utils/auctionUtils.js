import Auction from "../models/auction.js";
import User from "../models/user.js";

/**
 * Convert email addresses to user IDs in auction's invitedSuppliers
 * This function updates all auctions that have the given email in their invitedSuppliers
 * @param {string} email - The email address to convert
 * @param {string} userId - The user ID to replace the email with
 * @returns {Promise<number>} - Number of auctions updated
 */
export const convertEmailToUserIdInAuctions = async (email, userId) => {
  try {
    const result = await Auction.updateMany(
      { invitedSuppliers: email },
      { $set: { "invitedSuppliers.$": userId } }
    );
    
    console.log(`Updated ${result.modifiedCount} auctions for supplier: ${email}`);
    return result.modifiedCount;
  } catch (error) {
    console.error(`Error converting email to userId in auctions: ${error.message}`);
    throw error;
  }
};

/**
 * Get all auctions where a supplier is invited (by email or user ID)
 * @param {string} identifier - Email address or user ID
 * @returns {Promise<Array>} - Array of auctions
 */
export const getAuctionsForSupplier = async (identifier) => {
  try {
    // Check if identifier is an ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    
    let query;
    if (isObjectId) {
      query = { invitedSuppliers: identifier };
    } else {
      // Assume it's an email address
      query = { invitedSuppliers: identifier };
    }
    
    return await Auction.find(query).populate("lots createdBy");
  } catch (error) {
    console.error(`Error getting auctions for supplier: ${error.message}`);
    throw error;
  }
};

/**
 * Check if a supplier is invited to an auction (by email or user ID)
 * @param {string} auctionId - Auction ID
 * @param {string} identifier - Email address or user ID
 * @returns {Promise<boolean>} - True if invited, false otherwise
 */
export const isSupplierInvitedToAuction = async (auctionId, identifier) => {
  try {
    const auction = await Auction.findById(auctionId);
    if (!auction) return false;
    
    return auction.invitedSuppliers.some(supplier => {
      // Check if supplier is an ObjectId or email string
      if (typeof supplier === 'object' && supplier._id) {
        return supplier._id.toString() === identifier;
      } else if (typeof supplier === 'string') {
        return supplier === identifier;
      }
      return false;
    });
  } catch (error) {
    console.error(`Error checking if supplier is invited: ${error.message}`);
    throw error;
  }
}; 