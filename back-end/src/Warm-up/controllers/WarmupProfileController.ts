import { Request, Response, NextFunction } from 'express';
import { Boom } from '@hapi/boom';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupBaileysService } from '../services/WarmupBaileysService';
import { CreateWarmupProfileDto } from '../dtos/warmup.dto';
import { WarmupStatus } from '@prisma/client';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';


export class WarmupProfileController {
  static async startWarmup(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const data: CreateWarmupProfileDto = { ...req.body, instanceId };
      
      const profile = await WarmupProfileService.startWarmup(data);
      res.status(201).json(profile);
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const profile = await WarmupProfileService.getProfile(instanceId);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const { status, reason } = req.body;

      if (!Object.values(WarmupStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid WarmupStatus provided' });
      }

      const updatedProfile = await WarmupProfileService.updateStatus(instanceId, status as WarmupStatus, reason);
      res.status(200).json(updatedProfile);
    } catch (error) {
      next(error);
    }
  }

  static async stopWarmup(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const result = await WarmupProfileService.stopWarmup(instanceId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async uploadProfilePicture(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      
      if (!req.file) {
        throw new Boom('No image file provided', { statusCode: 400 });
      }

      const instance = whatsAppInstanceManager.getInstance(parseInt(instanceId, 10));
      
      if (!instance || !instance.getSocket()) {
        throw new Boom('WhatsApp socket not connected', { statusCode: 400 });
      }

      await WarmupBaileysService.updateProfilePicture(instance.getSocket()!, req.file.buffer);

      // Auditing
      await WarmupProfileService.updateStatus(instanceId, WarmupStatus.PAUSED, 'Profile picture updated (Auto-Pause)');
      
      res.status(200).json({ success: true, message: 'Profile picture updated successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async updateAboutStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        throw new Boom('Text status is required and must be a string', { statusCode: 400 });
      }

      const instance = whatsAppInstanceManager.getInstance(parseInt(instanceId, 10));
      
      if (!instance || !instance.getSocket()) {
        throw new Boom('WhatsApp socket not connected', { statusCode: 400 });
      }

      await WarmupBaileysService.updateProfileStatus(instance.getSocket()!, text);

      // Auditing
      await WarmupProfileService.updateStatus(instanceId, WarmupStatus.PAUSED, 'About status updated (Auto-Pause)');
      
      res.status(200).json({ success: true, message: 'About status updated successfully.' });
    } catch (error) {
      next(error);
    }
  }
}


