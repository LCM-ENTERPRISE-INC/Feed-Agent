import { Router } from 'express';
import whatsAppController from '../controllers/WhatsAppController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/whatsapp/instances
router.get('/instances', authMiddleware, whatsAppController.getInstances.bind(whatsAppController));

// POST /api/whatsapp/instances
router.post('/instances', authMiddleware, whatsAppController.createInstance.bind(whatsAppController));

// DELETE /api/whatsapp/instances/:id
router.delete('/instances/:id', authMiddleware, whatsAppController.deleteInstance.bind(whatsAppController));

// GET /api/whatsapp/instances/:id/stream
router.get('/instances/:id/stream', authMiddleware, whatsAppController.streamQr.bind(whatsAppController));

// POST /api/whatsapp/instances/:id/test-message
router.post('/instances/:id/test-message', authMiddleware, whatsAppController.sendTestMessage.bind(whatsAppController));

// POST /api/whatsapp/instances/:id/restart
router.post('/instances/:id/restart', authMiddleware, whatsAppController.restart.bind(whatsAppController));

// POST /api/whatsapp/instances/:id/logout
router.post('/instances/:id/logout', authMiddleware, whatsAppController.logout.bind(whatsAppController));

export default router;
