/* 檔案: script.js (最终功能完整版 v2 - 包含完整点餐系统) */

document.addEventListener('DOMContentLoaded', () => {
    // ================== 全局變數 & API 設定 ==================
    const API_BASE_URL = 'https://no-one-help-official-website-v3-1.onrender.com';
    let chatInterval;
    let calCurrentDate = new Date();
    let datesWithMenu = [];
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
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYearEl = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const orderModal = document.getElementById('calendar-order-modal');
    const orderModalCloseBtn = orderModal.querySelector('.modal-close-btn');
    const modalDateEl = document.getElementById('modal-date');
    const modalVendorEl = document.getElementById('modal-vendor');
    const modalMenuTextEl = document.getElementById('modal-menu-text');
    const modalOrderInput = document.getElementById('modal-order-input');
    const modalSaveOrderBtn = document.getElementById('modal-save-order-btn');
    
    // ================== 狀態管理 (Token) ==================
    const Auth = {
        saveToken: (token) => localStorage.setItem('authToken', token),
        getToken: () => localStorage.getItem('authToken'),
        clearToken: () => localStorage.removeItem('authToken'),
        isLoggedIn: () => Auth.getToken() !== null,
    };

    // ================== 核心：頁面切換邏輯 ==================
    function switchPage(targetId) {
        if ((targetId === 'page-customer-service' || targetId === 'page-calendar') && !Auth.isLoggedIn()) {
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
            let isActive = linkTarget === targetId;
            if (['page-login', 'page-register'].includes(targetId) && (linkTarget === 'page-customer-service' || linkTarget === 'page-calendar')) {
                 // 稍微調整邏輯，讓點客服或月曆跳到登入時，對應的連結也能亮
                if(linkTarget === 'page-customer-service' && targetId === 'page-login' || linkTarget ==='page-calendar' && targetId ==='page-login')
                isActive = true;
            }
             if(['page-login','page-register'].includes(targetId) && l.dataset.target === 'page-customer-service' && !sidebarLinks[3].classList.contains('active-link'))
            {
                l.classList.add('active-link')
            }else if(['page-login','page-register'].includes(targetId) && l.dataset.target === 'page-calendar' && !sidebarLinks[2].classList.contains('active-link')){
                l.classList.add('active-link')
            }else{
                l.classList.toggle('active-link', isActive);
            }

        });
        
        window.scrollTo(0, 0);
        if (targetId === 'page-menu') initDynamicBackground();
        if (targetId === 'page-customer-service') startChatSession();
        if (targetId === 'page-calendar') fetchMenusForMonth();
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
                // 登入後預設跳轉到月曆頁
                switchPage('page-calendar');
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
    
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
        fetchMenusForMonth();
    });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
        fetchMenusForMonth();
    });

    if(orderModalCloseBtn) orderModalCloseBtn.addEventListener('click', closeOrderModal);
    if(orderModal) orderModal.addEventListener('click', (e) => { if (e.target === orderModal) closeOrderModal(); });
    if(modalSaveOrderBtn) modalSaveOrderBtn.addEventListener('click', saveOrder);

    // ================== 功能性函數 ==================
    // --- 聊天功能 ---
    function startChatSession() {
        if (chatInterval) clearInterval(chatInterval);
        fetchChatMessages();
        chatInterval = setInterval(fetchChatMessages, 3000);
    }
    function stopChatSession() { clearInterval(chatInterval); }
    async function fetchChatMessages() { /* 和上一版相同 */ }
    async function sendChatMessage() { /* 和上一版相同 */ }

    // --- 月曆 & 訂餐功能 ---
    async function fetchMenusForMonth() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/calendar/menus`);
            datesWithMenu = await response.json();
            await renderCalendar();
        } catch (error) { console.error("無法獲取菜單月份資訊:", error); }
    }

    async function renderCalendar() {
        if (!calendarGrid || !currentMonthYearEl) return;
        const year = calCurrentDate.getFullYear();
        const month = calCurrentDate.getMonth();
        currentMonthYearEl.textContent = `${year}年 ${month + 1}月`;
        calendarGrid.innerHTML = '';
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.innerHTML += '<div class="calendar-day not-current-month"></div>';
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayElement = document.createElement('div');
            dayElement.textContent = i;
            dayElement.dataset.date = dateStr;
            if (datesWithMenu.includes(dateStr)) {
                dayElement.className = 'calendar-day active-day has-menu';
                dayElement.addEventListener('click', () => openOrderModal(dateStr));
            } else {
                dayElement.className = 'calendar-day not-current-month';
            }
            if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
                dayElement.classList.add('today');
            }
            calendarGrid.appendChild(dayElement);
        }
    }

    async function openOrderModal(dateStr) {
        if (!Auth.isLoggedIn()) {
            alert('請先登入才能進行點餐！');
            switchPage('page-login');
            return;
        }

        orderModal.classList.add('active');
        body.classList.add('modal-open');
        modalDateEl.textContent = `${dateStr} 點餐`;
        modalVendorEl.textContent = "載入中...";
        modalMenuTextEl.textContent = "載入中...";
        modalOrderInput.value = "載入您的訂單中...";
        const token = Auth.getToken();

        try {
            const [menuRes, orderRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/calendar/menu/${dateStr}`),
                fetch(`${API_BASE_URL}/api/orders/${dateStr}`, { headers: { 'Authorization': token } })
            ]);

            const menuData = menuRes.ok ? await menuRes.json() : { vendor: '無', menuText: '本日未提供菜單' };
            const orderData = orderRes.ok ? await orderRes.json() : { orderText: '' };
            
            modalVendorEl.textContent = `合作店家：${menuData.vendor || '未指定'}`;
            modalMenuTextEl.textContent = menuData.menuText || '店家未提供菜單文字';
            modalOrderInput.value = orderData.orderText || '';
            modalSaveOrderBtn.dataset.date = dateStr;
        } catch(error) {
            console.error('打開點餐視窗時出錯:', error);
            modalVendorEl.textContent = "錯誤";
            modalMenuTextEl.textContent = "無法載入菜單資訊，請稍後再試。";
        }
    }

    function closeOrderModal() {
        orderModal.classList.remove('active');
        body.classList.remove('modal-open');
    }

    async function saveOrder() {
        const dateStr = modalSaveOrderBtn.dataset.date;
        const orderText = modalOrderInput.value;
        const token = Auth.getToken();

        if (!dateStr || !token) return alert('發生錯誤，無法儲存訂單。');

        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/${dateStr}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ orderText })
            });

            if (response.ok) {
                alert('訂單已成功儲存/更新！');
                closeOrderModal();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || '儲存失敗');
            }
        } catch(error) {
            alert(`儲存訂單失敗：${error.message}`);
        }
    }
    
    // (補全聊天功能的函式)
    async function fetchChatMessages() {
        const token = Auth.getToken(); if (!token || !chatBox) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages`, { headers: { 'Authorization': token } }); if (!response.ok) throw new Error('無法獲取訊息'); const messages = await response.json(); const shouldScroll = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50; chatBox.innerHTML = ''; if (messages.length === 0) { chatBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary-color);">目前沒有對話紀錄，開始您的第一次對話吧！</p>'; } else { messages.forEach(msg => { const customerDiv = document.createElement('div'); customerDiv.className = 'chat-message customer-msg'; customerDiv.textContent = msg.customerMessage; chatBox.appendChild(customerDiv); if (msg.staffReply) { const staffDiv = document.createElement('div'); staffDiv.className = 'chat-message staff-reply'; staffDiv.textContent = `客服：${msg.staffReply}`; chatBox.appendChild(staffDiv); } }); } if (shouldScroll) chatBox.scrollTop = chatBox.scrollHeight;
        } catch (error) { console.error("獲取聊天訊息失敗:", error); chatBox.innerHTML = '<p style="text-align:center; color: #ff5252;">無法連接客服中心，請稍後再試。</p>'; stopChatSession(); }
    }
    async function sendChatMessage() {
        const token = Auth.getToken(); const message = messageInput.value.trim(); if (!message || !token) return;
        try { await fetch(`${API_BASE_URL}/api/message`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ message }) }); messageInput.value = ''; fetchChatMessages();
        } catch (error) { console.error('訊息發送失敗:', error); }
    }
    
    // --- 官網功能 ---
    const vendorData = [ { name: "歐賣咖", displayName: "歐賣咖 咖哩工坊", phone: "073806973", address: "高雄市三民區正興路82號", info: "營業時間:\n上午 11:00 ~ 下午 14:00\n下午 17:00 ~ 晚上 20:30\n\n外送資訊: 滿5-10份餐點可外送 (視路程)\n與鳳山高中距離：約 4.9 公里 (開車約 12 分鐘，步行約 1 小時)", tags: ["咖哩", "義大利麵", "鍋燒"], menu: [ { type: 'subtitle', text: '咖哩蛋包飯 (加大+10元 / 焗烤+30元)' }, { name: '原味', price: 70 }, { name: '雞排', price: 90 }, { name: '魚排', price: 90 }, { name: '花枝排', price: 90 }, { name: '豬肉', price: 95 }, { name: '雞腿丁', price: 95 }, { name: '海鮮總匯', price: 95 }, { name: '卡滋豬排', price: 100 }, { name: '脆皮雞腿', price: 100 }, { name: '牛肉', price: 110 }, { name: '炸蝦X3', price: 145 }, { name: '唐揚雞', price: 150 }, { name: '酥炸魷魚', price: 160 }, { type: 'subtitle', text: '咖哩拌麵 (加大+20元)' }, { name: '原味', price: 80 }, { name: '雞排', price: 110 }, { name: '魚排', price: 110 }, { name: '花枝排', price: 110 }, { name: '豬肉', price: 110 }, { name: '雞腿丁', price: 110 }, { name: '海鮮總匯', price: 110 }, { name: '卡滋豬排', price: 120 }, { name: '脆皮雞腿', price: 120 }, { name: '牛肉', price: 130 }, { name: '炸蝦X3', price: 165 }, { name: '唐揚雞', price: 170 }, { name: '酥炸魷魚', price: 180 }, { type: 'subtitle', text: '義大利麵 (白醬/紅醬/青醬+10元/換焗飯+20元)' }, { name: '原味', price: 70 }, { name: '雞排', price: 105 }, { name: '魚排', price: 105 }, { name: '花枝排', price: 105 }, { name: '豬肉', price: 105 }, { name: '雞腿丁', price: 105 }, { name: '蛤蜊', price: 105 }, { name: '豬排', price: 110 }, { name: '雞腿', price: 110 }, { name: '牛肉', price: 120 }, { name: '肉醬', price: 100 }, { name: '炸蝦X3', price: 145 }, { name: '唐揚雞', price: 150 }, { name: '酥炸魷魚', price: 160 }, { type: 'subtitle', text: '鍋燒系列' }, { name: '意麵/雞絲麵/冬粉/鍋燒粥', price: 90 }, { name: '烏龍麵', price: 100 }, { name: '麻婆豆腐燴飯', price: 85 }, { type: 'subtitle', text: '丼飯' }, { name: '親子丼', price: 100 }, { name: '豬肉丼', price: 100 }, { name: '豬排丼', price: 100 }, { name: '牛肉丼', price: 110 }, { name: '炸蝦丼', price: 140 }, { type: 'subtitle', text: '單點類' }, { name: '酥炸魷魚', price: 120 }, { name: '黃金炸蝦 (3支)', price: 120 }, { name: '唐揚雞', price: 120 }, { name: '骰子雞', price: 60 }, { name: '雞排', price: 55 }, { name: '豬排', price: 55 }, { name: '雞腿', price: 55 }, { name: '黃金脆薯', price: 40 }, { name: '起士', price: 60 }, { name: '竹輪', price: 40 }, { name: '豆腐', price: 60 }, { name: '德式香腸 (1支)', price: 30 }, { type: 'subtitle', text: '湯品/小菜' }, { name: '黃金泡菜/韓式泡菜', price: 40 }, { name: '玉米濃湯/味噌湯', price: 20 }, { name: '小菜一份', price: 30 } ] }, { name: "感丼現食", displayName: "感丼現食 文衡店", phone: "077405810", address: "高雄市鳳山區文衡路11號", info: "營業時間: 11:00 - 21:00\n外送資訊: 滿300元可外送\n備註: 早上9點起可電話訂餐；團體訂購可洽官方LINE。\n與鳳山高中距離：約 1.7 公里 (開車約 5 分鐘，步行約 21 分鐘)", tags: ["丼飯", "LINE點餐", "closed:週日公休"], menu: [ { type: 'subtitle', text: '日式醬燒丼 (可選: 飯/乾拌麵/湯麵/乾拌烏龍/湯烏龍)' }, { name: '方便素', price: '80/100/100' }, { name: '豬肉', price: '95/115/115' }, { name: '牛肉', price: '100/120/120' }, { name: '厚切雞腿', price: '140/160/160' }, { name: '板腱牛排', price: '180/200/200' }, { name: '櫻桃鴨胸', price: '200/220/220' }, { name: '隱藏版', price: '250/270/270' }, { type: 'subtitle', text: '韓式辣醬丼 (可選: 飯/乾拌麵/湯麵)' }, { name: '方便素', price: '85/105' }, { name: '豬肉', price: '100/120' }, { name: '牛肉', price: '105/125' }, { name: '厚切雞腿', price: '150/170' }, { type: 'subtitle', text: '義式白醬丼 (可選: 飯/乾拌麵/湯麵/乾拌烏龍/湯烏龍)' }, { name: '方便素', price: '85/105/105' }, { name: '豬肉', price: '100/120/120' }, { name: '牛肉', price: '105/125/125' }, { name: '厚切雞腿', price: '150/170/170' }, { name: '板腱牛排', price: '190/210/210' }, { name: '櫻桃鴨胸', price: '210/230/230' }, { type: 'subtitle', text: '加料' }, { name: '松露醬', price: 30 }, { name: '日式醬燒/黃金泡菜/起士片', price: 5 }, { type: 'subtitle', text: '單點小菜' }, { name: '煎小干貝(3顆)', price: 45 }, { name: '櫛瓜', price: 45 }, { name: '日本山藥', price: 65 }, { name: '嫩雞蛋豆腐', price: 40 }, { name: '黑輪片', price: 35 }, { name: '黃金泡菜', price: 35 }, { name: '溏心蛋/溫泉蛋', price: 25 }, { name: '起士抓餅', price: 50 }, { name: '蔥抓餅', price: 35 }, { name: '嫩牛筋', price: 50 }, { name: '厚切去骨雞腿', price: 100 }, { name: '板腱牛排', price: 130 }, { name: '櫻桃鴨胸', price: 150 }, { type: 'subtitle', text: '湯品.飲品' }, { name: '雞白湯(無料)/紫菜蛋花湯', price: 30 }, { name: '韓式嫩豆腐湯', price: 40 }, { name: '泰式奶茶', price: 70 }, { name: '蘋果綠茶', price: 60 } ] } ];
    
    function setupOfficialWebsiteJS() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => { const question = item.querySelector('.faq-question'); if (question) { question.addEventListener('click', () => { item.classList.toggle('active'); faqItems.forEach(other => { if (other !== item) other.classList.remove('active'); }); }); } });
        const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }); }, { threshold: 0.1 });
        const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
        elementsToAnimate.forEach(el => observer.observe(el));
        const vipCard = document.querySelector('.membership-card.vip');
        if (vipCard && !vipCard.querySelector('.membership-content')) { const content = vipCard.innerHTML; vipCard.innerHTML = ''; const wrapper = document.createElement('div'); wrapper.className = 'membership-content'; wrapper.innerHTML = content; vipCard.appendChild(wrapper); }
        const modalCloseBtn = modal ? modal.querySelector('.modal-close-btn') : null;
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        if (vendorGrid) vendorGrid.addEventListener('click', (e) => { const card = e.target.closest('.vendor-card'); if (card) populateAndShowModal(card.dataset.vendorName); });
        if (searchInput) { renderVendors(); searchInput.addEventListener('input', (e) => renderVendors(e.target.value)); }
    }
    
    function renderVendors(filter = '') { /* ... (完整內容) ... */ }
    function populateAndShowModal(vendorName) { /* ... (完整內容) ... */ }
    function openModal() { /* ... (完整內容) ... */ }
    function closeModal() { /* ... (完整內容) ... */ }
    function initDynamicBackground() { /* ... (完整內容) ... */ }

    // (補全官網功能函式的詳細邏輯)
    function renderVendors(filter = '') { if (!vendorGrid) return; vendorGrid.innerHTML = ''; const lowerCaseFilter = filter.toLowerCase(); const filteredData = vendorData.filter(vendor => { const nameMatch = (vendor.displayName || vendor.name).toLowerCase().includes(lowerCaseFilter); const tagMatch = vendor.tags && vendor.tags.some(tag => tag.toLowerCase().includes(lowerCaseFilter)); return nameMatch || tagMatch; }); if (filteredData.length === 0) { vendorGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary-color);">找不到符合條件的店家...</p>`; return; } filteredData.forEach(vendor => { const card = document.createElement('div'); card.className = 'vendor-card'; card.dataset.vendorName = vendor.name; let tagsHTML = ''; if (vendor.tags) { vendor.tags.forEach(tag => { let c = 'vendor-tag', t = tag; if (t.startsWith('new')) { c += ' new'; t = '新店家'; } else if (t.startsWith('closed:')) { c += ' closed'; t = t.replace('closed:', ''); } tagsHTML += `<span class="${c}">${t}</span>`; }); } card.innerHTML = `<div class="vendor-info-content"><h3 class="vendor-name">${vendor.displayName||vendor.name}</h3><div class="vendor-tags">${tagsHTML}</div></div><div class="vendor-action-text">點擊查看菜單</div>`; vendorGrid.appendChild(card); }); }
    function populateAndShowModal(vendorName) { const vendor = vendorData.find(v => v.name === vendorName); if (!vendor || !modal) return; modal.querySelector('#modal-vendor-name').textContent = vendor.displayName || vendor.name; const phoneLink = modal.querySelector('#modal-vendor-phone'); if (vendor.phone && vendor.phone !== "無") { phoneLink.href = `tel:${vendor.phone}`; phoneLink.style.display = 'inline-flex'; modal.querySelector('#modal-vendor-phone-text').textContent = vendor.phone; } else { phoneLink.style.display = 'none'; } modal.querySelector('#modal-vendor-map').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address||'高雄 '+(vendor.displayName||vendor.name))}`; const tagsContainer = modal.querySelector('#modal-vendor-tags'); tagsContainer.innerHTML = ''; if (vendor.tags) { vendor.tags.forEach(tag => { let c = 'vendor-tag', t = tag; if (t.startsWith('new')) { c += ' new'; t = '新店家'; } else if (t.startsWith('closed:')) { c += ' closed'; t = t.replace('closed:', ''); } tagsContainer.innerHTML += `<span class="${c}">${t}</span>`; }); } modal.querySelector('#modal-vendor-info').textContent = vendor.info || '無'; const menuContainer = modal.querySelector('#modal-vendor-menu'); if (vendor.menu && vendor.menu.length > 0) { menuContainer.className = 'modal-menu-grid'; menuContainer.innerHTML = ''; vendor.menu.forEach(item => { if (item.type === 'subtitle') { menuContainer.innerHTML += `<h4 class="modal-menu-subtitle">${item.text}</h4>`; } else { const price = (item.price === undefined || item.price === null) ? '' : (typeof item.price === 'string' ? item.price : `$${item.price}`); menuContainer.innerHTML += `<div class="modal-menu-item"><span class="modal-menu-name">${item.name}</span><span class="modal-menu-price">${price}</span></div>`; } }); } else { menuContainer.className = 'modal-placeholder'; menuContainer.innerHTML = '菜單資訊準備中...'; } openModal(); }
    function openModal() { if (modal) { modal.classList.add('active'); body.classList.add('modal-open'); } }
    function closeModal() { if (modal) { modal.classList.remove('active'); body.classList.remove('modal-open'); } }
    function initDynamicBackground() { if (!menuBackgroundContainer) return; if(menuBackgroundContainer.childElementCount > 0) { if(menuBackgroundContainer.style.display !== 'block') menuBackgroundContainer.style.display = 'block'; return; } const images = [ 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1562967915-92ae0c320a01?q=80&w=2787&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2940&auto=format&fit=crop' ]; images.forEach(src => { new Image().src = src; const div = document.createElement('div'); div.className = 'bg-image'; div.style.backgroundImage = `url(${src})`; menuBackgroundContainer.appendChild(div); }); menuBackgroundContainer.style.display = 'block'; const bgImages = menuBackgroundContainer.querySelectorAll('.bg-image'); let i = 0; const changeBg = () => { if (document.getElementById('page-menu').classList.contains('page-active')) { bgImages.forEach(img => img.classList.remove('active')); bgImages[i].classList.add('active'); i = (i + 1) % bgImages.length; } }; changeBg(); setInterval(changeBg, 7000); }
    
    // ================== 應用初始化 ==================
    function init() {
        setupOfficialWebsiteJS();
        switchPage('page-home');
    }
    init();
});