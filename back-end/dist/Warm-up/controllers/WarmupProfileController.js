"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupProfileController = void 0;
const boom_1 = require("@hapi/boom");
const WarmupProfileService_1 = require("../services/WarmupProfileService");
const WarmupBaileysService_1 = require("../services/WarmupBaileysService");
const client_1 = require("@prisma/client");
const WhatsAppInstanceManager_1 = __importDefault(require("../../services/WhatsAppInstanceManager"));
class WarmupProfileController {
    static async startWarmup(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const data = { ...req.body, instanceId };
            const profile = await WarmupProfileService_1.WarmupProfileService.startWarmup(data);
            res.status(201).json(profile);
        }
        catch (error) {
            next(error);
        }
    }
    static async getProfile(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceId);
            res.status(200).json(profile);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateStatus(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const { status, reason } = req.body;
            if (!Object.values(client_1.WarmupStatus).includes(status)) {
                return res.status(400).json({ error: 'Invalid WarmupStatus provided' });
            }
            const updatedProfile = await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceId, status, reason);
            res.status(200).json(updatedProfile);
        }
        catch (error) {
            next(error);
        }
    }
    static async stopWarmup(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const result = await WarmupProfileService_1.WarmupProfileService.stopWarmup(instanceId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }
    static async uploadProfilePicture(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            if (!req.file) {
                throw new boom_1.Boom('No image file provided', { statusCode: 400 });
            }
            const instance = WhatsAppInstanceManager_1.default.getInstance(parseInt(instanceId, 10));
            if (!instance || !instance.getClient()) {
                throw new boom_1.Boom('WhatsApp client not connected', { statusCode: 400 });
            }
            await WarmupBaileysService_1.WarmupBaileysService.updateProfilePicture(instance.getClient(), req.file.buffer);
            // Auditing
            await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceId, client_1.WarmupStatus.PAUSED, 'Profile picture updated (Auto-Pause)');
            res.status(200).json({ success: true, message: 'Profile picture updated successfully.' });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateAboutStatus(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const { text } = req.body;
            if (!text || typeof text !== 'string') {
                throw new boom_1.Boom('Text status is required and must be a string', { statusCode: 400 });
            }
            const instance = WhatsAppInstanceManager_1.default.getInstance(parseInt(instanceId, 10));
            if (!instance || !instance.getClient()) {
                throw new boom_1.Boom('WhatsApp client not connected', { statusCode: 400 });
            }
            await WarmupBaileysService_1.WarmupBaileysService.updateProfileStatus(instance.getClient(), text);
            // Auditing
            await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceId, client_1.WarmupStatus.PAUSED, 'About status updated (Auto-Pause)');
            res.status(200).json({ success: true, message: 'About status updated successfully.' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.WarmupProfileController = WarmupProfileController;
