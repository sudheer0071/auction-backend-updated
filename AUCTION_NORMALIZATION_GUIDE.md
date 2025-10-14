# Auction Model Normalization Guide

## Overview

This guide documents the migration from an embedded document structure to a normalized NoSQL structure for the auction system. This change improves maintainability, performance, and follows the same pattern as the Event model.

## 🔄 Changes Made

### Before (Embedded Structure)

```javascript
const auction = {
  title: "Test Auction",
  auction_settings: {
    start_date: "2025-08-15",
    bid_direction: "reverse",
    // ... embedded data
  },
  questionnaires: [
    {
      name: "Supplier Questionnaire",
      deadline: "2025-08-14",
      // ... embedded data
    },
  ],
  participants: [
    {
      participant: { email: "supplier@example.com" },
      status: "invited",
      // ... embedded data
    },
  ],
};
```

### After (Normalized Structure)

```javascript
const auction = {
  title: "Test Auction",
  auction_settings: ObjectId("64f5a1b2c3d4e5f6g7h8i9j0"), // Reference
  questionnaires: [ObjectId("64f5a1b2c3d4e5f6g7h8i9j1")], // References
  participants: [ObjectId("64f5a1b2c3d4e5f6g7h8i9j2")], // References
};
```

## 📁 Files Modified

### 1. Models

- ✅ `models/auction.js` - Updated to use references instead of embedded documents
- ✅ `models/auction_backup_20250811.js` - Backup of original model

### 2. Controllers

- ✅ `controllers/auctionController_backup_20250811.js` - Backup of original controller
- ✅ `controllers/auctionController_normalized_example.js` - Example normalized implementation

### 3. Migration Utilities

- ✅ `utils/auctionMigration.js` - Migration and rollback utilities

## 🚀 Migration Process

### Step 1: Backup Verification

All original files have been backed up with timestamp `20250811`:

- `auction_backup_20250811.js`
- `auctionController_backup_20250811.js`

### Step 2: Run Migration (When Ready)

```javascript
import { migrateAuctionToNormalizedStructure } from "./utils/auctionMigration.js";

// Run migration
await migrateAuctionToNormalizedStructure();
```

### Step 3: Update Controller Methods

Replace embedded document logic with normalized approach:

```javascript
// OLD: Embedded approach
auction.auction_settings = { start_date: "2025-08-15", ... };

// NEW: Normalized approach
const settings = new AuctionSettings({ event_id: auction._id, ... });
const savedSettings = await settings.save();
auction.auction_settings = savedSettings._id;
```

### Step 4: Update Queries to Use Populate

```javascript
// Get auction with all related data
const auction = await Auction.findById(id)
  .populate("auction_settings")
  .populate("questionnaires")
  .populate("event_documents")
  .populate("event_lots")
  .populate("participants");
```

## 💡 Benefits of Normalization

### 1. **Performance**

- ✅ Smaller document sizes
- ✅ Better indexing on individual collections
- ✅ Faster queries when not all data is needed

### 2. **Maintainability**

- ✅ Clear separation of concerns
- ✅ Consistent with Event model structure
- ✅ Easier to modify individual components

### 3. **Scalability**

- ✅ Independent scaling of collections
- ✅ Better memory usage
- ✅ Reduced document size limits issues

### 4. **Flexibility**

- ✅ Reusable components across different auctions
- ✅ Better support for complex queries
- ✅ Easier data analytics

## ⚠️ Important Considerations

### 1. **Backwards Compatibility**

The migration keeps legacy fields for temporary backwards compatibility:

```javascript
// Legacy fields maintained
lots: [ObjectId], // Old lot references
documents: [String], // Old document paths
invitedSuppliers: [Mixed], // Old supplier format
```

### 2. **Transaction Support**

All create/update operations should use transactions:

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Your operations here
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 3. **Query Performance**

Use selective population to avoid loading unnecessary data:

```javascript
// Only populate what you need
.populate('auction_settings', 'start_date event_type')
.populate('participants', 'participant.email status')
```

## 🔄 Rollback Process

If you need to rollback to embedded structure:

```javascript
import { rollbackAuctionNormalization } from "./utils/auctionMigration.js";

await rollbackAuctionNormalization();
```

## 📋 Testing Checklist

Before deploying to production:

- [ ] Run migration on development database
- [ ] Test all auction CRUD operations
- [ ] Verify data integrity after migration
- [ ] Test performance with populated queries
- [ ] Verify backwards compatibility
- [ ] Test rollback procedure
- [ ] Update frontend queries if needed

## 🔗 Related Models

The normalized structure now consistently uses these models:

- `AuctionSettings` - Auction configuration
- `Questionnaire` - Supplier questionnaires
- `EventDocument` - Auction documents
- `EventLot` - RFQ lots
- `EventParticipant` - Auction participants

## 📝 Next Steps

1. **Gradual Migration**: Start with new auctions using normalized structure
2. **Background Migration**: Migrate existing auctions during low-traffic periods
3. **Frontend Updates**: Update frontend to work with populated data
4. **Remove Legacy**: After successful migration, remove embedded document support
5. **Performance Monitoring**: Monitor query performance and optimize as needed

## 🆘 Support

If you encounter issues:

1. Check the backup files for original structure
2. Use the rollback utility if needed
3. Refer to the example controller for implementation patterns
4. Test migrations on development data first

---

**Remember**: This is a significant structural change. Always test thoroughly before deploying to production!
