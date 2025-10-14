# Reverse Auction Bid Validation - Increment-Based Pricing

## Overview

This implementation uses increment-based price limits where bids start from above the lot's current price and are constrained by percentage increments added to that current price.

## Scenario Example

**Buyer wants to purchase 1,000 laptops**

Setup:

- Lot `current_price`: 1000 (starting reference price per laptop)
- Auction settings `minimum_bid_change`: 0.5 (0.5% minimum increment)
- Auction settings `maximum_bid_change`: 10 (10% maximum increment)
- Currency from `auction.default_currency`: "GBP"

Calculated increments:

- Minimum increment: £1000 × 0.5% = £5
- Maximum increment: £1000 × 10% = £100

Calculated limits:

- Floor price: £1000 + £5 = £1005 (minimum allowed bid)
- Ceiling price: £1000 + £100 = £1100 (maximum allowed bid)

Suppliers can bid between £1005 and £1100 per laptop.

## Logic Explanation

### For Reverse Auctions (Increment-Based):

- **Current Price**: The starting point (lot.current_price = £1000)
- **Minimum Increment**: minimum_bid_change% added to current price (0.5% = £5)
- **Maximum Increment**: maximum_bid_change% added to current price (10% = £100)
- **Bid Floor**: current_price + minimum increment (£1000 + £5 = £1005)
- **Bid Ceiling**: current_price + maximum increment (£1000 + £100 = £1100)

This ensures bids start from a minimum increment above current price and are capped at a maximum increment.

## Database Schema (No Changes Required)

### AuctionSettings Model

```javascript
{
  minimum_bid_change: { type: Number, required: true, default: 0.50 }, // Minimum increment percentage (e.g., 0.5 for 0.5%)
  maximum_bid_change: { type: Number, required: true, default: 10.00 }, // Maximum increment percentage (e.g., 10 for 10%)
}
```

### EventLot Model

Uses existing `current_price` field as reference:

```javascript
{
  current_price: { type: Number }, // Starting reference price for increment calculations
}
```

## Validation Function

### `validateBidAgainstPriceLimits(bidAmount, bidCurrency, auctionSettings, lotCurrentPrice, auctionCurrency)`

- Uses `lot.current_price` as the starting point
- Calculates minimum increment: `current_price × minimum_bid_change%`
- Calculates maximum increment: `current_price × maximum_bid_change%`
- Floor price: `current_price + minimum increment`
- Ceiling price: `current_price + maximum increment`
- Handles currency conversion automatically

## Usage Examples

### Controller Implementation:

```javascript
// Fetch lot to get current_price
const lot = await EventLot.findById(lotId);

const validation = await validateBidAgainstPriceLimits(
  amount, // e.g., 1050
  currency, // e.g., "GBP"
  auctionSettings, // Contains min: 0.5%, max: 10%
  lot.current_price, // e.g., 1000
  auction.default_currency // e.g., "GBP"
);

// Result: valid if 1005 <= 1050 <= 1100
```

### Validation Response:

```javascript
{
  isValid: true,
  bidAmount: 1050,
  bidCurrency: "GBP",
  currentPrice: 1000,
  floorPrice: 1005,          // 1000 + (1000 * 0.5%)
  ceilingPrice: 1100,        // 1000 + (1000 * 10%)
  minIncrement: 5,           // 1000 * 0.5%
  maxIncrement: 100,         // 1000 * 10%
  validRange: "1005.00 - 1100.00 GBP"
}
```

### Frontend Constraints:

```javascript
{
  constraints: {
    bidDirection: "reverse",
    minBidPercentage: 0.5,     // minimum increment %
    maxBidPercentage: 10,      // maximum increment %
    currency: "GBP",
    referencePrice: 1000,
    floorPrice: 1005,
    ceilingPrice: 1100,
    minIncrement: 5,
    maxIncrement: 100,
    validRange: "1005.00 - 1100.00 GBP",
    explanation: "Bids must be between 1005.00 (current price + 0.5% increment) and 1100.00 (current price + 10% increment) GBP"
  }
}
```

## Benefits

1. **Increment-Based Logic**: Clear understanding of exact increment amounts
2. **Flexible Percentages**: Different increment ranges for different auction types
3. **Current Price Reference**: Each lot can have different starting prices
4. **Predictable Bidding**: Suppliers know exact increment requirements
5. **Currency Flexible**: Handles multi-currency bidding with proper conversion
6. **No Schema Changes**: Uses existing database fields

## Configuration Example

### Auction Settings:

```javascript
{
  event_id: "64f9b8c8e1234567890abcde",
  bid_direction: "reverse",
  minimum_bid_change: 0.5,   // 0.5% minimum increment
  maximum_bid_change: 10     // 10% maximum increment
}
```

### Lot Configuration:

```javascript
{
  auction: "64f9b8c8e1234567890abcde",
  name: "Laptop Model X",
  current_price: 1000        // Starting price £1000
}
```

### Bidding Results:

- Current price: £1000
- Minimum increment: £5 (0.5% of £1000)
- Maximum increment: £100 (10% of £1000)

#### Test Cases:

- Bid £1000: ❌ "Bid amount 1000 GBP is below the minimum allowed (1005.00 GBP = current price 1000.00 + 0.5% increment)"
- Bid £1004: ❌ "Bid amount 1004 GBP is below the minimum allowed (1005.00 GBP = current price 1000.00 + 0.5% increment)"
- Bid £1005: ✅ Valid (at minimum increment)
- Bid £1050: ✅ Valid (within increment range)
- Bid £1100: ✅ Valid (at maximum increment)
- Bid £1150: ❌ "Bid amount 1150 GBP is above the maximum allowed (1100.00 GBP = current price 1000.00 + 10% increment)"

### Dynamic Pricing Example:

If current_price changes to £1200:

- Minimum increment: £6 (0.5% of £1200)
- Maximum increment: £120 (10% of £1200)
- Floor price: £1206
- Ceiling price: £1320

This creates a predictable increment-based competitive environment where suppliers understand exact increment requirements.
