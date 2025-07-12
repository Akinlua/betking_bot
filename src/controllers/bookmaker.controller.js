// CORRECTED IMPORT PATH
import {
    getBetKingTeamDataByName,
    getBetKingMatchDataByTeamPair,
    getBetKingTeamDataById,
} from '../services/bookmaker.service.js';

export const getBetKingTeamDataByNameController = async (req, res) => {
    const searchTerm = req.query.search;
    if (!searchTerm) {
        return res.status(400).json({ success: false, message: 'A "search" query parameter is required.' });
    }
    try {
        const matches = await getBetKingTeamDataByName(searchTerm);
        if (matches && matches.length > 0) {
            res.status(200).json({ success: true, data: matches });
        } else {
            res.status(404).json({ success: false, message: `No matches found for search term "${searchTerm}".` });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

export const getBetKingMatchDataByTeamPairController = async (req, res) => {
    const { home, away } = req.query;
    if (!home || !away) {
        return res.status(400).json({ success: false, message: 'Both "home" and "away" query parameters are required.' });
    }
    try {
        const matchData = await getBetKingMatchDataByTeamPair(home, away);
        if (matchData) {
            res.status(200).json({ success: true, data: matchData });
        } else {
            res.status(404).json({ success: false, message: `No match found for ${home} vs ${away}.` });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};

export const getBetKingTeamDataByIdController = async (req, res) => {
    const { matchId } = req.params;
    if (!matchId) {
        return res.status(400).json({ success: false, message: 'A matchId parameter is required.' });
    }
    try {
        const matchData = await getBetKingTeamDataById(matchId);
        if (matchData) {
            res.status(200).json({ success: true, data: matchData });
        } else {
            res.status(404).json({ success: false, message: `No match found for ID "${matchId}".` });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
};
