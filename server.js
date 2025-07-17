// 檔案：server.js (確認無誤的版本)

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let messages = [];
let messageIdCounter = 1;

// API 1:【顧客】傳送新訊息
app.post('/api/message', (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: '訊息不能為空' });
  }
  const newMessage = {
    id: messageIdCounter++,
    customerMessage: userMessage,
    staffReply: ''
  };
  messages.push(newMessage);
  console.log(`收到新訊息 #${newMessage.id}: ${userMessage}`);
  res.status(201).json(newMessage);
});

// API 2:【工作人員】回覆特定訊息
app.post('/api/reply', (req, res) => {
  const { messageId, replyText } = req.body;
  const messageToReply = messages.find(m => m.id === parseInt(messageId));
  if (messageToReply) {
    messageToReply.staffReply = replyText;
    console.log(`回覆訊息 #${messageId}: ${replyText}`);
    res.json(messageToReply);
  } else {
    res.status(404).json({ error: '找不到該訊息 ID' });
  }
});

// API 3:【所有人】獲取所有訊息  <-- 問題很可能出在這裡！請確認這段存在且正確！
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

// 啟動伺服器，必須在最後
app.listen(port, () => {
  console.log(`伺服器正在 http://localhost:${port} 上運行`);
});