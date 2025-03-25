const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { userRegistration, userLogin, sendResetCode, verifyResetCode, resetPassword,getalldata,searchUsers } = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/images/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

router.post('/reg', upload.single("ProfilePicture"), userRegistration); // 🔥 No authMiddleware
router.post('/login', userLogin); // 🔥 No authMiddleware
router.post('/send-reset-code', sendResetCode);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);
router.get('/details',getalldata);
router.get("/search-users", searchUsers);

module.exports = router;
