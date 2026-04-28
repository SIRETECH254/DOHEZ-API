import express from 'express';
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
router.put('/:branchId', authenticateToken, updateBranch);
router.delete('/:branchId', authenticateToken, deleteBranch);

export default router;
