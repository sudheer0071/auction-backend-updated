import Invitation from "../models/invitation.js";
import User from "../models/user.js";
import crypto from "crypto";
import { sendInvitationEmail, sendAuctionLinkEmail, sendThankYouEmail } from "../utils/mailer.js"; // You need to implement this utility
import Auction from "../models/auction.js";
import EventParticipant from "../models/eventParticipant.js";

export const getAllInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({ invitedBy: req.user.userId })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(invitations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invitations", error: err.message });
  }
};

export const inviteSupplier = async (req, res) => {
  try {
    const { email, name, companyName } = req.body;

    // Validate required fields
    if (!email || !name || !companyName) {
      return res.status(400).json({ 
        message: "Email, name, and company name are required." 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email, role: "supplier" });
    // Check if invitation already exists
    const existingInvitation = await Invitation.findOne({ 
      email: email, 
      invitedBy: req.user.userId 
    });

    if (existingUser && existingInvitation) {
      // Both user and invitation exist
      console.log("existingUser ", existingUser);
      console.log("existingInvitation ", existingInvitation);

       if (existingInvitation.response === "yes"){
         return res.status(400).json({ 
          message: "You have already sent an invitation to this email address." 
        });
       }
      return res.status(200).json({ message: "Supplier added" });
    } 
    // Case: when supplier must be signedIn/signedUp by their own, without any invitations
    else if (existingUser && !existingInvitation) {
      // User exists but invitation does not, create invitation with response yes
      console.log("user exitss but invitation doesn't ");
      
      const token = crypto.randomBytes(32).toString("hex");
      const invitation = new Invitation({
        email,
        name,
        companyName,
        token,
        invitedBy: req.user.userId,
        response: "yes"
      });
      await invitation.save();
      return res.status(201).json({ message: "Supplier added", invitation });
    } 
    // Case: Supplier haven't registered on platform but already got invited
    else if (!existingUser && existingInvitation) {
      // User does not exist but invitation exists, just return the invitation (default behavior)
      console.log("user does not exist but invitation exists");

      if (existingInvitation.response === "yes") {
        return res.status(200).json({ message: "Supplier added" });
      } else {
        return res.status(400).json({ 
          message: "You have already sent an invitation to this email address." 
        });
      }
    }
    // If neither user nor invitation exists, create new invitation (default)

    // Generate unique token
    console.log("creating new invitation............");
    
    const token = crypto.randomBytes(32).toString("hex");

    // Create invitation
    const invitation = new Invitation({
      email,
      name,
      companyName,
      token,
      invitedBy: req.user.userId,
    });
    await invitation.save();

    // Send invitation email (implement sendInvitationEmail)
    const registrationLink = `${process.env.FRONTEND_URL}/supplier/auth?token=${token}$${email}$${name}$${companyName}`;
    console.log("sending email .... .");
    
    await sendInvitationEmail(email, registrationLink);
    console.log("email sent ...... .");

    res.status(201).json({
      _id: invitation._id,
      email: invitation.email,
      name: invitation.name,
      companyName: invitation.companyName,
      token: invitation.token,
      invitedBy: invitation.invitedBy,
      used: invitation.used,
      response: invitation.response,
      createdAt: invitation.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to send invitation", error: err.message });
  }
};

export const respondToInvitation = async (req, res) => {
  try {
    const method = req.method;
    let token, response, auctionId, source;
    if (method === 'POST') {
      token = req.body.token;
      response = req.body.response;
      auctionId = req.body.auctionId;
      source = req.body.source;
    } else {
      token = req.query.token;
      response = req.query.response;
      auctionId = req.query.auctionId;
      source = req.query.source;
    }
    console.log("req.body ", req.body);
    console.log("token , auctionId ", token, auctionId);
    console.log("source of request: ", source); // Log the source to identify email-based requests

    if (!token || !response) {
      return res.status(400).send("Missing required parameters.");
    }
    const invitation = await Invitation.findOne({ token });
    if (!invitation) {
      return res.status(404).send("Invalid or expired invitation token.");
    }
    console.log("invitation....... ", invitation);

    if (invitation.response === "yes" && !auctionId) {
      return res.status(400).send("You have already responded to this invitation.");
    }

    // Check if auction has already started when source is auction-invitation
    if (source === "auction-invitation" && auctionId) {
      const auction = await Auction.findById(auctionId).populate('auction_settings');
      if (!auction) {
        return res.status(404).send("Auction not found.");
      }

      // Combine start_date and start_time to get accurate start datetime
      let hasStarted = false;
      if (auction.auction_settings?.start_date && auction.auction_settings?.start_time) {
        const startDate = auction.auction_settings.start_date;
        const startTime = auction.auction_settings.start_time;

        // Extract date part (YYYY-MM-DD format)
        const datePart = typeof startDate === 'string' && startDate.includes('T')
          ? startDate.split('T')[0]
          : new Date(startDate).toISOString().split('T')[0];

        // Combine date and time to create full datetime (assuming GMT/UTC)
        const auctionStartDateTime = new Date(`${datePart}T${startTime}:00Z`);
        const currentTime = new Date();

        hasStarted = currentTime >= auctionStartDateTime;
      } else {
        // Fallback to old logic if start_time is not available
        const startTime = auction.auction_settings?.start_date || auction.startTime;
        hasStarted = startTime && new Date(startTime).getTime() <= Date.now();
      }

      if (hasStarted) {
        return res.send(`
          <html>
            <head>
              <title>Auction Already Started</title>
              <style>
                body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; }
                .container { max-width: 500px; margin: 80px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 40px 30px; text-align: center; }
                h2 { color: #dc3545; }
                p { font-size: 18px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Auction Already Started</h2>
                <p>This auction has already started. No invites will be accepted now.</p>
              </div>
            </body>
          </html>
        `);
      }
    }

    console.log("responding to invitation");
    console.log("token  and response ", token, response);

    if(source !== "auction-invitation"){
      invitation.response = response;
    }
    await invitation.save();

    // Update EventParticipant auctionStatus if auctionId is provided
    if (auctionId) {
      try {
        const participant = await EventParticipant.findOne({
          event_id: auctionId,
          "participant.email": invitation.email
        });

        if (participant) {
          // Check if auction status is already accepted
          if (participant.auctionStatus === "accepted") {
            console.log(`Participant ${invitation.email} has already accepted the auction ${auctionId}. Skipping update.`);
             return res.send(`
          <html>
            <head>
              <title>Already Responded</title>
              <style>
                body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; }
                .container { max-width: 500px; margin: 80px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 40px 30px; text-align: center; }
                h2 { color: #1AAB74; }
                p { font-size: 18px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Already Responded</h2>
                <p>You already responded to this Invitation.</p>
              </div>
            </body>
          </html>
        `);
          } else {
            participant.auctionStatus = response === "yes" ? "accepted" : "rejected";
            await participant.save();
            console.log(`Updated auctionStatus to ${participant.auctionStatus} for participant ${invitation.email} in auction ${auctionId}`);
          }
        } else {
          console.log(`Participant not found for email ${invitation.email} in auction ${auctionId}`);
        }
      } catch (participantError) {
        console.error("Error updating participant auction status:", participantError);
        // Don't fail the entire request, just log the error
      }
    }

    if (response === "yes") {
      // Check if this is a native invite (no auction ID)
      if (!auctionId) {
        // Native invite - just send thank you email
        await sendThankYouEmail(invitation.email);
        return res.send(`
          <html>
            <head>
              <title>Invitation Accepted</title>
              <style>
                body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; }
                .container { max-width: 500px; margin: 80px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 40px 30px; text-align: center; }
                h2 { color: #1AAB74; }
                p { font-size: 18px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Thank You!</h2>
                <p>Thank you for accepting our invitation to join our supplier network. You will receive further communications via email.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        // Auction-specific invite - send auction link email
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          return res.status(404).send("Auction not found.");
        }

        const auctionLink = `${process.env.FRONTEND_URL}/supplier/event/${auction.id}`;
        console.log(" sending auction link to , ", invitation.email)

        await sendAuctionLinkEmail(invitation.email, auction.title, auctionLink);
        return res.send(`
          <html>
            <head>
              <title>Invitation Accepted</title>
              <style>
                body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; }
                .container { max-width: 500px; margin: 80px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 40px 30px; text-align: center; }
                h2 { color: #1AAB74; }
                p { font-size: 18px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Invitation Accepted</h2>
                <p>You have accepted the invite and will receive the auction mail shortly.</p>
              </div>
            </body>
          </html>
        `);
      }
    } else {
      return res.send(`
        <html>
          <head>
            <title>Invitation Declined</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f7f7f7; color: #222; }
              .container { max-width: 500px; margin: 80px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 40px 30px; text-align: center; }
              h2 { color: #dc3545; }
              p { font-size: 18px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Invitation Declined</h2>
              <p>Thank you for your response. We have recorded that you decline to participate in this auction.</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (err) {
    return res.status(500).send("Failed to process invitation response: " + err.message);
  }
};

export const deleteInvitation = async (req, res) => {
  try {
    // Accept id from params, body or query for flexibility
    const id = req.params.id || req.body.id || req.query.id;
    if (!id) {
      return res.status(400).json({ message: "Invitation id is required." });
    }

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    // Only the user who created the invitation or an admin may delete it
    const isOwner = invitation.invitedBy && invitation.invitedBy.toString() === req.user.userId;
    const isAdmin = req.user && req.user.role && req.user.role.toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this invitation." });
    }

    // Prevent deleting invitations that were already accepted/used
    // if (invitation.used || invitation.response === 'yes') {
    //   return res.status(400).json({ message: "Cannot delete an invitation that has already been accepted or used." });
    // }

    await Invitation.findByIdAndDelete(id);

    return res.status(200).json({ message: "Invitation deleted.", id });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete invitation", error: err.message });
  }
};