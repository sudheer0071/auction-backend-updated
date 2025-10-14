# Supplier Invitation System

## Overview
The auction system now supports inviting suppliers who don't already exist in the database. When creating an auction, you can include both existing user IDs and email addresses in the `invitedSuppliers` field.

## How It Works

### 1. Auction Creation
When creating an auction, the `invitedSuppliers` field can now accept:
- **ObjectIds**: For existing suppliers in the database
- **Email addresses**: For suppliers who don't exist yet

Example:
```json
{
  "title": "Sample Auction",
  "invitedSuppliers": [
    "507f1f77bcf86cd799439011",  // Existing supplier ID
    "new.supplier@example.com"   // New supplier email
  ]
}
```

### 2. Automatic Invitation Process
When an email address is provided for a non-existing supplier:
1. An invitation record is created in the database
2. An invitation email is sent to the supplier
3. The email address is stored in the auction's `invitedSuppliers` field

### 3. Supplier Registration
When a supplier registers using the invitation link:
1. The invitation token is validated
2. A new user account is created
3. **All auctions that have the supplier's email in `invitedSuppliers` are automatically updated to use the new user ID**

## Database Schema Changes

### Auction Model
The `invitedSuppliers` field now uses a mixed type with validation:
```javascript
invitedSuppliers: [{
  type: mongoose.Schema.Types.Mixed,
  validate: {
    validator: function(v) {
      return mongoose.Types.ObjectId.isValid(v) || 
             (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    },
    message: 'Invited supplier must be either a valid ObjectId or email address'
  }
}]
```

## API Changes

### Create Auction Response
The create auction endpoint now returns additional information:
```json
{
  "message": "Auction created successfully",
  "auction": { ... },
  "invitationsSent": 2
}
```

### Registration Response
The registration endpoint now returns information about updated auctions:
```json
{
  "message": "Registration successful",
  "auctionsUpdated": 3
}
```

## Utility Functions

### `convertEmailToUserIdInAuctions(email, userId)`
Converts email addresses to user IDs in all relevant auctions.

### `getAuctionsForSupplier(identifier)`
Gets all auctions where a supplier is invited (by email or user ID).

### `isSupplierInvitedToAuction(auctionId, identifier)`
Checks if a supplier is invited to a specific auction.

## Frontend Integration

The frontend can now:
1. Accept email addresses in the supplier invitation step
2. Display both existing suppliers and email addresses in auction details
3. Handle the registration flow with invitation tokens

## Security Considerations

1. **Invitation Tokens**: Each invitation has a unique token that expires after use
2. **Email Validation**: Email addresses are validated before being stored
3. **Role Validation**: Only suppliers can be invited to auctions
4. **Access Control**: Suppliers can only access auctions they're invited to

## Migration Notes

- Existing auctions with ObjectId-based `invitedSuppliers` will continue to work unchanged
- New auctions can mix ObjectIds and email addresses
- The system automatically handles the conversion when suppliers register 