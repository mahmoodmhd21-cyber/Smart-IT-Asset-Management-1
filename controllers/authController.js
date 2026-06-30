/**
 * Authentication Controller
 * Handles user registration and login for the IT asset management system.
 *
 * Functions:
 * - registerUser: Register a new user account
 * - loginUser: Authenticate a user and return a JWT token
 *
 * Assumes a Mongoose model named `User` exists at ../models/User
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Register a new user account with hashed password
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
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
      fullName: name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully.', id: newUser._id, name: newUser.fullName, email: newUser.email, role: newUser.role });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

//Login a user and return a JWT token
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login User Error:', error.message);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

const getLoggedInUser = async (req, res) => {
  // Placeholder endpoint for the logged-in user.
  // Replace with authentication middleware that populates req.user.
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return res.status(200).json({ user: req.user });
};

module.exports = {
  registerUser,
  loginUser,
  getLoggedInUser,
};



