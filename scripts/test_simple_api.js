import chalk from 'chalk';

const BASE_URL = "http://localhost:3001";
const LOG_TAG = "[Test]";

async function sendRequest(endpoint, payload, description) {
    console.log(chalk.cyan(`\n${LOG_TAG} ${description}`));
    if (payload) console.log(chalk.dim(JSON.stringify(payload, null, 2)));

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log(chalk.green(`${LOG_TAG} Success!`));
            console.log(chalk.white(JSON.stringify(data, null, 2)));
        } else {
            console.log(chalk.red(`${LOG_TAG} Failed (Status ${response.status}):`));
            console.log(chalk.red(JSON.stringify(data, null, 2)));
        }
    } catch (error) {
        console.error(chalk.red(`${LOG_TAG} Error sending request:`), error);
    }
}

async function testSuite() {
    // 1. Login Test (Replace with valid credentials or dummy if mocking)
    // Assuming env vars are set or using placeholders
    const username = process.env.BETKING_USERNAME || "testuser";
    const password = process.env.BETKING_PASSWORD || "testpass";

    console.log(chalk.yellow(`${LOG_TAG} Note: Ensure credentials are correct for login test to pass.`));

    await sendRequest('/login', {
        username,
        password
    }, "Sending Login Request");

    // 2. Bet Placement (Using session from Login)
    // We don't need to send password here if session is saved
    await sendRequest('/bet', {
        home: "Arsenal",
        away: "Chelsea",
        stake: 10,
        username: username, // Just to identify session
        market_type: "moneyline",
        outcome: "home"
    }, "Sending Bet Request (Session based)");
}

testSuite();
