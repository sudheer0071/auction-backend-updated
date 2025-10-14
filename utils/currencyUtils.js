import CurrencyRate from "../models/currencyRate.js";

// Hardcoded GBP rates as fallback (same as frontend)
const GBP_RATES = {
  GBP: 1,
  USD: 1.35,
  CNY: 9.71,
  VND: 35364.06,
  TRY: 54.72,
  EUR: 1.15,
  INR: 116.79,
};

/**
 * Convert amount from one currency to another using GBP as base
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  console.log("reverse price , ", amount, fromCurrency, toCurrency);

  if (fromCurrency === toCurrency) return amount;
  
  try {
    // Try to get rates from database first
    const fromRate = await CurrencyRate.findOne({ code: fromCurrency.toUpperCase() });
    const toRate = await CurrencyRate.findOne({ code: toCurrency.toUpperCase() });
    
    if (fromRate && toRate) {
      // Use database rates
      const fromRateValue = parseFloat(fromRate.rate.toString());
      const toRateValue = parseFloat(toRate.rate.toString());
      
      // Convert from 'from' to GBP, then GBP to 'to'
      const amountInGbp = amount / fromRateValue;
      return amountInGbp * toRateValue;
    } else {
      // Fallback to hardcoded rates
      const rateFrom = GBP_RATES[fromCurrency.toUpperCase()];
      const rateTo = GBP_RATES[toCurrency.toUpperCase()];
      
      if (!rateFrom || !rateTo) {
        throw new Error(`Currency conversion not available for ${fromCurrency} to ${toCurrency}`);
      }
      
      // Convert from 'from' to GBP, then GBP to 'to'
      const amountInGbp = amount / rateFrom;
      return amountInGbp * rateTo;
    }
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw new Error(`Currency conversion failed: ${error.message}`);
  }
};

/**
 * Convert currency to GBP using database rates
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @returns {Object} Conversion result
 */
export const convertCurrencyToGBP = async (amount, fromCurrency) => {
  // If already GBP, return as is
  if (fromCurrency === 'GBP') {
    return { success: true, gbpAmount: amount, originalAmount: amount, fromCurrency };
  }

  try {
    // Find the currency rate in database
    const currencyRate = await CurrencyRate.findOne({ code: fromCurrency.toUpperCase() });
    console.log("currency rate ", currencyRate);
    
    if (!currencyRate) {
      throw new Error(`Currency rate not found for ${fromCurrency}. Please ensure this currency is supported.`);
    }

    // Convert to GBP: amount / rate (since rate represents how much of that currency equals 1 GBP)
    const rate = parseFloat(currencyRate.rate.toString());
    const gbpAmount = amount / rate;

    return { 
      success: true, 
      gbpAmount, 
      originalAmount: amount, 
      fromCurrency, 
      rate,
      conversion: `${amount} ${fromCurrency} = ${gbpAmount.toFixed(6)} GBP (rate: 1 GBP = ${rate} ${fromCurrency})`
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      originalAmount: amount, 
      fromCurrency 
    };
  }
};

/**
 * Convert GBP amount to supplier's currency using database rates
 * @param {number} gbpAmount - Amount in GBP to convert
 * @param {string} toCurrency - Target currency code
 * @returns {Object} Conversion result
 */
export const convertGBPToCurrency = async (gbpAmount, toCurrency) => {
  // If already GBP, return as is
  if (toCurrency === 'GBP') {
    return { success: true, convertedAmount: gbpAmount, originalAmount: gbpAmount, toCurrency };
  }

  try {
    // Find the currency rate in database
    const currencyRate = await CurrencyRate.findOne({ code: toCurrency.toUpperCase() });
    
    if (!currencyRate) {
      throw new Error(`Currency rate not found for ${toCurrency}. Please ensure this currency is supported.`);
    }

    // Convert from GBP: gbpAmount * rate (since rate represents how much of that currency equals 1 GBP)
    const rate = parseFloat(currencyRate.rate.toString());
    const convertedAmount = gbpAmount * rate;

    return { 
      success: true, 
      convertedAmount, 
      originalAmount: gbpAmount, 
      toCurrency, 
      rate,
      conversion: `${gbpAmount.toFixed(6)} GBP = ${convertedAmount.toFixed(2)} ${toCurrency} (rate: 1 GBP = ${rate} ${toCurrency})`
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      originalAmount: gbpAmount, 
      toCurrency 
    };
  }
};

/**
 * Validate bid amount against increment-based limits using auction settings and lot current price
 * Bids must be above current_price plus a percentage increment within min/max range
 * @param {number} bidAmount - Bid amount
 * @param {string} bidCurrency - Bid currency
 * @param {Object} auctionSettings - Auction settings containing minimum_bid_change and maximum_bid_change as increment percentages
 * @param {number} lotCurrentPrice - Current price from lot (starting point)
 * @param {string} auctionCurrency - Currency from auction.default_currency
 * @returns {Object} Validation result with calculated limits
 */
