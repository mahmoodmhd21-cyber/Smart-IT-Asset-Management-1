/**
 * Authentication Controller
 * Handles user registration and login for the IT asset management system.
 *
 * Functions:
 * - registerUser: Register a new user account
 * - loginUser: Authenticate a user and return a JWT token
 * - getLoggedInUser: Return data for the currently authenticated user
 * - getAllUsers: Retrieve the admin account directory
 *
 * Assumes a Mongoose model named `User` exists at ../models/User
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

const { secret } = require('../config/auth');

const buildUserProfile = (user) => ({
  _id: user._id,
  id: user._id,
  fullName: user.fullName,
  name: user.fullName,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
  createdDate: user.createdDate,
});

// Register a new user account with hashed password
const registerUser = async (req, res) => {
  try {
    const { name, fullName, email, password, role } = req.body || {};
    const displayName = fullName || name;

    if (!displayName || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }


    if (!['Admin', 'IT Staff'].includes(role)) {
      return res.status(400).json({ message: 'Role must be Admin or IT Staff.' });
    }

    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName: displayName,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    return res.status(201).json({
      message: 'User registered successfully.',
      user: buildUserProfile(newUser),
    });
  } catch (error) {
    console.error('Register User Error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// Login a user and return a JWT token
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, tokenVersion: user.tokenVersion },
      secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    return res.status(200).json({
      token,
      user: buildUserProfile(user),
    });
  } catch (error) {
    console.error('Login User Error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

const getLoggedInUser = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return res.status(200).json({ user: buildUserProfile(req.user) });
};

// Admin-only account directory; never return password hashes or token versions.
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('_id fullName email role isActive');

    const formattedUsers = users.map(user => ({
      _id: user._id,
      id: user._id,
      fullName: user.fullName,
      name: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
    }));

    return res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Get All Users Error:', error.message);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// Allocation selection only needs identity, not the privileged account directory.
const getAssignees = async (req, res) => {
  try {
    const users = await User.find({ isActive: { $ne: false } }).select('_id fullName');
    return res.json(users.map(user => ({ id: user._id, name: user.fullName })));
  } catch {
    return res.status(500).json({ message: 'Could not load assignees.' });
  }
};

const updateUserAccess = async (req, res) => {
  const { id } = req.params;
  const { isActive, revokeSessions } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user ID.' });
  if (String(req.user._id).toLowerCase() === id.toLowerCase()) {
    return res.status(409).json({ message: 'Use another administrator to change your account access.' });
  }
  if ((isActive !== undefined && typeof isActive !== 'boolean') ||
      (revokeSessions !== undefined && revokeSessions !== true) ||
      (isActive === undefined && revokeSessions !== true) ||
      Object.keys(req.body).some(key => !['isActive', 'revokeSessions'].includes(key))) {
    return res.status(400).json({ message: 'Provide isActive (boolean) or revokeSessions: true.' });
  }
  try {
    // Atomic increment prevents concurrent revocations from restoring older tokens.
    const update = { $inc: { tokenVersion: 1 } };
    if (isActive !== undefined) update.$set = { isActive };
    const user = await User.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: buildUserProfile(user) });
  } catch {
    return res.status(500).json({ message: 'Could not update account access.' });
  }
};

// Account identity changes preserve history and invalidate existing sessions atomically.
const updateUser = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid user ID.' });
  if (String(req.user._id).toLowerCase() === id.toLowerCase()) return res.status(409).json({ message: 'Use another administrator to edit your account.' });
  if (!Object.keys(body).length || Object.keys(body).some(key => !['fullName', 'email', 'role'].includes(key))) {
    return res.status(400).json({ message: 'Only fullName, email and role may be edited.' });
  }
  if ((body.fullName !== undefined && (typeof body.fullName !== 'string' || !body.fullName.trim())) ||
      (body.email !== undefined && (typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email.trim()))) ||
      (body.role !== undefined && !['Admin', 'IT Staff'].includes(body.role))) {
    return res.status(400).json({ message: 'Provide a valid name, email and supported role.' });
  }
  const updates = { ...body };
  if (updates.fullName) updates.fullName = updates.fullName.trim();
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
  try {
    const user = await User.findByIdAndUpdate(id, { $set: updates, $inc: { tokenVersion: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user: buildUserProfile(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already exists.' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: 'Invalid account details.' });
    return res.status(500).json({ message: 'Could not update account.' });
  }
};

module.exports = {
  updateUser,
  registerUser,
  loginUser,
  getLoggedInUser,
  getAllUsers,
  getAssignees,
  updateUserAccess,
};
