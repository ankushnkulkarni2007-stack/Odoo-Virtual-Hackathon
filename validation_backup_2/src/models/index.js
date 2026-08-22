/**
 * Barrel file so controllers can import several models in one line:
 *   const { User, Employee, Leave } = require('../models');
 */
const User = require('./User');
const Employee = require('./Employee');
const Attendance = require('./Attendance');
const Leave = require('./Leave');
const Payroll = require('./Payroll');

module.exports = { User, Employee, Attendance, Leave, Payroll };
