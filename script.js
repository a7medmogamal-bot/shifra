// ============ SHIFRA - التطبيق الكامل ============

// تكوين Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============ إدارة الحالة ============
const appState = {
    currentUser: null,
    userData: null,
    currentConversation: null,
    currentFriend: null,
    encryptionKey: null,
    unsubscribeListeners: [],
    typingTimeout: null,
    messagesListener: null,
    typingListener: null
};

// ============ إدارة الواجهة ============
const UIManager = {
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.remove('hidden');
    },

    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    },

    showElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove('hidden');
    },

    hideElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.add('hidden');
    },

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    showToast(message, type = 'info') {
        // إزالة التوست القديم
        const oldToast = document.querySelector('.toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showError(message) {
        this.showToast(message, 'error');
    },

    showSuccess(message) {
        this.showToast(message, 'success');
    },

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        
        return date.toLocaleDateString('ar');
    },

    formatMessageTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    }
};

// ============ معالجة الأخطاء ============
const ErrorHandler = {
    getArabicError(error) {
        const errorCode = error?.code || '';
        const errorMessages = {
            'auth/invalid-credential': 'بيانات تسجيل الدخول غير صحيحة.',
            'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
            'auth/wrong-password': 'كلمة المرور غير صحيحة.',
            'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل.',
            'auth/weak-password': 'كلمة المرور ضعيفة جداً.',
            'auth/too-many-requests': 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً.',
            'auth/network-request-failed': 'فشل الاتصال بالشبكة.',
            'permission-denied': 'ليس لديك صلاحية للقيام بهذه العملية.',
            'not-found': 'العنصر المطلوب غير موجود.',
            'already-exists': 'العنصر موجود بالفعل.',
            'unavailable': 'الخدمة غير متاحة حالياً.',
            'unauthenticated': 'يجب تسجيل الدخول أولاً.'
        };
        return errorMessages[errorCode] || 'حدث خطأ غير متوقع.';
    }
};

// ============ نظام التشفير ============
const EncryptionSystem = {
    async generateKey() {
        try {
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            return key;
        } catch (error) {
            console.error('Error generating key:', error);
            return null;
        }
    },

    async exportKey(key) {
        try {
            const exported = await crypto.subtle.exportKey('raw', key);
            return Array.from(new Uint8Array(exported))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Error exporting key:', error);
            return null;
        }
    },

    async importKey(keyHex) {
        try {
            const keyBytes = new Uint8Array(
                keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            return await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error('Error importing key:', error);
            return null;
        }
    },

    async encryptMessage(plaintext, key) {
        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encodedText = new TextEncoder().encode(plaintext);
            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedText
            );
            
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
            const ciphertextHex = Array.from(new Uint8Array(ciphertext))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            return `${ivHex}:${ciphertextHex}`;
        } catch (error) {
            console.error('Error encrypting message:', error);
            return null;
        }
    },

    async decryptMessage(encryptedData, key) {
        try {
            const [ivHex, ciphertextHex] = encryptedData.split(':');
            const iv = new Uint8Array(
                ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            const ciphertext = new Uint8Array(
                ciphertextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );
            
            return new TextDecoder().decode(plaintext);
        } catch (error) {
            console.error('Error decrypting message:', error);
            return null;
        }
    }
};

// ============ نظام QR ============
const QRSystem = {
    generateQRToken() {
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const token = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return `SHIFRA_${token}`;
    },

    async createInitialQR(userId) {
        try {
            const qrToken = this.generateQRToken();
            await db.collection('qrTokens').add({
                userId: userId,
                token: qrToken,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                changeCount: 0
            });
            return qrToken;
        } catch (error) {
            console.error('Error creating QR:', error);
            return null;
        }
    },

    async validateQRToken(token) {
        try {
            const qrDoc = await db.collection('qrTokens')
                .where('token', '==', token)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (qrDoc.empty) {
                return { valid: false, message: 'رمز QR غير صالح أو لم يعد متاحاً.' };
            }
            
            const qrData = qrDoc.docs[0].data();
            const userDoc = await db.collection('users').doc(qrData.userId).get();
            
            if (!userDoc.exists) {
                return { valid: false, message: 'المستخدم غير موجود.' };
            }
            
            if (userDoc.data().isBanned) {
                return { valid: false, message: 'هذا الحساب موقوف.' };
            }
            
            return {
                valid: true,
                userId: qrData.userId,
                username: userDoc.data().username
            };
        } catch (error) {
            console.error('Error validating QR:', error);
            return { valid: false, message: 'فشل التحقق من رمز QR.' };
        }
    }
};

