"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WhatsAppController_1 = __importDefault(require("../controllers/WhatsAppController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsPath = path_1.default.resolve(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsPath)) {
    fs_1.default.mkdirSync(uploadsPath, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsPath);
    },
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop() || 'bin';
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`);
    }
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
/**
 * @openapi
 * /api/whatsapp/instances:
 *   get:
 *     summary: Obter todas as instâncias do WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retorna a lista de instâncias conectadas e seus status.
 */
router.get('/instances', authMiddleware_1.authMiddleware, WhatsAppController_1.default.getInstances.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances:
 *   post:
 *     summary: Criar uma nova instância do WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Dispositivo 1"
 *     responses:
 *       201:
 *         description: Instância criada com sucesso.
 */
router.post('/instances', authMiddleware_1.authMiddleware, WhatsAppController_1.default.createInstance.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}:
 *   delete:
 *     summary: Remover uma instância do WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID numérico da instância
 *     responses:
 *       200:
 *         description: Instância removida com sucesso.
 */
router.delete('/instances/:id', authMiddleware_1.authMiddleware, WhatsAppController_1.default.deleteInstance.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/stream:
 *   get:
 *     summary: Obter stream SSE de status/QR Code da instância
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stream de Eventos (Server-Sent Events) contendo QR code ou status.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/instances/:id/stream', authMiddleware_1.authMiddleware, WhatsAppController_1.default.streamQr.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/messages/stream:
 *   get:
 *     summary: Obter stream SSE em tempo real das mensagens recebidas
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stream de Eventos contendo as novas mensagens recebidas em tempo real.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/instances/:id/messages/stream', authMiddleware_1.authMiddleware, WhatsAppController_1.default.streamMessages.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/messages:
 *   get:
 *     summary: Obter histórico de mensagens de um contato no MongoDB
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: contact
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensagens recuperadas com sucesso.
 */
router.get('/instances/:id/messages', authMiddleware_1.authMiddleware, WhatsAppController_1.default.getChatHistory.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/send-message:
 *   post:
 *     summary: Enviar mensagem de teste pelo WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, message]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "5511999999999"
 *               message:
 *                 type: string
 *                 example: "Olá! Isso é um teste."
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso.
 */
router.post('/instances/:id/send-message', authMiddleware_1.authMiddleware, WhatsAppController_1.default.sendMessage.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/send-media:
 *   post:
 *     summary: Enviar mídia/documento pelo WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [phoneNumber, file]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               caption:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Mídia enviada com sucesso.
 */
router.post('/instances/:id/send-media', authMiddleware_1.authMiddleware, upload.single('file'), WhatsAppController_1.default.sendMedia.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/restart:
 *   post:
 *     summary: Reiniciar sessão do WhatsApp para gerar um novo QR Code
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sessão reiniciada com sucesso.
 */
router.post('/instances/:id/restart', authMiddleware_1.authMiddleware, WhatsAppController_1.default.restart.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/logout:
 *   post:
 *     summary: Desconectar sessão ativa do WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Desconectado com sucesso.
 */
router.post('/instances/:id/logout', authMiddleware_1.authMiddleware, WhatsAppController_1.default.logout.bind(WhatsAppController_1.default));
/**
 * @openapi
 * /api/whatsapp/instances/{id}/connect:
 *   post:
 *     summary: Reconectar sessão pausada do WhatsApp sem pedir QR Code
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reconectando com sucesso.
 */
router.post('/instances/:id/connect', authMiddleware_1.authMiddleware, WhatsAppController_1.default.connect.bind(WhatsAppController_1.default));
exports.default = router;
