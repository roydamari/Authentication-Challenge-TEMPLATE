const ACCESS_TOKEN_SECRET = '123456';
const REFRESH_TOKEN_SECRET = '987654';
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();
app.use(express.json());

const USERS = [
    { email: "admin@email.com", name: "admin", password: "$2b$10$0H8MDbvg1d.BK.r54ASlS.cZ.KWOxDphQBrvL0TT1oD31y7bL.4qW", isAdmin: true }

];

const INFORMATION = [
    { user: "admin", info: 'admin info' }
];

let REFRESH_TOKENS = [];

app.post('/users/register', (req, res) => {
    if (USERS.find(user => user.email === req.body.email))
        return res.status(400).json({ message: "user already exists" })
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = {
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        isAdmin: false
    }
    USERS.push({ user: user.name, info: `${user.name} info` })
    res.status(201).json({ message: "Register Success" })
})