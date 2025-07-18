/* 檔案: server.js (v2 - 多使用者版本) */

const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ===============================================
//        新的資料庫結構 (In-Memory)
// ===============================================
let users = [];
let userIdCounter = 1;
let conversations = {};
let messageIdCounter = 1;

// ===============================================
//               使用者認證 API
// ===============================================

app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });
    }
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(409).json({ success: false, message: '該用戶名已被註冊' });
    }
    const newUser = { id: userIdCounter++, username, password };
    users.push(newUser);
    conversations[newUser.id.toString()] = [];
    console.log(`新用戶註冊成功: ${username} (ID: ${newUser.id})`);
    res.status(201).json({ success: true, message: '註冊成功' });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        console.log(`用戶登入成功: ${username}`);
        res.json({ success: true, message: '登入成功', token: user.id });
    } else {
        res.status(401).json({ success: false, message: '用戶名或密碼錯誤' });
    }
});

// ===============================================
//          新的客服訊息 API (需要認證)
// ===============================================
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) { return res.status(401).json({ success: false, message: '未提供授權 token' }); }
    const user = users.find(u => u.id.toString() === token);
    if (!user) { return res.status(403).json({ success: false, message: '無效的 token' }); }
    req.userId = token;
    next();
};

app.get('/api/messages', authenticate, (req, res) => {
    const userConversation = conversations[req.userId] || [];
    res.json(userConversation);
});

app.post('/api/message', authenticate, (req, res) => {
    const { message } = req.body;
    const newMessage = { id: messageIdCounter++, customerMessage: message, staffReply: '' };
    conversations[req.userId].push(newMessage);
    console.log(`用戶 #${req.userId} 發送新訊息: ${message}`);
    res.status(201).json(newMessage);
});

// ===============================================
//              工作人員專用 API
// ===============================================
app.get('/api/admin/conversations', (req, res) => {
    const allConversations = Object.keys(conversations).map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        return { userId, username: user ? user.username : '未知用戶', messages: conversations[userId] };
    });
    res.json(allConversations);
});

app.post('/api/admin/reply', (req, res) => {
    const { userId, messageId, replyText } = req.body;
    const userConversation = conversations[userId];
    if (!userConversation) { return res.status(404).json({ success: false, message: '找不到該用戶的對話' }); }
    const messageToReply = userConversation.find(m => m.id === messageId);
    if (messageToReply) {
        messageToReply.staffReply = replyText;
        console.log(`工作人員回覆用戶 #${userId} 的訊息 #${messageId}: ${replyText}`);
        res.json({ success: true, updatedMessage: messageToReply });
    } else {
        res.status(404).json({ success: false, message: '在該用戶對話中找不到該訊息ID' });
    }
});

app.listen(port, () => {
    console.log(`[多使用者版本] 伺服器正在 http://localhost:${port} 上運行`);
});