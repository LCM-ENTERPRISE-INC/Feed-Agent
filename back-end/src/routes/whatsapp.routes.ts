import { Router } from 'express';
import whatsAppController from '../controllers/WhatsAppController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/whatsapp/status:
 *   get:
 *     summary: Get the current WhatsApp connection status
 *     description: >
 *       Returns the current state (connecting / open / close) and the Base64 QR
 *       Code PNG if the device is awaiting a scan. Use this for lightweight
 *       polling after the QR has been displayed.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status snapshot.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 state:       { type: string,  enum: [connecting, open, close] }
 *                 qrCode:      { type: string,  description: "Base64 PNG (only when connecting)" }
 *                 lastUpdated: { type: string,  format: date-time }
 */
router.get('/status', authMiddleware, whatsAppController.getStatus.bind(whatsAppController));

/**
 * @openapi
 * /api/whatsapp/qr/stream:
 *   get:
 *     summary: SSE stream for real-time QR Code and connection events
 *     description: >
 *       Opens a Server-Sent Events stream. Requires the JWT passed as the
 *       `token` query parameter (since EventSource does not support custom headers).
 *       Events: `qr`, `connected`, `disconnected`, `qr:timeout`, `heartbeat`.
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Valid JWT (Bearer token without the "Bearer " prefix).
 *     responses:
 *       200:
 *         description: SSE stream (text/event-stream).
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/qr/stream', authMiddleware, whatsAppController.streamQr.bind(whatsAppController));

/**
 * @openapi
 * /api/whatsapp/test-message:
 *   post:
 *     summary: Send a test message via WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, message]
 *             properties:
 *               phoneNumber: { type: string, example: "5511999990001" }
 *               message:     { type: string, example: "Hello from Feed Agent!" }
 *     responses:
 *       200:
 *         description: Message queued successfully.
 *       400:
 *         description: Invalid phone number or missing body fields.
 *       503:
 *         description: WhatsApp is not connected.
 */
router.post('/test-message', authMiddleware, whatsAppController.sendTestMessage.bind(whatsAppController));

export default router;
