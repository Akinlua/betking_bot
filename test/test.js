import { initializeBrowser, closeBrowser } from "../src/core/browser.js";
import { getBetKingMatchDetailsByEvent } from "../src/services/bookmaker.service.js";

// ---  THE TEST DATA ---
// This is the data for the specific match we want to fetch,
// taken from a successful result from our previous fuzzy search.
const sampleEvent = {
	"IDEvent": 1002585837,
	"EventName": "wolverhampton-wanderers-manchester-city",
};


/**
 * The main test function.
 */
async function runDetailedFetchTest() {
	console.log('--- STARTING DETAILED MATCH FETCH TEST ---');
	console.log(`Testing with Event ID: ${sampleEvent.IDEvent}`);

	try {
		// 1. Initialize the browser
		await initializeBrowser();

		// 2. Call our target function directly with the test data
		console.log('\n[Test Runner] Calling getBetKingMatchDetailsByEvent...');
		const detailedMatchData = await getBetKingMatchDetailsByEvent(
			sampleEvent.IDEvent,
			sampleEvent.EventName
		);

		// 3. Check and display the result
		// if (detailedMatchData) {
		// 	console.log('\n--- SUCCESS! ---');
		// 	console.log('Successfully fetched and parsed detailed match data.');
		// 	console.log('The extracted JSON contains the following markets:');
		// 	// Log the names of all markets found on the page
		// 	const marketNames = detailedMatchData.Markets.map(m => m.OddsType.OddsTypeName);
		// 	console.log(marketNames);
		//
		// 	// For full details, you can log the whole object:
		// 	// console.log(JSON.stringify(detailedMatchData, null, 2));
		// } else {
		// 	console.log('\n--- FAILURE ---');
		// 	console.log('The function did not return any data.');
		// }

	} catch (error) {
		console.error('--- TEST FAILED WITH AN ERROR ---');
		console.error(error);
	} finally {
		// 4. Close the browser to end the test.
		console.log('\n[Test Runner] Test complete. Shutting down browser.');
		await closeBrowser();
	}
}

// Run the test
runDetailedFetchTest();
