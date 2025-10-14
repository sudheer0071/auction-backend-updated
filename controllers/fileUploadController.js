import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload single or multiple files
export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Get the backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8001';
    console.log('Backend URL:', backendUrl);

    // Process uploaded files and return their information
    const uploadedFiles = req.files.map(file => {
      const fileUrl = `${backendUrl}/uploads/documents/${file.filename}`;
      console.log('Generated file URL:', fileUrl);
      console.log('Absolute file path:', file.path);
      return {
        name: file.originalname,
        file_path: fileUrl, // URL for database/UI
        absolute_path: file.path, // Absolute path for email attachments
        file_size: file.size,
        mime_type: file.mimetype,
        version: 1,
        shared_with_all: true
      };
    });

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      message: 'Error uploading files',
      error: error.message
    });
  }
};

// Delete a file
export const deleteFile = async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ message: 'File path is required' });
    }

    // TODO: Implement file deletion logic
    // Be careful to validate the file path to prevent directory traversal attacks
    // Only delete files from the uploads directory

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      message: 'Error deleting file',
      error: error.message
    });
  }
};
