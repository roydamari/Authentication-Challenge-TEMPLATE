const ACCESS_TOKEN_SECRET = '123456';
const REFRESH_TOKEN_SECRET = '987654';
const express = require('express');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const bcrypt = require('bcrypt');

const app = express();

// JSON server declared

app.use(express.json());

// morgan logger
morgan.token('body', (req, res) => JSON.stringify(req.body));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms :body :req[content-length]'));

// Temporary DB for USERS, db info and refresh tokens
const USERS = [
    { email: "admin@email.com", name: "admin", password: "$2b$10$0H8MDbvg1d.BK.r54ASlS.cZ.KWOxDphQBrvL0TT1oD31y7bL.4qW", isAdmin: true }

];

const INFORMATION = [
    { user: "admin", info: 'admin info' }
];

let REFRESH_TOKENS = [];

let OPTIONSMETHOD =
    [
        { method: "post", path: "/users/register", description: "Register, required: email, user, password", example: { email: "user@email.com", name: "user", password: "password" } },
        { method: "post", path: "/users/login", description: "Login, required: valid email and password", example: { email: "user@email.com", password: "password" } },
        { method: "post", path: "/users/token", description: "Renew access token, required: valid refresh token", example: { token: "\*Refresh Token\*" } },
        { method: "post", path: "/users/tokenValidate", description: "Access Token Validation, required: valid access token", example: { authorization: "Bearer \*Access Token\*" } },
        { method: "get", path: "/api/v1/information", description: "Access user's information, required: valid access token", example: { authorization: "Bearer \*Access Token\*" } },
        { method: "post", path: "/users/logout", description: "Logout, required: access token", example: { token: "\*Refresh Token\*" } },
        { method: "get", path: "/api/v1/users", description: "Get users DB, required: Valid access token of admin user", example: { authorization: "Bearer \*Access Token\*" } }
    ]

app.options('/', (req, res) => {
    let RestOptions;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        RestOptions = OPTIONSMETHOD.slice(0, 2)
        res.json(RestOptions)
    }
    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            RestOptions = OPTIONSMETHOD.slice(0, 3)
            res.json(RestOptions)
        } else req.decoded = decoded;
    })
    if (req.decoded.isAdmin) res.json(OPTIONSMETHOD)
    RestOptions = OPTIONSMETHOD.slice(0, 5)
    res.json(RestOptions)
})

//expose user authentication services

// validates new user info and adds to DB
app.post('/users/register', async (req, res) => {
    if (USERS.find(user => user.email === req.body.email)) return res.status(409).json({ message: 'user already exists' });
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = { name: req.body.name, email: req.body.email, password: hashedPassword, isAdmin: false };
    USERS.push(user);
    INFORMATION.push({ user: user.name, info: `${user.name} info` });
    res.status(201).json({ message: "Register Success" });
});


// Validates login details and returns access and refresh tokens
app.post('/users/login', async (req, res) => {
    const user = USERS.find(user => user.email === req.body.email);
    if (!user) return res.status(404).json({ message: 'cannot find user' });
    if (await bcrypt.compare(req.body.password, user.password)) {
        const accessToken = generateAccessToken(user);
        const refreshToken = jwt.sign(user, REFRESH_TOKEN_SECRET);
        REFRESH_TOKENS.push(refreshToken);
        res.json({ accessToken, refreshToken, userName: user.name, isAdmin: user.isAdmin });
    } else {
        res.status(403).json({ message: 'User or Password incorrect' });
    };
});

// function for access keys generation, uses server's secret key and user details.
function generateAccessToken(user) {
    return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '30s' });
};

// Validates access token with the server
function checkToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Access Token Required" });
    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid Access Token" });
        req.decoded = decoded;
        next();
    });
};

// Renew user session with refresh token - returns 
app.post('/users/token', (req, res) => {
    const refreshToken = req.body.token;
    if (!refreshToken) return res.status(401).json({ message: "Refresh Token Required" });
    if (!REFRESH_TOKENS.includes(refreshToken)) return res.status(403).json({ message: "Invalid Refresh Token" });
    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid Refresh Token" });
        const newUser = {
            name: decoded.name,
            email: decoded.email,
            password: decoded.password,
            isAdmin: decoded.isAdmin
        };
        const accessToken = generateAccessToken(newUser);
        res.json({ accessToken });
    });
});

// check if user's token still valid
app.post('/users/tokenValidate', checkToken, (req, res) => {
    res.json({ valid: true });
});

// logout user session - removes refresh token from DB
app.post('/users/logout', (req, res) => {
    if (!req.body.token) return res.sendStatus(400).json({ message: 'Refresh Token Required' });
    const refreshTokensLength = REFRESH_TOKENS.length;
    REFRESH_TOKENS = REFRESH_TOKENS.filter(token => token !== req.body.token);
    if (REFRESH_TOKENS.length === refreshTokensLength) return res.status(400).json({ message: 'Invalid Refresh Token' });
    res.status(200).json({ message: "User Logged Out Successfully" });
});

// Get DB info (admin permissions are not required)
app.get('/api/v1/information', checkToken, (req, res) => {
    if (req.decoded.isAdmin) res.json(INFORMATION);
    const userInfo = INFORMATION.filter(info => info.user === req.decoded.name);
    if (userInfo) {
        res.json(userInfo);
    } else ({ Authenticated: true, information: "none" });
});

// get All users - only admin can access
app.get('/api/v1/users', checkToken, (req, res) => {
    if (!req.decoded.isAdmin) return res.status(403).json({ message: "Admin Premissions Required" });
    res.json(USERS)
})

/// ERRORS SECTION

const unknownEndpointHandler = (req, res) => {
    res.status(404).send({ error: 'unknown endpoint' });
};

// handler of requests with unknown endpoint
app.use(unknownEndpointHandler);

const errorHandler = (err, req, res, next) => {
    console.error(err.message);

    // build here your error handler

    next(err);
};

// handler of requests with result to errors
app.use(errorHandler);

module.exports = app;