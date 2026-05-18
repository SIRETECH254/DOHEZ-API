import express from 'express';
import upload from '../middleware/upload';
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch
} from '../controllers/branchController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, createBranch);
router.get('/', getBranches);
router.get('/:branchId', getBranchById);
router.put('/:branchId', authenticateToken, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), updateBranch);
router.delete('/:branchId', authenticateToken, deleteBranch);

export default router;
