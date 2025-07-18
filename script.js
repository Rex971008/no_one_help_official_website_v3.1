/* 檔案: script.js (修正版) */

// 等待整個 HTML 文件都載入並解析完成後，再執行裡面的所有程式碼
document.addEventListener('DOMContentLoaded', () => {

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });
    const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
    elementsToAnimate.forEach(el => observer.observe(el));
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            if (isActive) {
                item.classList.remove('active');
            } else {
                item.classList.add('active');
            }
        });
    });
    const vipCard = document.querySelector('.membership-card.vip');
    if (vipCard) {
        const content = vipCard.innerHTML;
        vipCard.innerHTML = '';
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'membership-content';
        contentWrapper.innerHTML = content;
        vipCard.appendChild(contentWrapper);
    }
    const hamburgerButton = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a.sidebar-link');
    const body = document.body;
    const pages = document.querySelectorAll('.page-content');
    const heroBackground = document.querySelector('.hero-background');
    const menuBackgroundContainer = document.getElementById('dynamic-bg-container');
    let customerServiceInterval;

    function toggleSidebar() {
        body.classList.toggle('sidebar-open');
        const isExpanded = body.classList.contains('sidebar-open');
        hamburgerButton.setAttribute('aria-expanded', isExpanded);
        sidebarLinks.forEach((link, index) => {
            link.style.setProperty('--link-delay', `${index * 0.05 + 0.2}s`);
        });
    }

    function switchPage(targetId) {
        const targetPage = document.getElementById(targetId);
        if (!targetPage) return;
        pages.forEach(p => p.classList.remove('page-active'));
        targetPage.classList.add('page-active');
        window.scrollTo(0, 0);
        sidebarLinks.forEach(l => {
            l.classList.toggle('active-link', l.dataset.target === targetId);
        });
        clearInterval(customerServiceInterval);
        heroBackground.style.display = 'none';
        menuBackgroundContainer.style.display = 'none';
        if (targetId === 'page-home') {
            heroBackground.style.display = 'block';
        } else if (targetId === 'page-menu') {
            menuBackgroundContainer.style.display = 'block';
            initDynamicBackground();
        } else if (targetId === 'page-customer-service') {
            fetchChatMessages();
            customerServiceInterval = setInterval(fetchChatMessages, 3000);
        }
    }
    if(hamburgerButton) hamburgerButton.addEventListener('click', toggleSidebar);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            switchPage(targetId);
            if (body.classList.contains('sidebar-open')) {
                toggleSidebar();
            }
        });
    });
    
    // 注意：店家資料可以之後再補上，這裡先放一個空的，確保 renderVendors 不會出錯
    const vendorData = [

    ]; 

    const vendorGrid = document.getElementById('vendor-grid');
    const searchInput = document.getElementById('vendor-search');

    function renderVendors(filter = '') {
        if (!vendorGrid) return; // 如果 vendorGrid 不存在，就直接返回
        
        vendorGrid.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        const filteredData = vendorData.filter(vendor => {
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
                if (tag.startsWith('new')) {
                    className += ' new';
                    tagText = '新店家';
                } else if (tag.startsWith('closed:')) {
                    className += ' closed';
                    tagText = tag.replace('closed:', '');
                }
                tagsHTML += `<span class="${className}">${tagText}</span>`;
            });
            card.innerHTML = `
                <div class="vendor-info-content">
                    <h3 class="vendor-name">${vendor.displayName || vendor.name}</h3>
                    <div class="vendor-tags">${tagsHTML}</div>
                </div>
                <div class="vendor-action-text">點擊查看菜單</div>`;
            vendorGrid.appendChild(card);
        });
    }
    const modal = document.getElementById('vendor-modal');
    const modalCloseBtn = modal ? modal.querySelector('.modal-close-btn') : null;

    function openModal() {
        if (!modal) return;
        modal.classList.add('active');
        body.classList.add('modal-open');
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('active');
        body.classList.remove('modal-open');
    }

    function populateAndShowModal(vendorName) {
        const vendor = vendorData.find(v => v.name === vendorName);
        if (!vendor) return;
        document.getElementById('modal-vendor-name').textContent = vendor.displayName || vendor.name;
        document.getElementById('modal-vendor-phone').href = `tel:${vendor.phone}`;
        document.getElementById('modal-vendor-phone-text').textContent = vendor.phone;
        document.getElementById('modal-vendor-map').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address || '高雄 ' + (vendor.displayName || vendor.name))}`;
        const tagsContainer = document.getElementById('modal-vendor-tags');
        tagsContainer.innerHTML = '';
        vendor.tags.forEach(tag => {
            let className = 'vendor-tag';
            let tagText = tag;
            if (tag.startsWith('new')) {
                className += ' new';
                tagText = '新店家';
            } else if (tag.startsWith('closed:')) {
                className += ' closed';
                tagText = tag.replace('closed:', '');
            }
            tagsContainer.innerHTML += `<span class="${className}">${tagText}</span>`;
        });
        const infoContainer = document.getElementById('modal-vendor-info');
        infoContainer.textContent = vendor.info || '無';
        const menuContainer = document.getElementById('modal-vendor-menu');
        if (vendor.menu && vendor.menu.length > 0) {
            menuContainer.className = 'modal-menu-grid';
            menuContainer.innerHTML = '';
            vendor.menu.forEach(item => {
                if (item.type === 'subtitle') {
                    menuContainer.innerHTML += `<h4 class="modal-menu-subtitle">${item.text}</h4>`;
                } else {
                    const price = typeof item.price === 'number' ? `$${item.price}` : (item.price === undefined ? '' : `$${item.price}`);
                    menuContainer.innerHTML += `<div class="modal-menu-item"><span class="modal-menu-name">${item.name}</span><span class="modal-menu-price">${price}</span></div>`;
                }
            });
        } else {
            menuContainer.className = 'modal-placeholder';
            menuContainer.innerHTML = '菜單資訊準備中...';
        }
        openModal();
    }

    if (vendorGrid) {
        vendorGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.vendor-card');
            if (card) {
                populateAndShowModal(card.dataset.vendorName);
            }
        });
    }

    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    function initDynamicBackground() {
        const bgContainer = document.getElementById('dynamic-bg-container');
        if (!bgContainer || bgContainer.childElementCount > 0) return;
        const images = ['https://images.unsplash.com/photo-1512152272829-e3139592d56f?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1562967915-92ae0c320a01?q=80&w=2787&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2940&auto=format&fit=crop', 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=2864&auto=format&fit=crop', 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=2940&auto=format&fit=crop'];
        images.forEach(src => {
            new Image().src = src;
        });
        images.forEach((src) => {
            const div = document.createElement('div');
            div.className = 'bg-image';
            div.style.backgroundImage = `url(${src})`;
            bgContainer.appendChild(div);
        });
        const bgImages = bgContainer.querySelectorAll('.bg-image');
        let currentIndex = 0;

        function changeBackground() {
            bgImages.forEach(img => img.classList.remove('active'));
            bgImages[currentIndex].classList.add('active');
            currentIndex = (currentIndex + 1) % bgImages.length;
        }
        changeBackground();
        setInterval(changeBackground, 7000);
    }
    
    // 客服系統的變數宣告和事件綁定
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatBox = document.getElementById('chatBox');

    async function sendChatMessage() {
        const message = messageInput.value.trim();
        if (!message) return;
        try {
            await fetch('https://no-one-help-official-website-v3-1.onrender.com/api/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message
                })
            });
            messageInput.value = '';
            fetchChatMessages();
        } catch (error) {
            console.error('訊息發送失敗:', error);
            alert('無法連接到伺服器，訊息發送失敗。');
        }
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendChatMessage);
    }
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    async function fetchChatMessages() {
            if (!chatBox) return; // 如果沒有 chatBox，直接返回

    try {
        const response = await fetch('https://no-one-help-official-website-v3-1.onrender.com/api/messages');
        if (!response.ok) {
            throw new Error(`網路錯誤: ${response.status}`);
        }
        const messages = await response.json();
        const shouldScroll = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50;

        chatBox.innerHTML = '';
        if (messages.length === 0) {
            chatBox.innerHTML = '<p style="text-align:center; color: var(--text-secondary-color);">目前沒有對話紀錄，開始您的第一次對話吧！</p>';
        } else {
            messages.forEach(msg => {
                // ★ 修改點 1: 不再有「你：」，直接顯示訊息內容
                const customerDiv = document.createElement('div');
                customerDiv.className = 'chat-message customer-msg';
                customerDiv.textContent = msg.customerMessage; // 直接使用訊息
                chatBox.appendChild(customerDiv);

                if (msg.staffReply) {
                    const staffDiv = document.createElement('div');
                    staffDiv.className = 'chat-message staff-reply';
                    
                    // ★ 修改點 2: 將「客服：」變成一個獨立的元素，方便做樣式
                    const staffNameSpan = document.createElement('span');
                    staffNameSpan.className = 'staff-name-prefix';
                    staffNameSpan.textContent = '客服：';
                    
                    const staffMessageNode = document.createTextNode(msg.staffReply);

                    staffDiv.appendChild(staffNameSpan);
                    staffDiv.appendChild(staffMessageNode);
                    chatBox.appendChild(staffDiv);
                }
            });
        }
        
        // 如果使用者本來就在最下面，才自動滾動
        if (shouldScroll) {
             chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch (error) {
        console.error("獲取聊天訊息失敗:", error);
        chatBox.innerHTML = '<p style="text-align:center; color: #ff5252;">無法連接客服中心，請稍後再試。</p>';
        clearInterval(customerServiceInterval);
    }
    }

    // 初始化頁面
    if (searchInput) {
        renderVendors();
        searchInput.addEventListener('input', (e) => renderVendors(e.target.value));
    }
    switchPage('page-home');

}); // DOMContentLoaded 結束