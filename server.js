/* 檔案: server.js (v4 - 新增使用者點餐與編輯API) */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================================
//        multer 檔案上傳設定 (無變動)
// ===============================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/') },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ storage: storage });

// ===============================================
//        資料庫結構 (In-Memory) (無變動)
// ===============================================
let users = [];
let userIdCounter = 1;
let conversations = {};
let messageIdCounter = 1;
let calendarEvents = {};

// ===============================================
//               使用者認證 API (無變動)
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
//          客服訊息 API (無變動)
// ===============================================
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) { return res.status(401).json({ success: false, message: '未提供授權 token' }); }
    const user = users.find(u => u.id.toString() === token);
    if (!user) { return res.status(403).json({ success: false, message: '無效的 token' }); }
    req.userId = user.id.toString();
    req.user = user;
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
//              工作人員專用 API (無變動)
// ===============================================
app.get('/api/admin/conversations', (req, res) => { /* ... */ });
app.post('/api/admin/reply', (req, res) => { /* ... */ });
app.post('/api/admin/calendar/event', upload.single('menuImage'), (req, res) => { /* ... */ });

// (為了讓程式碼簡潔，這裡省略了無變動的工作人員API內部實作，但它們實際上依然存在)
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
app.post('/api/admin/calendar/event', upload.single('menuImage'), (req, res) => {
    const { date, vendorName, menuType, menuContent, deadline } = req.body;
    if (!date || !vendorName || !menuType || !deadline) {
        return res.status(400).json({ success: false, message: '缺少必要欄位：date, vendorName, menuType, deadline' });
    }
    const newEvent = { date, vendorName, menuType, deadline, isClosed: false, orders: [], menuContent: '' };
    if (menuType === 'text') {
        if (!menuContent) return res.status(400).json({ success: false, message: '文字菜單模式下，menuContent 不能為空' });
        newEvent.menuContent = menuContent;
    } else if (menuType === 'image') {
        if (!req.file) return res.status(400).json({ success: false, message: '圖片菜單模式下，必須上傳菜單圖片' });
        newEvent.menuContent = `https://no-one-help-official-website-v3-1.onrender.com/uploads/${req.file.filename}`;
    } else {
        return res.status(400).json({ success: false, message: '無效的 menuType' });
    }
    calendarEvents[date] = newEvent;
    console.log(`[日曆系統] 已為 ${date} 新增活動，店家: ${vendorName}`);
    res.status(201).json({ success: true, message: '點餐活動已成功建立', event: newEvent });
});

// ===============================================
//        日曆點餐系統 API (擴充)
// ===============================================
// --- 公開 API ---
app.get('/api/calendar/events', (req, res) => {
    res.json(calendarEvents);
});

// --- **新增**: 使用者點餐/更新餐點的 API ---
app.post('/api/calendar/order', authenticate, (req, res) => {
    const { date, orderText } = req.body;
    const event = calendarEvents[date];

    // 1. 驗證
    if (!event) {
        return res.status(404).json({ success: false, message: '找不到該日期的點餐活動' });
    }
    if (event.isClosed || new Date() > new Date(event.deadline)) {
        return res.status(403).json({ success: false, message: '抱歉，點餐時間已截止' });
    }
    if (typeof orderText !== 'string') { // 允許空字串來刪除訂單
        return res.status(400).json({ success: false, message: '訂單內容格式不正確' });
    }

    // 2. 尋找或更新訂單
    const orderIndex = event.orders.findIndex(o => o.userId === req.userId);
    
    if (orderText.trim() === "") { // 如果內容是空的，視為刪除訂單
        if (orderIndex > -1) {
            event.orders.splice(orderIndex, 1);
            console.log(`用戶 #${req.userId} (${req.user.username}) 已刪除其在 ${date} 的訂單。`);
            return res.json({ success: true, message: '訂單已成功刪除' });
        } else {
            // 本來就沒訂單，也回傳成功
            return res.json({ success: true, message: '沒有需要刪除的訂單' });
        }
    }

    if (orderIndex > -1) {
        // 更新現有訂單
        event.orders[orderIndex].orderText = orderText;
        event.orders[orderIndex].timestamp = new Date().toISOString();
        console.log(`用戶 #${req.userId} (${req.user.username}) 已更新其在 ${date} 的訂單。`);
        res.json({ success: true, message: '訂單已成功更新', order: event.orders[orderIndex] });
    } else {
        // 新增訂單
        const newOrder = {
            userId: req.userId,
            username: req.user.username,
            orderText: orderText,
            timestamp: new Date().toISOString()
        };
        event.orders.push(newOrder);
        console.log(`用戶 #${req.userId} (${req.user.username}) 已新增訂單至 ${date} 活動。`);
        res.status(201).json({ success: true, message: '訂單已成功送出', order: newOrder });
    }
});


app.listen(port, () => {
    console.log(`[多使用者版本] 伺服器正在 http://localhost:${port} 上運行`);
    const fs = require('fs');
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)){ fs.mkdirSync(uploadsDir); console.log("已建立 'uploads' 資料夾。"); }
});