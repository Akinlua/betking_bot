import { lineTypeMapper } from "./betking.mapper.js";

export function normalizeTeamName(name) {
	if (!name) return '';
	// Split on spaces, slashes, hyphens
	const parts = name.toLowerCase().split(/[ \/-]/).filter(part => part);

	// Trim parts <=3 chars from front and rear
	let start = 0;
	let end = parts.length;

	while (start < end && parts[start].length < 3) {
		start++;
	}

	while (end > start && parts[end - 1].length < 3) {
		end--;
	}

	let meaningfulParts = parts.slice(start, end);

	// If no meaningful parts remain, use the longest original part
	if (!meaningfulParts.length) {
		meaningfulParts = [parts.reduce((longest, part) => part.length > longest.length ? part : longest, '')];
		console.log(`[Bookmaker] No meaningful parts, using longest: "${meaningfulParts[0]}"`);
	}

	// const keywordsToRemove = ['club', 'deportivo', 'deportes', 'santa'];
	// meaningfulParts = meaningfulParts.filter(part => !keywordsToRemove.includes(part));

	// Join parts and clean up
	let normalized = meaningfulParts.join(' ');
	normalized = normalized.replace(/[.-]/g, ' ');
	normalized = normalized.replace(/\s+/g, ' ');
	normalized = normalized.trim();

	console.log(`[Bookmaker] Final normalized name: "${normalized}"`);
	return normalized;
}

