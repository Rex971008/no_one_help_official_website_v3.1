/* 檔案: server.js (v5.0 - 持久化資料庫 MongoDB 整合版) */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 提供 uploads 資料夾中的靜態檔案
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================================
//        MongoDB 資料庫連線
// ===============================================
// 從環境變數讀取連線字串，這是最佳實踐
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
    .then(() => console.log('成功連接到 MongoDB Atlas！'))
    .catch((err) => console.error('無法連接到 MongoDB Atlas', err));

// ===============================================
//        Mongoose 資料庫模型 (Schema)
// ===============================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    customerMessage: { type: String, required: true },
    staffReply: { type: String, default: '' },
    // 不再需要手動的 id，MongoDB 會自動生成 _id
});

const ConversationSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    messages: [MessageSchema], // 嵌入訊息子文件
});
const Conversation = mongoose.model('Conversation', ConversationSchema);


const OrderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    orderText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const CalendarEventSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // 'YYYY-MM-DD'
    vendorName: { type: String, required: true },
    menuType: { type: String, required: true }, // 'text' or 'image'
    menuContent: { type: String, required: true },
    deadline: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },
    orders: [OrderSchema],
});
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);

// ===============================================
//        Multer 檔案上傳設定 (無變動)
// ===============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// ===============================================
//               中介軟體 & API
// ===============================================
// 中介軟體: 驗證使用者 Token
const authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: '未提供授權 token' });
    
    try {
        // 現在的 token 就是 MongoDB 的 _id
        const user = await User.findById(token);
        if (!user) return res.status(403).json({ success: false, message: '無效的 token' });

        req.userId = user._id.toString();
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
};

// --- 使用者認證 API ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(409).json({ success: false, message: '該用戶名已被註冊' });

        const newUser = new User({ username, password });
        await newUser.save();
        
        // 同時為新用戶建立一個空的對話紀錄
        const newConversation = new Conversation({ userId: newUser._id, username: newUser.username });
        await newConversation.save();

        console.log(`新用戶註冊成功: ${username} (ID: ${newUser._id})`);
        res.status(201).json({ success: true, message: '註冊成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: '註冊失敗', error });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        
        if (user) {
            console.log(`用戶登入成功: ${username}`);
            res.json({ success: true, message: '登入成功', token: user._id.toString() });
        } else {
            res.status(401).json({ success: false, message: '用戶名或密碼錯誤' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '登入失敗', error });
    }
});


// --- 客服訊息 API ---
app.get('/api/messages', authenticate, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ userId: req.userId });
        res.json(conversation ? conversation.messages : []);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/message', authenticate, async (req, res) => {
    try {
        const { message } = req.body;
        const conversation = await Conversation.findOne({ userId: req.userId });
        
        const newMessage = { customerMessage: message };
        conversation.messages.push(newMessage);
        await conversation.save();

        console.log(`用戶 #${req.userId} 發送新訊息: ${message}`);
        // 返回新增的那個子訊息物件
        res.status(201).json(conversation.messages[conversation.messages.length - 1]);
    } catch (error) {
        res.status(500).json({ success: false, message: '訊息發送失敗', error });
    }
});

// --- 日曆點餐 API ---
app.get('/api/calendar/events', async (req, res) => {
    try {
        const events = await CalendarEvent.find({});
        // 轉換成前端習慣的 {'YYYY-MM-DD': event} 格式
        const eventsObject = events.reduce((obj, event) => {
            obj[event.date] = event;
            return obj;
        }, {});
        res.json(eventsObject);
    } catch (error) {
        res.status(500).json({});
    }
});

app.post('/api/calendar/order', authenticate, async (req, res) => {
    try {
        const { date, orderText } = req.body;
        const event = await CalendarEvent.findOne({ date });

        if (!event) return res.status(404).json({ success: false, message: '找不到該日期的點餐活動' });
        if (event.isClosed || new Date() > new Date(event.deadline)) return res.status(403).json({ success: false, message: '抱歉，點餐時間已截止' });

        // 移除舊訂單 (如果有的話)
        event.orders = event.orders.filter(order => order.userId !== req.userId);

        // 如果新訂單不是空的，就新增回去
        if (orderText.trim() !== "") {
            const newOrder = { userId: req.userId, username: req.user.username, orderText, timestamp: new Date() };
            event.orders.push(newOrder);
        }
        
        await event.save();
        
        const message = orderText.trim() !== "" ? '訂單已成功送出/更新' : '訂單已成功刪除';
        console.log(`用戶 #${req.userId} (${req.user.username}) 在 ${date} 操作訂單。`);
        res.json({ success: true, message });

    } catch (error) {
        res.status(500).json({ success: false, message: '訂餐操作失敗', error });
    }
});


// --- 工作人員專用 API ---
app.get('/api/admin/conversations', async (req, res) => {
    try {
        const conversations = await Conversation.find({});
        res.json(conversations);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/reply', async (req, res) => {
    try {
        const { userId, messageId, replyText } = req.body;
        const conversation = await Conversation.findOne({ userId });
        if (!conversation) return res.status(404).json({ success: false, message: '找不到該用戶的對話' });
        
        // messageId 現在是 MongoDB 的 _id
        const messageToReply = conversation.messages.id(messageId);
        
        if (messageToReply) {
            messageToReply.staffReply = replyText;
            await conversation.save();
            console.log(`工作人員回覆用戶 #${userId} 的訊息 #${messageId}: ${replyText}`);
            res.json({ success: true, updatedMessage: messageToReply });
        } else {
            res.status(404).json({ success: false, message: '在該用戶對話中找不到該訊息ID' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '回覆失敗', error });
    }
});

app.post('/api/admin/calendar/event', upload.single('menuImage'), async (req, res) => {
    try {
        const { date, vendorName, menuType, menuContent, deadline } = req.body;
        // ... (其他驗證邏輯與之前相同)

        const eventData = { date, vendorName, menuType, deadline, orders: [], isClosed: false, menuContent: '' };
        
        if (menuType === 'text') {
            if (!menuContent) return res.status(400).json({ success: false, message: '文字菜單內容不能為空' });
            eventData.menuContent = menuContent;
        } else if (menuType === 'image') {
            if (!req.file) return res.status(400).json({ success: false, message: '必須上傳菜單圖片' });
            eventData.menuContent = `https://no-one-help-official-website-v3-1.onrender.com/uploads/${req.file.filename}`;
        }
        
        // 尋找並更新，如果不存在就建立新的 (upsert)
        const newEvent = await CalendarEvent.findOneAndUpdate({ date: date }, eventData, { new: true, upsert: true });

        console.log(`[日曆系統] 已為 ${date} 新增/更新活動，店家: ${vendorName}`);
        res.status(201).json({ success: true, message: '點餐活動已成功建立/更新', event: newEvent });

    } catch (error) {
        res.status(500).json({ success: false, message: '活動建立失敗', error });
    }
});

// ===============================================
//           伺服器啟動
// ===============================================
app.listen(port, () => {
    console.log(`[MongoDB版] 伺服器正在 http://localhost:${port} 上運行`);
    const fs = require('fs');
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
});