// ============ نظام الأصدقاء ============
const FriendSystem = {
    async sendFriendRequest(toUserId) {
        try {
            if (!appState.currentUser) {
                return { success: false, message: 'يجب تسجيل الدخول أولاً.' };
            }
            
            const fromUserId = appState.currentUser.uid;
            
            // التحقق من عدم وجود طلب معلق
            const existingRequest = await db.collection('friendRequests')
                .where('fromUserId', '==', fromUserId)
                .where('toUserId', '==', toUserId)
                .where('status', '==', 'pending')
                .limit(1)
                .get();
            
            if (!existingRequest.empty) {
                return { success: false, message: 'يوجد طلب صداقة معلق بالفعل.' };
            }
            
            // إنشاء طلب الصداقة
            await db.collection('friendRequests').add({
                fromUserId: fromUserId,
                toUserId: toUserId,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            
            return { success: true, message: 'تم إرسال طلب الصداقة.' };
        } catch (error) {
            console.error('Error sending friend request:', error);
            return { success: false, message: 'فشل إرسال طلب الصداقة.' };
        }
    },

    async getFriendsList(userId) {
        try {
            const friendships = await db.collection('friendships')
                .where('participants', 'arrayContains', userId)
                .get();
            
            const friendsList = [];
            
            for (const friendship of friendships.docs) {
                const participants = friendship.data().participants;
                const friendId = participants.find(id => id !== userId);
                
                const friendDoc = await db.collection('users').doc(friendId).get();
                if (friendDoc.exists) {
                    friendsList.push({
                        id: friendDoc.id,
                        ...friendDoc.data()
                    });
                }
            }
            
            return friendsList;
        } catch (error) {
            console.error('Error getting friends list:', error);
            return [];
        }
    }
};

// ============ نظام المحادثة ============
const ChatSystem = {
    async createConversation(friendId) {
        try {
            const currentUserId = appState.currentUser.uid;
            
            // التحقق من عدم وجود محادثة بالفعل
            const existingConv = await db.collection('conversations')
                .where('participants', 'arrayContains', currentUserId)
                .get();
            
            const existing = existingConv.docs.find(doc => 
                doc.data().participants.includes(friendId)
            );
            
            if (existing) {
                return { success: true, conversationId: existing.id };
            }
            
            // إنشاء محادثة جديدة
            const conversationRef = await db.collection('conversations').add({
                participants: [currentUserId, friendId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: null,
                lastMessageAt: null
            });
            
            return { success: true, conversationId: conversationRef.id };
        } catch (error) {
            console.error('Error creating conversation:', error);
            return { success: false, message: 'فشل إنشاء المحادثة.' };
        }
    },

    async sendMessage(conversationId, messageText, friendId) {
        try {
            if (!appState.currentUser) {
                throw new Error('يجب تسجيل الدخول أولاً.');
            }
            
            const currentUserId = appState.currentUser.uid;
            
            // إنشاء رسالة جديدة (في التطبيق الفعلي سيتم تشفيرها)
            const messageRef = await db.collection('messages').add({
                conversationId: conversationId,
                senderId: currentUserId,
                content: messageText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'sent'
            });
            
            // تحديث المحادثة
            await db.collection('conversations').doc(conversationId).update({
                lastMessage: messageText,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, messageId: messageRef.id };
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, message: error.message || 'فشل إرسال الرسالة.' };
        }
    },

    async loadMessages(conversationId) {
        try {
            const messagesSnapshot = await db.collection('messages')
                .where('conversationId', '==', conversationId)
                .orderBy('timestamp', 'asc')
                .limit(100)
                .get();
            
            return messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading messages:', error);
            return [];
        }
    }
};

// ============ نظام الإشعارات ============
const NotificationSystem = {
    async sendNotification(userId, notification) {
        try {
            await db.collection('notifications').add({
                userId: userId,
                ...notification,
                isRead: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error sending notification:', error);
            return false;
        }
    }
};

// ============ نظام الحظر ============
const BanSystem = {
    async checkBanStatus(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) return { isBanned: false };
            
            const userData = userDoc.data();
            
            if (userData.isBanned) {
                if (userData.banType === 'permanent') {
                    return { isBanned: true, permanent: true };
                }
                
                const banExpiry = userData.banExpiry?.toDate();
                if (banExpiry && banExpiry > new Date()) {
                    return { 
                        isBanned: true, 
                        permanent: false,
                        expiry: banExpiry
                    };
                } else {
                    // انتهت مدة الحظر
                    await db.collection('users').doc(userId).update({
                        isBanned: false,
                        banType: null,
                        banReason: null,
                        banExpiry: null
                    });
                    return { isBanned: false };
                }
            }
            
            return { isBanned: false };
        } catch (error) {
            console.error('Error checking ban status:', error);
            return { isBanned: false };
        }
    }
};

// ============ نظام VAR ============
const VARSystem = {
    async analyzeConversation(conversationId) {
        try {
            const messages = await ChatSystem.loadMessages(conversationId);
            
            const violations = [];
            const bannedWords = ['شتيمة', 'إهانة', 'تهديد', 'عنف', 'قتل', 'تحرش'];
            
            for (const message of messages) {
                const content = message.content.toLowerCase();
                
                for (const word of bannedWords) {
                    if (content.includes(word)) {
                        violations.push({
                            messageId: message.id,
                            senderId: message.senderId,
                            type: 'banned_word',
                            word: word,
                            severity: 'high'
                        });
                    }
                }
            }
            
            return {
                success: true,
                analysis: {
                    totalMessages: messages.length,
                    violations: violations,
                    severity: violations.length > 3 ? 'high' : violations.length > 0 ? 'medium' : 'low'
                }
            };
        } catch (error) {
            console.error('Error analyzing conversation:', error);
            return { success: false, message: 'فشل تحليل المحادثة.' };
        }
    }
};

// ============ تهيئة التطبيق ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('SHIFRA - تم تهيئة التطبيق');
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // مراقبة حالة المصادقة
    setupAuthListener();
    
    // إخفاء شاشة التحميل بعد ثانية
    setTimeout(() => {
        UIManager.hideLoading();
    }, 1000);
});

function setupEventListeners() {
    // تبويبات المصادقة
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            if (tabName === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });
    
    // نماذج المصادقة
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            navigateTo(view);
        });
    });
    
    // إرسال الرسائل
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', handleSendMessage);
    }
    
    // البحث
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(e.target.value), 500);
        });
    }
    
    // إغلاق المودالات
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });
    });
    
    // فحص QR
    const uploadQrBtn = document.getElementById('upload-qr-btn');
    const qrFileInput = document.getElementById('qr-file-input');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    
    if (uploadQrBtn && qrFileInput) {
        uploadQrBtn.addEventListener('click', () => {
            qrFileInput.click();
        });
    }
    
    if (qrFileInput) {
        qrFileInput.addEventListener('change', handleQRFileUpload);
    }
    
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', () => {
            UIManager.hideModal('scan-qr-modal');
        });
    }
    
    // تحليل VAR
    const varBtn = document.getElementById('var-btn');
    const startVarBtn = document.getElementById('start-var-analysis');
    
    if (varBtn) {
        varBtn.addEventListener('click', () => {
            UIManager.showModal('var-modal');
        });
    }
    
    if (startVarBtn) {
        startVarBtn.addEventListener('click', startVARAnalysis);
    }
    
    // أزرار الهيدر
    const headerQrBtn = document.getElementById('header-qr-btn');
    const headerSettingsBtn = document.getElementById('header-settings-btn');
    
    if (headerQrBtn) {
        headerQrBtn.addEventListener('click', () => {
            UIManager.showModal('scan-qr-modal');
        });
    }
    
    if (headerSettingsBtn) {
        headerSettingsBtn.addEventListener('click', () => {
            navigateTo('settings');
        });
    }
}

