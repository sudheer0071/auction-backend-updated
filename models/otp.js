import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otpCode: { type: String, required: true },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Enables MongoDB TTL to auto-delete expired OTPs
  },
}, { timestamps: true }); // Adds createdAt and updatedAt

export default mongoose.model('Otp', otpSchema);