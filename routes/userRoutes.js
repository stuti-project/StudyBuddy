const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { userRegistration,userLogin } = require("../controllers/userController");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/images/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

const upload = multer({ storage: storage });

router.post('/reg', upload.single("ProfilePicture"), userRegistration);
router.post('/login',userLogin);

module.exports = router;
