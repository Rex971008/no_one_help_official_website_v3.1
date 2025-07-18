/* 檔案: script.js (最終功能完整版 - 已包含【所有】店家資訊) */

document.addEventListener('DOMContentLoaded', () => {
    // ================== 全局變數 & API 設定 ==================
    const API_BASE_URL = 'http://localhost:3000'; // 部署時記得改成你的 Render URL
    let chatInterval;
    const body = document.body;

    // ================== 獲取所有頁面和關鍵元素 ==================
    const hamburgerButton = document.querySelector('.hamburger-menu');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a.sidebar-link');
    const pages = document.querySelectorAll('.page-content');
    const heroBackground = document.querySelector('.hero-background');
    const menuBackgroundContainer = document.getElementById('dynamic-bg-container');
    const vendorGrid = document.getElementById('vendor-grid');
    const searchInput = document.getElementById('vendor-search');
    const modal = document.getElementById('vendor-modal');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const goToRegisterLink = document.getElementById('go-to-register');
    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');
    const registerBtn = document.getElementById('register-btn');
    const goToLoginLink = document.getElementById('go-to-login');
    const chatBox = document.getElementById('chatBox');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const logoutBtn = document.getElementById('logout-btn');

    // ================== 狀態管理 (Token) ==================
    const Auth = {
        saveToken: (token) => localStorage.setItem('authToken', token),
        getToken: () => localStorage.getItem('authToken'),
        clearToken: () => localStorage.removeItem('authToken'),
        isLoggedIn: () => Auth.getToken() !== null,
    };

    // ================== 核心：頁面切換邏輯 ==================
    function switchPage(targetId) {
        if (targetId === 'page-customer-service' && !Auth.isLoggedIn()) {
            targetId = 'page-login';
        }

        const targetPage = document.getElementById(targetId);
        if (!targetPage) return;

        clearInterval(chatInterval);
        if (heroBackground) heroBackground.style.display = (targetId === 'page-home') ? 'block' : 'none';
        if (menuBackgroundContainer) menuBackgroundContainer.style.display = 'none';

        pages.forEach(p => p.classList.remove('page-active'));
        targetPage.classList.add('page-active');

        sidebarLinks.forEach(l => {
            const linkTarget = l.dataset.target;
            const isActive = (linkTarget === targetId) ||
                (linkTarget === 'page-customer-service' && ['page-login', 'page-register'].includes(targetId));
            l.classList.toggle('active-link', isActive);
        });

        window.scrollTo(0, 0);
        if (targetId === 'page-menu') initDynamicBackground();
        if (targetId === 'page-customer-service') startChatSession();
    }

    // ================== 事件綁定 ==================
    if (hamburgerButton) hamburgerButton.addEventListener('click', () => body.classList.toggle('sidebar-open'));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => body.classList.toggle('sidebar-open'));
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage(link.dataset.target);
            if (body.classList.contains('sidebar-open')) {
                body.classList.toggle('sidebar-open');
            }
        });
    });

    if (goToRegisterLink) goToRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchPage('page-register'); });
    if (goToLoginLink) goToLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchPage('page-login'); });

    if (registerBtn) registerBtn.addEventListener('click', async () => {
        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value.trim();
        if (!username || !password) return alert('用戶名和密碼不能為空！');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (response.ok && data.success) {
                alert('註冊成功，請登入！');
                switchPage('page-login');
            } else {
                alert(`註冊失敗：${data.message}`);
            }
        } catch(error) { alert('註冊請求失敗，請檢查網絡或稍後再試。'); }
    });
    
    if (loginBtn) loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!username || !password) return alert('用戶名和密碼不能為空！');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (response.ok && data.success) {
                Auth.saveToken(data.token);
                switchPage('page-customer-service');
            } else {
                alert(`登入失敗：${data.message}`);
            }
        } catch(error) { alert('登入請求失敗，請檢查網絡或稍後再試。'); }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        Auth.clearToken();
        stopChatSession();
        switchPage('page-home');
    });

    if (sendButton) sendButton.addEventListener('click', sendChatMessage);
    if (messageInput) messageInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); sendChatMessage(); } });

    // ================== 功能性函數 ==================
    // --- 聊天功能 ---
    function startChatSession() {
        if (chatInterval) clearInterval(chatInterval);
        fetchChatMessages();
        chatInterval = setInterval(fetchChatMessages, 3000);
    }
    function stopChatSession() { clearInterval(chatInterval); }
    async function fetchChatMessages() {
        const token = Auth.getToken();
        if (!token || !chatBox) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages`, { headers: { 'Authorization': token } });
            if (!response.ok) throw new Error('無法獲取訊息');
            const messages = await response.json();
            const shouldScroll = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50;
            chatBox.innerHTML = '';
            if (messages.length === 0) {
                chatBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary-color);">目前沒有對話紀錄，開始您的第一次對話吧！</p>';
            } else {
                messages.forEach(msg => {
                    const customerDiv = document.createElement('div');
                    customerDiv.className = 'chat-message customer-msg';
                    customerDiv.textContent = msg.customerMessage;
                    chatBox.appendChild(customerDiv);
                    if (msg.staffReply) {
                        const staffDiv = document.createElement('div');
                        staffDiv.className = 'chat-message staff-reply';
                        staffDiv.textContent = `客服：${msg.staffReply}`;
                        chatBox.appendChild(staffDiv);
                    }
                });
            }
            if (shouldScroll) chatBox.scrollTop = chatBox.scrollHeight;
        } catch (error) {
            console.error("獲取聊天訊息失敗:", error);
            chatBox.innerHTML = '<p style="text-align:center; color: #ff5252;">無法連接客服中心，請稍後再試。</p>';
            stopChatSession();
        }
    }
    async function sendChatMessage() {
        const token = Auth.getToken();
        const message = messageInput.value.trim();
        if (!message || !token) return;
        try {
            await fetch(`${API_BASE_URL}/api/message`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ message }) });
            messageInput.value = '';
            fetchChatMessages();
        } catch (error) { console.error('訊息發送失敗:', error); }
    }
    
    // ★★★★★ 這裡是您完整的店家資料 ★★★★★
    const vendorData = [
        { name: "歐賣咖", displayName: "歐賣咖 咖哩工坊", phone: "073806973", address: "高雄市三民區正興路82號", info: "營業時間:\n上午 11:00 ~ 下午 14:00\n下午 17:00 ~ 晚上 20:30\n\n外送資訊: 滿5-10份餐點可外送 (視路程)\n與鳳山高中距離：約 4.9 公里 (開車約 12 分鐘，步行約 1 小時)", tags: ["咖哩", "義大利麵", "鍋燒"], menu: [ { type: 'subtitle', text: '咖哩蛋包飯 (加大+10元 / 焗烤+30元)' }, { name: '原味', price: 70 }, { name: '雞排', price: 90 }, { name: '魚排', price: 90 }, { name: '花枝排', price: 90 }, { name: '豬肉', price: 95 }, { name: '雞腿丁', price: 95 }, { name: '海鮮總匯', price: 95 }, { name: '卡滋豬排', price: 100 }, { name: '脆皮雞腿', price: 100 }, { name: '牛肉', price: 110 }, { name: '炸蝦X3', price: 145 }, { name: '唐揚雞', price: 150 }, { name: '酥炸魷魚', price: 160 }, { type: 'subtitle', text: '咖哩拌麵 (加大+20元)' }, { name: '原味', price: 80 }, { name: '雞排', price: 110 }, { name: '魚排', price: 110 }, { name: '花枝排', price: 110 }, { name: '豬肉', price: 110 }, { name: '雞腿丁', price: 110 }, { name: '海鮮總匯', price: 110 }, { name: '卡滋豬排', price: 120 }, { name: '脆皮雞腿', price: 120 }, { name: '牛肉', price: 130 }, { name: '炸蝦X3', price: 165 }, { name: '唐揚雞', price: 170 }, { name: '酥炸魷魚', price: 180 }, { type: 'subtitle', text: '義大利麵 (白醬/紅醬/青醬+10元/換焗飯+20元)' }, { name: '原味', price: 70 }, { name: '雞排', price: 105 }, { name: '魚排', price: 105 }, { name: '花枝排', price: 105 }, { name: '豬肉', price: 105 }, { name: '雞腿丁', price: 105 }, { name: '蛤蜊', price: 105 }, { name: '豬排', price: 110 }, { name: '雞腿', price: 110 }, { name: '牛肉', price: 120 }, { name: '肉醬', price: 100 }, { name: '炸蝦X3', price: 145 }, { name: '唐揚雞', price: 150 }, { name: '酥炸魷魚', price: 160 }, { type: 'subtitle', text: '鍋燒系列' }, { name: '意麵/雞絲麵/冬粉/鍋燒粥', price: 90 }, { name: '烏龍麵', price: 100 }, { name: '麻婆豆腐燴飯', price: 85 }, { type: 'subtitle', text: '丼飯' }, { name: '親子丼', price: 100 }, { name: '豬肉丼', price: 100 }, { name: '豬排丼', price: 100 }, { name: '牛肉丼', price: 110 }, { name: '炸蝦丼', price: 140 }, { type: 'subtitle', text: '單點類' }, { name: '酥炸魷魚', price: 120 }, { name: '黃金炸蝦 (3支)', price: 120 }, { name: '唐揚雞', price: 120 }, { name: '骰子雞', price: 60 }, { name: '雞排', price: 55 }, { name: '豬排', price: 55 }, { name: '雞腿', price: 55 }, { name: '黃金脆薯', price: 40 }, { name: '起士', price: 60 }, { name: '竹輪', price: 40 }, { name: '豆腐', price: 60 }, { name: '德式香腸 (1支)', price: 30 }, { type: 'subtitle', text: '湯品/小菜' }, { name: '黃金泡菜/韓式泡菜', price: 40 }, { name: '玉米濃湯/味噌湯', price: 20 }, { name: '小菜一份', price: 30 } ] },
        { name: "感丼現食", displayName: "感丼現食 文衡店", phone: "077405810", address: "高雄市鳳山區文衡路11號", info: "營業時間: 11:00 - 21:00\n外送資訊: 滿300元可外送\n備註: 早上9點起可電話訂餐；團體訂購可洽官方LINE。\n與鳳山高中距離：約 1.7 公里 (開車約 5 分鐘，步行約 21 分鐘)", tags: ["丼飯", "LINE點餐", "closed:週日公休"], menu: [ { type: 'subtitle', text: '日式醬燒丼 (可選: 飯/乾拌麵/湯麵/乾拌烏龍/湯烏龍)' }, { name: '方便素', price: '80/100/100' }, { name: '豬肉', price: '95/115/115' }, { name: '牛肉', price: '100/120/120' }, { name: '厚切雞腿', price: '140/160/160' }, { name: '板腱牛排', price: '180/200/200' }, { name: '櫻桃鴨胸', price: '200/220/220' }, { name: '隱藏版', price: '250/270/270' }, { type: 'subtitle', text: '韓式辣醬丼 (可選: 飯/乾拌麵/湯麵)' }, { name: '方便素', price: '85/105' }, { name: '豬肉', price: '100/120' }, { name: '牛肉', price: '105/125' }, { name: '厚切雞腿', price: '150/170' }, { type: 'subtitle', text: '義式白醬丼 (可選: 飯/乾拌麵/湯麵/乾拌烏龍/湯烏龍)' }, { name: '方便素', price: '85/105/105' }, { name: '豬肉', price: '100/120/120' }, { name: '牛肉', price: '105/125/125' }, { name: '厚切雞腿', price: '150/170/170' }, { name: '板腱牛排', price: '190/210/210' }, { name: '櫻桃鴨胸', price: '210/230/230' }, { type: 'subtitle', text: '加料' }, { name: '松露醬', price: 30 }, { name: '日式醬燒/黃金泡菜/起士片', price: 5 }, { type: 'subtitle', text: '單點小菜' }, { name: '煎小干貝(3顆)', price: 45 }, { name: '櫛瓜', price: 45 }, { name: '日本山藥', price: 65 }, { name: '嫩雞蛋豆腐', price: 40 }, { name: '黑輪片', price: 35 }, { name: '黃金泡菜', price: 35 }, { name: '溏心蛋/溫泉蛋', price: 25 }, { name: '起士抓餅', price: 50 }, { name: '蔥抓餅', price: 35 }, { name: '嫩牛筋', price: 50 }, { name: '厚切去骨雞腿', price: 100 }, { name: '板腱牛排', price: 130 }, { name: '櫻桃鴨胸', price: 150 }, { type: 'subtitle', text: '湯品.飲品' }, { name: '雞白湯(無料)/紫菜蛋花湯', price: 30 }, { name: '韓式嫩豆腐湯', price: 40 }, { name: '泰式奶茶', price: 70 }, { name: '蘋果綠茶', price: 60 } ] },
        { name: "小魯魯", phone: "077415470", address: "高雄市鳳山區維新路60號", info: "營業時間: 週日公休 (預訂時間早上9點起)\n備註: 麻醬、沙茶加量+10元。\n與鳳山高中距離：約 1.1 公里 (開車約 4 分鐘，步行約 14 分鐘)", tags: ["鴨肉飯", "closed:週日公休"], menu: [ { type: 'subtitle', text: '飯/麵類' }, { name: '鴨肉意麵', price: '小50/大65' }, { name: '鴨肉冬粉', price: 60 }, { name: '鴨肉飯', price: 55 }, { name: '燒肉飯/麵', price: '小60/大70' }, { name: '雞絲飯/麵', price: '小35/大40' }, { name: '麻油麵線', price: 50 }, { name: '麻醬麵', price: 50 }, { name: '餛飩麵', price: 60 }, { name: '豬舌冬粉', price: 50 }, { name: '肉絲/海產/什錦炒飯/麵', price: '60-70' }, { name: '炒米粉/粄條', price: 60 }, { name: '青燥飯', price: 30 }, { type: 'subtitle', text: '湯品/其他' }, { name: '骨仔肉湯', price: 40 }, { name: '吳郭魚湯', price: 55 }, { name: '蛤仔湯', price: 40 }, { name: '豬肝湯', price: 30 }, { name: '貢丸湯', price: 30 }, { name: '海鮮湯', price: 60 }, { name: '虱目魚湯', price: 60 }, { name: '水餃(每顆)', price: 5 } ] },
        { name: "小宜的店", displayName: "小宜的店 (小目鍋燒)", phone: "0985446509", address: "高雄市鳳山區經武路285號", info: "備註: 加飯/麵/蛋 +10元。\n與鳳山高中距離：約 1.5 公里 (開車約 4 分鐘，步行約 18 分鐘)", tags: ["鍋燒", "粥"], menu: [ { type: 'subtitle', text: '鍋燒類' }, { name: '鍋燒(意麵/雞絲/烏龍/冬粉/王子)', price: 75 }, { name: '韓式泡菜鍋燒', price: 85 }, { name: '味噌拉麵', price: 85 }, { name: '起士鍋燒', price: 85 }, { name: '丸餃鍋', price: 90 }, { type: 'subtitle', text: '粥類' }, { name: '海產粥/魚肉粥/蛤仔粥/蝦仁粥', price: 75 }, { name: '味噌泡飯', price: 85 }, { name: '魚肚粥', price: 95 }, { type: 'subtitle', text: '湯類' }, { name: '蛤仔湯/海產湯/魚肉湯', price: 50 }, { name: '魚肚湯', price: 85 }, { name: '魚丸湯', price: 30 }, { name: '蛋花湯', price: 35 } ] },
        { name: "八方雲集", displayName: "八方雲集 高雄鳳山青年店", phone: "077461237", address: "高雄市鳳山區青年路二段381號", info: "此為綜合多張點單的資訊整理。\n與鳳山高中距離：約 1.7 公里 (開車約 5 分鐘，步行約 20 分鐘)", tags: ["水餃", "鍋貼", "麵食"], menu: [ { type: 'subtitle', text: '鍋貼/水餃 (每顆)' }, { name: '招牌/韭菜/韓式辣味/咖哩雞肉/玉米', price: 7 }, { name: '薪蔬食', price: 7.5 }, { name: '鮮蝦水餃', price: 10.5 }, { type: 'subtitle', text: '麵食系列' }, { name: '紅燒牛肉麵/清燉牛肉麵', price: 168 }, { name: '金牌麻辣牛肉乾拌麵', price: 178 }, { name: '旗艦海陸湯麵', price: 125 }, { name: '酸辣湯麵', price: 68 }, { name: '麻醬乾麵', price: 60 }, { name: '紹辣乾麵', price: 58 }, { name: '招牌乾麵', price: 55 }, { name: '古早味乾麵', price: 45 }, { type: 'subtitle', text: '湯品/抄手' }, { name: '酸辣湯/旗艦濃湯/蕈菇濃湯', price: 35 }, { name: '玉米濃湯', price: 30 }, { name: '招牌抄手/紅油抄手', price: 60 }, { name: '鮮蝦抄手', price: 80 }, { type: 'subtitle', text: '小菜/飲品' }, { name: '和風秋葵/胡麻豆干絲/滷蛋/燙青菜', price: '30-40' }, { name: '豆漿/無糖豆漿', price: 20 }, { name: '紅茶/奶茶/特濃豆漿', price: 25 } ] },
        { name: "關東煮", phone: "無", address: "鳳山體育館周邊", info: "攤販，無確切地址與電話。此為個人整理價目表。\n與鳳山高中距離：約 1.0 公里 (步行約 12 分鐘)", tags: ["關東煮", "鍋燒", "麵食"], menu: [ { type: 'subtitle', text: '關東煮類' }, { name: '高麗菜/百頁/米血/黑輪/菜頭/豆皮/豆干/空心菜/蒸煮麵/意麵/拉麵', price: 20 }, { name: '龍蝦棒/雞絲麵', price: 15 }, { name: '金針菇/秀珍菇/鱈魚丸(2)/黃金魚蛋(2)/貢丸(2)/竹輪/魚丸串/花枝串', price: 10 }, { name: '凍豆腐', price: 5 }, { name: '高麗菜捲/讚岐烏龍麵/韓式拉麵', price: 30 }, { name: '杏包菇', price: 40 }, { name: '肉片', price: 35 }, { type: 'subtitle', text: '麵食/其他' }, { name: '乾麵', price: '小35/大45' }, { name: '鍋燒系列 (加麵+10)', price: '小65/大70' }, { name: '麻醬麵', price: 40 }, { name: '麻辣牛肉(乾/湯/烏龍) (加麵/飯+10)', price: 95 }, { name: '奶油白醬培根麵', price: 85 }, { name: '烤黑輪片(每片)', price: 30 }, { name: '大腸包小腸', price: 75 }, { name: '香腸', price: 35 }, { name: '大腸', price: 50 }, { name: '綜合滷味', price: '小75/大80' } ] },
        { name: "39焗烤家族", phone: "077778883", address: "高雄市鳳山區八德路二段260號", info: "電話: 07-7778883\n週二公休\n此為連鎖店通用菜單，需確認訂購分店。\n與鳳山高中距離：約 2.5 公里 (開車約 7 分鐘，步行約 30 分鐘)", tags: ["焗烤", "closed:週二公休"], menu: [ { type: 'subtitle', text: '升級套餐說明:' }, { name: 'No.1', price: '單點' }, { name: 'No.2 (+飲料)', price: '主餐價+30元' }, { name: 'No.3 (+濃湯)', price: '主餐價+30元' }, { name: 'No.4 (+飲料+濃湯)', price: '主餐價+50元' }, { type: 'subtitle', text: '比薩 (Pizza) (皆為6吋)' }, { name: '玉米/夏威夷/蔬菜總匯/培根/燻雞/泡菜/鮪魚/鮮蝦/辣味雞丁/德式香腸', price: '單點 99元 / No.2 149元 / No.3 159元 / No.4 169元' }, { name: '章魚燒/燻雞蘑菇/羅勒燻雞/泡菜牛肉/泡菜豬肉/總匯/煙燻德腸', price: '單點 109元 / No.2 159元 / No.3 169元 / No.4 179元' }, { name: '龍蝦沙拉', price: '單點 119元 / No.2 179元 / No.3 189元 / No.4 199元' }, { name: '起司加倍', price: '+35元' }, { type: 'subtitle', text: '義大利麵 (Spaghetti)' }, { name: '蔬菜/奶油/茄汁/黑胡椒/肉醬', price: '單點 79元 / No.2 139元 / No.3 149元 / No.4 159元' }, { name: '羅勒/奶油燻雞/辣味雞/泡菜/韓國辣雞/奶油培根/海鮮/牛肉', price: '單點 99元 / No.2 159元 / No.3 169元 / No.4 179元' }, { name: '白醬焗烤', price: '+15元' }, { type: 'subtitle', text: '焗烤 (Pasta Baked) (飯/麵)' }, { name: '夏威夷/蔬菜/肉醬/培根/燻雞/泡菜/海鮮/鮪魚/牛肉/辣味雞丁/墨西哥/蕈菇燻雞/章魚燒/羅勒燻雞/奶油培根/咖哩雞肉/奶油雞肉/泡菜豬肉/泡菜牛肉/總匯/煙燻德腸', price: '單點 109元 / No.2 169元 / No.3 179元 / No.4 189元' }, { name: '龍蝦沙拉/法式燻鴨/檸檬雞柳', price: '單點 119元 / No.2 179元 / No.3 189元 / No.4 199元' }, { name: '起司加倍', price: '+25元' }, { name: '白醬焗烤', price: '+15元' }, { type: 'subtitle', text: '漢堡/點心 (Hamburger/Dessert)' }, { name: '薯條', price: 45 }, { name: '卡啦雞腿堡 (原味/辣味)', price: '單點 55元 / 套餐 115元' }, { name: '醬燒烤肉堡', price: '單點 65元 / 套餐 135元' }, { name: '熱狗', price: 29 }, { name: '麥克雞塊', price: 29 }, { name: '辣味雞米花', price: 65 }, { name: '檸檬雞柳條', price: 65 }, { type: 'subtitle', text: '特製排餐 (Special)' }, { name: '紐奧良雞排/卡啦雞/醬燒豬排/茄汁豬排/泡菜豬排/泡菜雞排', price: 145 }, { type: 'subtitle', text: '素食 (Vegetarian) (飯/麵)' }, { name: '夏威夷/蔬菜', price: '單點 99元' }, { name: '素肉燥', price: 89 }, { name: '素什錦', price: 119 }, { name: '素食總匯', price: 109 }, { name: '素什錦(鐵板)', price: 109 }, { name: '無肉玉米', price: 99 }, { name: '素玉米什錦', price: 119 }, { name: '無肉玉米(鐵板)', price: 65 }, { name: '玉米濃湯', price: 40 }, { name: '蔬菜玉米濃湯', price: 65 }, { type: 'subtitle', text: '冷飲 (Drinks)' }, { name: '紅茶/綠茶/百香果/柳橙汁/可樂/雪碧/蔓越莓/錫蘭奶茶/梅子紅', price: 30 }, { name: '柳橙汁/鮮奶茶', price: 40 }, { name: '冬瓜檸檬/冬瓜鮮奶/阿華田/鮮奶綠', price: 40 }, { name: '加料: 奶蓋/珍珠/椰果', price: '+10' } ] },
        { name: "昭和炒飯", phone: "077228585", address: "高雄市苓雅區廣州一街141-5號", info: "電話: 07-7228585\n**注意：店家位於苓雅區，與鳳山高中距離約 4.0 公里 (開車約 10 分鐘)，請務必確認外送範圍。**\n此為連鎖店通用菜單，需確認訂購分店", tags: ["炒飯"], menu: [ { type: 'subtitle', text: '招牌系列' }, { name: '昭和牛丼', price: 160 }, { name: '昭和炒飯', price: 145 }, { name: '海鮮什錦炒飯', price: 140 }, { name: '泡菜牛肉蓋飯', price: 170 }, { name: '揚州炒飯', price: 140 }, { name: '咖哩海陸蓋炒飯', price: 140 }, { name: '日式芥末鮭魚炒飯', price: 115 }, { type: 'subtitle', text: '家常炒飯' }, { name: '蝦仁蛋炒飯', price: 100 }, { name: '黃金鮭魚蛋炒飯', price: 110 }, { name: '泰式香雞蛋炒飯', price: 100 }, { name: '櫻花蝦蛋炒飯', price: 95 }, { name: '肉絲蛋炒飯', price: 90 }, { name: '雞丁蛋炒飯', price: 90 }, { name: '香腸蛋炒飯', price: 90 }, { name: '培根蛋炒飯', price: 80 }, { name: '火腿蛋炒飯', price: 75 }, { name: '蛋炒飯', price: 70 }, { name: '蔬菜玉米蛋炒飯', price: 80 }, { name: '青椒肉絲蛋炒飯', price: 100 }, { name: '青椒牛肉蛋炒飯', price: 110 }, { type: 'subtitle', text: '熱炒系列' }, { name: '現炒青菜', price: 65 }, { name: '香煎蔥蛋', price: 65 }, { name: '香煎蝦仁蛋', price: 80 }, { name: '香煎菜圃蛋', price: 70 }, { name: '培根高麗菜', price: 75 }, { type: 'subtitle', text: '風味炒麵 (加麵+15元)' }, { name: '海鮮什錦炒烏龍', price: 135 }, { name: '沙茶牛肉炒麵', price: 105 }, { name: '沙茶豬肉炒麵', price: 100 }, { name: '沙茶羊肉炒麵', price: 105 }, { name: '金門炒泡麵', price: 95 }, { name: '炒泡麵', price: 90 }, { name: '泡菜炒烏龍', price: 110 }, { name: '咖哩牛肉炒烏龍', price: 115 }, { name: '咖哩豬肉炒烏龍', price: 100 }, { name: '日式炒烏龍麵', price: 95 }, { name: '台式炒麵', price: 95 }, { type: 'subtitle', text: '風味炒飯' }, { name: '醬燒牛肉蛋炒飯', price: 125 }, { name: '醬燒肉絲蛋炒飯', price: 115 }, { name: '醬燒雞丁蛋炒飯', price: 115 }, { name: '沙茶羊肉蛋炒飯', price: 110 }, { name: '沙茶牛肉蛋炒飯', price: 110 }, { name: '沙茶豬肉蛋炒飯', price: 95 }, { name: '咖哩牛肉蛋炒飯', price: 120 }, { name: '咖哩雞肉蛋炒飯', price: 100 }, { name: '咖哩豬肉蛋炒飯', price: 100 }, { name: '泡菜炒飯', price: 120 }, { name: '番茄牛肉蛋炒飯', price: 120 }, { name: '番茄肉絲蛋炒飯', price: 100 }, { name: '番茄蛋炒飯', price: 90 }, { name: '夏威夷鳳梨炒飯', price: 105 }, { name: '蒜香奶油培根炒飯', price: 95 }, { name: '蒜香奶油鮭魚炒飯', price: 110 }, { name: '麻辣炒飯', price: 120 }, { name: '麻辣牛肉炒飯', price: 130 }, { type: 'subtitle', text: '焗烤系列' }, { name: '海鮮什錦焗飯', price: 135 }, { name: '咖哩牛肉焗飯', price: 115 }, { name: '咖哩雞肉焗飯', price: 100 }, { name: '沙茶牛肉焗飯', price: 110 }, { name: '沙茶羊肉焗飯', price: 110 }, { name: '沙茶豬肉焗飯', price: 95 }, { name: '日式醬燒牛肉焗飯', price: 125 }, { name: '日式醬燒豬肉焗飯', price: 115 }, { type: 'subtitle', text: '鍋燒系列 (可選：意麵、烏龍、冬粉、泡麵)' }, { name: '原味鍋燒', price: 95 }, { name: '奶油鍋燒', price: 130 }, { name: '麻辣鍋燒', price: 120 }, { type: 'subtitle', text: '湯品 & 其他' }, { name: '蛋花湯', price: 40 }, { name: '紫菜蛋花湯', price: 45 }, { name: '貢丸湯', price: 45 }, { name: '魚丸湯', price: 45 }, { name: '蛤仔湯', price: 55 }, { name: '泡菜(單點)', price: 50 }, { name: '泡菜(罐裝)', price: 230 }, { name: '加起司', price: 30 }, { name: '加蛋', price: 15 }, { type: 'subtitle', text: '飲品' }, { name: '梨山青茶', price: 50 }, { name: '冬瓜檸檬', price: 55 }, { name: '黑糖沖繩鮮奶茶', price: 55 } ] },
        { name: "何媽媽鍋燒丼飯炒飯", phone: "077263740", address: "高雄市苓雅區福德三路269號", info: "電話: 07-7263740 / 0956-536299\n營業時間: 上午9:00~13:00 / 下午4:00~7:30\n**注意：店家位於苓雅區，與鳳山高中距離約 2.8 公里 (開車約 7 分鐘，步行約 34 分鐘)，請務必確認外送範圍。**", tags: ["鍋燒", "丼飯", "炒飯", "自製滷油"], menu: [ { type: 'subtitle', text: '限量咖哩系列' }, { name: '豬排咖哩飯', price: 100 }, { name: '雞排咖哩飯', price: 100 }, { name: '魚排咖哩飯', price: 100 }, { name: '牛肉咖哩飯', price: 100 }, { type: 'subtitle', text: '丼飯系列' }, { name: '豬肉丼飯', price: 100 }, { name: '雞肉丼飯', price: 100 }, { name: '豬排丼飯', price: 100 }, { name: '雞排丼飯', price: 100 }, { name: '魚排丼飯', price: 100 }, { name: '牛肉丼飯', price: 100 }, { type: 'subtitle', text: '人氣炒飯系列 (加滷油+10)' }, { name: '火腿炒飯', price: 80 }, { name: '培根炒飯', price: 80 }, { name: '肉絲炒飯', price: 80 }, { name: '蝦仁炒飯', price: 90 }, { name: '蚵仁炒飯', price: 90 }, { name: '滷油雞粒炒飯', price: 90 }, { name: '青椒肉絲炒飯', price: 90 }, { name: '綜合炒飯', price: 90 }, { name: '素食蛋炒飯', price: 90 }, { name: '香腸蛋炒飯', price: 90 }, { name: '青椒肉絲炒飯', price: 90 }, { name: '鯖肉炒飯', price: 90 }, { name: '鹹豬肉炒飯', price: 90 }, { name: '豬肉炒飯', price: 90 }, { type: 'subtitle', text: '湯系列' }, { name: '蛋花湯', price: 35 }, { name: '貢丸湯', price: 35 }, { name: '蛤仔湯', price: 40 }, { name: '魚皮湯', price: 40 }, { name: '滷油雞腿湯', price: 85 }, { type: 'subtitle', text: '鍋燒系列 (滷油加10)' }, { name: '麻婆豆腐燴飯', price: 100 }, { name: '滷油雞腿燴飯', price: 100 }, { name: '蝦仁燴飯', price: 100 }, { name: '沙茶雞肉/豬肉燴飯', price: 100 }, { name: '鍋燒系列', price: 85 }, { name: '鍋燒雞絲', price: 85 }, { name: '鍋燒烏龍', price: 85 }, { name: '鍋燒冬粉', price: 85 }, { name: '鍋燒王子麵', price: 85 }, { name: '鍋燒蒸煮麵', price: 85 }, { name: '鍋燒拉麵', price: 85 }, { name: '鍋燒泡麵', price: 85 }, { type: 'subtitle', text: '炒麵系列 (滷油加10)' }, { name: '炒意麵', price: 85 }, { name: '炒烏龍', price: 85 }, { name: '炒泡麵', price: 85 }, { type: 'subtitle', text: '其他系列' }, { name: '炒青菜', price: 60 }, { name: '煎鴨蛋', price: 60 }, { name: '魚皮粥', price: 70 }, { name: '魚肉粥', price: 70 }, { name: '水餃 (最少十粒)', price: '6元/粒' }, { name: '炸豬排', price: 60 }, { name: '炸雞排', price: 60 } ] },
        { name: "吳爸便當", phone: "077775102", address: "高雄市鳳山區文衡路189號", info: "營業時間: 09:00 - 20:00\n公休日: 每週六公休\n電話: 07-7775102 / 0968-788-909\n與鳳山高中距離: 約 1.8 公里 (開車約 5 分鐘，步行約 22 分鐘)", tags: ["便當", "closed:週六公休"], menu: [ { type: 'subtitle', text: '人氣主餐' }, { name: '台灣三寶飯 (香腸+鹹豬肉+無骨腿)', price: 90 }, { name: '韓國炸雞', price: 90 }, { name: '招牌油雞', price: 90 }, { name: '辣妹椒麻雞', price: 110 }, { type: 'subtitle', text: '便當' }, { name: '招牌雙拼飯 (油雞+炸排)', price: 130 }, { name: '炸雞排便當', price: 110 }, { name: '辦桌炸雞腿飯', price: 90 }, { name: '無骨雞腿排飯', price: 90 }, { name: '泰式椒麻魚', price: 80 }, { name: '炸排骨飯', price: 80 }, { name: '宮保雞丁飯', price: 80 }, { name: '招牌滷排骨飯', price: 80 }, { name: '鹹蛋瓜仔肉飯', price: 80 }, { name: '糖醋咕咾肉飯', price: 80 }, { name: '香煎雞腿排飯', price: 80 }, { name: '台味滷雞腿飯', price: 80 }, { name: '鯖魚飯', price: 80 }, { name: '鱈魚飯', price: 80 }, { name: '香腸便當', price: 75 }, { name: '鹹豬雞便當', price: 75 }, { name: '鹹豬肉便當', price: 75 }, { name: '古早味肉燥飯', price: 70 }, { type: 'subtitle', text: '綜合便當' }, { name: '炸雞腿 + 宮保雞丁', price: 90 }, { name: '炸雞腿 + 鯖魚', price: 90 }, { name: '炸雞腿 + 咕咾肉', price: 90 }, { type: 'subtitle', text: '菜飯便當' }, { name: '四菜', price: 75 }, { name: '三菜', price: 65 }, { name: '二菜', price: 55 } ] },
        { name: "陳麻飯", phone: "077778751", address: "高雄市鳳山區光復路一段81號", info: "週六公休。\n與鳳山高中距離：約 0.6 公里 (開車約 2 分鐘，步行約 7 分鐘)", tags: ["飯", "closed:週六公休"], menu: [] },
        { name: "老闆不夠辣", phone: "077998855", address: "高雄市鳳山區光復路一段1號", info: "營業時間: 11:00-13:50 / 16:00-20:00\n與鳳山高中距離: 約 0.6 公里 (開車約 2 分鐘，步行約 7 分鐘)\n備註: 餐點可自選加價升級為丼飯、咖哩飯、焗烤", tags: ["麵食", "小菜", "咖哩"], menu: [ { type: 'subtitle', text: '招牌咖哩飯' }, { name: '單點咖哩飯', price: 49 }, { name: '快樂兒童咖哩飯', price: 65 }, { name: '可樂餅咖哩飯', price: 80 }, { name: '鹽酥杏鮑菇咖哩飯', price: 90 }, { name: '卡拉雞咖哩飯', price: 90 }, { name: '炸豬排咖哩飯', price: 90 }, { name: '起司豬排咖哩飯', price: 100 }, { name: '黃金雞腿咖哩飯', price: 120 }, { name: '酥炸大雞排咖哩飯', price: 120 }, { name: '唐揚雞咖哩飯', price: 130 }, { name: '厚切豬排咖哩飯', price: 135 }, { name: '雜豬雙享咖哩飯', price: 130 }, { name: '海陸空霸王咖哩飯', price: 188 }, { type: 'subtitle', text: '嫩肉咖哩飯' }, { name: '國產嫩豬咖哩飯', price: 120 }, { name: '舒肥嫩雞咖哩飯', price: 120 }, { name: '紅燒燉牛咖哩飯', price: 140 }, { type: 'subtitle', text: '老闆推薦小點' }, { name: '煉乳銀絲卷', price: 45 }, { name: '鹽酥杏鮑菇', price: 45 }, { name: '和風胡麻豆腐', price: 45 }, { name: '甜不辣', price: 45 }, { name: '起司地瓜條', price: 45 }, { name: '紫金雙色QQ球', price: 45 }, { name: '洋蔥圈', price: 45 }, { name: '麥克雞塊', price: 45 }, { name: '可樂餅', price: 45 }, { name: '港式心菜', price: 25 }, { name: '味噌湯', price: 20 }, { name: '白飯', price: 15 } ] },
        { name: "華新牛排", phone: "077433522", address: "高雄市鳳山區瑞興路260號", info: "電話: 07-7433522 / 07-7431239 / 0930-035017\n與鳳山高中距離: 約 2.5 公里 (開車約 7 分鐘，步行約 30 分鐘)\n備註: 滿500元外送到府，隨餐附濃湯、飲料及餐包", tags: ["牛排"], menu: [ { type: 'subtitle', text: '排餐' }, { name: '超大厚切牛排', price: 180 }, { name: '龍力牛排', price: 150 }, { name: '頂級沙朗', price: 150 }, { name: '海陸大餐', price: 150 }, { name: '厚重牛排', price: 130 }, { name: '羊小排', price: 130 }, { name: '雙拼排', price: 130 }, { name: '大比目魚排', price: 120 }, { name: '胡椒鹹鮮蝦排', price: 120 }, { name: '香辣厚重豬排', price: 120 }, { name: '厚重豬排', price: 110 }, { name: '綜合排', price: 100 }, { name: '羊排', price: 100 }, { name: '雞腿排', price: 90 }, { name: '牛排', price: 80 }, { name: '小卷排', price: 80 }, { name: '豬排', price: 70 }, { type: 'subtitle', text: '其他' }, { name: '鐵板麵', price: 50 }, { name: '餐包 (2個)', price: 15 } ] },
        { name: "奇奇蚵仔煎", phone: "077905029", address: "高雄市鳳山區後庄街78號", info: "營業時間:\n週一至週五: 11:00-14:45 / 16:00-21:00\n週六至週日: 11:00-21:00\n與鳳山高中距離: 約 3.8 公里 (開車約 10 分鐘，步行約 45 分鐘)", tags: ["蚵仔煎"], menu: [ { type: 'subtitle', text: '大咻 (蚵仔煎系列)' }, { name: '大咻鮮蚵 (原味/蒜味/胡麻)', price: '77 / 87 / 87' }, { name: '大咻蝦仁 (原味/蒜味/胡麻)', price: '87 / 97 / 97' }, { name: '大咻花枝 (原味/蒜味/胡麻)', price: '87 / 97 / 97' }, { name: '大咻干貝 (原味/蒜味/胡麻)', price: '107 / 117 / 117' }, { type: 'subtitle', text: '可口 (酥脆系列)' }, { name: '可口蚵仔燒', price: 97 }, { name: '可口蝦仁燒', price: 117 }, { name: '可口花枝燒', price: 117 }, { name: '可口干貝燒', price: 137 }, { name: '可口沙拉燒', price: 147 }, { type: 'subtitle', text: '奇饗 (主食)' }, { name: '奇饗鮮蚵煎', price: 97 }, { name: '奇饗蝦仁煎', price: 117 }, { name: '奇饗花枝煎', price: 117 }, { name: '奇饗干貝煎', price: 137 }, { name: '奇饗綜合煎', price: 147 }, { type: 'subtitle', text: '配料品 (加料)' }, { name: '雞蛋/青菜', price: '+17' }, { name: '麵/粿/飯/冬粉', price: '+17' }, { name: '鮮蚵/蝦仁/花枝/干貝', price: '+67' }, { name: '起司/蝦卵/蝦仁/鯛魚', price: '+37' }, { name: '沙茶醬(乾)/麻辣醬(乾)', price: '+7' }, { type: 'subtitle', text: '配料品 (單點)' }, { name: '大咻蛤蠣湯', price: 37 }, { name: '大咻蚵仔蛋', price: 57 }, { name: '大咻蝦仁蛋', price: 57 }, { type: 'subtitle', text: '飲品' }, { name: '古早味紅茶', price: 27 }, { name: '烏梅汁', price: 27 }, { name: '暮香奶茶', price: 37 } ] },
        { name: "嘉義火雞肉飯", displayName: "李嘉義火雞肉飯", phone: "077474905", address: "高雄市鳳山區青年路二段140號", info: "電話: 747-4905 / 專線 0928-860568\n營業時間: 09:30 - 19:30\n公休日: 每星期日 (若有第五個星期日則正常營業)\n與鳳山高中距離: 約 2.1 公里 (開車約 6 分鐘，步行約 26 分鐘)", tags: ["飯", "closed:週日公休"], menu: [ { type: 'subtitle', text: '便當系列 (附3樣菜)' }, { name: '火雞肉飯特製便當', price: 85 }, { name: '肉燥飯特製便當', price: 85 }, { name: '吳郭魚特製便當', price: 90 }, { type: 'subtitle', text: '飯類' }, { name: '火雞肉飯 (內用/外帶)', price: '小45 / 大55' }, { name: '火雞肉飯 (外帶)', price: '小45 / 大70 (外帶大碗份量較多)' }, { name: '肉燥飯 (內用/外帶)', price: '小40 / 大50' }, { name: '肉燥飯 (外帶)', price: '小40 / 大60 (外帶大碗份量較多)' }, { type: 'subtitle', text: '切盤系列' }, { name: '火雞肉切盤', price: 80 }, { name: '火雞翅切盤', price: 100 }, { name: '火雞元寶切盤', price: 100 }, { type: 'subtitle', text: '湯類' }, { name: '薑絲過魚湯', price: 130 }, { name: '虱目魚皮湯', price: 55 }, { name: '火雞下水湯', price: 35 }, { name: '火雞腳湯', price: 35 }, { name: '脆筍湯', price: 35 }, { name: '虱目魚丸湯', price: 35 }, { name: '貢丸湯', price: 35 }, { name: '紫菜湯', price: 15 }, { type: 'subtitle', text: '各式精緻小菜' }, { name: '豆鼓吳郭魚', price: 50 }, { name: '筍干', price: 35 }, { name: '白菜魯', price: 35 }, { name: '皮蛋豆腐', price: 35 }, { name: '魯蛋', price: 15 }, { name: '魯貢丸', price: 10 }, { name: '油豆腐', price: 10 } ] },
        { name: "手作??", displayName: "手作功夫茶-高醫店?", phone: "073220885", address: "高雄市三民區自由一路99號", info: "**注意：店名不確定，請確認是否為此店家。**\n**店家位於三民區，與鳳山高中距離約 6.0 公里 (開車約 15 分鐘，步行約 1 小時 15 分鐘)，請務必確認外送範圍。**", tags: ["飲料"], menu: [] },
        { name: "山內村", displayName: "山內村咖哩 (鳳民店)", phone: "073963077", address: "高雄市三民區山東街117號", info: "電話: (07) 396-3077 / 093317890\n營業時間: 11:00-14:00 / 17:00-20:00\n公休日: 週二公休\n**注意：店家位於三民區，與鳳山高中距離約 4.9 公里 (開車約 12 分鐘，步行約 1 小時)，請務必確認外送範圍。**\n備註:\n升級太陽蛋 +15元\n升級歐姆蛋 +30元\n青醬加倍 +30元", tags: ["咖哩", "closed:週二公休"], menu: [ { type: 'subtitle', text: '熟成濃咖哩' }, { name: '原味熟成咖哩飯 (無肉)', price: 70 }, { name: '豬肉熟成咖哩飯', price: 90 }, { name: '實格斯牛五花咖哩飯', price: 110 }, { name: '舒肥香料雞肉咖哩飯', price: 100 }, { name: '德式香腸熟成咖哩飯', price: 100 }, { type: 'subtitle', text: '麻婆豆腐咖哩' }, { name: '麻婆豆腐咖哩飯', price: 80 }, { name: '豬肉麻婆豆腐咖哩飯', price: 100 }, { name: '牛五花麻婆豆腐咖哩飯', price: 120 }, { name: '舒肥香料雞肉麻婆豆腐咖哩飯', price: 110 }, { name: '德式香腸麻婆豆腐咖哩飯', price: 110 }, { type: 'subtitle', text: '單點' }, { name: '白飯', price: 15 }, { name: '咖哩醬(一碗)', price: 40 }, { name: '胡麻小黃瓜', price: 40 }, { name: '胡麻花椰菜', price: 40 }, { name: '日式牛蒡絲', price: 40 }, { name: '涼拌海帶絲', price: 40 }, { name: '鮮蝦貝柱味噌湯', price: 40 }, { name: '甘露煮杏鮑菇', price: 40 }, { name: '和風芥末海帶芽', price: 40 }, { name: '黃金泡菜', price: 40 } ] },
        { name: "曉食記", phone: "077103838", address: "高雄市鳳山區八德路二段212巷2號", info: "週一公休。\n與鳳山高中距離：約 2.0 公里 (開車約 6 分鐘，步行約 25 分鐘)", tags: ["早午餐", "closed:週一公休"], menu: [] },
        { name: "鳳城老牌米糕", displayName: "鳳城老牌米糕肉焿", phone: "077418180", address: "高雄市鳳山區維新路20號", info: "電話: 07-741-8180\n與鳳山高中距離: 約 1.1 公里 (開車約 4 分鐘，步行約 14 分鐘)", tags: ["米糕", "肉焿"], menu: [ { type: 'subtitle', text: '主食' }, { name: '米糕', price: 40 }, { name: '肉焿', price: 45 }, { name: '飯焿', price: 55 }, { name: '麵焿', price: 55 }, { name: '米粉焿', price: 55 }, { name: '冬粉焿', price: 55 }, { type: 'subtitle', text: '湯品' }, { name: '貢丸湯', price: 30 }, { name: '魚丸湯', price: 30 }, { name: '貢丸冬粉湯', price: 40 }, { name: '魚丸冬粉湯', price: 40 }, { type: 'subtitle', text: '小菜' }, { name: '油豆腐', price: 10 }, { name: '滷蛋', price: '10 (兩顆15元)' }, { name: '滷貢丸', price: 8 } ] },
        { name: "西貢河粉", phone: "077990014", address: "高雄市鳳山區自由路156號", info: "與鳳山高中距離：約 1.7 公里 (開車約 5 分鐘，步行約 20 分鐘)", tags: ["河粉"], menu: [] },
        { name: "一翻馫", phone: "0976667183", address: "高雄市鳳山區自由路28-2號", info: "訂購專線: 0976-667-183\n營業時間: 每週三固定公休，其餘時間不定時公休，請見店家LINE公告\n與鳳山高中距離: 約 1.4 公里 (開車約 4 分鐘，步行約 17 分鐘)\n備註:\n一公里內滿250元可外送\n麻辣湯底含牛油\n不吃蔥/蒜/洋蔥/胡蘿蔔/海鮮等，請提前告知", tags: ["飯糰", "closed:週三公休"], menu: [ { type: 'subtitle', text: '鍋燒 (可選：意麵/雞絲麵/冬粉/泡麵，換烏龍 +15元)' }, { name: '原味', price: 85 }, { name: '石頭', price: 90 }, { name: '沙茶', price: 90 }, { name: '泡菜', price: 100 }, { name: '牛奶起司', price: 110 }, { name: '麻辣(豬)', price: 110 }, { name: '麻奶(豬)', price: 120 }, { name: '藤椒酸湯(豬)', price: 130 }, { type: 'subtitle', text: '蓋飯' }, { name: '回鍋肉蓋飯', price: 100 }, { name: '醬燒五花蓋飯', price: 100 }, { name: '日式培根牛丼飯', price: 110 }, { name: '醬燒松阪豬蓋飯', price: 110 }, { name: '蔥爆牛肉蓋飯', price: 110 }, { name: '沙茶牛肉蓋飯', price: 110 }, { name: '醬燒牛胸腹蓋飯', price: 110 }, { name: '香蔥油雞蓋飯', price: 120 }, { name: '照燒雞腿蓋飯', price: 120 }, { name: '紐奧良雞腿蓋飯', price: 120 }, { name: '炸豬排蓋飯', price: 120 }, { name: '柚香嫩肩牛蓋飯', price: 140 }, { type: 'subtitle', text: '炒飯/麵' }, { name: '火腿炒飯', price: 80 }, { name: '培根炒飯', price: 85 }, { name: '肉絲炒飯', price: 85 }, { name: '香腸炒飯', price: 90 }, { name: '鹹魚炒飯', price: 90 }, { name: '鹹豬肉炒飯', price: 90 }, { name: '蝦仁炒飯', price: 95 }, { name: '櫻花蝦炒飯', price: 95 }, { name: '泡菜炒飯', price: 100 }, { name: '牛肉炒飯', price: 100 }, { name: '什錦炒飯', price: 100 }, { name: '老乾媽珠貝炒飯', price: 120 }, { name: '什錦炒麵', price: 100 }, { name: '什錦炒意麵', price: 100 }, { name: '什錦炒泡麵', price: 100 }, { type: 'subtitle', text: '炸物 & 小菜' }, { name: '廣島黑輪', price: 30 }, { name: '手工黑輪片', price: 30 }, { name: '可樂餅', price: 30 }, { name: '炸魚排', price: 35 }, { name: '煙燻豬耳朵', price: 30 }, { name: '涼拌黃瓜', price: 30 }, { name: '各式小菜', price: 30 }, { name: '皮蛋豆腐', price: 35 }, { name: '涼拌香茅牛肉(限量)', price: 60 }, { name: '口水雞(限量)', price: 70 }, { name: '醉雞(限量)', price: 70 }, { type: 'subtitle', text: '飲品' }, { name: '玻璃罐飲品', price: 20 }, { name: '紅茶', price: 25 }, { name: '原萃茶', price: 25 }, { name: '紅茶牛奶', price: 40 }, { type: 'subtitle', text: '加飯或加麵' }, { name: '飯、油麵、泡麵、冬粉', price: '+10' }, { name: '雞絲、意麵', price: '+15' }, { name: '讚岐烏龍', price: '+25' } ] },
        { name: "高大早點", phone: "077479869", address: "高雄市鳳山區光遠路279巷1號", info: "電話: 07-7479869\n與鳳山高中距離：約 1.3 公里 (開車約 3 分鐘，步行約 16 分鐘)\n備註: 特別需求，請提前告知。歡迎來電預訂外送。\n加蛋+10 / 加起司+10 / 加蔬菜+15", tags: ["早餐", "早午餐"], menu: [ { type: 'subtitle', text: '麵糊蛋餅' }, { name: '原味', price: 20 }, { name: '九層塔', price: 25 }, { name: '蔬菜', price: 25 }, { name: '玉米', price: 30 }, { name: '起司', price: 30 }, { name: '火腿', price: 35 }, { name: '鮪魚', price: 35 }, { name: '炸雞', price: 35 }, { name: '熱狗', price: 35 }, { name: '熱狗培根', price: 35 }, { name: '燻雞', price: 40 }, { name: '燒肉', price: 40 }, { type: 'subtitle', text: '果醬類' }, { name: '奶油', price: 20 }, { name: '草莓', price: 20 }, { name: '煉乳', price: 20 }, { name: '花生', price: 20 }, { name: '巧克力', price: 20 }, { name: '奶酥', price: 20 }, { name: '香蒜', price: 25 }, { name: '起司香蒜', price: 35 }, { type: 'subtitle', text: '中式點餐' }, { name: '鍋燒麵', price: 70 }, { name: '鍋燒粥', price: 70 }, { name: '鍋燒烏龍', price: 70 }, { name: '鍋燒米粉', price: 70 }, { name: '肉羹麵 (加滷泡菜15元)', price: 70 }, { name: '玉米濃湯', price: 25 }, { name: '玉米濃湯', price: 30 }, { name: '海鮮湯', price: 40 }, { type: 'subtitle', text: '肉酥' }, { name: '起司', price: 30 }, { name: '鮪魚', price: 35 }, { name: '燻雞', price: 40 }, { type: 'subtitle', text: '吐司 / 漢堡' }, { name: '卡拉雞腿 (片)', price: 40 }, { name: '照燒雞腿 (片)', price: 45 }, { name: '起司雞排 (片)', price: 45 }, { name: '蚵仔煎', price: 50 }, { name: '豬排', price: 40 }, { name: '豬排培根', price: 30 }, { name: '鮪魚', price: 35 }, { name: '燻雞', price: 35 }, { name: '雞排', price: 30 }, { name: '雞腿', price: 30 }, { name: '火腿蛋', price: 25 }, { name: '鮪魚蛋', price: 30 }, { name: '起司蛋', price: 30 }, { name: '玉米蛋', price: 30 }, { name: '肉鬆蛋', price: 30 }, { name: '醬油蛋 (濕)', price: 25 }, { name: '蘿蔔糕', price: 25 }, { name: '蔥肉餅', price: 25 }, { name: '熱狗', price: 20 }, { type: 'subtitle', text: '點心' }, { name: '蘿蔔糕', price: 15 }, { name: '蔥肉餅', price: 15 }, { name: '布丁酥', price: 20 }, { name: '鍋燒麵條', price: 30 }, { name: '小肉粽', price: 30 }, { name: '鹽酥雞', price: 30 }, { name: '熱狗 (3條)', price: 30 }, { name: '蛋包熱狗', price: 20 }, { name: '蔥抓餅', price: 25 }, { name: '蔥抓餅加蛋', price: 30 }, { name: '披薩抓餅', price: 30 }, { name: '蘿蔔糕', price: 30 }, { name: '薯餅', price: 30 }, { name: '薯餅', price: 20 }, { type: 'subtitle', text: '飲料' }, { name: '紅茶', price: '小15 / 大20' }, { name: '豆漿', price: '小20 / 大25' }, { name: '奶茶', price: '小25 / 大30' }, { name: '鮮奶茶', price: '小30 / 大40' }, { name: '咖啡牛奶', price: '小30 / 大40' }, { name: '草莓牛奶', price: '小30 / 大40' }, { name: '冬瓜茶', price: '小20 / 大25' }, { name: '檸檬紅茶', price: '小20 / 大25' }, { name: '芋頭牛奶', price: '小25 / 大30' }, { name: '米漿', price: '小20 / 大25' }, { name: '養樂多', price: 25 }, { name: '檸檬茶', price: 25 }, { name: '研磨芝麻奶茶', price: 35 }, { name: '研磨美式咖啡', price: 45 }, { name: '研磨拿鐵咖啡', price: 45 }, { type: 'subtitle', text: '特製' }, { name: '豬肉總匯', price: 55 }, { name: '雞腿總匯', price: 60 }, { name: '雞腿蛋餅', price: 55 }, { name: '豬肉蛋餅', price: 55 }, { name: '豬肉堡', price: 55 }, { name: '雞排蛋餅', price: 50 }, { name: '豬排蛋餅', price: 50 }, { name: '培根蛋餅', price: 45 }, { name: '燒肉蛋餅', price: 50 }, { name: '總匯蛋餅', price: 40 }, { name: '薯條蛋餅', price: 40 }, { name: '薯條漢堡', price: 50 }, { name: '漢堡蛋', price: 40 }, { name: '總匯沙拉', price: 30 }, { name: '饅頭夾肉', price: 50 }, { name: '饅頭夾蛋', price: 25 }, { name: '饅頭 (黑/白)', price: 15 } ] },
        { name: "夏目鐵板燒", displayName: "夏目鐵板燒料理便當", phone: "0925388050", address: "高雄市新興區尚義街119號", info: "營業時間: 11:00 - 18:30\n**注意：店家位於新興區，與鳳山高中距離約 5.6 公里 (開車約 15 分鐘，步行約 1 小時 10 分鐘)，請務必確認外送範圍。**\n備註:\n滿6個便當可外送，外送數量依實際距離調整\n大量訂單請於前一天訂購\n套餐附餐二選一：昆布柴魚清湯 或 古早味紅茶", tags: ["鐵板燒", "便當"], menu: [ { type: 'subtitle', text: '便當' }, { name: '麻婆豆腐飯', price: 100 }, { name: '蔥爆五花豬', price: 110 }, { name: '醬燒雞腿肉', price: 110 }, { name: '鐵板五花牛', price: 120 }, { name: '板煎鱈羊', price: 130 }, { name: '好餓配口蝦', price: 140 }, { type: 'subtitle', text: '套餐內容: 高麗菜、豆芽菜、日式蒸蛋' }, { type: 'subtitle', text: '單點 & 飲品' }, { name: '來一碗白飯', price: 10 }, { name: '日式水蒸蛋', price: 25 }, { name: '古早味紅茶', price: 20 }, { name: '濃紅茶鮮奶', price: 35 } ] },
        { name: "Chai&Tina", phone: "077408206", address: "高雄市鳳山區文衡路491號", info: "電話: (07) 7408206\n營業時間: AM10:30~PM08:00 (每週一公休)\n與鳳山高中距離：約 2.0 公里 (開車約 6 分鐘，步行約 25 分鐘)\n外送服務: 400元以上，外送距離3公里內\n備註: 加奶蓋+10 / 加珍珠+10 / 加椰果+10\n版本日期: 2023.03.14版", tags: ["new", "closed:週一公休", "咖啡", "輕食", "義大利麵", "焗烤", "漢堡", "飲料"], menu: [ { type: 'subtitle', text: '義大利麵 Dishes (可選: 青醬/白醬/紅醬/海鮮)' }, { name: '義大利麵', price: 120 }, { name: '蝦仁義大利麵', price: 130 }, { name: '燻雞義大利麵', price: 130 }, { name: '德式香腸義大利麵', price: 135 }, { name: '培根義大利麵', price: 140 }, { name: '蛤蜊義大利麵', price: 150 }, { name: '綜合義大利麵', price: 155 }, { name: '日式炸豬排義大利麵', price: 150 }, { name: '日式炸雞排義大利麵', price: 155 }, { name: '日式炸魚排義大利麵', price: 155 }, { name: '羅勒燻雞義大利麵', price: 155 }, { name: '牛肉義大利麵', price: 160 }, { name: '海鮮總匯義大利麵', price: 170 }, { type: 'subtitle', text: '焗烤飯類 Risotto (可選: 白醬/紅醬/青醬，焗飯+10元，起司加倍+35元)' }, { name: '蔬菜焗烤飯', price: 120 }, { name: '鮪魚焗烤飯', price: 125 }, { name: '燻雞焗烤飯', price: 130 }, { name: '培根焗烤飯', price: 130 }, { name: '海鮮焗烤飯', price: 145 }, { name: '牛肉焗烤飯', price: 145 }, { name: '章魚燒焗烤飯', price: 150 }, { name: '綜合焗烤飯', price: 155 }, { name: '炸豬排焗烤飯', price: 155 }, { name: '炸雞排焗烤飯', price: 160 }, { name: '炸魚排焗烤飯', price: 160 }, { name: '羅勒燻雞焗烤飯', price: 160 }, { name: '海鮮總匯焗烤飯', price: 170 }, { type: 'subtitle', text: '披薩 Pizza (皆為6吋)' }, { name: '原味', price: 95 }, { name: '燻雞起司', price: 110 }, { name: '玉米培根', price: 110 }, { name: '夏威夷', price: 120 }, { name: '海鮮總匯', price: 120 }, { name: '小肉豆', price: 120 }, { name: '培根', price: 130 }, { name: '小肉豆', price: 140 }, { type: 'subtitle', text: '美式總匯輕食系列 (皆附脆薯)' }, { name: '鮪魚沙拉', price: 100 }, { name: '羅勒雞肉', price: 100 }, { name: '日式炸魚排', price: 110 }, { name: '培根總匯', price: 110 }, { type: 'subtitle', text: '飲料 (不可熱飲)' }, { name: '紅茶', price: 25 }, { name: '綠茶', price: 25 }, { name: '冬瓜茶', price: 25 }, { name: '奶茶', price: 30 }, { name: '鮮奶茶', price: 40 }, { name: '拿鐵', price: 45 }, { name: '可可', price: 40 }, { name: '抹茶拿鐵', price: 40 }, { name: '珍珠奶茶', price: 40 }, { name: '鮮奶綠', price: 40 }, { name: '奶蓋綠茶', price: 40 }, { name: '奶蓋紅茶', price: 40 }, { type: 'subtitle', text: '吐司系列 (皆附脆薯)' }, { name: '起司蛋吐司', price: 65 }, { name: '鮪魚蛋吐司', price: 80 }, { name: '燻雞蛋吐司', price: 80 }, { name: '豬肉蛋吐司', price: 80 }, { type: 'subtitle', text: '漢堡 Burger (可加蛋+10元/起司+10元)' }, { name: '原味漢堡', price: '單點80 / 套餐125' }, { name: '蔬菜蛋堡', price: '單點80 / 套餐125' }, { name: '豬肉漢堡', price: '單點85 / 套餐130' }, { name: '雞肉漢堡', price: '單點90 / 套餐135' }, { type: 'subtitle', text: '兒童餐 Kids meal' }, { name: 'A餐 (麥克雞塊)', price: 65 }, { name: 'B餐 (薯條)', price: 65 }, { name: 'C餐 (熱狗)', price: 65 }, { type: 'subtitle', text: '輕食點心系列' }, { name: '熱狗', price: 20 }, { name: '雞塊', price: 30 }, { name: '薯條', price: 30 }, { name: '小肉豆', price: 30 }, { name: '黑輪', price: 40 }, { name: '甜不辣', price: 40 }, { name: '鹽酥雞', price: 50 }, { name: '檸檬雞柳', price: 50 }, { name: '洋蔥圈', price: 40 }, { name: '可樂餅', price: 40 } ] },
        { name: "大咖", phone: "077406399", address: "高雄市鳳山區中山路138-6號", info: "電話: 07-7406399\n營業時間: 09:00~13:30 / 16:00~20:00\n與鳳山高中距離：約 1.2 公里 (開車約 3 分鐘，步行約 15 分鐘)\n備註: 鳳山區滿300可外送，請提早2小時前來電訂餐。", tags: ["new", "飲料", "蛋包飯", "咖哩"], menu: [ { type: 'subtitle', text: '日式咖哩蛋包飯 (內用/外帶)' }, { name: '原味', price: 65 }, { name: '涮涮豬肉蛋包飯', price: 80 }, { name: '海鮮總匯咖哩蛋包飯', price: 80 }, { name: '香酥雞排咖哩蛋包飯', price: 80 }, { name: '麥克雞塊咖哩蛋包飯', price: 80 }, { name: '和風鮮蝦咖哩蛋包飯', price: 80 }, { name: '炸花枝排咖哩蛋包飯', price: 80 }, { name: '黃金魚排咖哩蛋包飯', price: 80 }, { name: '德式香腸咖哩蛋包飯', price: 80 }, { name: '日式豬排咖哩蛋包飯', price: 85 }, { name: '涮涮牛肉咖哩蛋包飯', price: 95 }, { name: '脆皮雞腿咖哩蛋包飯', price: 105 }, { type: 'subtitle', text: '焗烤飯' }, { name: '原味', price: 95 }, { name: '涮涮豬肉咖哩焗烤飯', price: 110 }, { name: '海鮮總匯咖哩焗烤飯', price: 110 }, { name: '香酥雞排咖哩焗烤飯', price: 110 }, { name: '麥克雞塊咖哩焗烤飯', price: 110 }, { name: '和風鮮蝦咖哩焗烤飯', price: 110 }, { name: '炸花枝排咖哩焗烤飯', price: 110 }, { name: '黃金魚排咖哩焗烤飯', price: 110 }, { name: '德式香腸咖哩焗烤飯', price: 110 }, { name: '日式豬排咖哩焗烤飯', price: 115 }, { name: '涮涮牛肉咖哩焗烤飯', price: 125 }, { name: '脆皮雞腿咖哩焗烤飯', price: 135 }, { type: 'subtitle', text: '咖哩烏龍麵' }, { name: '原味咖哩拌麵', price: 85 }, { name: '涮涮豬肉咖哩拌麵', price: 100 }, { name: '海鮮總匯咖哩拌麵', price: 100 }, { name: '香酥雞排咖哩拌麵', price: 100 }, { name: '麥克雞塊咖哩拌麵', price: 100 }, { name: '和風鮮蝦咖哩拌麵', price: 100 }, { name: '炸花枝排咖哩拌麵', price: 100 }, { name: '黃金魚排咖哩拌麵', price: 100 }, { name: '德式香腸咖哩拌麵', price: 100 }, { name: '日式豬排咖哩拌麵', price: 105 }, { name: '涮涮牛肉咖哩拌麵', price: 115 }, { name: '脆皮雞腿咖哩拌麵', price: 125 }, { type: 'subtitle', text: '咖哩烏龍湯麵' }, { name: '涮涮豬肉咖哩烏龍湯麵', price: 110 }, { name: '海鮮總匯咖哩烏龍湯麵', price: 110 }, { name: '香酥雞排咖哩烏龍湯麵', price: 110 }, { name: '麥克雞塊咖哩烏龍湯麵', price: 110 }, { name: '炸花枝排咖哩烏龍湯麵', price: 110 }, { name: '黃金魚排咖哩烏龍湯麵', price: 110 }, { name: '德式香腸咖哩烏龍湯麵', price: 110 }, { name: '日式豬排咖哩烏龍湯麵', price: 115 }, { name: '涮涮牛肉咖哩烏龍湯麵', price: 125 }, { name: '脆皮雞腿咖哩烏龍湯麵', price: 135 }, { type: 'subtitle', text: '鍋燒系列' }, { name: '海鮮鍋燒意麵', price: 75 }, { name: '海鮮鍋燒雞絲', price: 75 }, { name: '海鮮鍋燒冬粉', price: 75 }, { name: '海鮮鍋燒烏龍麵', price: 85 }, { name: '泡菜海鮮鍋燒★(附白飯)', price: 100 }, { name: '味噌海鮮鍋燒★(附白飯)', price: 100 }, { type: 'subtitle', text: '湯品 & 其他' }, { name: '白飯', price: 15 }, { name: '味噌湯', price: 15 }, { name: '蛋花湯', price: 30 }, { name: '貢丸湯', price: 30 }, { name: '海鮮', price: 50 }, { type: 'subtitle', text: '單點' }, { name: '炸雞塊', price: 35 }, { name: '炸薯條', price: 35 }, { name: 'QQ球', price: 40 }, { name: '雞腿', price: 50 }, { name: '排骨', price: 45 }, { name: '雞排', price: 45 }, { name: '鍋貼', price: 5 } ] },
        { name: "良食", phone: "077667271", address: "高雄市鳳山區五甲三路75號", info: "週日公休。\n與鳳山高中距離：約 4.0 公里 (開車約 10 分鐘，步行約 48 分鐘)", tags: ["new", "輕食", "closed:週日公休"], menu: [] },
        { name: "甲一飯包", displayName: "甲一飯包 鳳山店", phone: "077261685", address: "高雄市鳳山區瑞隆東路60號", info: "週日公休。\n與鳳山高中距離：約 4.4 公里 (開車約 12 分鐘，步行約 54 分鐘)", tags: ["new", "飯包", "closed:週日公休"], menu: [] },
        { name: "池上飯盒", displayName: "池上飯盒 鳳山經武店", phone: "077658052", address: "高雄市鳳山區新康街308號", info: "營業時間: AM10:30~PM2:00 / PM4:00~PM8:00\n公休日: 每週日公休\n與鳳山高中距離：約 1.9 公里 (開車約 5 分鐘，步行約 23 分鐘)", tags: ["new", "飯盒", "closed:週日公休"], menu: [ { name: '菜飯', price: 65 }, { name: '招牌飯', price: 80 }, { name: '蝦柳飯', price: 80 }, { name: '雞排飯', price: 80 }, { name: '雞腿飯', price: 80 }, { name: '魚排飯', price: 80 }, { name: '排骨飯', price: 80 }, { name: '原味豬肉飯', price: 80 }, { name: '香酥雞腿飯', price: 85 }, { name: '廣東鴨腿飯', price: 85 }, { name: '滷鯖魚飯', price: 85 }, { name: '滷鴨腿飯', price: 95 }, { name: '鱈魚飯', price: 110 } ] },
        { name: "鍋燒堂", phone: "077752322", address: "高雄市鳳山區凱旋路278號", info: "電話: 07-7752322\n與鳳山高中距離：約 1.0 公里 (開車約 3 分鐘，步行約 12 分鐘)", tags: ["new", "鍋燒", "炒飯", "咖哩"], menu: [ { type: 'subtitle', text: '鍋燒類 (加麵/加飯 +15元)' }, { name: '經典原味', price: 80 }, { name: '香濃沙茶', price: 80 }, { name: '招牌牛奶', price: 90 }, { name: '南洋咖哩', price: 90 }, { name: '韓式泡菜', price: 90 }, { name: '酸菜麻辣', price: 90 }, { name: '香草卡菲', price: 90 }, { name: '清香藥膳', price: 100 }, { name: '起司牛奶', price: 105 }, { name: '海產粥', price: 90 }, { type: 'subtitle', text: '炒飯類 (飯類加飯加10元)' }, { name: '肉絲炒飯', price: 80 }, { name: '雞肉炒飯', price: 80 }, { name: '蔬菜蛋炒飯', price: 80 }, { name: '茄汁蛋炒飯', price: 85 }, { name: '沙茶蛋炒飯', price: 85 }, { name: '塔根蛋炒飯', price: 85 }, { name: '雞肉蛋炒飯', price: 85 }, { name: '蝦仁蛋炒飯', price: 85 }, { name: '泡菜炒飯', price: 90 }, { name: '牛肉蛋炒飯', price: 100 }, { name: '什錦炒飯', price: 100 }, { name: '櫻花蝦炒飯', price: 105 }, { type: 'subtitle', text: '咖哩類' }, { name: '咖哩飯 (無肉)', price: 70 }, { name: '咖哩雞肉飯', price: 80 }, { name: '咖哩豬肉飯', price: 80 }, { name: '咖哩牛肉飯', price: 95 }, { name: '咖哩雞排飯', price: 100 }, { name: '咖哩雞腿飯', price: 125 }, { type: 'subtitle', text: '蒸飯類 (原味加起司+15元)' }, { name: '海苔飯 (無肉)', price: 70 }, { name: '海苔雞肉飯', price: 80 }, { name: '海苔豬肉飯', price: 80 }, { name: '海苔牛肉飯', price: 95 }, { name: '海苔雞排飯', price: 100 }, { name: '海苔雞腿飯', price: 90 }, { type: 'subtitle', text: '單點類' }, { name: '白飯', price: 10 }, { name: '韓式泡菜', price: 20 }, { name: '酥炸黑輪片', price: 40 }, { name: '酥炸雞塊', price: 40 }, { name: '炸薯條', price: 40 }, { name: '日式炸豬排', price: 55 }, { name: '咔啦炸雞排', price: 65 }, { type: 'subtitle', text: '紅燒類 (牛肉湯汁)' }, { name: '紅燒飯 (無肉)', price: 70 }, { name: '紅燒雞肉燴飯', price: 80 }, { name: '紅燒豬肉燴飯', price: 80 }, { name: '紅燒牛肉燴飯', price: 95 }, { name: '紅燒豬排燴飯', price: 100 }, { name: '紅燒咔啦雞排', price: 125 }, { type: 'subtitle', text: '湯類' }, { name: '蛋花湯', price: 30 }, { name: '貢丸湯', price: 30 }, { name: '蛤蜊湯', price: 40 }, { name: '鮮蝦蛤蜊湯', price: 45 } ] },
        { name: "南啵炒飯", phone: "077223704", address: "高雄市苓雅區福德三路342號", info: "電話: 07-7223704\n營業時間: 上午10:00 ~ 晚上9:30\n**注意：店家位於苓雅區，與鳳山高中距離約 3.2 公里 (開車約 8 分鐘，步行約 38 分鐘)，請務必確認外送範圍。**\n備註: 滿300即可外送，請先來電預約，大量訂購請於前一天預訂。", tags: ["new", "炒飯", "麵食"], menu: [ { type: 'subtitle', text: '醬炒飯' }, { name: '川味肉絲炒飯', price: 100 }, { name: '川味雞肉炒飯', price: 90 }, { name: '泡菜雞肉炒飯', price: 90 }, { name: '泡菜什錦炒意麵', price: 100 }, { name: '泡菜豬肉炒飯', price: 90 }, { name: '韓式泡菜炒烏龍', price: 95 }, { name: '海鮮湯麵', price: 85 }, { name: '台式什錦炒飯', price: 80 }, { name: '台式什錦炒烏龍', price: 85 }, { type: 'subtitle', text: '炒飯 (醬/廣式/蔥/湯)' }, { name: 'XO醬蝦仁炒飯', price: 130 }, { name: '什錦炒飯', price: 110 }, { name: '招牌炒飯', price: 110 }, { name: '鹹蛋蝦仁', price: 110 }, { name: '玉米炒飯', price: 100 }, { name: '牛肉炒飯', price: 100 }, { name: '海鮮炒飯', price: 95 }, { name: '豬肉炒飯', price: 95 }, { name: '雞肉炒飯', price: 95 }, { name: '鮮蝦炒飯', price: 95 }, { name: '蛤蠣炒飯', price: 95 }, { name: '皮蛋肉絲', price: 95 }, { name: '泡菜肉絲炒飯', price: 90 }, { name: '培根炒飯', price: 90 }, { name: '花枝炒飯', price: 90 }, { name: '青椒肉絲炒飯', price: 90 }, { name: '青椒牛肉炒飯', price: 100 }, { name: '青椒雞肉炒飯', price: 95 }, { name: '牛肉炒飯', price: 100 }, { name: '雞腿炒飯', price: 95 }, { name: '鮭魚炒飯', price: 120 }, { name: '鳳梨蝦仁炒飯', price: 110 }, { name: '蒜香雞丁炒飯', price: 80 }, { name: '蝦仁蛋炒飯', price: 80 }, { name: '泡菜蝦仁炒飯', price: 90 }, { name: '香腸蛋炒飯', price: 75 }, { name: '鹹魚炒飯', price: 80 }, { name: '白菜炒飯', price: 70 }, { name: '玉米蛋炒飯', price: 70 }, { name: '豬排炒飯', price: 70 }, { name: '肉絲蛋炒飯', price: 70 }, { name: '培根蛋炒飯', price: 70 }, { name: '香腸肉絲炒飯', price: 75 }, { name: '豬排蛋炒飯', price: 75 }, { name: '古早味蛋炒飯', price: 65 }, { type: 'subtitle', text: '燴飯 / 麵 (泰式/廣式)' }, { name: '海鮮燴飯', price: 110 }, { name: '滑蛋蝦仁燴飯', price: 100 }, { name: '什錦燴飯', price: 95 }, { name: '蝦仁燴飯', price: 90 }, { name: '肉絲燴飯', price: 90 }, { name: '滑蛋肉絲燴飯', price: 90 }, { name: '滑蛋牛肉燴飯', price: 100 }, { name: '滑蛋雞肉燴飯', price: 95 }, { name: '韓式雞肉燴飯', price: 95 }, { name: '泰式海鮮燴飯', price: 110 }, { name: '泰式雞肉燴飯', price: 100 }, { name: '泰式蝦仁燴飯', price: 100 }, { name: '港式海鮮燴飯', price: 110 }, { name: '港式雞肉燴飯', price: 100 }, { name: '港式豬肉燴飯', price: 95 }, { name: '泰式牛肉燴飯', price: 100 }, { name: '海鮮麵', price: 110 }, { name: '什錦麵', price: 100 }, { name: '豬肉麵', price: 95 }, { name: '雞肉麵', price: 95 }, { name: '牛肉麵', price: 100 }, { name: '蝦仁麵', price: 95 }, { name: '港式海鮮麵', price: 110 }, { name: '泰式海鮮麵', price: 110 }, { type: 'subtitle', text: '炒麵 / 烏龍麵' }, { name: '沙茶豬肉炒麵', price: 90 }, { name: '沙茶牛肉炒麵', price: 100 }, { name: '沙茶什錦炒意麵', price: 110 }, { name: '泡菜豬肉炒烏龍', price: 95 }, { name: '川味肉絲炒烏龍', price: 95 }, { name: '川味雞肉炒烏龍', price: 90 }, { name: '台式什錦炒烏龍', price: 100 }, { name: '什錦炒烏龍', price: 90 }, { type: 'subtitle', text: '平價快炒' }, { name: '打拋豬', price: 120 }, { name: '醬爆豬肉', price: 130 }, { name: '蔥爆牛肉', price: 130 }, { name: '泰式花枝', price: 150 }, { name: '蔥爆雞肉', price: 120 }, { name: '香腸炒蛋', price: 120 }, { name: '醬爆鮮蚵', price: 140 }, { name: '宮保雞丁', price: 130 }, { name: '花枝羹', price: 150 }, { name: '蒜香中卷', price: 130 }, { name: '涼拌黃瓜', price: 40 }, { name: '泰式涼拌豬皮', price: 40 }, { name: '蒜香毛豆', price: 30 }, { name: '涼拌海帶絲', price: 30 }, { name: '黃金泡菜', price: 50 }, { name: '涼拌豬肝', price: 50 }, { name: '涼拌豬頭皮', price: 50 }, { name: '蒜香花椰菜', price: 60 }, { name: '涼拌香菇', price: 60 }, { name: '涼拌豬舌', price: 60 }, { name: '黃金泡菜', price: 50 }, { name: '豬血糕', price: 50 }, { type: 'subtitle', text: '湯品' }, { name: '海鮮羹', price: 140 }, { name: '泰式海鮮羹', price: 140 }, { name: '海鮮湯', price: 130 }, { name: '招牌蝦仁湯', price: 90 }, { name: '肉絲湯', price: 80 }, { name: '豬肉湯', price: 80 }, { name: '雞肉湯', price: 80 }, { name: '牛花湯', price: 120 }, { name: '貢丸湯', price: 40 }, { name: '魚丸湯', price: 40 }, { name: '魚羹湯', price: 40 }, { type: 'subtitle', text: '季節時蔬' }, { name: '清炒水蓮', price: 80 }, { name: '清炒菠菜', price: 80 }, { name: '清炒龍鬚菜', price: 80 }, { name: '櫻花蝦高麗菜', price: 80 }, { name: '清炒空心菜', price: 60 }, { name: '清炒高麗菜', price: 60 }, { name: '清炒小白菜', price: 60 }, { type: 'subtitle', text: '鍋燒' }, { name: '海產羹', price: 120 }, { name: '韓式泡菜海鮮麵', price: 130 }, { name: '韓式泡菜肉絲麵', price: 95 }, { name: '招牌烏龍麵', price: 90 }, { name: '鍋燒泡飯', price: 85 }, { name: '蛤蠣麵', price: 85 }, { name: '豬肉湯', price: 80 }, { type: 'subtitle', text: '滷味' }, { name: '白飯', price: 10 }, { name: '荷包蛋', price: 20 } ] },
        { name: "太師傅", displayName: "太師傅便當-鳳山青年店", phone: "077218852", address: "高雄市鳳山區青年路二段497號", info: "與鳳山高中距離：約 1.7 公里 (開車約 5 分鐘，步行約 20 分鐘)", tags: ["new", "便當"], menu: [] },
        { name: "梅家村排骨飯", displayName: "梅家村排骨飯 鳳山店", phone: "077990002", address: "高雄市鳳山區青年路二段2號", info: "電話: 07-7990002 / 07-7990609\n營業時間: 週六下午二點後店休 / 週日店休\n與鳳山高中距離: 約 1.6 公里 (開車約 5 分鐘，步行約 20 分鐘)\n歡迎團體訂購", tags: ["new", "飯", "排骨飯", "closed:週六下午/週日公休"], menu: [ { name: '排骨飯', price: 95 }, { name: '雞腿飯', price: 115 }, { name: '魯肉飯', price: 95 }, { name: '魚排飯', price: 95 } ] },
        { name: "成峰便當", phone: "077481919", address: "高雄市鳳山區中山西路238號", info: "與鳳山高中距離：約 1.5 公里 (開車約 4 分鐘，步行約 19 分鐘)", tags: ["new", "便當"], menu: [] },
        { name: "豚將拉麵", displayName: "豚將拉麵 鳳山光遠店", phone: "077210485", address: "高雄市鳳山區光遠路87號", info: "週一公休。\n與鳳山高中距離：約 0.9 公里 (開車約 3 分鐘，步行約 11 分鐘)", tags: ["new", "拉麵", "closed:週一公休"], menu: [] },
        { name: "麥圓多", displayName: "麥圓多 日式咖哩蛋包飯", phone: "077218689", address: "鳳山區南江街130號", info: "營業時間:\n上午 09:00 ~ 下午 14:00\n下午 16:00 ~ 晚上 20:30\n與鳳山高中距離：約 1.7 公里 (開車約 4-5 分鐘，步行約 20 分鐘)\n外送服務: 滿300元即可外送 (視距離而定)，請於一小時前來電預訂。", tags: ["new", "早午餐", "咖哩", "蛋包飯"], menu: [ { type: 'subtitle', text: '蛋包飯 (皆可焗烤+30元)' }, { name: '原味咖哩蛋包飯 (無肉)', price: 65 }, { name: '鱈魚咖哩蛋包飯', price: 80 }, { name: '麥克雞塊咖哩蛋包飯', price: 80 }, { name: '黃金鮮蝦咖哩蛋包飯', price: 80 }, { name: '海鮮總匯咖哩蛋包飯', price: 80 }, { name: '川燙豬肉片咖哩蛋包飯', price: 80 }, { name: '雞排咖哩蛋包飯', price: 85 }, { name: '雞肉丁咖哩蛋包飯', price: 90 }, { name: '卡滋豬排咖哩蛋包飯', price: 90 }, { name: '牛肉咖哩蛋包飯', price: 95 }, { name: '脆皮雞腿咖哩蛋包飯', price: 105 }, { name: '無骨雞腿咖哩蛋包飯', price: 105 }, { type: 'subtitle', text: '咖哩拌麵 (皆可焗烤+30元)' }, { name: '原味咖哩拌麵 (無肉)', price: 85 }, { name: '鱈魚咖哩拌麵', price: 100 }, { name: '麥克雞塊咖哩拌麵', price: 100 }, { name: '黃金鮮蝦咖哩拌麵', price: 100 }, { name: '海鮮總匯咖哩拌麵', price: 100 }, { name: '川燙豬肉片咖哩拌麵', price: 100 }, { name: '雞排咖哩拌麵', price: 105 }, { name: '雞肉丁咖哩拌麵', price: 110 }, { name: '卡滋豬排咖哩拌麵', price: 110 }, { name: '牛肉咖哩拌麵', price: 115 }, { name: '脆皮雞腿咖哩拌麵', price: 125 }, { name: '無骨雞腿咖哩拌麵', price: 125 }, { type: 'subtitle', text: '咖哩雞絲麵' }, { name: '原味', price: 75 }, { name: '雞肉', price: 90 }, { name: '雞排', price: 95 }, { name: '雞肉丁', price: 100 }, { name: '豬排', price: 100 }, { name: '牛肉', price: 105 }, { type: 'subtitle', text: '咖哩烏龍湯麵' }, { name: '原味', price: 85 }, { name: '海鮮總匯咖哩烏龍湯麵', price: 110 }, { name: '豬肉咖哩烏龍湯麵', price: 110 }, { name: '牛肉咖哩烏龍湯麵', price: 110 }, { type: 'subtitle', text: '焗烤飯' }, { name: '原味咖哩焗烤飯', price: 95 }, { name: '鱈魚咖哩焗烤飯', price: 110 }, { name: '麥克雞塊咖哩焗烤飯', price: 110 }, { name: '黃金鮮蝦咖哩焗烤飯', price: 110 }, { name: '海鮮總匯咖哩焗烤飯', price: 110 }, { name: '川燙豬肉片咖哩焗烤飯', price: 110 }, { name: '雞排咖哩焗烤飯', price: 115 }, { name: '雞肉丁咖哩焗烤飯', price: 120 }, { name: '卡滋豬排咖哩焗烤飯', price: 120 }, { name: '牛肉咖哩焗烤飯', price: 125 }, { name: '脆皮雞腿咖哩焗烤飯', price: 135 }, { name: '無骨雞腿咖哩焗烤飯', price: 135 }, { type: 'subtitle', text: '湯類' }, { name: '味噌', price: 15 }, { name: '玉米濃湯', price: 25 }, { name: '海鮮湯', price: 55 }, { type: 'subtitle', text: '單點' }, { name: '可樂餅', price: 35 }, { name: '麥克雞塊', price: 35 }, { name: '小肉豆', price: 35 }, { name: 'QQ棒', price: 40 }, { name: '薯條', price: 40 }, { name: '辣味雞塊', price: 40 }, { name: '雞排', price: 45 }, { name: '豬排', price: 45 }, { type: 'subtitle', text: '其他' }, { name: '白飯', price: 10 }, { name: '每碗粥', price: 70 } ] },
        { name: "三記港式燒臘", phone: "077632383", address: "高雄市鳳山區五甲三路13號", info: "與鳳山高中距離：約 4.0 公里 (開車約 10 分鐘，步行約 48 分鐘)", tags: ["new", "燒臘"], menu: [] },
        { name: "也竹咖哩", phone: "077672116", address: "高雄市鳳山區五甲一路96號", info: "週日公休。\n與鳳山高中距離：約 2.5 公里 (開車約 7 分鐘，步行約 30 分鐘)", tags: ["new", "咖哩", "closed:週日公休"], menu: [] },
        { name: "桌上賓", displayName: "桌上賓會議餐盒-高雄", phone: "077216172", address: "高雄市苓雅區福德一路89號", info: "**注意：店家位於苓雅區，與鳳山高中距離約 2.9 公里 (開車約 8 分鐘，步行約 35 分鐘)，請務必確認外送範圍。**", tags: ["new", "便當"], menu: [] },
        { name: "新百齡", phone: "077611199", address: "高雄市鳳山區五甲二路466號", info: "與鳳山高中距離：約 3.4 公里 (開車約 9 分鐘，步行約 40 分鐘)", tags: ["new", "排骨飯"], menu: [] },
    ];
    
    // --- 官網功能 ---
    function setupOfficialWebsiteJS() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            if (question) {
                question.addEventListener('click', () => {
                    item.classList.toggle('active');
                    faqItems.forEach(other => { if (other !== item) other.classList.remove('active'); });
                });
            }
        });
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });
        const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
        elementsToAnimate.forEach(el => observer.observe(el));
        
        const vipCard = document.querySelector('.membership-card.vip');
        if (vipCard) {
            if(!vipCard.querySelector('.membership-content')){
                const content = vipCard.innerHTML;
                vipCard.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'membership-content';
                wrapper.innerHTML = content;
                vipCard.appendChild(wrapper);
            }
        }

        const modalCloseBtn = modal ? modal.querySelector('.modal-close-btn') : null;
        if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        if(modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        if(vendorGrid) vendorGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.vendor-card');
            if(card) populateAndShowModal(card.dataset.vendorName);
        });

        if (searchInput) {
            renderVendors();
            searchInput.addEventListener('input', (e) => renderVendors(e.target.value));
        }
    }
    
    function renderVendors(filter = '') {
        if (!vendorGrid) return;
        vendorGrid.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredData = vendorData.filter(vendor => {
            const nameMatch = (vendor.displayName || vendor.name).toLowerCase().includes(lowerCaseFilter);
            const tagMatch = vendor.tags && vendor.tags.some(tag => tag.toLowerCase().includes(lowerCaseFilter));
            return nameMatch || tagMatch;
        });
        if (filteredData.length === 0) { vendorGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary-color);">找不到符合條件的店家...</p>`; return; }
        filteredData.forEach(vendor => {
            const card = document.createElement('div');
            card.className = 'vendor-card';
            card.dataset.vendorName = vendor.name;
            let tagsHTML = '';
            if (vendor.tags) {
                vendor.tags.forEach(tag => {
                    let className = 'vendor-tag';
                    let tagText = tag;
                    if (tag.startsWith('new')) { className += ' new'; tagText = '新店家'; }
                    else if (tag.startsWith('closed:')) { className += ' closed'; tagText = tag.replace('closed:', ''); }
                    tagsHTML += `<span class="${className}">${tagText}</span>`;
                });
            }
            card.innerHTML = `<div class="vendor-info-content"><h3 class="vendor-name">${vendor.displayName || vendor.name}</h3><div class="vendor-tags">${tagsHTML}</div></div><div class="vendor-action-text">點擊查看菜單</div>`;
            vendorGrid.appendChild(card);
        });
    }

    function populateAndShowModal(vendorName) {
        const vendor = vendorData.find(v => v.name === vendorName);
        if (!vendor || !modal) return;
        modal.querySelector('#modal-vendor-name').textContent = vendor.displayName || vendor.name;
        const phoneLink = modal.querySelector('#modal-vendor-phone');
        if (vendor.phone && vendor.phone !== "無") { 
            phoneLink.href = `tel:${vendor.phone}`; 
            phoneLink.style.display = 'inline-flex'; 
            modal.querySelector('#modal-vendor-phone-text').textContent = vendor.phone; 
        } else { 
            phoneLink.style.display = 'none'; 
        }
        modal.querySelector('#modal-vendor-map').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address || '高雄 ' + (vendor.displayName || vendor.name))}`;
        const tagsContainer = modal.querySelector('#modal-vendor-tags');
        tagsContainer.innerHTML = '';
        if (vendor.tags) { 
            vendor.tags.forEach(tag => {
                let className = 'vendor-tag';
                let tagText = tag;
                if (tag.startsWith('new')) { className += ' new'; tagText = '新店家'; }
                else if (tag.startsWith('closed:')) { className += ' closed'; tagText = tag.replace('closed:', ''); }
                tagsContainer.innerHTML += `<span class="${className}">${tagText}</span>`;
            });
         }
        modal.querySelector('#modal-vendor-info').textContent = vendor.info || '無';
        const menuContainer = modal.querySelector('#modal-vendor-menu');
        if (vendor.menu && vendor.menu.length > 0) {
            menuContainer.className = 'modal-menu-grid';
            menuContainer.innerHTML = '';
            vendor.menu.forEach(item => {
                if (item.type === 'subtitle') {
                    menuContainer.innerHTML += `<h4 class="modal-menu-subtitle">${item.text}</h4>`;
                } else {
                    const priceText = (item.price === undefined || item.price === null) ? '' : (typeof item.price === 'string' ? item.price : `$${item.price}`);
                    menuContainer.innerHTML += `<div class="modal-menu-item"><span class="modal-menu-name">${item.name}</span><span class="modal-menu-price">${priceText}</span></div>`;
                }
            });
        } else {
            menuContainer.className = 'modal-placeholder';
            menuContainer.innerHTML = '菜單資訊準備中...';
        }
        openModal();
    }
    
    function openModal() { if (modal) { modal.classList.add('active'); body.classList.add('modal-open'); } }
    function closeModal() { if (modal) { modal.classList.remove('active'); body.classList.remove('modal-open'); } }
    
    function initDynamicBackground() {
        if (!menuBackgroundContainer) return;
        if(menuBackgroundContainer.childElementCount > 0) {
             menuBackgroundContainer.style.display = 'block';
             return;
        }

        const images = [ 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1562967915-92ae0c320a01?q=80&w=2787&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=2940&auto=format&fit=crop' ];
        images.forEach(src => { 
            const img = new Image();
            img.src = src; 
            const div = document.createElement('div'); 
            div.className = 'bg-image'; 
            div.style.backgroundImage = `url(${src})`; 
            menuBackgroundContainer.appendChild(div); 
        });
        menuBackgroundContainer.style.display = 'block';

        const bgImages = menuBackgroundContainer.querySelectorAll('.bg-image');
        let currentIndex = 0;
        const changeBg = () => { 
            if(document.getElementById('page-menu').classList.contains('page-active')) {
                bgImages.forEach(img => img.classList.remove('active')); 
                bgImages[currentIndex].classList.add('active'); 
                currentIndex = (currentIndex + 1) % bgImages.length; 
            }
        };
        changeBg();
        setInterval(changeBg, 7000);
    }
    
    // ================== 應用初始化 ==================
    function init() {
        setupOfficialWebsiteJS();
        switchPage('page-home');
    }

    init();
});