const express = require('express');
const {
  registerUser,
  loginUser,
  getLoggedInUser,
  getAllUsers,
  getAssignees,
  updateUserAccess,
  updateUser,
} = require('../controllers/authController');

const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * Auth Routes
 * Defines authentication endpoints and connects them to the auth controller.
 *
 * Routes:
 * - POST /register -> Register a new user
 * - POST /login -> Authenticate a user and return a token
 * - GET /me -> Retrieve the currently logged-in user
 */

// Register a new user account
router.post('/register', protect, authorize('Admin'), registerUser);

// Authenticate a user and return a JWT token
router.post('/login', loginUser);

// Return the currently logged-in user
router.get('/me', protect, getLoggedInUser);

router.get('/users', protect, authorize('Admin'), getAllUsers);
router.patch('/users/:id/access', protect, authorize('Admin'), updateUserAccess);
router.patch('/users/:id', protect, authorize('Admin'), updateUser);
router.get('/assignees', protect, authorize('Admin', 'IT Staff'), getAssignees);

module.exports = router;
