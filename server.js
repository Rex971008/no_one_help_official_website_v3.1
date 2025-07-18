/* 檔案: server.js (v4.1 - 繁體中文修正版) */

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ===============================================
//       V4 升級版資料庫結構 (In-Memory)
// ===============================================
let users = []; 
let userIdCounter = 1;
let conversations = {};
let messageIdCounter = 1;

// ★ 升級：每日菜單現在是一個物件，包含一個菜單陣列和截止狀態
// 結構: { 'YYYY-MM-DD': { isClosed: false, menus: [{ menuId: 1, vendor: '店家A', menuText: '...' }] }, ... }
let dailyMenus = {};
let menuIdCounter = 1;

// ★ 訂單資料庫
// 結構: { 'YYYY-MM-DD': { userId: '訂單內容' }, ... }
let orders = {};

// ===============================================
//           使用者認證 API (繁體)
// ===============================================
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });
    }
    if (users.find(u => u.username === username)) {
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

const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: '未提供授權 token' });
    
    const user = users.find(u => u.id.toString() === token);
    if (!user) return res.status(403).json({ success: false, message: '無效的 token' });
    
    req.userId = token;
    next();
};

// ===============================================
//          客服訊息 API (繁體)
// ===============================================
app.get('/api/messages', authenticate, (req, res) => {
    res.json(conversations[req.userId] || []);
});
app.post('/api/message', authenticate, (req, res) => {
    const newMessage = { id: messageIdCounter++, customerMessage: req.body.message, staffReply: '' };
    if (!conversations[req.userId]) {
        conversations[req.userId] = [];
    }
    conversations[req.userId].push(newMessage);
    res.status(201).json(newMessage);
});

// ===============================================
//       ★ V4 月曆菜單 API (繁體) ★
// ===============================================
// API: (任何人) 獲取月份的菜單摘要 (包含截止狀態和使用者是否有訂單)
app.get('/api/calendar/summary/:year/:month', authenticate, (req, res) => {
    const { year, month } = req.params;
    const userId = req.userId; // 從認證中介軟體取得
    
    const summary = {};
    for (const date in dailyMenus) {
        if (date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
            const hasOrder = !!(orders[date] && orders[date][userId]);
            summary[date] = {
                hasMenu: true,
                isClosed: dailyMenus[date].isClosed,
                hasOrder: hasOrder
            };
        }
    }
    res.json(summary);
});

// API: (任何人) 獲取某一天的具體菜單
app.get('/api/calendar/menu/:date', (req, res) => {
    const { date } = req.params;
    const menuData = dailyMenus[date];
    if (menuData) {
        res.json(menuData);
    } else {
        res.status(404).json({ message: '該日期沒有菜單' });
    }
});

// ===============================================
//        ★ V4 訂單管理 API (繁體) ★
// ===============================================
app.get('/api/orders/:date', authenticate, (req, res) => {
    const { date } = req.params;
    const dailyOrder = orders[date] ? orders[date][req.userId] : null;
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

    if (dailyMenus[date] && dailyMenus[date].isClosed) {
        return res.status(403).json({ success: false, message: '本日點餐已截止，無法修改或新增訂單' });
    }
    
    if (!orders[date]) {
        orders[date] = {};
    }
    orders[date][userId] = orderText;

    console.log(`用戶 #${userId} 在 ${date} 的訂單已更新為: ${orderText}`);
    res.status(200).json({ success: true, message: '訂單已儲存' });
});

// ===============================================
//           ★ V4 工作人員專用 API (繁體) ★
// ===============================================
// ... 客服相關API ...
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
    const conv = conversations[userId];
    if (!conv) return res.status(404).json({ success: false, message: '找不到該用戶的對話' });
    const msg = conv.find(m => m.id === messageId);
    if (msg) {
        msg.staffReply = replyText;
        res.json({ success: true, updatedMessage: msg });
    } else {
        res.status(404).json({ success: false, message: '找不到該訊息' });
    }
});

// --- API ★: (工作人員) 新增某一天的菜單 ---
app.post('/api/admin/menu/:date', (req, res) => {
    const { date } = req.params;
    const { menuText, vendor } = req.body;
    
    if (!dailyMenus[date]) {
        dailyMenus[date] = { isClosed: false, menus: [] };
    }
    
    const newMenu = { menuId: menuIdCounter++, vendor, menuText };
    dailyMenus[date].menus.push(newMenu);
    
    console.log(`管理員已於 ${date} 新增菜單 (店家: ${vendor})`);
    res.status(201).json({ success: true, message: '新菜單已新增', newMenu });
});

// --- API ★: (工作人員) 刪除某一天的某個菜單 ---
app.delete('/api/admin/menu/:date/:menuId', (req, res) => {
    const { date, menuId } = req.params;
    if (dailyMenus[date] && dailyMenus[date].menus) {
        dailyMenus[date].menus = dailyMenus[date].menus.filter(m => m.menuId !== parseInt(menuId));
        console.log(`管理員已於 ${date} 刪除菜單 ID #${menuId}`);
        res.status(200).json({ success: true, message: '菜單已刪除' });
    } else {
        res.status(404).json({ success: false, message: '找不到該日期的菜單' });
    }
});

// --- API ★: (工作人員) 切換某一天的點餐截止狀態 ---
app.post('/api/admin/menu/toggle-close/:date', (req, res) => {
    const { date } = req.params;
    if (dailyMenus[date]) {
        dailyMenus[date].isClosed = !dailyMenus[date].isClosed;
        console.log(`${date} 的點餐狀態已切換為: ${dailyMenus[date].isClosed ? '截止' : '開放'}`);
        res.status(200).json({ success: true, isClosed: dailyMenus[date].isClosed });
    } else {
        res.status(404).json({ success: false, message: '找不到該日期的菜單' });
    }
});

// --- API ★: (工作人員) 獲取某一天的所有訂單 ---
app.get('/api/admin/orders/:date', (req, res) => {
    const { date } = req.params;
    const dailyOrders = orders[date] || {};
    const formattedOrders = Object.keys(dailyOrders).map(userId => {
        const user = users.find(u => u.id.toString() === userId);
        return {
            userId: userId,
            username: user ? user.username : `用戶 #${userId}`,
            orderText: dailyOrders[userId]
        };
    });
    res.json(formattedOrders);
});

// ===============================================
//                 啟動伺服器
// ===============================================
app.listen(port, () => {
    console.log(`[v4.1 進階點餐系統] 伺服器正在 http://localhost:${port} 上運行`);
});