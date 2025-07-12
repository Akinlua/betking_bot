import { Router } from 'express';
import {
    getBetKingTeamDataByIdController,
    getBetKingTeamDataByNameController,
    getBetKingMatchDataByTeamPairController,
} from '../controllers/bookmaker.controller.js';

const router = Router();

// Route for ?search=Arsenal
router.get('/game', getBetKingTeamDataByNameController); 

// Route for ?home=...&away=...
router.get('/team-pair', getBetKingMatchDataByTeamPairController);

// Route for /12345
router.get('/:matchId', getBetKingTeamDataByIdController);

export default router;