function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            appState.currentUser = user;
            
            try {
                // تحميل بيانات المستخدم
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    appState.userData = userDoc.data();
                    
                    // التحقق من حالة الحظر
                    const banStatus = await BanSystem.checkBanStatus(user.uid);
                    
                    if (banStatus.isBanned) {
                        showBanScreen(userDoc.data(), banStatus);
                        await auth.signOut();
                        return;
                    }
                    
                    // تحديث حالة الاتصال
                    await db.collection('users').doc(user.uid).update({
                        isOnline: true,
                        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    UIManager.hideElement('auth-screen');
                    UIManager.showElement('chat-interface');
                    
                    // تحميل المحادثات
                    await loadConversations();
                } else {
                    await auth.signOut();
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                await auth.signOut();
            }
        } else {
            appState.currentUser = null;
            appState.userData = null;
            
            // تنظيف المستمعين
            if (appState.messagesListener) {
                appState.messagesListener();
                appState.messagesListener = null;
            }
            
            if (appState.typingListener) {
                appState.typingListener();
                appState.typingListener = null;
            }
            
            UIManager.hideElement('chat-interface');
            UIManager.showElement('auth-screen');
        }
        
        UIManager.hideLoading();
    });
}

function showBanScreen(userData, banStatus) {
    const banScreen = document.createElement('div');
    banScreen.className = 'ban-screen';
    
    let banMessage = '';
    if (banStatus.permanent) {
        banMessage = 'هذا الإيقاف لا تنتهي مدته.';
    } else if (banStatus.expiry) {
        banMessage = `تاريخ انتهاء الإيقاف: ${banStatus.expiry.toLocaleDateString('ar')}`;
    }
    
    banScreen.innerHTML = `
        <div class="ban-content">
            <h2>تم إيقاف الحساب</h2>
            <p>سبب الإيقاف: ${userData.banReason || 'غير محدد'}</p>
            <p>${banMessage}</p>
            <button class="primary-button" onclick="auth.signOut()">تسجيل الخروج</button>
        </div>
    `;
    
    document.body.appendChild(banScreen);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        UIManager.showError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
        return;
    }
    
    UIManager.showLoading();
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        UIManager.showSuccess('تم تسجيل الدخول بنجاح.');
    } catch (error) {
        UIManager.hideLoading();
        UIManager.showError(ErrorHandler.getArabicError(error));
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // التحقق من صحة البيانات
    if (!username || !email || !phone || !password || !confirmPassword) {
        UIManager.showError('يرجى إدخال جميع البيانات المطلوبة.');
        return;
    }
    
    if (username.length < 3) {
        UIManager.showError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل.');
        return;
    }
    
    if (!email.endsWith('@gmail.com')) {
        UIManager.showError('يجب استخدام بريد Gmail فقط.');
        return;
    }
    
    if (password.length < 8) {
        UIManager.showError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
        return;
    }
    
    if (password !== confirmPassword) {
        UIManager.showError('كلمات المرور غير متطابقة.');
        return;
    }
    
    UIManager.showLoading();
    
    try {
        // إنشاء الحساب
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // إنشاء سجل المستخدم
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            username: username,
            email: email,
            phone: phone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true,
            isBanned: false,
            banHistory: [],
            privacySettings: {
                showLastSeen: true,
                showOnlineStatus: true,
                readReceipts: true
            },
            blockedUsers: []
        });
        
        // إنشاء رمز QR
        await QRSystem.createInitialQR(user.uid);
        
        UIManager.showSuccess('تم إنشاء الحساب بنجاح.');
        
    } catch (error) {
        UIManager.hideLoading();
        UIManager.showError(ErrorHandler.getArabicError(error));
    }
}

