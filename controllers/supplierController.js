import User from "../models/user.js";

// Get supplier profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile", error: err.message });
  }
};

// Update supplier profile
export const updateProfile = async (req, res) => {
  try {
    const { name, companyName } = req.body;

    // Validate required fields
    if (!name || !companyName) {
      return res.status(400).json({
        message: "Name and company name are required"
      });
    }

    // Prepare update object
    const updates = {
      name: name.trim(),
      "profile.companyName": companyName.trim()
    };

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to update profile", 
      error: err.message 
    });
  }
};

export const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await User.find({ role: "Supplier" });
      suppliers.sort((a, b) =>
      a.email.localeCompare(b.email, undefined, { numeric: true, sensitivity: "base" })
    );
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch suppliers", error: err.message });
  }
};