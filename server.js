/* 檔案: server.js (v6.1 - 偵錯修復版) */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000; // 使用 Render 提供的 PORT

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================================
//        MongoDB 資料庫連線
// ===============================================
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
    .then(() => console.log('[DB] 成功連接到 MongoDB Atlas！'))
    .catch((err) => console.error('[DB] 無法連接到 MongoDB Atlas', err));

// ===============================================
//        Mongoose 資料庫模型 (Schema) - v6.0 大改版
// ===============================================

// --- 金流與使用者 ---
const TransactionSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    resultingBalance: { type: Number, required: true },
});

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    transactions: [TransactionSchema],
});
const User = mongoose.model('User', UserSchema);


// --- 客服訊息 ---
const MessageSchema = new mongoose.Schema({
    customerMessage: { type: String, required: true },
    staffReply: { type: String, default: '' },
    isStaffMessage: {type: Boolean, default: false},
    timestamp: { type: Date, default: Date.now },
});

const ConversationSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    messages: [MessageSchema],
});
const Conversation = mongoose.model('Conversation', ConversationSchema);


// --- 日曆點餐 ---
const OrderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    orderText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

const CalendarEventSchema = new mongoose.Schema({
    date: { type: String, required: true, index: true },
    vendorName: { type: String, required: true },
    menuText: { type: String },
    menuImageURL: { type: String },
    deadline: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },
    orders: [OrderSchema],
});
const CalendarEvent = mongoose.model('CalendarEvent', CalendarEventSchema);

// ===============================================
//        Multer 檔案上傳設定
// ===============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// ===============================================
//               中介軟體 & API
// ===============================================
const authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ success: false, message: '未提供授權 token' });
    
    try {
        const user = await User.findById(token);
        if (!user) return res.status(403).json({ success: false, message: '無效的 token' });
        req.userId = user._id.toString();
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: '伺服器 Token 驗證錯誤' });
    }
};

// --- 使用者認證 API (v6.0 更新) ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: '用戶名和密碼不能為空' });

        if (await User.findOne({ username })) return res.status(409).json({ success: false, message: '該用戶名已被註冊' });

        const newUser = new User({ username, password });
        
        newUser.transactions.push({
            description: "帳號建立",
            amount: 0,
            resultingBalance: 0
        });

        await newUser.save();
        
        const newConversation = new Conversation({ userId: newUser._id.toString(), username: newUser.username });
        await newConversation.save();

        console.log(`[Auth] 新用戶註冊成功: ${username} (ID: ${newUser._id})`);
        res.status(201).json({ success: true, message: '註冊成功' });
    } catch (error) {
        console.error('[Auth] 註冊失敗:', error);
        res.status(500).json({ success: false, message: '伺服器註冊錯誤' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        
        if (user) {
            console.log(`[Auth] 用戶登入成功: ${username}`);
            res.json({ 
                success: true, 
                message: '登入成功', 
                token: user._id.toString(),
                user: {
                    username: user.username,
                    balance: user.balance
                }
            });
        } else {
            res.status(401).json({ success: false, message: '用戶名或密碼錯誤' });
        }
    } catch (error) {
        console.error('[Auth] 登入失敗:', error);
        res.status(500).json({ success: false, message: '伺服器登入錯誤' });
    }
});

app.post('/api/user/change-password', authenticate, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (req.user.password !== oldPassword) {
            return res.status(403).json({ success: false, message: '舊密碼不正確' });
        }
        req.user.password = newPassword;
        await req.user.save();
        console.log(`[Auth] 用戶 ${req.user.username} 成功修改密碼`);
        res.json({ success: true, message: '密碼更新成功！' });
    } catch (error) {
        console.error(`[Auth] 用戶 ${req.user.username} 修改密碼失敗:`, error);
        res.status(500).json({ success: false, message: '伺服器錯誤，密碼更新失敗' });
    }
});

app.get('/api/user/transactions', authenticate, async (req, res) => {
    res.json({ success: true, transactions: req.user.transactions });
});


// --- 客服訊息 API (v6.0 更新) ---
app.get('/api/messages', authenticate, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ userId: req.userId });
        res.json(conversation ? conversation.messages : []);
    } catch (error) {
        console.error(`[Message] 獲取用戶 ${req.userId} 訊息失敗:`, error);
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
        console.log(`[Message] 用戶 #${req.userId} 發送新訊息`);
        res.status(201).json({ success: true, message: '發送成功' });
    } catch (error) {
        console.error(`[Message] 用戶 #${req.userId} 訊息發送失敗:`, error);
        res.status(500).json({ success: false, message: '訊息發送失敗' });
    }
});


