import express from 'express';
import * as controller from './controller.js';
import * as authController from './auth.controller.js';

const router = express.Router();

router.post('/login', authController.login);
router.post('/bet', controller.placeBet);

export default router;
