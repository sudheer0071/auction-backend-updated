import express from 'express';
import upload from '../middleware/upload.js';
import { uploadFiles, deleteFile } from '../controllers/fileUploadController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Upload multiple files (requires authentication)
router.post('/', authenticate, upload.array('files', 10), uploadFiles);

// Delete a file (requires authentication)
router.delete('/', authenticate, deleteFile);

export default router;
