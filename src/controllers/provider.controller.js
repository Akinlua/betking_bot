import { getPollingStatus } from "../services/provider.service.js";

export function getProviderStatus(req, res) {
    try {
        const status = getPollingStatus();
        res.status(200).json({ success: true, status });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to get bot status." });
    }
}
