import User from "../models/user.js";
import Otp from '../models/otp.js';
import { v4 as uuidv4 } from 'uuid';
import Auction from "../models/auction.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOTP } from "../utils/mailer.js";
import Invitation from "../models/invitation.js";
import { convertEmailToUserIdInAuctions } from "../utils/auctionUtils.js";

// Register a new user (EP member or Supplier)
// export const register = async (req, res) => {
//   try {
//     const { name, email, password, role, profile, businessDocs, invitationToken, agreedToTerms } = req.body;

//     // Only allow "Supplier" role for public registration
//     if (role && role !== "Supplier") {
//       return res.status(403).json({ message: "Only Supplier registration is allowed here." });
//     }

//     // Validate invitation token
//     const invitation = await Invitation.findOne({ email, token: invitationToken, used: false });
//     if (!invitation) {
//       return res.status(400).json({ message: "Invalid or expired invitation token." });
//     }

//     // Check required supplier fields
//     const requiredFields = [
//       "companyName", "registrationNumber", "taxId", "address", "coreCapabilities",
//       "portOfLoading", "containerCapacity", "importDutiesInfo"
//     ];
//     for (const field of requiredFields) {
//       if (!profile || !profile[field]) {
//         return res.status(400).json({ message: `Missing required field: ${field}` });
//       }
//     }
//     if (!businessDocs || businessDocs.length < 2) {
//       return res.status(400).json({ message: "Business registration and tax documents are required." });
//     }
//     if (!agreedToTerms) {
//       return res.status(400).json({ message: "You must agree to the terms to register." });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ message: "User already exists" });

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Create user
//     const user = new User({
//       name,
//       email,
//       password: hashedPassword,
//       role: "Supplier",
//       profile,
//       businessDocs,
//       agreedToTerms,
//     });

//     await user.save();

//     // Mark invitation as used
//     invitation.used = true;
//     invitation.usedAt = new Date();
//     await invitation.save();

//     // Update auctions that have this email in invitedSuppliers
//     // Convert email to user ID in all relevant auctions
//     const auctionsUpdated = await convertEmailToUserIdInAuctions(email, user._id);

//     res.status(201).json({ 
//       message: "Registration successful",
//       auctionsUpdated
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Registration failed", error: err.message });
//   }
// };
export const register = async (req, res) => {
  try {
    const { name, email, password, role, profile } = req.body;
console.log("suppliers's registration data: ", req.body);

    // Only allow "Supplier" role for public registration
    if (role && role !== "supplier") {
      return res.status(403).json({ message: "Only Supplier registration is allowed here." });
    }
console.log("suppliers's regsterrrr , ", req.body);

    // Validate invitation token
    // const invitation = await Invitation.findOne({ email, token: invitationToken, used: false });
    // if (!invitation) {
    //   return res.status(400).json({ message: "Invalid or expired invitation token." });
    // }

    // Check required supplier fields
    // const requiredFields = [
    //   "companyName", "registrationNumber", "taxId", "address", "coreCapabilities",
    //   "portOfLoading", "containerCapacity", "importDutiesInfo"
    // ];
      const requiredFields = [
      "companyName",
      "country"
    ];
    for (const field of requiredFields) {
      if (!profile || !profile[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }
    // if (!businessDocs || businessDocs.length < 2) {
    //   return res.status(400).json({ message: "Business registration and tax documents are required." });
    // }
    // if (!agreedToTerms) {
    //   return res.status(400).json({ message: "You must agree to the terms to register." });
    // }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    let updatedProfile = { ...profile };
    if (role === "supplier") {
      const shortId = uuidv4().split('-')[0]; // short unique suffix
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // e.g., 20250712
      const registrationNumber = `SUP-${today}-${shortId}`;
      updatedProfile.registrationNumber = registrationNumber;
    }

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      profile: updatedProfile
      // businessDocs,
      // agreedToTerms,
    });
    console.log("New user created:", user);
    await user.save();

    // Mark invitation as used
    // invitation.used = true;
    // invitation.usedAt = new Date();
    // await invitation.save();

    // Update auctions that have this email in invitedSuppliers
    // Convert email to user ID in all relevant auctions
    const auctionsUpdated = await convertEmailToUserIdInAuctions(email, user._id);

    // update the invitation table with response yes, who have this user.email
    await Invitation.updateMany({ email }, { response: "yes" });

    // Check if OTP record exists for this email
    
   const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    const existingOtp = await Otp.findOne({ email });

    if (existingOtp) {
      // Update existing OTP
      existingOtp.otpCode = otpCode;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      // Create new OTP record

      await Otp.create({ email, otpCode, expiresAt });
    }
    // Send OTP via email
    await sendOTP(user.email, otpCode);
    res.json({ message: "OTP sent to your email", otpEmail: user.email });

  } catch (err) {
    console.log("failed to register ,", err);
    
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

// Login (Step 1: Password check, send OTP)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    console.log(isMatch, "ppppppppppppppppppp")

   const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    // Check if OTP record exists for this email
    const existingOtp = await Otp.findOne({ email });

    if (existingOtp) {
      // Update existing OTP
      existingOtp.otpCode = otpCode;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      // Create new OTP record
      await Otp.create({ email, otpCode, expiresAt });
    }
    // Send OTP via email
    await sendOTP(user.email, otpCode);
    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.log(err);
    
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// Verify OTP (Step 2: OTP check, issue JWT)
// export const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const user = await User.findOne({ email });
//     if (
//       !user ||
//       user.otpCode !== otp ||
//       !user.otpExpires ||
//       user.otpExpires < Date.now()
//     ) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     // Clear OTP fields
//     user.otpCode = undefined;
//     user.otpExpires = undefined;
//     await user.save();

//     // Generate JWT
//     const token = jwt.sign(
//       { userId: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
//   } catch (err) {
//     res.status(500).json({ message: "OTP verification failed", error: err.message });
//   }
// };


export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Find OTP record
    const otpRecord = await Otp.findOne({ email, otpCode: otp });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id }); // Optional: cleanup expired
      return res.status(400).json({ message: "OTP has expired" });
    }

    // 2. Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 3. Delete the OTP record (prevent reuse)
    await Otp.deleteOne({ _id: otpRecord._id });

    // 4. Issue JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log("email ", email);
    console.log("uerrrrr, ", user);
    

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email
      }
    });
  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).json({
      message: "OTP verification failed",
      error: err.message
    });
  }
};