// --- 日曆點餐 API (v6.0 更新) ---
app.get('/api/calendar/events', async (req, res) => {
    try {
        const events = await CalendarEvent.find({}).sort({ date: 1 });
        const groupedEvents = events.reduce((acc, event) => {
            const date = event.date;
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(event);
            return acc;
        }, {});
        res.json(groupedEvents);
    } catch (error) {
        console.error('[Calendar] 獲取日曆事件失敗:', error);
        res.status(500).json({});
    }
});

app.post('/api/calendar/order', authenticate, async (req, res) => {
    try {
        const { eventId, orderText, price } = req.body; 
        const event = await CalendarEvent.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: '找不到此點餐活動' });
        if (event.isClosed || new Date() > new Date(event.deadline)) return res.status(403).json({ success: false, message: '抱歉，點餐時間已截止' });

        //【未來實現】 1. 檢查餘額是否足夠, 2. 扣款並新增交易紀錄
        event.orders = event.orders.filter(order => order.userId !== req.userId);
        if (orderText.trim() !== "") {
            const newOrder = { userId: req.userId, username: req.user.username, orderText, timestamp: new Date() };
            event.orders.push(newOrder);
        }
        await event.save();
        const message = orderText.trim() !== "" ? '訂單已成功送出/更新' : '訂單已成功刪除';
        console.log(`[Calendar] 用戶 #${req.userId} 在活動 #${eventId} 操作訂單。`);
        res.json({ success: true, message });
    } catch (error) {
        console.error(`[Calendar] 用戶 #${req.userId} 訂餐失敗:`, error);
        res.status(500).json({ success: false, message: '訂餐操作失敗' });
    }
});

// ===============================================
//          ★ 工作人員專用 API (Admin) ★
// ===============================================

// --- 管理使用者 & 金流 ---

// 獲取所有使用者資料 (精簡)
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username balance');
        res.json(users);
    } catch (error) {
        console.error('[Admin] 獲取使用者列表失敗:', error);
        res.status(500).json([]);
    }
});

// 【v6.1 Bug修復】獲取單一使用者的完整資料
app.get('/api/admin/users/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '找不到該使用者' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error(`[Admin] 獲取使用者 #${req.params.userId} 資料失敗:`, error);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});

// 手動為用戶新增交易 (儲值/扣款)
app.post('/api/admin/transaction', async (req, res) => {
    try {
        const { userId, description, amount } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: '找不到使用者' });
        const newBalance = user.balance + amount;
        user.balance = newBalance;
        user.transactions.push({ description, amount, resultingBalance: newBalance });
        await user.save();
        console.log(`[Admin] 已為用戶 ${user.username} 新增交易: ${description}, 金額: ${amount}`);
        res.json({ success: true, message: '交易已成功記錄', newBalance });
    } catch (error) {
        console.error('[Admin] 新增交易失敗:', error);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});


// 重設使用者密碼
app.post('/api/admin/users/:userId/reset-password', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "找不到該用戶" });
        user.password = "12345678";
        await user.save();
        console.log(`[Admin] 已將用戶 ${user.username} 的密碼重設`);
        res.json({ success: true, message: `已將用戶 ${user.username} 的密碼重設為 12345678` });
    } catch(error) {
        console.error('[Admin] 重設密碼失敗:', error);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});

// 刪除使用者
app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) return res.status(404).json({ success: false, message: "找不到該用戶" });
        await Conversation.findOneAndDelete({ userId });
        console.log(`[Admin] 已成功刪除用戶: ${deletedUser.username} (ID: ${userId}) 及其對話紀錄`);
        res.json({ success: true, message: `已成功刪除用戶 ${deletedUser.username}` });
    } catch(error) {
        console.error('[Admin] 刪除用戶失敗:', error);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});


