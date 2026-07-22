import { Router } from 'express';
import campaignController from '../controllers/CampaignController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/audience-preview', campaignController.audiencePreview.bind(campaignController));
router.post('/launch', campaignController.launch.bind(campaignController));
router.get('/history', campaignController.history.bind(campaignController));
router.get('/active', campaignController.active.bind(campaignController));
router.get('/events', campaignController.events.bind(campaignController));
router.get('/:id/progress', campaignController.progress.bind(campaignController));
router.get('/:id/jobs', campaignController.jobs.bind(campaignController));
router.post('/:id/pause', campaignController.pause.bind(campaignController));
router.post('/:id/resume', campaignController.resume.bind(campaignController));
router.post('/:id/cancel', campaignController.cancel.bind(campaignController));

export default router;
