/* 檔案: server.js (完整功能版) */

// 1. 引入需要的套件
const express = require('express');
const cors = require('cors');

// 2. 建立 Express 應用程式
const app = express();
const port = 3000; // Render 會自動忽略這個，並使用它自己的 PORT，但在本地開發時有用

// 3. 使用中介軟體 (Middleware)
app.use(cors());          // 允許所有來源的跨域請求
app.use(express.json());  // 讓 Express 能夠解析 JSON 格式的請求內容

// ===============================================
//        簡易的記憶體資料庫 (In-Memory Database)
// ===============================================
// 我們的訊息都會儲存在這個陣列裡。
// 伺服器重啟後，訊息會消失。
let messages = []; 
let messageIdCounter = 1; // 用來產生唯一的訊息 ID

// ===============================================
//               API 路由 (Endpoints)
// ===============================================

// --- API 1: 顧客發送新訊息 ---
// 當收到 POST 請求送到 /api/message 路徑時...
app.post('/api/message', (req, res) => {
  // 從請求的 body 中取出顧客傳來的訊息文字
  const userMessage = req.body.message;
  
  // 基本的驗證：確保訊息不是空的
  if (!userMessage || userMessage.trim() === '') {
    return res.status(400).json({ error: '訊息不能為空' });
  }

  // 建立一個新的訊息物件
  const newMessage = {
    id: messageIdCounter++,       // 使用目前的計數器作為 ID，然後將計數器加 1
    customerMessage: userMessage, // 儲存顧客訊息
    staffReply: ''                // 工作人員的回覆一開始是空的字串
  };

  // 將這個新的訊息物件加入到我們的 messages 陣列中
  messages.push(newMessage);

  // 在後端日誌中印出紀錄，方便我們偵錯
  console.log(`收到新訊息 #${newMessage.id}: ${userMessage}`);
  
  // 回傳 HTTP 狀態碼 201 (Created) 並附上剛建立的訊息物件
  res.status(201).json(newMessage);
});


// --- API 2: 工作人員回覆特定訊息 ---
// 當收到 POST 請求送到 /api/reply 路徑時...
app.post('/api/reply', (req, res) => {
  // 從請求的 body 中取出要回覆的訊息 ID 和回覆的文字
  const { messageId, replyText } = req.body;

  // 使用 Array.find() 方法在 messages 陣列中尋找 ID 相符的訊息
  // parseInt() 是因為從前端傳來的 ID 可能是字串，我們要把它轉成數字來比對
  const messageToReply = messages.find(m => m.id === parseInt(messageId));

  if (messageToReply) {
    // 如果找到了訊息，就把它的 staffReply 屬性更新成新的回覆內容
    messageToReply.staffReply = replyText;
    
    // 在後端日誌中印出紀錄
    console.log(`工作人員回覆訊息 #${messageId}: ${replyText}`);
    
    // 將更新後的訊息物件回傳給前端
    res.json(messageToReply);
  } else {
    // 如果沒找到對應的 ID，就回傳 404 (Not Found) 錯誤
    res.status(404).json({ error: '找不到該訊息 ID' });
  }
});


// --- API 3: 所有人獲取所有訊息 ---
// 當收到 GET 請求送到 /api/messages 路徑時...
app.get('/api/messages', (req, res) => {
  // 直接將整個 messages 陣列以 JSON 格式回傳
  res.json(messages);
});


// 4. 啟動伺服器
// 讓伺服器開始監聽指定的 port，並在啟動成功後執行一個回呼函式
app.listen(port, () => {
  console.log(`伺服器正在 http://localhost:${port} 上運行`);
});