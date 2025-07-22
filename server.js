/* 檔案: server.js (v5.1 - 允許多活動版) */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================================
//        MongoDB 資料庫連線
// ===============================================
const dbURI = process.env.MONGODB_URI;
mongoose.connect(dbURI)
    .then(() => console.log('成功連接到 MongoDB Atlas！'))
    .catch((err) => console.error('無法連接到 MongoDB Atlas', err));

// ===============================================
//        Mongoose 資料庫模型 (Schema)
// ===============================================
const UserSchema = new mongoose.Schema({ /* ...無變動... */ });
const User = mongoose.model('User', UserSchema);
const MessageSchema = new mongoose.Schema({ /* ...無變動... */ });
const ConversationSchema = new mongoose.Schema({ /* ...無變動... */ });
const Conversation = mongoose.model('Conversation', ConversationSchema);
const OrderSchema = new mongoose.Schema({ /* ...無變動... */ });

// **【修正】** 移除 date 欄位的 unique: true 限制
const CalendarEventSchema = new mongoose.Schema({
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    vendorName: { type: String, required: true },
    menuType: { type: String, required: true }, // 'text' or 'image'
    menuContent: { type: String, required: true },
    deadline: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },
    orders: [OrderSchema],
});
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);

// 省略的無變動程式碼 (User, Conversation Schema)
Object.assign(UserSchema.obj, {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
Object.assign(MessageSchema.obj, {
    customerMessage: { type: String, required: true },
    staffReply: { type: String, default: '' },
});
Object.assign(ConversationSchema.obj, {
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    messages: [MessageSchema],
});
Object.assign(OrderSchema.obj, {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    orderText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

// ===============================================
//        Multer 檔案上傳設定 (無變動)
// ===============================================
const storage = multer.diskStorage({ /* ...無變動... */ });
const upload = multer({ storage: storage });
// 省略的無變動程式碼 (Multer)
Object.assign(storage.options, {
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// ===============================================
//               中介軟體 & API
// ===============================================
const authenticate = async (req, res, next) => { /* ...無變動... */ };
// 省略的無變動程式碼 (authenticate)
const authImpl = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: '未提供授權 token' });
    try {
        const user = await User.findById(token);
        if (!user) return res.status(403).json({ success: false, message: '無效的 token' });
        req.userId = user._id.toString();
        req.user = user;
        next();
    } catch (error) { res.status(500).json({ success: false, message: '伺服器錯誤' }); }
};
Object.assign(authenticate, { impl: authImpl }); // A bit of a trick to avoid re-typing
app.use('/api/auth/register', (req, res, next) => next()); // Not using authenticate here
app.use('/api/auth/login', (req, res, next) => next());
app.use('/api/messages', authenticate.impl);
app.use('/api/message', authenticate.impl);
app.use('/api/calendar/order', authenticate.impl);


// --- 使用者認證 API (無變動) ---
app.post('/api/auth/register', async (req, res) => { /* ...無變動... */ });
app.post('/api/auth/login', async (req, res) => { /* ...無變動... */ });

// --- 客服訊息 API (無變動) ---
app.get('/api/messages', async (req, res) => { /* ...無變動... */ });
app.post('/api/message', async (req, res) => { /* ...無變動... */ });

// --- 日曆點餐 API ---
// **【修正】** 這裡的邏輯需要改變，以處理同一天內有多個事件
app.get('/api/calendar/events', async (req, res) => {
    try {
        const events = await CalendarEvent.find({});
        // **【修正】** 轉換成 {'YYYY-MM-DD': [event1, event2, ...]} 格式
        const eventsObject = events.reduce((obj, event) => {
            if (!obj[event.date]) {
                obj[event.date] = [];
            }
            obj[event.date].push(event);
            return obj;
        }, {});
        res.json(eventsObject);
    } catch (error) {
        res.status(500).json({});
    }
});

// **【修正】** 點餐 API，需要用 event 的 _id 來精確指定是哪個活動
app.post('/api/calendar/order', authenticate.impl, async (req, res) => {
    try {
        // **【修正】** 前端現在必須傳送 eventId
        const { eventId, orderText } = req.body;
        if (!eventId) return res.status(400).json({ success: false, message: '缺少活動 ID' });

        const event = await CalendarEvent.findById(eventId);

        if (!event) return res.status(404).json({ success: false, message: '找不到該點餐活動' });
        if (event.isClosed || new Date() > new Date(event.deadline)) return res.status(403).json({ success: false, message: '抱歉，點餐時間已截止' });

        event.orders = event.orders.filter(order => order.userId !== req.userId);

        if (orderText.trim() !== "") {
            const newOrder = { userId: req.userId, username: req.user.username, orderText, timestamp: new Date() };
            event.orders.push(newOrder);
        }
        
        await event.save();
        
        const message = orderText.trim() !== "" ? '訂單已成功送出/更新' : '訂單已成功刪除';
        console.log(`用戶 #${req.userId} (${req.user.username}) 在活動 #${eventId} 操作訂單。`);
        res.json({ success: true, message });

    } catch (error) {
        res.status(500).json({ success: false, message: '訂餐操作失敗', error });
    }
});

// --- 工作人員專用 API ---
app.get('/api/admin/conversations', async (req, res) => { /* ...無變動... */ });
app.post('/api/admin/reply', async (req, res) => { /* ...無變動... */ });

// **【修正】** 修改建立活動的 API，從更新改為一律新增
app.post('/api/admin/calendar/event', upload.single('menuImage'), async (req, res) => {
    try {
        const { date, vendorName, menuType, menuContent, deadline } = req.body;
        if (!date || !vendorName || !menuType || !deadline) {
            return res.status(400).json({ success: false, message: '缺少必要欄位' });
        }

        let finalMenuContent = '';
        if (menuType === 'text') {
            if (!menuContent) return res.status(400).json({ success: false, message: '文字菜單內容不能為空' });
            finalMenuContent = menuContent;
        } else if (menuType === 'image') {
            if (!req.file) return res.status(400).json({ success: false, message: '必須上傳菜單圖片' });
            finalMenuContent = `https://no-one-help-official-website-v3-1.onrender.com/uploads/${req.file.filename}`;
        }
        
        // **【修正】** 從 findOneAndUpdate 改為直接 create
        const newEvent = await CalendarEvent.create({
            date, vendorName, menuType, menuContent: finalMenuContent, deadline
        });

        console.log(`[日曆系統] 已為 ${date} 新增一個新活動，店家: ${vendorName}`);
        res.status(201).json({ success: true, message: '新點餐活動已成功建立', event: newEvent });

    } catch (error) {
        console.error("活動建立失敗:", error);
        res.status(500).json({ success: false, message: '活動建立失敗', error: error.message });
    }
});

// 省略的無變動 API 實作
const apisToKeep = {
    '/api/auth/register': async (req, res) => { try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' }); const existingUser = await User.findOne({ username }); if (existingUser) return res.status(409).json({ success: false, message: '該用戶名已被註冊' }); const newUser = new User({ username, password }); await newUser.save(); const newConversation = new Conversation({ userId: newUser._id, username: newUser.username }); await newConversation.save(); console.log(`新用戶註冊成功: ${username} (ID: ${newUser._id})`); res.status(201).json({ success: true, message: '註冊成功' }); } catch (error) { res.status(500).json({ success: false, message: '註冊失敗', error }); } },
    '/api/auth/login': async (req, res) => { try { const { username, password } = req.body; const user = await User.findOne({ username, password }); if (user) { console.log(`用戶登入成功: ${username}`); res.json({ success: true, message: '登入成功', token: user._id.toString() }); } else { res.status(401).json({ success: false, message: '用戶名或密碼錯誤' }); } } catch (error) { res.status(500).json({ success: false, message: '登入失敗', error }); } },
    '/api/messages': async (req, res) => { try { const conversation = await Conversation.findOne({ userId: req.userId }); res.json(conversation ? conversation.messages : []); } catch (error) { res.status(500).json([]); } },
    '/api/message': async (req, res) => { try { const { message } = req.body; const conversation = await Conversation.findOne({ userId: req.userId }); const newMessage = { customerMessage: message }; conversation.messages.push(newMessage); await conversation.save(); console.log(`用戶 #${req.userId} 發送新訊息: ${message}`); res.status(201).json(conversation.messages[conversation.messages.length - 1]); } catch (error) { res.status(500).json({ success: false, message: '訊息發送失敗', error }); } },
    '/api/admin/conversations': async (req, res) => { try { const conversations = await Conversation.find({}); res.json(conversations); } catch (error) { res.status(500).json([]); } },
    '/api/admin/reply': async (req, res) => { try { const { userId, messageId, replyText } = req.body; const conversation = await Conversation.findOne({ userId }); if (!conversation) return res.status(404).json({ success: false, message: '找不到該用戶的對話' }); const messageToReply = conversation.messages.id(messageId); if (messageToReply) { messageToReply.staffReply = replyText; await conversation.save(); console.log(`工作人員回覆用戶 #${userId} 的訊息 #${messageId}: ${replyText}`); res.json({ success: true, updatedMessage: messageToReply }); } else { res.status(404).json({ success: false, message: '在該用戶對話中找不到該訊息ID' }); } } catch (error) { res.status(500).json({ success: false, message: '回覆失敗', error }); } },
};
for(const [path, handler] of Object.entries(apisToKeep)) app.post(path, handler) || app.get(path, handler);

// ===============================================
//           伺服器啟動 (無變動)
// ===============================================
app.listen(port, () => {
    console.log(`[MongoDB版] 伺服器正在 http://localhost:${port} 上運行`);
    const fs = require('fs');
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
});