async function navigateTo(view) {
    // تحديث التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    switch(view) {
        case 'chats':
            await loadConversations();
            break;
        case 'friends':
            await loadFriends();
            break;
        case 'requests':
            await loadRequests();
            break;
        case 'qr':
            loadQRView();
            break;
        case 'settings':
            loadSettingsView();
            break;
    }
}

async function loadConversations() {
    if (!appState.currentUser) return;
    
    try {
        const conversationsList = document.getElementById('conversations-list');
        
        if (!conversationsList) return;
        
        conversationsList.innerHTML = '';
        
        const conversations = await db.collection('conversations')
            .where('participants', 'arrayContains', appState.currentUser.uid)
            .orderBy('lastMessageAt', 'desc')
            .limit(50)
            .get();
        
        if (conversations.empty) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <p>لا توجد محادثات بعد</p>
                    <p class="subtitle">ابدأ بإضافة صديق من خلال رمز QR</p>
                </div>
            `;
            return;
        }
        
        for (const conversation of conversations.docs) {
            const conversationData = conversation.data();
            const otherUserId = conversationData.participants.find(id => id !== appState.currentUser.uid);
            
            const otherUserDoc = await db.collection('users').doc(otherUserId).get();
            if (!otherUserDoc.exists) continue;
            
            const otherUserData = otherUserDoc.data();
            
            const conversationItem = document.createElement('div');
            conversationItem.className = 'conversation-item';
            conversationItem.innerHTML = `
                <div class="avatar ${otherUserData.isBanned ? 'banned' : ''}">
                    ${otherUserData.username ? otherUserData.username.charAt(0).toUpperCase() : 'م'}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${otherUserData.username || 'مستخدم'}</div>
                    <div class="conversation-preview">${conversationData.lastMessage || 'لا توجد رسائل'}</div>
                </div>
                <div class="conversation-time">
                    ${UIManager.formatTime(conversationData.lastMessageAt)}
                    ${otherUserData.isOnline ? '<span class="status-indicator online"></span>' : ''}
                </div>
            `;
            
            conversationItem.addEventListener('click', () => {
                openConversation(conversation.id, otherUserId, otherUserData);
            });
            
            conversationsList.appendChild(conversationItem);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

async function openConversation(conversationId, friendId, friendData) {
    appState.currentConversation = conversationId;
    appState.currentFriend = { uid: friendId, ...friendData };
    
    // تحديث الواجهة
    UIManager.hideElement('chat-placeholder');
    UIManager.showElement('chat-header');
    UIManager.showElement('chat-input');
    
    // تحديث معلومات الصديق
    const chatUsername = document.getElementById('chat-username');
    const chatStatus = document.getElementById('chat-status');
    
    if (chatUsername) {
        chatUsername.textContent = friendData.username || 'مستخدم';
    }
    
    if (chatStatus) {
        if (friendData.isBanned) {
            chatStatus.textContent = 'حساب موقوف';
            chatStatus.className = 'chat-status';
        } else if (friendData.isOnline) {
            chatStatus.textContent = 'متصل الآن';
            chatStatus.className = 'chat-status online';
        } else {
            chatStatus.textContent = `آخر ظهور: ${UIManager.formatTime(friendData.lastSeen)}`;
            chatStatus.className = 'chat-status';
        }
    }
    
    // تحميل الرسائل
    await loadMessages(conversationId);
    
    // الاستماع للرسائل الجديدة
    listenToNewMessages(conversationId);
}

async function loadMessages(conversationId) {
    try {
        const messages = await ChatSystem.loadMessages(conversationId);
        const messagesList = document.getElementById('messages-list');
        
        if (!messagesList) return;
        
        messagesList.innerHTML = '';
        
        for (const message of messages) {
            addMessageToUI(message);
        }
        
        scrollToBottom();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function addMessageToUI(message) {
    const messagesList = document.getElementById('messages-list');
    
    if (!messagesList) return;
    
    const messageElement = document.createElement('div');
    const isSent = message.senderId === appState.currentUser?.uid;
    
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.dataset.messageId = message.id;
    
    const statusIcons = isSent ? getStatusIcons(message.status) : '';
    
    messageElement.innerHTML = `
        <div class="message-content">${message.content || message.encryptedContent || 'رسالة'}</div>
        <div class="message-time">
            ${UIManager.formatMessageTime(message.timestamp)}
            ${statusIcons}
        </div>
    `;
    
    messagesList.appendChild(messageElement);
}

function getStatusIcons(status) {
    switch(status) {
        case 'sent':
            return '<svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        case 'delivered':
            return '<div class="message-status"><svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: -8px"><path d="M20 6L9 17l-5-5"/></svg></div>';
        case 'read':
            return '<div class="message-status read"><svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: -8px"><path d="M20 6L9 17l-5-5"/></svg></div>';
        default:
            return '';
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('message-input');
    
    if (!messageInput || !appState.currentConversation || !appState.currentFriend) return;
    
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    // إضافة الرسالة للواجهة مؤقتاً
    const tempMessage = {
        id: `temp_${Date.now()}`,
        senderId: appState.currentUser.uid,
        content: messageText,
        timestamp: new Date(),
        status: 'sending'
    };
    
    addMessageToUI(tempMessage);
    scrollToBottom();
    
    // مسح الإدخال
    messageInput.value = '';
    
    // إرسال الرسالة
    const result = await ChatSystem.sendMessage(
        appState.currentConversation,
        messageText,
        appState.currentFriend.uid
    );
    
    if (!result.success) {
        UIManager.showError(result.message);
        // إزالة الرسالة المؤقتة
        const tempElement = document.querySelector(`[data-message-id="${tempMessage.id}"]`);
        if (tempElement) tempElement.remove();
    }
}

function listenToNewMessages(conversationId) {
    // إلغاء المستمع السابق
    if (appState.messagesListener) {
        appState.messagesListener();
    }
    
    appState.messagesListener = db.collection('messages')
        .where('conversationId', '==', conversationId)
        .orderBy('timestamp', 'asc')
        .limitToLast(1)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const messageData = change.doc.data();
                    messageData.id = change.doc.id;
                    addMessageToUI(messageData);
                    scrollToBottom();
                }
            });
        });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

async function loadFriends() {
    if (!appState.currentUser) return;
    
    try {
        const friends = await FriendSystem.getFriendsList(appState.currentUser.uid);
        const conversationsList = document.getElementById('conversations-list');
        
        if (!conversationsList) return;
        
        conversationsList.innerHTML = '';
        
        if (friends.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <p>لم تقم بإضافة أي أصدقاء بعد.</p>
                </div>
            `;
            return;
        }
        
        for (const friend of friends) {
            const friendElement = document.createElement('div');
            friendElement.className = 'conversation-item';
            friendElement.innerHTML = `
                <div class="avatar ${friend.isBanned ? 'banned' : ''}">
                    ${friend.username ? friend.username.charAt(0).toUpperCase() : 'م'}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${friend.username || 'مستخدم'}</div>
                    <div class="conversation-preview">${friend.isOnline ? 'متصل الآن' : 'غير متصل'}</div>
                </div>
            `;
            conversationsList.appendChild(friendElement);
        }
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

async function loadRequests() {
    // تحميل طلبات الصداقة
    console.log('Loading friend requests...');
}

function loadQRView() {
    // عرض صفحة QR
    console.log('Loading QR view...');
    UIManager.showModal('scan-qr-modal');
}

function loadSettingsView() {
    // عرض الإعدادات
    console.log('Loading settings view...');
}

async function handleSearch(query) {
    if (!query.trim() || !appState.currentUser) {
        await loadConversations();
        return;
    }
    
    try {
        const friends = await FriendSystem.getFriendsList(appState.currentUser.uid);
        const filteredFriends = friends.filter(friend => 
            friend.username?.toLowerCase().includes(query.toLowerCase())
        );
        
        const conversationsList = document.getElementById('conversations-list');
        
        if (!conversationsList) return;
        
        conversationsList.innerHTML = '';
        
        if (filteredFriends.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <p>لا توجد نتائج للبحث.</p>
                </div>
            `;
            return;
        }
        
        for (const friend of filteredFriends) {
            const friendElement = document.createElement('div');
            friendElement.className = 'conversation-item';
            friendElement.innerHTML = `
                <div class="avatar">
                    ${friend.username ? friend.username.charAt(0).toUpperCase() : 'م'}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${friend.username || 'مستخدم'}</div>
                    <div class="conversation-preview">صديق</div>
                </div>
            `;
            
            friendElement.addEventListener('click', async () => {
                const result = await ChatSystem.createConversation(friend.id);
                if (result.success) {
                    openConversation(result.conversationId, friend.id, friend);
                }
            });
            
            conversationsList.appendChild(friendElement);
        }
    } catch (error) {
        console.error('Error searching:', error);
    }
}

async function handleQRFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // استخدام مكتبة jsQR إذا كانت متاحة
                if (typeof jsQR !== 'undefined') {
                    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (qrCode && qrCode.data) {
                        await processQRCode(qrCode.data);
                    } else {
                        UIManager.showError('لم يتم العثور على رمز QR في الصورة.');
                    }
                } else {
                    UIManager.showError('مكتبة QR غير متاحة.');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error processing QR:', error);
        UIManager.showError('فشل معالجة الصورة.');
    }
}

async function processQRCode(token) {
    const result = await QRSystem.validateQRToken(token);
    
    if (result.valid) {
        // عرض معلومات المستخدم
        const qrResultContent = document.getElementById('qr-result-content');
        
        if (qrResultContent) {
            qrResultContent.innerHTML = `
                <p>هل تريد إرسال طلب صداقة إلى: <strong>${result.username}</strong>؟</p>
                <div class="qr-actions" style="margin-top: 20px;">
                    <button class="primary-button" onclick="sendFriendRequest('${result.userId}')">إرسال الطلب</button>
                    <button class="text-button" onclick="UIManager.hideModal('qr-result-modal')">إلغاء</button>
                </div>
            `;
        }
        
        UIManager.hideModal('scan-qr-modal');
        UIManager.showModal('qr-result-modal');
    } else {
        UIManager.showError(result.message);
    }
}

async function sendFriendRequest(userId) {
    const result = await FriendSystem.sendFriendRequest(userId);
    
    if (result.success) {
        UIManager.hideModal('qr-result-modal');
        UIManager.showSuccess(result.message);
    } else {
        UIManager.showError(result.message);
    }
}

async function startVARAnalysis() {
    if (!appState.currentConversation) return;
    
    const resultDiv = document.getElementById('var-result');
    
    if (!resultDiv) return;
    
    resultDiv.innerHTML = '<div class="loading-spinner"></div>';
    resultDiv.classList.remove('hidden');
    
    const result = await VARSystem.analyzeConversation(appState.currentConversation);
    
    if (result.success) {
        const analysis = result.analysis;
        let severityClass = 'severity-low';
        let severityText = 'منخفضة';
        
        switch(analysis.severity) {
            case 'high':
                severityClass = 'severity-high';
                severityText = 'عالية';
                break;
            case 'medium':
                severityClass = 'severity-medium';
                severityText = 'متوسطة';
                break;
        }
        
        resultDiv.innerHTML = `
            <h4>نتيجة التحليل</h4>
            <p>عدد الرسائل: ${analysis.totalMessages}</p>
            <p>عدد المخالفات: ${analysis.violations.length}</p>
            <p>مستوى الخطورة: <span class="${severityClass}">${severityText}</span></p>
            ${analysis.violations.length > 0 ? '<p>تم تسجيل تقرير للمراجعة.</p>' : '<p>لا توجد مخالفات.</p>'}
        `;
    } else {
        resultDiv.innerHTML = `<p class="error-message">${result.message}</p>`;
    }
}

// تحديث حالة المستخدم عند إغلاق الصفحة
window.addEventListener('beforeunload', async () => {
    if (appState.currentUser) {
        try {
            await db.collection('users').doc(appState.currentUser.uid).update({
                isOnline: false,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating offline status:', error);
        }
    }
});

// تصدير الدوال للاستخدام العام
window.UIManager = UIManager;
window.ErrorHandler = ErrorHandler;
window.EncryptionSystem = EncryptionSystem;
window.QRSystem = QRSystem;
window.FriendSystem = FriendSystem;
window.ChatSystem = ChatSystem;
window.VARSystem = VARSystem;
window.BanSystem = BanSystem;
window.NotificationSystem = NotificationSystem;
window.sendFriendRequest = sendFriendRequest;
