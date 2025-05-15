const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { connect } = require("../utils/sendEmail");
const transporter = connect();
const Appointment = require("../models/Appointment");
const Message = require("../models/Message");

exports.setRole = function (role) {
  return (req, res, next) => {
    req.body.roles = role;
    next();
  };
};

const oneTimePasswordCreator = () => {
  let password = crypto.randomBytes(32).toString("hex");
  return password;
};

const filterObj = (obj) => {
  const newObj = {};
  const notAllowed = ["email", "roles"];
  Object.keys(obj).forEach((el) => {
    if (!notAllowed.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

exports.allow = (...roles) => {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      next(new AppError("Admin-only access", 401));
    }
  };
};

exports.createTeacher = catchAsync(async (req, res, next) => {
  const user = {
    email: req.body.email,
    name: req.body.name,
    department: req.body.department,
    subject: req.body.subject,
    age: req.body.age,
    roles: req.body.roles,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  };

  // Check if a user with the same email already exists
  const existing = await User.findOne({ email: user.email });
  if (existing) {
    return res.status(400).json({
      status: "FAIL",
      message: "Email already in use",
    });
  }

  const newUser = await User.create(user);

  return res.status(200).json({
    status: "SUCCESS",
    data: {
      newUser,
    },
  });
});

exports.getAllTeachers = catchAsync(async (req, res, next) => {
  const users = await User.find({ roles: "teacher" }).populate("appointments");

  res.status(200).json({
    status: "SUCCESS",
    data: {
      users,
    },
  });
});

exports.getTeacher = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  res.status(200).json({
    status: "SUCCESS",
    data: {
      user,
    },
  });
});

exports.updateTeacher = catchAsync(async (req, res, next) => {
  const updateObj = filterObj(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, updateObj, {
    new: true,
  });

  res.status(200).json({
    status: "SUCCESS",
    data: {
      user,
    },
  });
});

exports.deleteTeacher = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  // Find the user to get the email or any identifier to delete appointments and messages
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      status: "FAIL",
      message: "User not found",
    });
  }

  // Delete the user
  await User.findByIdAndDelete(userId);

  // Delete appointments associated with the user
  await Appointment.deleteMany({ sendBy: user.email });

  // Delete messages associated with the user
  await Message.deleteMany({ $or: [{ from: user.email }, { to: user.email }] });

  res.status(200).json({
    status: "SUCCESS",
    message: "User, related appointments, and messages deleted",
  });
});

exports.approveStudent = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(
    req.params.id,
    { admissionStatus: true },
    { where: { roles: "student" } }
  );
  const studentEmail = await User.findById(req.params.id).select("email");
  // console.log("studentmail", studentEmail.email)
  let info = await transporter.sendMail({
    from: '"tutor-time@brevo.com',
    to: studentEmail.email,
    subject: "Appointment Accepted",
    html: `
    <h2>Congratulations!</h2>
    <p>Your account has been approved on TUTOR-TIME.</p>
    <p>You can now access all the features and resources available to students.</p>
    <p>Best regards,</p>
    <p>From TUTOR-TIME</p>
    `,
  });
  res.status(200).json({
    message: "Student Approved",
  });
});

// // for test by FH
// exports.approveStudent = catchAsync(async (req, res, next) => {
//   // Step 1: Find the student and ensure role is "student"
//   const student = await User.findOne({ _id: req.params.id, roles: "student" });

//   if (!student) {
//     return res.status(404).json({ message: "Student not found or not eligible for approval" });
//   }

//   // Step 2: Update admission status
//   student.admissionStatus = true;
//   await student.save();

//   // Step 3: Try to send approval email
//   try {
//     await transporter.sendMail({
//       from: '"eribookstore@gmail.com"',
//       to: student.email,
//       subject: "Account Approved - TUTOR-TIME",
//       html: `
//         <h2>Congratulations!</h2>
//         <p>Your account has been approved on TUTOR-TIME.</p>
//         <p>You can now log in and access all the features available to students.</p>
//         <p>Best regards,<br/>TUTOR-TIME Team</p>
//       `,
//     });
//   } catch (error) {
//     console.error("❌ Email sending failed:", error.message);
//     // You may log this or continue silently — don't throw
//   }

//   // Step 4: Send successful response
//   res.status(200).json({ message: "Student approved successfully." });
// });



exports.deleteStudent = catchAsync(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: "SUCCESS",
    message: "Student deleted",
  });
});
