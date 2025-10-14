// Test script for bid validation implementation

const { validateBidAgainstPriceLimits } = require('./utils/currencyUtils');

async function testBidValidation() {
    console.log('Testing Reverse Auction Bid Validation - Starting Above Current Price\n');
    
    // Mock auction settings
    const auctionSettings = {
        minimum_bid_change: 0.50, // Legacy field (not used)
        maximum_bid_change: 120   // Maximum 120% (20% above current price)
    };
    
    const lotCurrentPrice = 1000;  // Lot current price: £1000
    const auctionCurrency = 'GBP';
    
    console.log('Scenario: Laptop Auction');
    console.log(`Current Price: ${lotCurrentPrice} ${auctionCurrency}`);
    console.log(`Maximum Bid Change: ${auctionSettings.maximum_bid_change}%`);
    console.log(`Expected Range: Above ${lotCurrentPrice} up to ${lotCurrentPrice * auctionSettings.maximum_bid_change / 100}\n`);
    
    // Test cases
    const testCases = [
        { amount: 999, description: 'Below current price' },
        { amount: 1000, description: 'Equal to current price' },
        { amount: 1000.01, description: 'Just above current price' },
        { amount: 1050, description: 'Valid bid (5% above)' },
        { amount: 1150, description: 'Valid bid (15% above)' },
        { amount: 1200, description: 'At maximum limit (20% above)' },
        { amount: 1250, description: 'Above maximum limit' }
    ];
    
    for (const testCase of testCases) {
        try {
            const result = await validateBidAgainstPriceLimits(
                testCase.amount,
                auctionCurrency,
                auctionSettings,
                lotCurrentPrice,
                auctionCurrency
            );
            
            console.log(`${testCase.description}: ${testCase.amount} ${auctionCurrency}`);
            console.log(`  Result: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
            if (!result.isValid) {
                console.log(`  Error: ${result.errorMessage}`);
            }
            if (result.validRange) {
                console.log(`  Valid Range: ${result.validRange}`);
            }
            console.log('');
        } catch (error) {
            console.log(`❌ Error testing ${testCase.description}: ${error.message}\n`);
        }
    }
}

// Mock the CurrencyRate model for testing
if (require.main === module) {
    // Mock CurrencyRate.findOne to avoid database dependency
    const originalCurrencyRate = require('./models/currencyRate');
    if (originalCurrencyRate) {
        originalCurrencyRate.findOne = () => Promise.resolve({ rate: 1 });
    }
    
    testBidValidation().catch(console.error);
}

module.exports = { testBidValidation };