// --- 管理客服訊息 ---
app.get('/api/admin/conversations', async (req, res) => {
    try {
        const conversations = await Conversation.find({}).sort({ 'messages.timestamp': -1 });
        res.json(conversations);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/admin/reply', async (req, res) => {
    try {
        const { userId, messageId, replyText } = req.body;
        const conversation = await Conversation.findOne({ userId });
        if (!conversation) return res.status(404).json({ success: false, message: '找不到對話' });
        const messageToReply = conversation.messages.id(messageId);
        if (messageToReply) {
            messageToReply.staffReply = replyText;
            await conversation.save();
            console.log(`[Admin] 回覆用戶 #${userId} 訊息成功`);
            res.json({ success: true, message: '回覆成功' });
        } else {
            res.status(404).json({ success: false, message: '找不到訊息ID' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '回覆失敗' });
    }
});

// 工作人員主動發送訊息給單一用戶
app.post('/api/admin/message/send', async (req, res) => {
    try {
        const { userId, message } = req.body;
        const conversation = await Conversation.findOne({ userId });
        if (!conversation) return res.status(404).json({ success: false, message: '找不到該用戶的對話' });
        const staffMessage = { customerMessage: message, isStaffMessage: true };
        conversation.messages.push(staffMessage);
        await conversation.save();
        console.log(`[Admin] 工作人員主動發送訊息給用戶 #${userId}`);
        res.json({ success: true, message: '訊息發送成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: '訊息發送失敗' });
    }
});


// 工作人員群發訊息
app.post('/api/admin/message/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        const staffMessage = { customerMessage: message, isStaffMessage: true };
        await Conversation.updateMany({}, { $push: { messages: staffMessage } });
        console.log(`[Admin] 已成功群發訊息: "${message}"`);
        res.json({ success: true, message: '訊息已成功群發給所有用戶' });
    } catch (error) {
        res.status(500).json({ success: false, message: '群發訊息失敗' });
    }
});

// --- 管理日曆事件 ---
app.post('/api/admin/calendar/event', upload.single('menuImage'), async (req, res) => {
    try {
        const { date, vendorName, menuText, deadline } = req.body;
        const eventData = { date, vendorName, deadline, menuText: menuText || '' };
        if (req.file) {
            const imageURL = `https://no-one-help-official-website-v3-1.onrender.com/uploads/${req.file.filename}`;
            eventData.menuImageURL = imageURL;
        }
        const newEvent = new CalendarEvent(eventData);
        await newEvent.save();
        console.log(`[Admin] 已為 ${date} 新增活動，店家: ${vendorName}`);
        res.status(201).json({ success: true, message: '點餐活動已成功建立', event: newEvent });
    } catch (error) {
        console.error('[Admin] 建立活動失敗:', error);
        res.status(500).json({ success: false, message: '活動建立失敗' });
    }
});

app.put('/api/admin/calendar/event/:eventId', upload.single('menuImage'), async (req, res) => {
    try {
        const { eventId } = req.params;
        const { date, vendorName, menuText, deadline } = req.body;
        const updateData = { date, vendorName, deadline, menuText };
        if(req.file){
            const imageURL = `https://no-one-help-official-website-v3-1.onrender.com/uploads/${req.file.filename}`;
            updateData.menuImageURL = imageURL;
        }
        const updatedEvent = await CalendarEvent.findByIdAndUpdate(eventId, updateData, { new: true });
        if(!updatedEvent) return res.status(404).json({ success: false, message: "找不到該活動" });
        console.log(`[Admin] 已更新活動 #${eventId}`);
        res.json({ success: true, message: "活動更新成功", event: updatedEvent });
    } catch (error) {
        console.error('[Admin] 更新活動失敗:', error);
        res.status(500).json({ success: false, message: '活動更新失敗' });
    }
});

app.delete('/api/admin/calendar/event/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const deletedEvent = await CalendarEvent.findByIdAndDelete(eventId);
        if(!deletedEvent) return res.status(404).json({ success: false, message: "找不到該活動" });
        console.log(`[Admin] 已刪除活動 #${eventId}`);
        res.json({ success: true, message: "活動刪除成功" });
    } catch (error) {
        console.error('[Admin] 刪除活動失敗:', error);
        res.status(500).json({ success: false, message: '活動刪除失敗' });
    }
});

// ===============================================
//           伺服器啟動
// ===============================================
app.listen(port, () => {
    console.log(`[Server] 伺服器正在 port ${port} 上運行`);
    const fs = require('fs');
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
        console.log('[Server] "uploads" 資料夾已建立');
    }
});