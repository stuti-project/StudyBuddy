const jwt = require('jsonwebtoken');

const isAuthenticated = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ "msgm": "unauthorized" })
    }
    jwt.verify(token, process.env.jwt_secret, (error, payload) => {
        if (error) {
            console.log(error)
            return res.status(401).json({ "msgm": "unauthorized" })
        }
        req.userId = payload._id
        next()
    })
}

module.exports = { isAuthenticated }

