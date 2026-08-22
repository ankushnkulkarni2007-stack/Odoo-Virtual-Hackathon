/**
 * Authentication Controller
 * Handle user registration and login logic here
 */

// Register a new user
const register = async (req, res) => {
  try {
    // Validation already done by middleware, so req.body is clean
    const { name, employeeId, email, password, role } = req.body;

    // TODO: Hash password with bcrypt
    // TODO: Create user in database
    // TODO: Send verification email

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: {
        name,
        email,
        role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Validation already done by middleware
    const { email, password } = req.body;

    // TODO: Find user by email in database
    // TODO: Compare password with bcrypt
    // TODO: Generate JWT token
    // TODO: Return token to client

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: 'JWT_TOKEN_HERE',
        user: {
          email,
          role: 'employee',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
};

module.exports = { register, login };
