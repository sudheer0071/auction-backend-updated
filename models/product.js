// models/Product.js
import mongoose from 'mongoose';


const productSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
}, { timestamps: true });

// module.exports = mongoose.model('Product', productSchema);
export default mongoose.model('Product', productSchema);