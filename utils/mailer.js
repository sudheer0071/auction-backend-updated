import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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
  // Read signup email template
  const signupMailPath = path.join(__dirname, '..', 'signupmail.md');
  let emailContent = customHtmlBody;

  if (!customHtmlBody && fs.existsSync(signupMailPath)) {
    try {
      const templateContent = fs.readFileSync(signupMailPath, 'utf-8');

      // Convert markdown to HTML (basic conversion)
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
          <p><strong>Dear Supplier,</strong></p>

          <p>Greetings from <strong>EP Group</strong>.</p>

          <p>We hope this message finds you well. As part of our ongoing commitment to transparency, efficiency, and innovation in procurement, we are pleased to announce the launch of our <strong>E-Auction Platform</strong>, designed to streamline sourcing and supplier engagement across all our business verticals.</p>

          <p>Through this platform, we aim to create a dynamic and competitive environment that fosters collaboration, cost optimization, and long-term partnerships with our valued suppliers. As a trusted organization in your domain, we would like to invite you to participate in our upcoming e-auctions by registering yourself as a <strong>supplier</strong> on our platform.</p>

          <p>To complete your registration, please click on the link below and follow the simple steps outlined on the portal:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationLink}"
               style="background-color: #1AAB74; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
              Click here to access the EP E-Auction Platform
            </a>
          </div>

          <p>Once you open the link, kindly fill in the required details and submit the necessary documents to complete your supplier profile. Upon successful verification, your registration will be activated, and you will receive confirmation along with your login credentials.</p>

          <p><strong>By joining our platform, you will gain access to:</strong></p>
          <ul style="margin: 15px 0; padding-left: 25px;">
            <li>Real-time auction participation opportunities</li>
            <li>Transparent and competitive bidding processes</li>
            <li>Direct engagement with the EP Group procurement team</li>
            <li>Streamlined documentation and communication channels</li>
          </ul>

          <p>We highly encourage you to register at your earliest convenience to ensure eligibility for upcoming procurement events.</p>

          <p>For any assistance during registration or for further clarification, please feel free to contact our support team at <strong>support@epgroup.com</strong> or reach out to your designated procurement contact.</p>

          <p>We look forward to your participation and to building a mutually beneficial business relationship.</p>

          <p style="margin-top: 30px;">Warm regards,</p>

          <p style="margin-top: 5px;"><strong>Procurement & Supplier Relations Team</strong></p>
          <p style="margin-top: 5px;"><strong>EP Group</strong></p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

          <div style="text-align: center; color: #666; font-size: 13px;">
            <p style="margin: 5px 0;">📧 support@EPgroup.com | ☎ +44-20-XXXX-XXXX</p>
            <p style="margin: 5px 0; color: #999; font-size: 12px;">
              This invitation link is unique to you. Please do not share it with others.
            </p>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error reading signup mail template:', error);
      // Fallback to default template if file read fails
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Auction Invitation</h2>
          <p>You have been invited to register as a supplier on EP Group's E-Auction Platform.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationLink}"
               style="background-color: #1AAB74; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Register Now
            </a>
          </div>
        </div>
      `;
    }
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Invitation to Register as a Supplier on EP Group's E-Auction Platform",
    html: emailContent,
  });
};

export const sendAuctionConfirmationEmail = async (to, auctionTitle, confirmationLink, previewEmail, token, auctionId, auctionDetailsHtml, documents = [], auctionSettings = {}) => {
  // Format dates from auction settings (as stored in DB)
  // console.log("auction-setingggggggggggg ", auctionSettings);
  
  const formatDateTime = (date, time) => {
    if (!date) return null;
    const dateStr = new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    return time ? `${dateStr} at ${time} UTC` : dateStr;
  };

  const startDateTime = auctionSettings?.start_date
    ? formatDateTime(auctionSettings.start_date, auctionSettings.start_time)
    : '[Start Date and Time]';

  const endDateTime = auctionSettings?.end_date
    ? formatDateTime(auctionSettings.end_date, auctionSettings.end_time)
    : '[End Date and Time]';

  const bidDeadline = auctionSettings?.bid_deadline
    ? formatDateTime(auctionSettings.bid_deadline, auctionSettings.bid_deadline_time) + ' UTC'
    : '[Insert Deadline Date and Time]';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: `Invitation to Participate in Upcoming E-Auction Event – ${auctionTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
        <p><strong>Dear Valued Supplier,</strong></p>

        <p>We are pleased to inform you that the <strong>EP Group</strong> will be hosting an upcoming <strong>E-Auction Event</strong>, and we would like to extend a formal invitation for your participation. The event will be conducted through our e-auction platform, designed to ensure a transparent, fair, and efficient procurement process.</p>

        <p>The auction will be live from <strong>${startDateTime}</strong> to <strong>${endDateTime}</strong>, and we encourage all qualified suppliers to review the event details carefully before confirming participation. Please note that the <strong>deadline for submitting the Qualification Bid</strong> is <strong>${bidDeadline}</strong>. Submitting your qualification bid within this timeframe is mandatory in order to be eligible for participation in the live auction.</p>

       

        ${documents && documents.length > 0 ? `
        <p>For your convenience, we have attached the following documents to this email:</p>
        <div style="background: #f8f9fa; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <ul style="color: #555; margin: 10px 0; padding-left: 20px;">
            ${documents.map(doc => `<li><strong>${doc.name}</strong> ${doc.file_size ? `(${(doc.file_size / 1024).toFixed(2)} KB)` : ''}</li>`).join('')}
          </ul>
          <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
            <em>These documents outline the detailed scope, requirements, technical information, and terms and conditions associated with this event.</em>
          </p>
        </div>
        ` : ''}

        <p>We request you to review these documents thoroughly. If you wish to take part in this auction, please confirm your interest by clicking <strong>"Yes, I want to take part"</strong> below and proceed with the submission of your qualification bid as per the instructions provided on the platform. Should you decide not to participate in this particular event, please click <strong>"No, not this time."</strong></p>

        <div style="text-align: center; margin: 35px 0;">
          <a href="${process.env.BACKEND_URL || 'http://localhost:5001'}/api/invitation/respond?token=${encodeURIComponent(token)}&response=yes&auctionId=${encodeURIComponent(auctionId)}&source=auction-invitation"
             style="background-color: #1AAB74; color: white; padding: 14px 32px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; margin: 0 8px;">
            Yes, I want to take part
          </a>
          <a href="${process.env.BACKEND_URL || 'http://localhost:5001'}/api/invitation/respond?token=${encodeURIComponent(token)}&response=no&auctionId=${encodeURIComponent(auctionId)}&source=auction-invitation"
             style="background-color: #dc3545; color: white; padding: 14px 32px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; margin: 0 8px;">
            No, not this time
          </a>
        </div>

        <p>We highly value your continued association with EP Group and look forward to your participation in this auction event. Should you require any clarification or support during the registration or bidding process, please feel free to reach out to our procurement support team at <strong>support@EPgroup.com</strong>.</p>

        <p>Thank you for your time and consideration. We look forward to engaging with you in this and future procurement opportunities.</p>

        <p style="margin-top: 30px;">Kind regards,</p>

        <p style="margin-top: 5px;"><strong>Procurement & Supplier Relations Team</strong></p>
        <p style="margin-top: 5px;"><strong>EP Group</strong></p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <div style="text-align: center; color: #666; font-size: 13px;">
          <p style="margin: 5px 0;">📧 support@EPgroup.com | ☎ +44-20-XXXX-XXXX</p>
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

export const sendBidApprovalEmail = async (to, auctionTitle, auctionLink, participantName) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Your Qualification is Approved – Live E-Auction Now Open for Participation`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
        <p><strong>Dear Valued Supplier,</strong></p>

        <p>We are pleased to inform you that your <strong>qualification bid has been approved</strong>, and you are now <strong>eligible to participate in the ongoing Live E-Auction Event</strong> hosted by <strong>EP Group</strong>.</p>

        <p>The auction is currently live and open for bidding. You may join the event immediately by following the link provided below. Alternatively, you can access the live auction through your supplier account on the <strong>EP E-Auction Platform</strong> by navigating to your dashboard, selecting the <strong>"View"</strong> option, and then opening the <strong>"Auction"</strong> tab.</p>

        <div style="text-align: center; margin: 35px 0;">
          <a href="${auctionLink}"
             style="background-color: #1AAB74; color: white; padding: 14px 32px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;">
            Join the Live Auction
          </a>
        </div>

        <p>We encourage you to participate actively and submit your bids within the designated auction window. Please ensure that your bids are placed in accordance with the event's terms and conditions as outlined in the previously shared documentation.</p>

        <p>For the best experience, we recommend logging in from a stable network connection and keeping your session active throughout the duration of the auction. Should you encounter any technical difficulties or require assistance during the bidding process, please contact our procurement support team at <strong>support@EPgroup.com</strong>.</p>

        <p>We appreciate your continued engagement and wish you success in the live auction.</p>

        <p style="margin-top: 30px;">Kind regards,</p>

        <p style="margin-top: 5px;"><strong>Procurement & Supplier Relations Team</strong></p>
        <p style="margin-top: 5px;"><strong>EP Group</strong></p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <div style="text-align: center; color: #666; font-size: 13px;">
          <p style="margin: 5px 0;">📧 support@EPgroup.com | ☎ +44-20-XXXX-XXXX</p>
        </div>
      </div>
    `,
  });
};