export const validateBidAgainstPriceLimits = async (bidAmount, bidCurrency, auctionSettings, lotCurrentPrice, lotQualificationPrice, auctionCurrency = "GBP") => {
  try {
    // Auction settings are required for price limit validation
    if (!auctionSettings) {
      throw new Error("Auction settings are required for bid validation. Please configure auction settings with increment percentages.");
    }

    // Convert bid amount to GBP for consistent validation (backend stores everything in GBP)
    const currencyConversion = await convertCurrencyToGBP(bidAmount, bidCurrency);
    if (!currencyConversion.success) {
      throw new Error(`Currency conversion failed for ${bidAmount} ${bidCurrency}. ${currencyConversion.error}`);
    }

    console.log("Currency conversion for validation:", currencyConversion.conversion);
    
    // Use the converted GBP amount for all validation calculations
    const gbpBidAmount = currencyConversion.gbpAmount;

    // Determine which price to use based on auction direction
    const bidDirection = auctionSettings.bid_direction || "reverse";
    let referencePrice;
    if (bidDirection === "reverse") {
      if (!lotQualificationPrice || lotQualificationPrice <= 0) {
        throw new Error(`Lot qualification_price is required for reverse auction bid validation. Please set a valid qualification_price for this lot. (bidCurrency: ${bidCurrency})`);
      }
      referencePrice = lotQualificationPrice;
    } else {
      if (!lotCurrentPrice || lotCurrentPrice <= 0) {
        throw new Error(`Lot current price is required for forward auction bid validation. Please set a valid current_price for this lot. (bidCurrency: ${bidCurrency})`);
      }
      referencePrice = lotCurrentPrice;
    }

    // Get increment percentages from auction settings
    let minIncrementPercentage = auctionSettings.minimum_bid_change; // e.g., 0.5 (represents 0.5%)
    let maxIncrementPercentage = auctionSettings.maximum_bid_change; // e.g., 10 (represents 10%)

    // For reverse auction, override maxIncrementPercentage to 1
    if (bidDirection === "reverse") {
      maxIncrementPercentage = 10;
    }
    // For forward auction, keep as is

    // Validate that increment percentages are properly configured
    if (minIncrementPercentage == null || maxIncrementPercentage == null || minIncrementPercentage < 0 || maxIncrementPercentage <= 0) {
      throw new Error(`Invalid auction settings: minimum_bid_change and maximum_bid_change must be non-negative numbers representing increment percentages. (bidCurrency: ${bidCurrency})`);
    }
    if (minIncrementPercentage >= maxIncrementPercentage) {
      throw new Error(`Invalid auction settings: minimum_bid_change must be less than maximum_bid_change. (bidCurrency: ${bidCurrency})`);
    }

    // Since we're working in GBP now, reference price should already be in GBP
    // No need to convert reference price as backend stores everything in GBP
    const convertedCurrentPrice = referencePrice; // Already in GBP

    // Calculate increment amounts based on percentages
    // Min increment: e.g., £1000 × 0.5% = £5
    // Max increment: e.g., £1000 × 10% = £100
    const minIncrement = (convertedCurrentPrice * minIncrementPercentage) / 100;
    const maxIncrement = (convertedCurrentPrice * maxIncrementPercentage) / 100;
console.log("convertedCurrentPrice ///////// ", convertedCurrentPrice);

    // Calculate floor and ceiling prices (all in GBP)
    // For reverse auction, floorPrice is always 0
    let floorPrice, ceilingPrice;
    if (bidDirection === "reverse") {
      floorPrice = 0;
      ceilingPrice = convertedCurrentPrice + maxIncrement;
    } else {
      floorPrice = convertedCurrentPrice + minIncrement;
      ceilingPrice = convertedCurrentPrice + maxIncrement;
    }
    
    // Validate bid is within the allowed range (comparing GBP amounts)
    console.log(`Bid validation: originalAmount=${bidAmount} ${bidCurrency}, gbpAmount=${gbpBidAmount.toFixed(6)} GBP, currentPrice=${convertedCurrentPrice.toFixed(2)} GBP, floor=${floorPrice.toFixed(2)} GBP, ceiling=${ceilingPrice.toFixed(2)} GBP`);
    
    const isBelowFloor = gbpBidAmount < floorPrice;
    const isAboveCeiling = gbpBidAmount > ceilingPrice;
    const isValid = !isBelowFloor && !isAboveCeiling;
    
    let errorMessage = null;
    let supplierCurrencyRange = `${floorPrice.toFixed(2)} - ${ceilingPrice.toFixed(2)} GBP`;
    
    if (isBelowFloor || isAboveCeiling) {
      // Convert floorPrice and ceilingPrice to supplier's currency for user-friendly error message
      try {
        const floorConversion = await convertGBPToCurrency(floorPrice, bidCurrency);
        const ceilingConversion = await convertGBPToCurrency(ceilingPrice, bidCurrency);
        
        if (floorConversion.success && ceilingConversion.success) {
          supplierCurrencyRange = `${floorConversion.convertedAmount.toFixed(2)} - ${ceilingConversion.convertedAmount.toFixed(2)} ${bidCurrency}`;
          errorMessage = `Bid amount should be in range between ${supplierCurrencyRange} (your bid: ${bidAmount} ${bidCurrency})`;
        } else {
          // Fallback to GBP if conversion fails
          errorMessage = `Bid amount should be in range between ${floorPrice.toFixed(2)} - ${ceilingPrice.toFixed(2)} GBP (your bid: ${gbpBidAmount.toFixed(6)} GBP converted from ${bidAmount} ${bidCurrency})`;
        }
      } catch (conversionError) {
        // Fallback to GBP if conversion fails
        errorMessage = `Bid amount should be in range between ${floorPrice.toFixed(2)} - ${ceilingPrice.toFixed(2)} GBP (your bid: ${gbpBidAmount.toFixed(6)} GBP converted from ${bidAmount} ${bidCurrency})`;
      }
    }  
    
    return {
      isValid,
      bidAmount: gbpBidAmount, // Return converted GBP amount for storage
      bidCurrency: 'GBP', // Validation is done in GBP
      originalBidAmount: bidAmount, // Keep original amount for reference
      originalBidCurrency: bidCurrency, // Keep original currency for error messages
      currentPrice: convertedCurrentPrice,
      floorPrice,
      ceilingPrice,
      minIncrement,
      maxIncrement,
      auctionCurrency: 'GBP', // Always GBP for validation
      minIncrementPercentage,
      maxIncrementPercentage,
      isBelowFloor,
      isAboveCeiling,
      errorMessage,
      validRange: supplierCurrencyRange, // Range in supplier's currency
      validRangeGBP: `${floorPrice.toFixed(2)} - ${ceilingPrice.toFixed(2)} GBP`, // Also provide GBP range
      conversionDetails: currencyConversion,
      // Original values
      originalCurrentPrice: lotCurrentPrice,
      originalCurrency: auctionCurrency
    };
  } catch (error) {
    console.error('Bid validation error:', error);
    // Make sure error includes bidCurrency information
    const errorMessage = error.message.includes('bidCurrency:') 
      ? error.message 
      : `${error.message} (bidCurrency: ${bidCurrency})`;
    throw new Error(`Bid validation failed: ${errorMessage}`);
  }
};

