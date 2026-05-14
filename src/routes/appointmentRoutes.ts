import { Router } from 'express';
import {
  createAppointment,
  createAppointmentByAdmin,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  completeAppointment,
  markNoShow,
  getAppointments,
  getMyAppointments,
  getAppointmentById
} from '../controllers/appointmentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRoleType } from '../types';

const router = Router();

const adminRoles: UserRoleType[] = ['super_admin', 'admin', 'branch_admin', 'vendor_admin'];
const staffRoles: UserRoleType[] = [...adminRoles, 'staff'];

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment management and scheduling
 */

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment (Customer)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branch
 *               - vendor
 *               - items
 *             properties:
 *               branch:
 *                 type: string
 *               vendor:
 *                 type: string
 *               bookingFeeAmount:
 *                 type: number
 *                 default: 50
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     serviceId:
 *                       type: string
 *                     staffId:
 *                       type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     amount:
 *                       type: number
 *                     durationMinutes:
 *                       type: number
 *     responses:
 *       201:
 *         description: Appointment created successfully
 */
router.post('/', authenticateToken, createAppointment);

/**
 * @swagger
 * /api/appointments/admin:
 *   post:
 *     summary: Create a new appointment by Admin
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - branch
 *               - vendor
 *               - items
 *             properties:
 *               customerId:
 *                 type: string
 *               branch:
 *                 type: string
 *               vendor:
 *                 type: string
 *               status:
 *                 type: string
 *                 default: "CONFIRMED"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Appointment created by admin
 */
router.post('/admin', authenticateToken, authorizeRoles(adminRoles), createAppointmentByAdmin);

/**
 * @swagger
 * /api/appointments/my:
 *   get:
 *     summary: Get my appointments (Customer)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of my appointments
 */
router.get('/my', authenticateToken, getMyAppointments);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Get all appointments (Admin/Staff)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of all appointments
 */
router.get('/', authenticateToken, authorizeRoles(staffRoles), getAppointments);

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Get appointment by ID
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment details
 */
router.get('/:id', authenticateToken, getAppointmentById);

/**
 * @swagger
 * /api/appointments/{id}/reschedule:
 *   put:
 *     summary: Reschedule an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 */
router.put('/:id/reschedule', authenticateToken, rescheduleAppointment);

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   put:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment cancelled
 */
router.put('/:id/cancel', authenticateToken, cancelAppointment);

/**
 * @swagger
 * /api/appointments/{id}/check-in:
 *   put:
 *     summary: Check-in for an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checked in successfully
 */
router.put('/:id/check-in', authenticateToken, authorizeRoles(staffRoles), checkIn);

/**
 * @swagger
 * /api/appointments/{id}/complete:
 *   put:
 *     summary: Complete an appointment
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment completed
 */
router.put('/:id/complete', authenticateToken, authorizeRoles(staffRoles), completeAppointment);

/**
 * @swagger
 * /api/appointments/{id}/no-show:
 *   put:
 *     summary: Mark appointment as No-Show
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment marked as No-Show
 */
router.put('/:id/no-show', authenticateToken, authorizeRoles(staffRoles), markNoShow);

export default router;