// Admin creates EP member (Admin/Manager/Viewer)
export const createEpMember = async (req, res) => {
  try {
    const { name, email, password, role, profile } = req.body;

    // Only allow Admin, Manager, Viewer roles
    if (!["Admin", "Manager", "Viewer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role for EP member." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      profile,
    });

    await user.save();
console.log("User created:", user.email);

    res.status(201).json({ message: "EP member account created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Account creation failed", error: err.message });
  }
};

// Step 1: Request OTP for password reset
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2. Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 3. Check for existing OTP and update or create new one
    const existingOtp = await Otp.findOne({ email });

    if (existingOtp) {
      existingOtp.otpCode = otpCode;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      await Otp.create({ email, otpCode, expiresAt });
    }

    // Debug log for OTP
    console.log(`Sending OTP for password reset:`, { email, otpCode });

    // Send OTP
    await sendOTP(user.email, otpCode);

    res.json({ message: "OTP sent to your email for password reset" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP", error: err.message });
  }
};

// Step 2: Verify OTP before allowing reset
export const verifyForgotOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Find matching OTP record
    const otpRecord = await Otp.findOne({ email, otpCode: otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 2. Check expiration
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id }); // Optional cleanup
      return res.status(400).json({ message: "OTP has expired" });
    }

    // 3. Optionally delete OTP to prevent reuse
    await Otp.deleteOne({ _id: otpRecord._id });

    // 4. Confirm OTP is valid and proceed
    return res.json({ message: "OTP verified. You may now reset your password." });

  } catch (err) {
    console.error("OTP Verification Failed:", err);
    return res.status(500).json({ message: "OTP verification failed", error: err.message });
  }
};

// Step 3: Reset password after OTP verification
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // 3. Save user
    await user.save();

    // 4. Respond
    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Password reset failed:", err);
    return res.status(500).json({ message: "Password reset failed", error: err.message });
  }
};

// Resend OTP for password reset
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update or create OTP record
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      existingOtp.otpCode = otpCode;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      await Otp.create({ email, otpCode, expiresAt });
    }

    // Debug log for OTP
    console.log(`Resending OTP for password reset:`, { email, otpCode });

    // Send OTP
    await sendOTP(user.email, otpCode);

    res.json({ message: "OTP resent to your email for password reset" });
  } catch (err) {
    res.status(500).json({ message: "Failed to resend OTP", error: err.message });
  }
};