import express from 'express';
import { deleteInvitation, getAllInvitations, inviteSupplier, respondToInvitation } from '../controllers/invitationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/invitation - Get all invitations
router.get('/', authenticate, getAllInvitations);

// POST /api/invitation - Create new invitation
router.post('/', authenticate, inviteSupplier);

// POST /api/invitation/respond - Respond to invitation
router.post('/respond', respondToInvitation);

// POST /api/invitation/respond - Respond to invitation
router.get('/respond', respondToInvitation);

router.delete('/delete/:id', authenticate, deleteInvitation);

export default router;
