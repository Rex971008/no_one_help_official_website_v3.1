/* 檔案: script.js (v5.1 - 完整最終版，允許多活動) */

document.addEventListener('DOMContentLoaded', () => {
    // ================== 全局變數 & API 設定 ==================
    const API_BASE_URL = 'https://no-one-help-official-website-v3-1.onrender.com';
    let chatInterval;
    let currentDate = new Date(); // 月曆的目前日期
    let calendarEventsData = {}; // **修改**: 存放從後端獲取的日曆事件
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

    // **月曆頁面相關元素**
    const calendarPageContainer = document.querySelector('#page-calendar .container');
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYearEl = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    // ================== 狀態管理 (Token) ==================
    const Auth = {
        saveToken: (token) => localStorage.setItem('authToken', token),
        getToken: () => localStorage.getItem('authToken'),
        clearToken: () => localStorage.removeItem('authToken'),
        isLoggedIn: () => Auth.getToken() !== null,
    };

    // ================== 核心：頁面切換邏輯 ==================
    async function switchPage(targetId) {
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
            let isActive = linkTarget === targetId;
            if (['page-login', 'page-register'].includes(targetId) && linkTarget === 'page-customer-service') {
                isActive = true;
            }
            l.classList.toggle('active-link', isActive);
        });

        window.scrollTo(0, 0);
        if (targetId === 'page-menu') initDynamicBackground();
        if (targetId === 'page-customer-service') startChatSession();
        if (targetId === 'page-calendar') await fetchCalendarEvents();
    }

    // ================== 事件綁定 ==================
    if (hamburgerButton) hamburgerButton.addEventListener('click', () => body.classList.toggle('sidebar-open'));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => body.classList.toggle('sidebar-open'));
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); switchPage(link.dataset.target); if (body.classList.contains('sidebar-open')) { body.classList.toggle('sidebar-open'); } });
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
            if (response.ok && data.success) { alert('註冊成功，請登入！'); switchPage('page-login'); } else { alert(`註冊失敗：${data.message}`); }
        } catch (error) { alert('註冊請求失敗，請檢查網絡或稍後再試。'); }
    });

    if (loginBtn) loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!username || !password) return alert('用戶名和密碼不能為空！');
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (response.ok && data.success) { Auth.saveToken(data.token); switchPage('page-customer-service'); } else { alert(`登入失敗：${data.message}`); }
        } catch (error) { alert('登入請求失敗，請檢查網絡或稍後再試。'); }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => { Auth.clearToken(); stopChatSession(); switchPage('page-home'); alert('您已成功登出。'); });
    if (sendButton) sendButton.addEventListener('click', sendChatMessage);
    if (messageInput) messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); } });
    
    // **修改**：讓上下個月按鈕能維持選中的日期
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(document.querySelector('.calendar-day.today')?.dataset.date); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(document.querySelector('.calendar-day.today')?.dataset.date); });


    // ================== 功能性函數 ==================
    // --- 客服系統 ---
    function startChatSession() { if (chatInterval) clearInterval(chatInterval); fetchChatMessages(); chatInterval = setInterval(fetchChatMessages, 3000); }
    function stopChatSession() { clearInterval(chatInterval); }
    async function fetchChatMessages() {
        const token = Auth.getToken(); if (!token || !chatBox) return;
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
        } catch (error) {
            console.error('訊息發送失敗:', error);
        }
    }

    // --- **點餐月曆系統 (v5.1)** ---
    async function fetchCalendarEvents(defaultDateToShow) {
        if (!calendarPageContainer) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/calendar/events`);
            if (!response.ok) throw new Error('獲取活動資料失敗');
            calendarEventsData = await response.json();
            
            if (defaultDateToShow) {
                 renderEventDetailsForDate(defaultDateToShow);
            } else {
                 const today = new Date();
                 const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                 renderEventDetailsForDate(todayStr);
            }
        } catch (error) {
            console.error(error);
            const calendarContainer = document.querySelector('.calendar-container');
            if (calendarContainer) calendarContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary-color);">無法載入點餐活動，請稍後再試。</p>`
        }
    }
    
    function renderCalendar(selectedDate) {
        if (!calendarGrid || !currentMonthYearEl) return;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        currentMonthYearEl.textContent = `${year}年 ${month + 1}月`;
        calendarGrid.innerHTML = '';
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) { calendarGrid.innerHTML += `<div class="calendar-day not-current-month"></div>`; }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day active-day';
            dayElement.dataset.date = dateStr;
            dayElement.textContent = i;
            
            if (calendarEventsData[dateStr] && calendarEventsData[dateStr].length > 0) {
                dayElement.classList.add('has-event');
            }
            if (dateStr === selectedDate) {
                 // "today" class now means "selected" in our CSS
                dayElement.classList.add('today');
            }
            
            dayElement.addEventListener('click', () => renderEventDetailsForDate(dateStr));
            calendarGrid.appendChild(dayElement);
        }
    }

    function renderEventDetailsForDate(dateStr) {
        renderCalendar(dateStr); // Rerender to update 'selected' style

        const oldDetailView = document.getElementById('calendar-detail-view');
        if (oldDetailView) oldDetailView.remove();
        
        const detailView = document.createElement('div');
        detailView.id = 'calendar-detail-view';
        
        const eventsToday = calendarEventsData[dateStr] || [];

        if (eventsToday.length === 0) {
            detailView.innerHTML = `<h3 class="detail-vendor-name">本日無點餐活動</h3><p class="detail-deadline">請選擇其他有標示的日期。</p>`;
        } else {
            detailView.innerHTML = eventsToday.map(event => getSingleEventHtml(event)).join('');
        }
        
        calendarPageContainer.appendChild(detailView);

        detailView.addEventListener('click', (e) => {
            if (e.target.matches('.order-submit-btn')) {
                const eventId = e.target.dataset.eventId;
                handleOrderSubmit(eventId);
            }
            if (e.target.matches('#login-from-calendar')) {
                 e.preventDefault(); 
                 switchPage('page-login');
            }
        });
    }

    function getSingleEventHtml(event) {
        const isClosed = event.isClosed || new Date() > new Date(event.deadline);
        let menuHtml = '';
        if (event.menuType === 'text') {
            menuHtml = `<div class="modal-placeholder">${event.menuContent.replace(/\n/g, '<br>')}</div>`;
        } else if (event.menuType === 'image') {
            menuHtml = `<a href="${event.menuContent}" target="_blank"><img src="${event.menuContent}" alt="菜單" class="detail-menu-image"></a>`;
        }

        let orderSectionHtml = '';
        if (!Auth.isLoggedIn()) {
            orderSectionHtml = `<p class="order-status">請先<a href="#" id="login-from-calendar">登入</a>以進行點餐。</p>`;
        } else if (isClosed) {
            orderSectionHtml = `<p class="order-status">此活動點餐已截止。</p>`;
        } else {
            const userId = Auth.getToken();
            const existingOrder = event.orders.find(o => o.userId === userId);
            const orderText = existingOrder ? existingOrder.orderText : "";
            
            orderSectionHtml = `
                <div class="order-submission-area">
                    <h4>${existingOrder ? '編輯您的訂單' : '請輸入您的訂單'}</h4>
                    <p>${existingOrder ? `上次更新時間: ${new Date(existingOrder.timestamp).toLocaleTimeString()}` : '（若要取消訂單，請將內容清空後送出）'}</p>
                    <textarea id="order-textarea-${event._id}" class="order-textarea" placeholder="範例：招牌鍋貼一份，豆漿一杯">${orderText}</textarea>
                    <button data-event-id="${event._id}" class="auth-btn order-submit-btn">送出/更新訂單</button>
                </div>`;
        }
        
        // Return a card for each event
        return `
            <div class="calendar-event-card">
                <h3 class="detail-vendor-name">${event.vendorName}</h3>
                <p class="detail-deadline">截止時間：${new Date(event.deadline).toLocaleString()} ${isClosed ? '(已截止)' : ''}</p>
                <div class="detail-menu-container">
                    <h4>當日菜單</h4>
                    ${menuHtml}
                </div>
                ${orderSectionHtml}
            </div>
        `;
    }

    async function handleOrderSubmit(eventId) {
        const token = Auth.getToken();
        if(!token) return alert("請先登入！");

        const textarea = document.getElementById(`order-textarea-${eventId}`);
        if(!textarea) return console.error("找不到對應的輸入框");

        const orderText = textarea.value;
        const submitBtn = document.querySelector(`button[data-event-id="${eventId}"]`);
        if (!submitBtn) return; // safety check
        submitBtn.disabled = true;
        submitBtn.textContent = '傳送中...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/calendar/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ eventId: eventId, orderText: orderText })
            });

            const result = await response.json();
            if(!response.ok) throw new Error(result.message || "發生未知錯誤");

            alert(result.message);
            
            // Re-fetch data and re-render the details for the currently selected date
            const currentSelectedDate = document.querySelector('.calendar-day.today')?.dataset.date;
            await fetchCalendarEvents(currentSelectedDate);

        } catch(error) {
            console.error("訂餐失敗:", error);
            alert(`訂餐失敗：${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = '送出/更新訂單';
        }
    }


    // ================== 原有網站功能 ==================
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ 請在此處貼上您【所有】的店家資料陣列 ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    const vendorData = []; // <---- 這個功能目前獨立，未與日曆系統整合

    function setupOfficialWebsiteJS() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            if (question) {
                question.addEventListener('click', () => {
                    item.classList.toggle('active');
                    faqItems.forEach(other => {
                        if (other !== item) other.classList.remove('active');
                    });
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
        if (vipCard && !vipCard.querySelector('.membership-content')) {
            const content = vipCard.innerHTML;
            vipCard.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'membership-content';
            wrapper.innerHTML = content;
            vipCard.appendChild(wrapper);
        }

        const modalCloseBtn = modal ? modal.querySelector('.modal-close-btn') : null;
        if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        if(modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
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
            if (!vendor.tags) vendor.tags = [];
            const nameMatch = (vendor.displayName || vendor.name).toLowerCase().includes(lowerCaseFilter);
            const tagMatch = vendor.tags.some(tag => tag.toLowerCase().includes(lowerCaseFilter));
            return nameMatch || tagMatch;
        });
        if (filteredData.length === 0) {
            vendorGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary-color);">找不到符合條件的店家...</p>`;
            return;
        }
        filteredData.forEach(vendor => {
            const card = document.createElement('div');
            card.className = 'vendor-card';
            card.dataset.vendorName = vendor.name;
            let tagsHTML = '';
            vendor.tags.forEach(tag => {
                let className = 'vendor-tag';
                let tagText = tag;
                if (tag.startsWith('new')) { className += ' new'; tagText = '新店家'; }
                else if (tag.startsWith('closed:')) { className += ' closed'; tagText = tag.replace('closed:', ''); }
                tagsHTML += `<span class="${className}">${tagText}</span>`;
            });
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
            if(menuBackgroundContainer.style.display !== 'block') menuBackgroundContainer.style.display = 'block';
            return;
        }
        const images = [ 'https://images.unsplash.com/photo-1512152272829-e3139592d56f?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1562967915-92ae0c320a01?q=80&w=2787&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2940&auto=format&fit=crop' ];
        images.forEach(src => {
            new Image().src = src;
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