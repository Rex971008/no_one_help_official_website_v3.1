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
let users = []; // 儲存使用者 { id, username, password }
let userIdCounter = 1;

// 使用一個物件來儲存每個使用者的對話
// 鍵(key)是 userId，值(value)是該使用者的訊息陣列
// { '1': [{...}, {...}], '2': [{...}] }
let conversations = {};
let messageIdCounter = 1;

// ===============================================
//               使用者認證 API
// ===============================================

// --- API: 註冊 ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });
    }
    // 檢查用戶名是否已被使用
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(409).json({ success: false, message: '該用戶名已被註冊' });
    }
    const newUser = {
        id: userIdCounter++,
        username,
        password // 真實專案中，密碼需要加密！這裡為了簡單教學先用明文。
    };
    users.push(newUser);
    conversations[newUser.id.toString()] = []; // 為新用戶建立一個空的對話紀錄
    console.log(`新用戶註冊成功: ${username} (ID: ${newUser.id})`);
    res.status(201).json({ success: true, message: '註冊成功' });
});

// --- API: 登入 ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        console.log(`用戶登入成功: ${username}`);
        // 登入成功，回傳一個簡易的 "Token" (這裡我們直接用 userId)
        res.json({ success: true, message: '登入成功', token: user.id });
    } else {
        res.status(401).json({ success: false, message: '用戶名或密碼錯誤' });
    }
});

// ===============================================
//          新的客服訊息 API (需要認證)
// ===============================================
// 這是一個 "中介軟體"，用來保護需要登入才能訪問的 API
// 它會檢查請求的 Header 中是否有合法的 token (也就是 userId)
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ success: false, message: '未提供授權 token' });
    }
    // 簡單的驗證，檢查 token (userId) 是否存在
    const user = users.find(u => u.id.toString() === token);
    if (!user) {
        return res.status(403).json({ success: false, message: '無效的 token' });
    }
    // 將驗證過的 userId 存入 req 中，方便後續 API 使用
    req.userId = token;
    next(); // 驗證通過，繼續執行下一個函式 (真正的 API)
};

// --- API: 獲取特定使用者的訊息 ---
// 注意，我們在真正執行 API 之前，先執行了 authenticate 中介軟體
app.get('/api/messages', authenticate, (req, res) => {
    const userId = req.userId; // 從 authenticate 中介軟體取得
    const userConversation = conversations[userId] || [];
    res.json(userConversation);
});

// --- API: 特定使用者發送新訊息 ---
app.post('/api/message', authenticate, (req, res) => {
    const userId = req.userId;
    const { message } = req.body;

    const newMessage = {
        id: messageIdCounter++,
        customerMessage: message,
        staffReply: ''
    };
    conversations[userId].push(newMessage);

    console.log(`用戶 #${userId} 發送新訊息: ${message}`);
    res.status(201).json(newMessage);
});

// ===============================================
//              工作人員專用 API
// ===============================================
// (為了簡化，我們先不做工作人員的登入，假設他們能直接訪問)

// --- API: 工作人員獲取所有人的對話 ---
app.get('/api/admin/conversations', (req, res) => {
    // 格式化資料，方便前端使用
    const allConversations = Object.keys(conversations).map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        return {
            userId: userId,
            username: user ? user.username : '未知用戶',
            messages: conversations[userId]
        };
    });
    res.json(allConversations);
});

// --- API: 工作人員回覆訊息 ---
app.post('/api/admin/reply', (req, res) => {
    const { userId, messageId, replyText } = req.body;
    
    const userConversation = conversations[userId];
    if (!userConversation) {
        return res.status(404).json({ success: false, message: '找不到該用戶的對話' });
    }

    const messageToReply = userConversation.find(m => m.id === messageId);
    if (messageToReply) {
        messageToReply.staffReply = replyText;
        console.log(`工作人員回覆用戶 #${userId} 的訊息 #${messageId}: ${replyText}`);
        res.json({ success: true, updatedMessage: messageToReply });
    } else {
        res.status(404).json({ success: false, message: '在該用戶對話中找不到該訊息ID' });
    }
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`[多使用者版本] 伺服器正在 http://localhost:${port} 上運行`);
});