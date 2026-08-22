/**
 * Employee Controller
 * Handle employee profile management, CRUD operations
 */

// Create a new employee (Admin only)
const create = async (req, res) => {
  try {
    // Validation already done by middleware
    const employeeData = req.body;

    // TODO: Create employee in database
    // TODO: Send welcome email

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employeeData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message,
    });
  }
};

// Get all employees (Admin/HR only)
const getAll = async (req, res) => {
  try {
    // TODO: Fetch all employees from database with pagination
    // TODO: Filter by department, status, etc. based on query params

    res.status(200).json({
      success: true,
      message: 'Employees retrieved',
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message,
    });
  }
};

// Get employee by ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch employee from database by ID
    // TODO: Check user permissions (own record or admin)

    res.status(200).json({
      success: true,
      message: 'Employee retrieved',
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message,
    });
  }
};

// Employee updates their own profile (address, phone, profile picture only)
const updateSelf = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // TODO: Verify user is updating their own profile
    // TODO: Update employee record in database with allowed fields only
    // TODO: If profile picture changed, handle image upload

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updateData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

// Admin updates employee profile (all fields)
const updateByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // TODO: Verify user is admin
    // TODO: Update employee record in database
    // TODO: Log changes for audit trail

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: updateData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message,
    });
  }
};

module.exports = {
  create,
  getAll,
  getById,
  updateSelf,
  updateByAdmin,
};