export function translateProviderData(providerData) {
	const mapping = lineTypeMapper[providerData.lineType];
	if (!mapping) {
		console.log(`[Bot - BOOKMAKER] Unsupported line type: ${providerData.lineType}`);
		return null;
	}

	const providerOutcomeKey = providerData.outcome.toLowerCase();
	const selectionName = mapping.outcome[providerOutcomeKey];
	if (!selectionName) {
		console.error(`[Bot] Unknown outcome: ${providerData.outcome} for line type ${providerData.lineType}`);
		return null;
	}

	const providerOutcomeName = `price${providerOutcomeKey.charAt(0).toUpperCase() + providerOutcomeKey.slice(1)}`;
	const odds = providerData[providerOutcomeName];
	if (!odds || isNaN(parseFloat(odds))) {
		console.error(`[Bot] Invalid odds for outcome: ${providerOutcomeKey}`);
		return null;
	}

	if (providerData.sportId === '1') {
		// Football: Handle all line types (money_line, total, spread)
		const sportMarkets = mapping.marketsBySport?.['1'] || {
			'0': providerData.lineType === 'total' ? 'Total Goals' : 'Handicap'
		};
		const marketName = providerData.lineType === 'total' ? sportMarkets['0'] : mapping.name;
		let betkingMarketName = providerData.lineType === 'total' ? `${marketName} ${providerData.points}` : marketName;
		let betkingSelectionName = selectionName;
		let betkingSpecialValue = providerData.lineType === 'total' ? providerData.points : null;

		if (providerData.lineType === 'spread') {
			// Spread Mapping for Football (sportId: '1'):
			// - points: "0", outcome: "home" → Draw No Bet, 1 DNB, specialValue: "0"
			// - points: "0", outcome: "away" → Draw No Bet, 2 DNB, specialValue: "0"
			// - points: "0.5", outcome: "home" → Double Chance, 1X, specialValue: "0"
			// - points: "0.5", outcome: "away" → Double Chance, X2, specialValue: "0"
			// - points: "n" (positive whole, n != 0), outcome: "home" → Handicap +n, Home, specialValue: "n:0"
			// - points: "-n" (negative whole), outcome: "home" → Handicap -n, Home, specialValue: "0:n"
			// - points: "n" (positive whole, n != 0), outcome: "away" → Handicap -n, Away, specialValue: "0:n"
			// - points: "-n" (negative whole), outcome: "away" → Handicap +n, Away, specialValue: "n:0"
			// - Other decimals (e.g., -0.5, -0.25, 0.75) return null until supported
			const points = parseFloat(providerData.points);
			if (!isNaN(points)) {
				if (points === 0) {
					betkingMarketName = 'Draw No Bet';
					betkingSelectionName = providerOutcomeKey === 'home' ? '1 DNB' : '2 DNB';
					betkingSpecialValue = '0';
				} else if (points === 0.5) {
					betkingMarketName = 'Double Chance';
					betkingSelectionName = providerOutcomeKey === 'home' ? '1X' : 'X2';
					betkingSpecialValue = '0';
				} else {
					// Whole-number handicaps
					if (Number.isInteger(points)) {
						if (providerOutcomeKey === 'home') {
							betkingSpecialValue = points < 0 ? `0:${-points}` : `${points}:0`;
							betkingSelectionName = 'Home';
						} else {
							betkingSpecialValue = points < 0 ? `${-points}:0` : `0:${points}`;
							betkingSelectionName = 'Away';
						}
						betkingMarketName = `Handicap ${points}`;
					} else {
						console.log(`[Bot] Quarter-goal handicap (${points}) not supported yet.`);
						return null; // Defer quarter-goals
					}
				}
			}
		}

		console.log(`[Bot] Translated Football: Sport=${providerData.sportId}, LineType=${providerData.lineType}, Outcome=${providerOutcomeKey}, Points=${providerData.points || 'N/A'}, Market=${betkingMarketName}, Selection=${betkingSelectionName}, Odds=${odds}`);
		return {
			marketName: betkingMarketName,
			selectionName: betkingSelectionName,
			points: providerData.points,
			specialValue: betkingSpecialValue,
			odds
		};
	}
	else if (providerData.sportId === '3') {
		// Basketball: Support total and spread bets
		if (!['total', 'spread'].includes(providerData.lineType)) {
			console.log(`[Bot] Unsupported basketball line type: ${providerData.lineType}. Only total and spread bets supported.`);
			return null;
		}

		// Set market name based on periodNumber and lineType
		const sportMarkets = mapping.marketsBySport?.['3'] || {
			'0': providerData.lineType === 'total' ? 'Total (Incl. Overtime)' : 'Handicap (Incl. Overtime)'
		};
		const periodNumber = providerData.periodNumber || '0';
		if (periodNumber !== '0') {
			console.log(`[Bot] Unsupported basketball period: ${periodNumber}. Only full-game (period 0) supported.`);
			return null;
		}
		let betkingMarketName = providerData.lineType === 'total' ? `${sportMarkets[periodNumber]} ${providerData.points}` : sportMarkets[periodNumber];
		let betkingSelectionName = selectionName; // Default: '1' for home, '2' for away
		let betkingSpecialValue = providerData.lineType === 'total' ? providerData.points : null;

		if (providerData.lineType === 'spread') {
			// Spread Mapping for Basketball (sportId: '3'):
			// - points: "0", outcome: "home" → DNB RT, 1 DNB, specialValue: "0"
			// - points: "0", outcome: "away" → DNB RT, 2 DNB, specialValue: "0"
			// - points: "n" (positive whole or decimal), outcome: "home" → Handicap (Incl. Overtime) +n, 1 AH, specialValue: "n : 0"
			// - points: "-n" (negative whole or decimal), outcome: "home" → Handicap (Incl. Overtime) -n, 1 AH, specialValue: "0 : |n|"
			// - points: "n" (positive whole or decimal), outcome: "away" → Handicap (Incl. Overtime) -n, 2 AH, specialValue: "0 : |n|"
			// - points: "-n" (negative whole or decimal), outcome: "away" → Handicap (Incl. Overtime) +n, 2 AH, specialValue: "|n| : 0"
			const points = parseFloat(providerData.points);
			if (!isNaN(points)) {
				if (points === 0) {
					betkingMarketName = 'DNB RT';
					betkingSelectionName = providerOutcomeKey === 'home' ? '1 DNB' : '2 DNB';
					betkingSpecialValue = '0';
				} else {
					betkingMarketName = `Handicap (Incl. Overtime) ${points}`;
					if (providerOutcomeKey === 'home') {
						betkingSpecialValue = points < 0 ? `0 : ${Math.abs(points)}` : `${Math.abs(points)} : 0`;
						betkingSelectionName = '1 AH';
					} else {
						betkingSpecialValue = points < 0 ? `${Math.abs(points)} : 0` : `0 : ${Math.abs(points)}`;
						betkingSelectionName = '2 AH';
					}
				}
			}
		}

		console.log(`[Bot] Translated Basketball: Sport=${providerData.sportId}, LineType=${providerData.lineType}, Period=${periodNumber}, Outcome=${providerOutcomeKey}, Points=${providerData.points || 'N/A'}, Market=${betkingMarketName}, Selection=${betkingSelectionName}, Odds=${odds}`);
		return {
			marketName: betkingMarketName,
			selectionName: betkingSelectionName,
			points: providerData.points,
			periodNumber: periodNumber,
			specialValue: betkingSpecialValue,
			odds
		};
	}

	// Fallback for unsupported sports
	console.log(`[Bot] Unsupported sportId: ${providerData.sportId}. Using generic mapping.`);
	return {
		marketName: mapping.name,
		selectionName: selectionName,
		points: providerData.points,
		odds: odds,
	};
}
