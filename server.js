/* 檔案: server.js (v3.1 - 修正與整理版) */

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ===============================================
//         資料庫結構 (In-Memory)
// ===============================================
let users = [];
let userIdCounter = 1;
let conversations = {};
let messageIdCounter = 1;
let dailyMenus = {}; // 格式: { 'YYYY-MM-DD': { menuText: '...', vendor: '...' } }
let orders = {};     // 格式: { 'YYYY-MM-DD': { userId: '訂單內容' } }

// ===============================================
//               使用者認證 API
// ===============================================
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });
    if (users.find(u => u.username === username)) return res.status(409).json({ success: false, message: '該用戶名已被註冊' });
    
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
//          授權中介軟體 (Middleware)
// ===============================================
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: '未提供授權 token' });

    const user = users.find(u => u.id.toString() === token);
    if (!user) return res.status(403).json({ success: false, message: '無效的 token' });

    req.userId = token; // 將 userId 附加到請求物件上
    next();
};

// ===============================================
//          客服訊息 API (需授權)
// ===============================================
app.get('/api/messages', authenticate, (req, res) => {
    res.json(conversations[req.userId] || []);
});

app.post('/api/message', authenticate, (req, res) => {
    const { message } = req.body;
    if (!message || message.trim() === '') {
        return res.status(400).json({ error: '訊息不能為空' });
    }
    
    const newMessage = {
        id: messageIdCounter++,
        customerMessage: message,
        staffReply: ''
    };

    if (!conversations[req.userId]) {
        conversations[req.userId] = [];
    }
    
    conversations[req.userId].push(newMessage);
    console.log(`用戶 #${req.userId} 發送新訊息: ${message}`);
    res.status(201).json(newMessage);
});

// ===============================================
//          月曆菜單 API (公開)
// ===============================================
app.get('/api/calendar/menus', (req, res) => {
    const datesWithMenus = Object.keys(dailyMenus);
    res.json(datesWithMenus);
});

app.get('/api/calendar/menu/:date', (req, res) => {
    const { date } = req.params;
    const menu = dailyMenus[date];
    if (menu) {
        res.json(menu);
    } else {
        res.status(404).json({ message: '該日期沒有菜單' });
    }
});

// ===============================================
//          訂單管理 API (需授權)
// ===============================================
app.get('/api/orders/:date', authenticate, (req, res) => {
    const { date } = req.params;
    const userId = req.userId;
    const dailyOrder = orders[date] ? orders[date][userId] : null;

    if (dailyOrder) {
        res.json({ orderText: dailyOrder });
    } else {
        res.json({ orderText: null });
    }
});

app.post('/api/orders/:date', authenticate, (req, res) => {
    const { date } = req.params;
    const userId = req.userId;
    const { orderText } = req.body;

    if (!orders[date]) {
        orders[date] = {};
    }

    orders[date][userId] = orderText;
    console.log(`用戶 #${userId} 在 ${date} 的訂單已更新為: ${orderText}`);
    res.status(200).json({ success: true, message: '訂單已儲存' });
});

// ===============================================
//          工作人員專用 API (管理)
// ===============================================
app.get('/api/admin/conversations', (req, res) => {
    const allConversations = Object.keys(conversations).map(userId => ({
        userId: userId,
        username: (users.find(u => u.id.toString() === userId) || {}).username || `用戶 #${userId}`,
        messages: conversations[userId]
    }));
    res.json(allConversations);
});

app.post('/api/admin/reply', (req, res) => {
    const { userId, messageId, replyText } = req.body;
    const userConversation = conversations[userId];
    if (!userConversation) return res.status(404).json({ success: false, message: '找不到該用戶的對話' });
    
    const messageToReply = userConversation.find(m => m.id === messageId);
    if (messageToReply) {
        messageToReply.staffReply = replyText;
        console.log(`工作人員回覆用戶 #${userId} 的訊息 #${messageId}: ${replyText}`);
        res.json({ success: true, updatedMessage: messageToReply });
    } else {
        res.status(404).json({ success: false, message: '找不到該訊息ID' });
    }
});

app.post('/api/admin/menu/:date', (req, res) => {
    const { date } = req.params;
    const { menuText, vendor } = req.body;

    dailyMenus[date] = { menuText, vendor };
    console.log(`管理員已更新 ${date} 的菜單`);
    res.status(200).json({ success: true, message: '菜單已更新' });
});

app.get('/api/admin/orders/:date', (req, res) => {
    const { date } = req.params;
    const dailyOrders = orders[date] || {};

    const formattedOrders = Object.keys(dailyOrders).map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        return {
            userId: userId,
            username: user ? user.username : `用戶 #${userId}`,
            orderText: dailyOrders[userId]
        }
    });
    res.json(formattedOrders);
});

// ===============================================
//                 啟動伺服器
// ===============================================
app.listen(port, () => {
    console.log(`[v3.1 點餐系統] 伺服器正在 http://localhost:${port} 上運行`);
});