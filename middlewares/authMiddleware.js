const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(403).json({ message: "Access denied. No token provided." });

    try {
        console.log("Token received:", token); // Log the received token
        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        console.log("Decoded token:", decoded); 
        if (!decoded._id || !decoded.email) {
            return res.status(400).json({ message: "Invalid token structure: userId or email missing." });
        }
        req.user = decoded;

        next();
    } catch (error) {
        res.status(400).json({ message: "Invalid token." });
    }
};

module.exports = authMiddleware;
