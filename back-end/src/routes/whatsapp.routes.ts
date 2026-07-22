import { Router } from 'express';
import whatsAppController from '../controllers/WhatsAppController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

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
router.get('/instances', authMiddleware, whatsAppController.getInstances.bind(whatsAppController));

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
router.post('/instances', authMiddleware, whatsAppController.createInstance.bind(whatsAppController));

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
router.delete('/instances/:id', authMiddleware, whatsAppController.deleteInstance.bind(whatsAppController));

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
router.get('/instances/:id/stream', authMiddleware, whatsAppController.streamQr.bind(whatsAppController));

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
router.get('/instances/:id/messages/stream', authMiddleware, whatsAppController.streamMessages.bind(whatsAppController));

/**
 * @openapi
 * /api/whatsapp/instances/{id}/test-message:
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
router.post('/instances/:id/test-message', authMiddleware, whatsAppController.sendTestMessage.bind(whatsAppController));

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
router.post('/instances/:id/restart', authMiddleware, whatsAppController.restart.bind(whatsAppController));

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
router.post('/instances/:id/logout', authMiddleware, whatsAppController.logout.bind(whatsAppController));

export default router;
