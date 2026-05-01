import { Router } from 'express';
import contactController, { csvUpload } from '../controllers/ContactController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// All contact routes require a valid JWT
router.use(authMiddleware);

/**
 * @openapi
 * /api/contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, name]
 *             properties:
 *               phoneNumber: { type: string, example: "5511999990001" }
 *               name:        { type: string, example: "João da Silva" }
 *     responses:
 *       201: { description: Contact created. }
 *       400: { description: Invalid phone number format. }
 *       409: { description: Phone already registered for this account. }
 */
router.post('/', contactController.create.bind(contactController));

/**
 * @openapi
 * /api/contacts:
 *   get:
 *     summary: List contacts (paginated)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: onlyActive
 *         schema: { type: boolean }
 *         description: Filter by active contacts only.
 *     responses:
 *       200:
 *         description: Paginated list of contacts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:       { type: array }
 *                 total:      { type: integer }
 *                 page:       { type: integer }
 *                 limit:      { type: integer }
 *                 totalPages: { type: integer }
 */
router.get('/', contactController.findAll.bind(contactController));

/**
 * @openapi
 * /api/contacts/import:
 *   post:
 *     summary: Import contacts via CSV file
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "CSV with columns: name, phoneNumber"
 *     responses:
 *       201:
 *         description: Import summary (imported, skipped, errors).
 *       422:
 *         description: Invalid CSV format.
 */
router.post('/import', csvUpload.single('file'), contactController.importCsv.bind(contactController));

/**
 * @openapi
 * /api/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:   { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200: { description: Contact updated. }
 *       404: { description: Not found. }
 */
router.put('/:id', contactController.update.bind(contactController));

/**
 * @openapi
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Contact deleted. }
 *       404: { description: Not found. }
 */
router.delete('/:id', contactController.remove.bind(contactController));

export default router;
