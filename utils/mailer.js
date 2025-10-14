import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTP = async (to, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your OTP Code",
    text: `Your OTP code is: ${otp}`,
  });
};

// export const inviteAuction = async (to, auction) => {
//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to,
//     subject: "Auction Invite",
//     text: `Your are invited to an auction ${auction?.title}`,
//   });
// };
export const inviteAuction = async (to, auction, previewEmail) => {
  const loginUrl = `https://epauction.vercel.app/supplier/check-email`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Auction Invite",
    text: previewEmail
      ? `${previewEmail}\n\nLogin here: ${loginUrl}`
      : `You are invited to an auction: ${auction?.title}\nPlease log in to participate: ${loginUrl}`,
    html: previewEmail
      ? `<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">${previewEmail}<br><br><a href=\"${loginUrl}\">${loginUrl}</a></div>`
      : `<p>You are invited to an auction: <strong>${auction?.title}</strong></p><p>Please <a href=\"${loginUrl}\">click here</a> to log in and join the auction.</p>`,
  });
};

export const sendRegistrationInvite = async (email, previewEmail) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "You're Invited to an Auction",
    html: previewEmail
      ? `<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">${previewEmail}</div>`
      : `You’ve been invited to participate in an auction. Register here: <a href=https://epauction.vercel.app/supplier/check-email>Register</a>`,
  });
};

export const sendInvitationEmail = async (to, registrationLink, auctionTitle = "an auction", customHtmlBody) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `You've been invited to participate in ${auctionTitle}`,
    html: customHtmlBody || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Auction Invitation</h2>
        <p>You have been invited to participate in <strong>${auctionTitle}</strong>.</p>
        <p>To register and participate in this auction, please click the link below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${registrationLink}" 
             style="background-color: #1AAB74; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Register & Join Auction
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, you can copy and paste this link into your browser:<br>
          <a href="${registrationLink}">${registrationLink}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This invitation link is unique to you and will expire once used.
        </p>
      </div>
    `,
  });
};

export const sendAuctionConfirmationEmail = async (to, auctionTitle, confirmationLink, previewEmail, token, auctionId, auctionDetailsHtml, documents = []) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: `Confirm Participation in ${auctionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Auction Participation Confirmation</h2>
        <p>You are invited to participate in <strong>${auctionTitle}</strong>.</p>
        ${previewEmail ? `<div style='background: #f5f5f5; border-radius: 6px; padding: 16px 18px; margin: 18px 0; color: #444;'>${previewEmail}</div>` : ''}
        ${auctionDetailsHtml || ''}
        ${documents && documents.length > 0 ? `
        <div style="background: #f8f9fa; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Attached Documents</h3>
          <ul style="color: #555; margin: 10px 0; padding-left: 20px;">
            ${documents.map(doc => `<li>${doc.name} (${(doc.file_size / 1024).toFixed(2)} KB)</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        <p>To confirm your participation, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.BACKEND_URL || 'http://localhost:5001'}/api/invitation/respond?token=${encodeURIComponent(token)}&response=yes&auctionId=${encodeURIComponent(auctionId)}" style="background-color: #1AAB74; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; text-decoration: none; display: inline-block;">Yes, I want to participate</a>
        </div>
      </div>
    `,
  };

  // Add attachments if documents are provided
  if (documents && documents.length > 0) {
    mailOptions.attachments = documents.map(doc => {
      // Extract filename from URL path and construct absolute file system path
      let filePath = doc.file_path;
      if (filePath && filePath.includes('/uploads/documents/')) {
        const filename = filePath.split('/uploads/documents/').pop();
        // Construct absolute path from project root
        filePath = path.join(__dirname, '..', 'uploads', 'documents', filename);
      }
      return {
        filename: doc.name,
        path: filePath,
        contentType: doc.mime_type
      };
    }).filter(attachment => attachment.path); // Only include documents with valid file paths
  }

  await transporter.sendMail(mailOptions);
};

export const sendAuctionLinkEmail = async (to, auctionTitle, auctionLink, customHtmlBody) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Auction Link for ${auctionTitle}`,
    html: customHtmlBody || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Auction Link</h2>
        <p>Thank you for confirming your participation in <strong>${auctionTitle}</strong>.</p>
        <p>Click the link below to access the auction:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${auctionLink}"
             style="background-color: #1AAB74; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Go to Auction
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, you can copy and paste this link into your browser:<br>
          <a href="${auctionLink}">${auctionLink}</a>
        </p>
      </div>
    `,
  });
};

export const sendThankYouEmail = async (to) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Thank You for Accepting Our Invitation",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1AAB74;">Thank You!</h2>
        <p>Thank you for accepting our invitation to join our supplier network.</p>
        <p>We have successfully updated your response and you are now part of our supplier community.</p>
        <p>You will receive notifications about upcoming auction opportunities that match your profile.</p>
        <div style="background: #f9f9f9; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #333;">What's Next?</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Keep an eye on your email for auction invitations</li>
            <li>Make sure to respond promptly to auction opportunities</li>
            <li>Update your profile information as needed</li>
          </ul>
        </div>
        <p style="color: #666; font-size: 14px;">
          We look forward to working with you!
        </p>
      </div>
    `,
  });
};

export const sendAwardNoticeEmail = async (to, lotName, emailText, purchaseOrderNumber, ccEmail, senderName) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: `Congratulations! You have been awarded: ${lotName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1AAB74; margin: 0;">🎉 Award Notice</h1>
          <p style="color: #666; font-size: 18px; margin: 10px 0;">Congratulations on your successful bid!</p>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Lot Details</h3>
          <p><strong>Lot Name:</strong> ${lotName}</p>
          
          <p><strong>Awarded by:</strong> ${senderName}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div style="background: #fff; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Message</h3>
          <div style="white-space: pre-line; color: #555; line-height: 1.6;">
            ${emailText}
          </div>
        </div>

        <div style="background: #e8f5e8; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <h4 style="color: #1AAB74; margin-top: 0;">Next Steps</h4>
          <ul style="color: #333; margin: 10px 0; padding-left: 20px;">
            <li>Review the lot details and requirements</li>
            <li>Prepare for contract finalization</li>
            <li>Contact the buyer if you have any questions</li>
          </ul>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p>This is an automated message. Please do not reply directly to this email.</p>
          <p>Thank you for participating in our auction!</p>
        </div>
      </div>
    `,
  };

  // Add CC if provided
  if (ccEmail) {
    mailOptions.cc = ccEmail;
  }

  await transporter.sendMail(mailOptions);
};