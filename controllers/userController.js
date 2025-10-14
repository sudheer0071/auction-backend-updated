import User from "../models/user.js";

// Get current user's profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
};


export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.json(user);
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user", error: err.message });
  }
};


export const getAllSupplier = async (req, res) => {
  try {
    const user = await User.find({ role: "supplier" });
    if (user.length === 0) {
      return res.json(user);
    }
    console.log("supplierss.... ");
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch Supplier", error: err.message });
  }
};

// Update current user's profile
export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;

    // Prevent role or email change
    delete updates.role;
    delete updates.email;

    // Only allow updating allowed fields
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
};