/**
 * @deprecated Use validateBidAgainstPriceLimits instead
 * Legacy function - kept for backward compatibility
 */
export const validateBidAgainstReservePrice = async (bidAmount, bidCurrency, reservePrice, marketCurrency, auctionSettings = null) => {
  console.warn("validateBidAgainstReservePrice is deprecated. Use validateBidAgainstPriceLimits instead.");
  
  // If new price limits are available, use them
  if (auctionSettings && auctionSettings.floor_price && auctionSettings.ceiling_price) {
    return await validateBidAgainstPriceLimits(bidAmount, bidCurrency, auctionSettings);
  }
  
  // Legacy fallback logic
  try {
    // If no market price provided, skip validation
    console.log("market price: ", reservePrice);
    if (!reservePrice) {
      return {
        isValid: true,
        message: "No market price provided, validation skipped"
      };
    }

    let convertedMarketPrice = reservePrice;
    
    // Convert market price to bid currency if different
    if (bidCurrency !== marketCurrency) {
      convertedMarketPrice = await convertCurrency(reservePrice, marketCurrency, bidCurrency);
    }

    // Use auction settings percentages or defaults
    const minPercentage = auctionSettings?.minimum_bid_change || 70; // 70% as default floor
    const maxPercentage = auctionSettings?.maximum_bid_change || 95; // 95% as default ceiling
    
    // Calculate floor and ceiling prices based on percentages
    const floorPrice = (convertedMarketPrice * minPercentage) / 100;
    const ceilingPrice = (convertedMarketPrice * maxPercentage) / 100;
    
    // Validate bid is within limits
    console.log("bidamount and floorPrice ", bidAmount, floorPrice);
    
    const isBelowFloor = bidAmount < floorPrice;
    const isAboveCeiling = bidAmount > ceilingPrice;
    const isValid = !isBelowFloor && !isAboveCeiling;
    
    let errorMessage = null;
    if (isBelowFloor) {
      errorMessage = `Bid amount ${bidAmount} ${bidCurrency} is below the minimum allowed (${floorPrice.toFixed(2)} ${bidCurrency} - ${minPercentage}% of market price)`;
    } else if (isAboveCeiling) {
      errorMessage = `Bid amount ${bidAmount} ${bidCurrency} is above the maximum allowed (${ceilingPrice.toFixed(2)} ${bidCurrency} - ${maxPercentage}% of market price)`;
    }
    
    return {
      isValid,
      bidAmount,
      bidCurrency,
      reservePrice: convertedMarketPrice,
      marketCurrency: bidCurrency,
      floorPrice,
      ceilingPrice,
      minPercentage,
      maxPercentage,
      isBelowFloor,
      isAboveCeiling,
      errorMessage,
      // Keep backward compatibility fields
      convertedReservePrice: ceilingPrice,
      reservePriceCurrency: bidCurrency,
      originalReservePrice: reservePrice,
      originalReserveCurrency: marketCurrency
    };
  } catch (error) {
    console.error('Bid validation error:', error);
    throw new Error(`Bid validation failed: ${error.message}`);
  }
}; 