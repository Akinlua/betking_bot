import { Router } from 'express';
import { getPollingStatus } from '../services/provider.service.js';

const router = Router();

// Example route to get the status of the provider/poller
router.get('/status', (req, res) => {
    const status = getPollingStatus();
    res.status(200).json(status);
});

export default router;
