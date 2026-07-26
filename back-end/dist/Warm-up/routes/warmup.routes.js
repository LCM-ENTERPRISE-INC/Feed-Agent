"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const WarmupProfileController_1 = require("../controllers/WarmupProfileController");
const WarmupMetricsController_1 = require("../controllers/WarmupMetricsController");
const warmupRoutes = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
/**
 * @swagger
 * tags:
 *   name: Warmup
 *   description: Gerenciamento do ciclo de vida de aquecimento das instâncias do WhatsApp
 */
/**
 * @swagger
 * /api/warmup/{instanceId}/metrics:
 *   get:
 *     summary: Retrieve warmup metrics for an instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
warmupRoutes.get('/:instanceId/metrics', WarmupMetricsController_1.WarmupMetricsController.getMetrics);
/**
 * @swagger
 * /api/warmup/{instanceId}/start:
 *   post:
 *     summary: Start the warmup process for an instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warmup started
 */
warmupRoutes.post('/:instanceId/start', WarmupProfileController_1.WarmupProfileController.startWarmup);
/**
 * @swagger
 * /api/warmup/{instanceId}:
 *   get:
 *     summary: Get warmup profile status
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile retrieved
 */
warmupRoutes.get('/:instanceId', WarmupProfileController_1.WarmupProfileController.getProfile);
/**
 * @swagger
 * /api/warmup/{instanceId}/status:
 *   put:
 *     summary: Update warmup status manually (e.g. pause/resume)
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
warmupRoutes.put('/:instanceId/status', WarmupProfileController_1.WarmupProfileController.updateStatus);
/**
 * @swagger
 * /api/warmup/{instanceId}:
 *   delete:
 *     summary: Stop and delete warmup profile
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warmup stopped and deleted
 */
warmupRoutes.delete('/:instanceId', WarmupProfileController_1.WarmupProfileController.stopWarmup);
/**
 * @swagger
 * /api/warmup/{instanceId}/profile-picture:
 *   post:
 *     summary: Upload a profile picture for the instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture uploaded successfully
 */
warmupRoutes.post('/:instanceId/profile-picture', upload.single('image'), WarmupProfileController_1.WarmupProfileController.uploadProfilePicture);
/**
 * @swagger
 * /api/warmup/{instanceId}/about:
 *   put:
 *     summary: Update the about (status) text of the instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aboutText:
 *                 type: string
 *     responses:
 *       200:
 *         description: About text updated
 */
warmupRoutes.put('/:instanceId/about', WarmupProfileController_1.WarmupProfileController.updateAboutStatus);
exports.default = warmupRoutes;
