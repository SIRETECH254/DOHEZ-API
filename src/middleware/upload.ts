import multer from 'multer';

// Use memory storage for general form data
const upload = multer({ storage: multer.memoryStorage() });

export default upload;
