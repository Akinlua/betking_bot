import chalk from 'chalk';

class Logger {
	constructor(logSender) {
		this.sender = logSender;
	}

	logBridgedMarkets(groupedMatches, calculateValueFn) {
		const intro = `[Edgerunner] **BRIDGED MARKETS**\n`;
		let summaryLog = '```\n';
		let consoleLog = '```\n';

		if (Object.keys(groupedMatches).length > 0) {
			const marketLogs = [];
			const consoleMarketLogs = [];

			for (const marketName in groupedMatches) {
				const marketGroup = groupedMatches[marketName];
				const header = `${marketName.toUpperCase()}${'─'.repeat(44 - marketName.length)}\n`;
				const subHeader = `Sel.             B-Odds   P-Odds   Value\n`;
				const divider = `${'─'.repeat(44)}\n`;

				let marketLogContent = '';
				let consoleMarketLogContent = '';

				marketGroup.forEach(bet => {
					const valuedBet = calculateValueFn(bet);
					let logSelectionName = bet.bookmaker.selection.name;
					const specialValue = bet.bookmaker.market.specialValue;
					if (specialValue && specialValue != 0) {
						logSelectionName = `${logSelectionName} ${specialValue}`;
					}
					const bOdd = valuedBet.bookmaker.selection.odd.value.toFixed(2);
					const pOdd = valuedBet.provider.matchedOutcome.odd.toFixed(2);
					const value = isFinite(valuedBet.value) ? valuedBet.value.toFixed(2) + '%' : 'N/A';

					const selectionCol = logSelectionName.padEnd(16);
					const bOddsCol = `@ ${bOdd}`.padEnd(8);
					const pOddsCol = pOdd.padEnd(8);

					marketLogContent += `${selectionCol} ${bOddsCol} ${pOddsCol} ${value}\n`;
					const valueColor = valuedBet.value > 0 ? chalk.green : chalk.red;
					consoleMarketLogContent += `${selectionCol} ${bOddsCol} ${pOddsCol} ${valueColor(value)}\n`;
				});

				marketLogs.push(header + subHeader + divider + marketLogContent);
				consoleMarketLogs.push(header + subHeader + divider + consoleMarketLogContent);
			}
			summaryLog += marketLogs.join('\n');
			consoleLog += consoleMarketLogs.join('\n');
		} else {
			const noBridgeMessage = `No markets were successfully bridged.`;
			summaryLog += noBridgeMessage;
			consoleLog += noBridgeMessage;
		}

		summaryLog += '```';
		consoleLog += '```';

		this.sender(intro + summaryLog);
		console.log(chalk.gray(intro.replace(/\*/g, '') + consoleLog.replace(/`/g, '')));
	}

	// Formats the "Best in Each Market" summary
	logBestInMarket(bestBetsForTable) {
		const intro = `[Edgerunner] **BEST IN EACH MARKET**\n`;
		let tableLog = '```\n';
		tableLog += `Mkt         Sel              Val\n`;
		tableLog += `----------- ---------------- ---------\n`;

		bestBetsForTable.forEach(best => {
			if (!best || !isFinite(best.value)) return;
			let logSelectionName = best.bookmaker.selection.name;
			const specialValue = best.bookmaker.market.specialValue;
			if (specialValue && specialValue != 0) {
				logSelectionName = `${logSelectionName} ${specialValue}`;
			}
			const marketCol = best.marketName.padEnd(11);
			const selectionCol = logSelectionName.padEnd(16);
			const valueCol = `${best.value.toFixed(2)}%`;
			tableLog += `${marketCol} ${selectionCol} ${valueCol}\n`;
		});
		tableLog += '```';

		this.sender(intro + tableLog);
		console.log(intro + tableLog);
	}

	logGameHeader(providerData, sportIdMapper) {
		const sportName = sportIdMapper[providerData.sportId] || '❓ UNKNOWN SPORT';
		let gameHeader = '----------------------------------------\n';
		gameHeader += `Sport : ${sportName}\n`;
		gameHeader += `Match : ${providerData.home} vs ${providerData.away}\n`;
		gameHeader += '----------------------------------------';
		this.sender(`\`\`\`\n${gameHeader}\n\`\`\``);
	}

	logValueOpportunities(valueBets) {
		const intro = `✅ **[${valueBets.length}] VALUE OPPORTUNITIES FOUND**\n`;
		let summaryLog = '```\n';
		valueBets.forEach((bet, index) => {
			let logSelectionName = bet.selection.name;
			const specialValue = bet.market.specialValue;
			if (specialValue && specialValue !== 0) {
				logSelectionName = `${logSelectionName} ${specialValue}`;
			}
			summaryLog += `Market   : ${bet.market.name}\n`;
			summaryLog += `Selection: ${logSelectionName}\n`;
			summaryLog += `Odds     : @ ${bet.bookmakerOdds.toFixed(2)}\n`;
			summaryLog += `Value    : ${bet.value.toFixed(2)}%\n`;
			if (index < valueBets.length - 1) {
				summaryLog += '---\n';
			}
		});
		summaryLog += '```';
		this.sender(intro + summaryLog);
		console.log(chalk.green(intro + summaryLog.replace(/`/g, '')));
	}

	logSuccess(details) {
		const { detailedBookmakerData, valueBet, stakeAmount } = details;
		const intro = `✅ **Bet Placed Successfully!**\n`;
		let successMessage = '```\n';
		successMessage += `Match    : ${detailedBookmakerData.name}\n`;
		successMessage += `Bet      : ${valueBet.selection.name} ${valueBet.market.specialValue || ''} @ ${valueBet.selection.odd.value}\n`;
		successMessage += `Market   : ${valueBet.market.name}\n`;
		successMessage += `Value    : ${valueBet.value.toFixed(2)}%\n`;
		successMessage += `Stake    : ₦${stakeAmount.toFixed(2)}\n`;
		successMessage += '```';
		this.sender(intro + successMessage);
	}

	logPendingBet(details) {
		const { detailedBookmakerData, valueBet, stakeAmount } = details;
		const intro = `[Edgerunner] 📈 **PENDING BET**\n`;
		let log = '```\n';
		
		let logSelectionName = valueBet.selection.name;
		const specialValue = valueBet.market.specialValue;
		if (specialValue && specialValue !== 0) {
			logSelectionName = `${logSelectionName} ${specialValue}`;
		}

		log += `Match    : ${detailedBookmakerData.name}\n`;
		log += `Market   : ${valueBet.market.name}\n`;
		log += `Selection: ${logSelectionName} @ ${valueBet.bookmakerOdds.toFixed(2)}\n`;
		log += `Value    : ${valueBet.value.toFixed(2)}%\n`;
		log += `Stake    : ₦${stakeAmount.toFixed(2)}\n`;
		log += '```';

		this.sender(intro + log);
	}
}

export default Logger;
