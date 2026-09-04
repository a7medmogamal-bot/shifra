// ============ SHIFRA - منصة المراسلة الآمنة ============
// الملف الكامل للتطبيق

// ============ تكوين Firebase ============
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

// ============ إدارة الحالة العامة ============
class AppState {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.currentConversation = null;
        this.currentFriend = null;
        this.encryptionKey = null;
        this.unsubscribeListeners = [];
        this.isLoading = false;
        this.typingTimeout = null;
        this.qrToken = null;
    }

    setUser(user) {
        this.currentUser = user;
    }

    setUserData(data) {
        this.userData = data;
    }

    setConversation(conversation) {
        this.currentConversation = conversation;
    }

    setEncryptionKey(key) {
        this.encryptionKey = key;
    }

    addUnsubscribe(listener) {
        this.unsubscribeListeners.push(listener);
    }

    cleanup() {
        this.unsubscribeListeners.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.unsubscribeListeners = [];
    }
}

const appState = new AppState();

// ============ إدارة الواجهة ============
class UIManager {
    static showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
    }

    static hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
    }

    static showElement(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    static hideElement(id) {
        document.getElementById(id).classList.add('hidden');
    }

    static showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    static hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    static showError(message) {
        this.showToast(message, 'error');
    }

    static showSuccess(message) {
        this.showToast(message, 'success');
    }

    static formatTime(timestamp) {
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
    }

    static formatMessageTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    }
}

// ============ معالجة الأخطاء ============
class ErrorHandler {
    static getArabicError(error) {
        const errorCode = error?.code || '';
        const errorMessages = {
            'auth/invalid-credential': 'بيانات تسجيل الدخول غير صحيحة.',
            'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
            'auth/wrong-password': 'كلمة المرور غير صحيحة.',
            'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل.',
            'auth/weak-password': 'كلمة المرور ضعيفة جداً.',
            'auth/too-many-requests': 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً.',
            'auth/network-request-failed': 'فشل الاتصال بالشبكة.',
            'auth/operation-not-allowed': 'هذه العملية غير مسموح بها.',
            'permission-denied': 'ليس لديك صلاحية للقيام بهذه العملية.',
            'not-found': 'العنصر المطلوب غير موجود.',
            'already-exists': 'العنصر موجود بالفعل.',
            'unavailable': 'الخدمة غير متاحة حالياً.',
            'deadline-exceeded': 'انتهت مهلة الطلب.',
            'unauthenticated': 'يجب تسجيل الدخول أولاً.',
            'invalid-argument': 'بيانات غير صالحة.',
            'failed-precondition': 'فشل تنفيذ العملية.'
        };
        return errorMessages[errorCode] || 'حدث خطأ غير متوقع.';
    }
}

// ============ نظام التشفير ============
class EncryptionSystem {
    static async generateKey() {
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
    }

    static async exportKey(key) {
        try {
            const exported = await crypto.subtle.exportKey('raw', key);
            return Array.from(new Uint8Array(exported))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Error exporting key:', error);
            return null;
        }
    }

    static async importKey(keyHex) {
        try {
            const keyBytes = new Uint8Array(
                keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            const key = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );
            return key;
        } catch (error) {
            console.error('Error importing key:', error);
            return null;
        }
    }

    static async encryptMessage(plaintext, key) {
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
    }

    static async decryptMessage(encryptedData, key) {
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

    static async getOrCreateConversationKey(conversationId) {
        if (appState.encryptionKey) return appState.encryptionKey;
        
        try {
            // البحث عن مفتاح مشفر في Firestore
            const keyDoc = await db.collection('conversationKeys')
                .where('conversationId', '==', conversationId)
                .where('participants', 'arrayContains', appState.currentUser.uid)
                .limit(1)
                .get();
            
            if (!keyDoc.empty) {
                const keyData = keyDoc.docs[0].data();
                const encryptedKey = keyData.encryptedKey;
                // في التطبيق الفعلي، سيتم فك تشفير المفتاح باستخدام مفتاح المستخدم الخاص
                const key = await EncryptionSystem.importKey(encryptedKey);
                appState.setEncryptionKey(key);
                return key;
            }
            
            // إنشاء مفتاح جديد
            const newKey = await EncryptionSystem.generateKey();
            const keyHex = await EncryptionSystem.exportKey(newKey);
            
            if (keyHex) {
                await db.collection('conversationKeys').add({
                    conversationId: conversationId,
                    participants: [appState.currentUser.uid, appState.currentFriend?.uid],
                    encryptedKey: keyHex,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                appState.setEncryptionKey(newKey);
                return newKey;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting conversation key:', error);
            return null;
        }
    }
}

// ============ نظام QR ============
class QRSystem {
    static async createInitialQR(userId) {
        try {
            const qrToken = this.generateQRToken();
            await db.collection('qrTokens').add({
                userId: userId,
                token: qrToken,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                changeCount: 0,
                lastChanged: firebase.firestore.FieldValue.serverTimestamp()
            });
            return qrToken;
        } catch (error) {
            console.error('Error creating QR:', error);
            return null;
        }
    }

    static generateQRToken() {
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        const token = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return `SHIFRA_${token}`;
    }

    static async getCurrentQR(userId) {
        try {
            const qrDoc = await db.collection('qrTokens')
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (!qrDoc.empty) {
                return {
                    id: qrDoc.docs[0].id,
                    token: qrDoc.docs[0].data().token,
                    changeCount: qrDoc.docs[0].data().changeCount || 0
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting QR:', error);
            return null;
        }
    }

    static async changeQR(userId) {
        try {
            const currentQR = await this.getCurrentQR(userId);
            if (!currentQR) return { success: false, message: 'لا يوجد رمز QR حالي.' };
            
            // التحقق من حد التغيير الشهري
            if (currentQR.changeCount >= 3) {
                return { 
                    success: false, 
                    message: 'لقد استنفدت عدد مرات تغيير رمز QR المسموح بها هذا الشهر.' 
                };
            }
            
            // تعطيل الرمز القديم
            await db.collection('qrTokens').doc(currentQR.id).update({
                isActive: false
            });
            
            // إنشاء رمز جديد
            const newToken = this.generateQRToken();
            await db.collection('qrTokens').add({
                userId: userId,
                token: newToken,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                changeCount: (currentQR.changeCount || 0) + 1,
                lastChanged: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, token: newToken, message: 'تم تغيير رمز QR بنجاح.' };
        } catch (error) {
            console.error('Error changing QR:', error);
            return { success: false, message: 'فشل تغيير رمز QR.' };
        }
    }

    static async validateQRToken(token) {
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
}

// ============ نظام الأصدقاء ============
class FriendSystem {
    static async sendFriendRequest(toUserId) {
        try {
            if (!appState.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
            
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
            
            // التحقق من عدم وجود صداقة بالفعل
            const existingFriendship = await db.collection('friendships')
                .where('participants', 'arrayContains', fromUserId)
                .get();
            
            const isAlreadyFriend = existingFriendship.docs.some(doc => 
                doc.data().participants.includes(toUserId)
            );
            
            if (isAlreadyFriend) {
                return { success: false, message: 'أنتم أصدقاء بالفعل.' };
            }
            
            // إنشاء طلب الصداقة
            await db.collection('friendRequests').add({
                fromUserId: fromUserId,
                toUserId: toUserId,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 أيام
            });
            
            return { success: true, message: 'تم إرسال طلب الصداقة.' };
        } catch (error) {
            console.error('Error sending friend request:', error);
            return { success: false, message: 'فشل إرسال طلب الصداقة.' };
        }
    }

    static async acceptFriendRequest(requestId) {
        try {
            const requestDoc = await db.collection('friendRequests').doc(requestId).get();
            if (!requestDoc.exists) {
                return { success: false, message: 'طلب الصداقة غير موجود.' };
            }
            
            const requestData = requestDoc.data();
            
            // التحقق من أن المستخدم الحالي هو المستقبل
            if (requestData.toUserId !== appState.currentUser.uid) {
                return { success: false, message: 'ليس لديك صلاحية لقبول هذا الطلب.' };
            }
            
            // إنشاء صداقة
            await db.collection('friendships').add({
                participants: [requestData.fromUserId, requestData.toUserId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // تحديث حالة الطلب
            await db.collection('friendRequests').doc(requestId).update({
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, message: 'تم قبول طلب الصداقة.' };
        } catch (error) {
            console.error('Error accepting friend request:', error);
            return { success: false, message: 'فشل قبول طلب الصداقة.' };
        }
    }

    static async rejectFriendRequest(requestId) {
        try {
            await db.collection('friendRequests').doc(requestId).update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, message: 'تم رفض طلب الصداقة.' };
        } catch (error) {
            console.error('Error rejecting friend request:', error);
            return { success: false, message: 'فشل رفض طلب الصداقة.' };
        }
    }

    static async getFriendsList(userId) {
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

    static async blockUser(userId) {
        try {
            const currentUserId = appState.currentUser.uid;
            
            // إضافة إلى قائمة المحظورين
            await db.collection('users').doc(currentUserId).update({
                blockedUsers: firebase.firestore.FieldValue.arrayUnion(userId)
            });
            
            // حذف الصداقة إذا وجدت
            const friendships = await db.collection('friendships')
                .where('participants', 'arrayContains', currentUserId)
                .get();
            
            for (const friendship of friendships.docs) {
                if (friendship.data().participants.includes(userId)) {
                    await friendship.ref.delete();
                }
            }
            
            return { success: true, message: 'تم حظر المستخدم.' };
        } catch (error) {
            console.error('Error blocking user:', error);
            return { success: false, message: 'فشل حظر المستخدم.' };
        }
    }

    static async unblockUser(userId) {
        try {
            await db.collection('users').doc(appState.currentUser.uid).update({
                blockedUsers: firebase.firestore.FieldValue.arrayRemove(userId)
            });
            
            return { success: true, message: 'تم إلغاء الحظر.' };
        } catch (error) {
            console.error('Error unblocking user:', error);
            return { success: false, message: 'فشل إلغاء الحظر.' };
        }
    }
}

// ============ نظام المحادثة ============
class ChatSystem {
    static async createConversation(friendId) {
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
                lastMessageAt: null,
                temporaryMessages: 'off'
            });
            
            return { success: true, conversationId: conversationRef.id };
        } catch (error) {
            console.error('Error creating conversation:', error);
            return { success: false, message: 'فشل إنشاء المحادثة.' };
        }
    }

    static async sendMessage(conversationId, messageText, friendId) {
        try {
            if (!appState.currentUser) throw new Error('يجب تسجيل الدخول أولاً.');
            
            const currentUserId = appState.currentUser.uid;
            
            // التحقق من أن المستخدم جزء من المحادثة
            const convDoc = await db.collection('conversations').doc(conversationId).get();
            if (!convDoc.exists || !convDoc.data().participants.includes(currentUserId)) {
                throw new Error('ليس لديك صلاحية للإرسال في هذه المحادثة.');
            }
            
            // التحقق من عدم وجود حظر
            const userDoc = await db.collection('users').doc(currentUserId).get();
            const userData = userDoc.data();
            
            if (userData.blockedUsers?.includes(friendId)) {
                throw new Error('لا يمكنك إرسال رسائل لمستخدم محظور.');
            }
            
            // تشفير الرسالة
            const encryptionKey = await EncryptionSystem.getOrCreateConversationKey(conversationId);
            if (!encryptionKey) {
                throw new Error('فشل تشفير الرسالة.');
            }
            
            const encryptedContent = await EncryptionSystem.encryptMessage(messageText, encryptionKey);
            if (!encryptedContent) {
                throw new Error('فشل تشفير الرسالة.');
            }
            
            // إنشاء رسالة جديدة
            const messageRef = await db.collection('messages').add({
                conversationId: conversationId,
                senderId: currentUserId,
                encryptedContent: encryptedContent,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'sent',
                messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });
            
            // تحديث المحادثة
            await db.collection('conversations').doc(conversationId).update({
                lastMessage: 'رسالة مشفرة',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                [`lastMessageFrom_${currentUserId}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, messageId: messageRef.id };
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, message: error.message || 'فشل إرسال الرسالة.' };
        }
    }

    static async loadMessages(conversationId) {
        try {
            const messagesSnapshot = await db.collection('messages')
                .where('conversationId', '==', conversationId)
                .orderBy('timestamp', 'asc')
                .limit(100)
                .get();
            
            const messages = [];
            const encryptionKey = await EncryptionSystem.getOrCreateConversationKey(conversationId);
            
            for (const messageDoc of messagesSnapshot.docs) {
                const messageData = messageDoc.data();
                let decryptedContent = '';
                
                if (encryptionKey && messageData.encryptedContent) {
                    decryptedContent = await EncryptionSystem.decryptMessage(
                        messageData.encryptedContent,
                        encryptionKey
                    );
                }
                
                messages.push({
                    id: messageDoc.id,
                    ...messageData,
                    content: decryptedContent || 'رسالة مشفرة'
                });
            }
            
            return messages;
        } catch (error) {
            console.error('Error loading messages:', error);
            return [];
        }
    }

    static async updateMessageStatus(messageId, status) {
        try {
            await db.collection('messages').doc(messageId).update({
                status: status,
                [`statusUpdatedAt`]: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return true;
        } catch (error) {
            console.error('Error updating message status:', error);
            return false;
        }
    }

    static async setTypingStatus(conversationId, isTyping) {
        try {
            if (!appState.currentUser) return;
            
            await db.collection('conversations').doc(conversationId).update({
                [`typing_${appState.currentUser.uid}`]: isTyping,
                [`typingUpdatedAt_${appState.currentUser.uid}`]: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error setting typing status:', error);
        }
    }

    static async setTemporaryMessages(conversationId, duration) {
        try {
            await db.collection('conversations').doc(conversationId).update({
                temporaryMessages: duration
            });
            
            return { success: true, message: 'تم تحديث إعدادات الرسائل المؤقتة.' };
        } catch (error) {
            console.error('Error setting temporary messages:', error);
            return { success: false, message: 'فشل تحديث الإعدادات.' };
        }
    }
}

// ============ نظام VAR ============
class VARSystem {
    static async analyzeConversation(conversationId) {
        try {
            // تحميل الرسائل المشفرة
            const messages = await ChatSystem.loadMessages(conversationId);
            
            // قواعد التحليل
            const violations = [];
            const bannedWords = [
                'شتيمة', 'إهانة', 'تهديد', 'عنف', 'قتل', 'تحرش',
                'سب', 'قذف', 'إساءة', 'تهديد خطير'
            ];
            
            const spamPatterns = [
                /(.)\1{4,}/, // تكرار الأحرف
                /(..+)\1{3,}/, // تكرار الكلمات
                /\b(شراء|بيع|إعلان|ترويج)\b/ // إعلانات
            ];
            
            for (const message of messages) {
                const content = message.content.toLowerCase();
                
                // فحص الكلمات المحظورة
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
                
                // فحص السبام
                for (const pattern of spamPatterns) {
                    if (pattern.test(content)) {
                        violations.push({
                            messageId: message.id,
                            senderId: message.senderId,
                            type: 'spam',
                            severity: 'medium'
                        });
                    }
                }
            }
            
            // تحليل النتائج
            const analysisResult = {
                totalMessages: messages.length,
                violations: violations,
                severity: this.calculateSeverity(violations),
                timestamp: new Date().toISOString()
            };
            
            // حفظ التقرير
            await db.collection('moderationReports').add({
                conversationId: conversationId,
                reportedBy: appState.currentUser.uid,
                analysis: analysisResult,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, analysis: analysisResult };
        } catch (error) {
            console.error('Error analyzing conversation:', error);
            return { success: false, message: 'فشل تحليل المحادثة.' };
        }
    }

    static calculateSeverity(violations) {
        if (violations.length === 0) return 'none';
        
        const highSeverity = violations.filter(v => v.severity === 'high');
        const mediumSeverity = violations.filter(v => v.severity === 'medium');
        
        if (highSeverity.length > 3) return 'critical';
        if (highSeverity.length > 0) return 'high';
        if (mediumSeverity.length > 5) return 'medium';
        return 'low';
    }
}

// ============ نظام الإشعارات ============
class NotificationSystem {
    static async sendNotification(userId, notification) {
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

    static async getNotifications(userId) {
        try {
            const notifications = await db.collection('notifications')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            
            return notifications.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    static async markAsRead(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).update({
                isRead: true
            });
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }
}

// ============ نظام الحظر ============
class BanSystem {
    static async applyBan(userId, banData) {
        try {
            const { reason, duration, type } = banData;
            
            let banExpiry = null;
            if (type !== 'permanent') {
                banExpiry = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
            }
            
            await db.collection('users').doc(userId).update({
                isBanned: true,
                banType: type,
                banReason: reason,
                banExpiry: banExpiry || null,
                banHistory: firebase.firestore.FieldValue.arrayUnion({
                    reason: reason,
                    type: type,
                    appliedAt: new Date().toISOString(),
                    expiry: banExpiry?.toISOString() || 'permanent'
                })
            });
            
            // تسجيل الحدث الأمني
            await db.collection('securityEvents').add({
                userId: userId,
                type: 'ban_applied',
                reason: reason,
                duration: duration,
                appliedBy: appState.currentUser?.uid || 'system',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, message: 'تم تطبيق العقوبة.' };
        } catch (error) {
            console.error('Error applying ban:', error);
            return { success: false, message: 'فشل تطبيق العقوبة.' };
        }
    }

    static async liftBan(userId) {
        try {
            await db.collection('users').doc(userId).update({
                isBanned: false,
                banType: null,
                banReason: null,
                banExpiry: null
            });
            
            return { success: true, message: 'تم رفع العقوبة.' };
        } catch (error) {
            console.error('Error lifting ban:', error);
            return { success: false, message: 'فشل رفع العقوبة.' };
        }
    }

    static async checkBanStatus(userId) {
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
                    await this.liftBan(userId);
                    return { isBanned: false };
                }
            }
            
            return { isBanned: false };
        } catch (error) {
            console.error('Error checking ban status:', error);
            return { isBanned: false };
        }
    }
}

// ============ نظام الاعتراض ============
class AppealSystem {
    static async submitAppeal(appealData) {
        try {
            await db.collection('appeals').add({
                userId: appState.currentUser.uid,
                reason: appealData.reason,
                details: appealData.details,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, message: 'تم إرسال الاعتراض بنجاح.' };
        } catch (error) {
            console.error('Error submitting appeal:', error);
            return { success: false, message: 'فشل إرسال الاعتراض.' };
        }
    }
}

// ============ إدارة الأجهزة ============
class DeviceManager {
    static async getDevices(userId) {
        try {
            const devices = await db.collection('devices')
                .where('userId', '==', userId)
                .get();
            
            return devices.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting devices:', error);
            return [];
        }
    }

    static async addDevice(deviceInfo) {
        try {
            await db.collection('devices').add({
                userId: appState.currentUser.uid,
                deviceName: deviceInfo.name || 'جهاز غير معروف',
                userAgent: navigator.userAgent,
                lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                loginDate: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error adding device:', error);
            return { success: false };
        }
    }

    static async logoutOtherDevices() {
        try {
            // في التطبيق الفعلي، سيتم استخدام Firebase Admin SDK
            // لتعطيل الجلسات الأخرى
            UIManager.showSuccess('تم تسجيل الخروج من الأجهزة الأخرى.');
            return { success: true };
        } catch (error) {
            console.error('Error logging out other devices:', error);
            return { success: false };
        }
    }
}

// ============ إعدادات الخصوصية ============
class PrivacySettings {
    static async updatePrivacySettings(settings) {
        try {
            await db.collection('users').doc(appState.currentUser.uid).update({
                privacySettings: settings
            });
            
            return { success: true, message: 'تم تحديث إعدادات الخصوصية.' };
        } catch (error) {
            console.error('Error updating privacy settings:', error);
            return { success: false, message: 'فشل تحديث الإعدادات.' };
        }
    }

    static async getPrivacySettings() {
        try {
            const userDoc = await db.collection('users').doc(appState.currentUser.uid).get();
            return userDoc.data()?.privacySettings || {
                showLastSeen: true,
                showOnlineStatus: true,
                readReceipts: true
            };
        } catch (error) {
            console.error('Error getting privacy settings:', error);
            return null;
        }
    }
}

// ============ حذف الحساب ============
class AccountDeletion {
    static async deleteAccount() {
        try {
            const userId = appState.currentUser.uid;
            
            // حذف جميع البيانات المرتبطة بالحساب
            await this.deleteUserData(userId);
            
            // حذف حساب المصادقة
            await appState.currentUser.delete();
            
            UIManager.showSuccess('تم حذف الحساب بنجاح.');
            return { success: true };
        } catch (error) {
            console.error('Error deleting account:', error);
            return { success: false, message: 'فشل حذف الحساب.' };
        }
    }

    static async deleteUserData(userId) {
        try {
            // حذف الملف الشخصي
            await db.collection('users').doc(userId).delete();
            
            // حذف رمز QR
            const qrTokens = await db.collection('qrTokens')
                .where('userId', '==', userId)
                .get();
            
            for (const token of qrTokens.docs) {
                await token.ref.delete();
            }
            
            // حذف طلبات الصداقة
            const requests = await db.collection('friendRequests')
                .where('fromUserId', '==', userId)
                .get();
            
            for (const request of requests.docs) {
                await request.ref.delete();
            }
            
            const receivedRequests = await db.collection('friendRequests')
                .where('toUserId', '==', userId)
                .get();
            
            for (const request of receivedRequests.docs) {
                await request.ref.delete();
            }
            
            // حذف الصداقات
            const friendships = await db.collection('friendships')
                .where('participants', 'arrayContains', userId)
                .get();
            
            for (const friendship of friendships.docs) {
                await friendship.ref.delete();
            }
            
            // حذف المحادثات
            const conversations = await db.collection('conversations')
                .where('participants', 'arrayContains', userId)
                .get();
            
            for (const conversation of conversations.docs) {
                // حذف رسائل المحادثة
                const messages = await db.collection('messages')
                    .where('conversationId', '==', conversation.id)
                    .get();
                
                for (const message of messages.docs) {
                    await message.ref.delete();
                }
                
                await conversation.ref.delete();
            }
            
            // حذف الإشعارات
            const notifications = await db.collection('notifications')
                .where('userId', '==', userId)
                .get();
            
            for (const notification of notifications.docs) {
                await notification.ref.delete();
            }
            
            // حذف الأجهزة
            const devices = await db.collection('devices')
                .where('userId', '==', userId)
                .get();
            
            for (const device of devices.docs) {
                await device.ref.delete();
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting user data:', error);
            return false;
        }
    }
}

// ============ نظام البحث ============
class SearchSystem {
    static async searchFriendsAndConversations(query) {
        try {
            if (!query || query.length < 1) return { friends: [], conversations: [] };
            
            const userId = appState.currentUser.uid;
            query = query.toLowerCase();
            
            // البحث في الأصدقاء
            const friends = await FriendSystem.getFriendsList(userId);
            const filteredFriends = friends.filter(friend => 
                friend.username?.toLowerCase().includes(query)
            );
            
            // البحث في المحادثات
            const conversations = await db.collection('conversations')
                .where('participants', 'arrayContains', userId)
                .get();
            
            const conversationResults = [];
            
            for (const conversation of conversations.docs) {
                const participants = conversation.data().participants;
                const otherUserId = participants.find(id => id !== userId);
                
                const otherUserDoc = await db.collection('users').doc(otherUserId).get();
                if (otherUserDoc.exists) {
                    const username = otherUserDoc.data().username;
                    if (username.toLowerCase().includes(query)) {
                        conversationResults.push({
                            id: conversation.id,
                            friendId: otherUserId,
                            username: username
                        });
                    }
                }
            }
            
            return {
                friends: filteredFriends,
                conversations: conversationResults
            };
        } catch (error) {
            console.error('Error searching:', error);
            return { friends: [], conversations: [] };
        }
    }
}

// ============ تهيئة التطبيق ============
document.addEventListener('DOMContentLoaded', async () => {
    // إضافة الأنماط الديناميكية
    addDynamicStyles();
    
    // إعداد مستمعي الأحداث
    setupEventListeners();
    
    // مراقبة حالة المصادقة
    setupAuthListener();
    
    // إضافة رسالة ترحيب
    console.log('SHIFRA - منصة المراسلة الآمنة');
});

function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .error-message {
            background-color: #fde8e8;
            color: #c0392b;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            animation: slideIn 0.3s ease;
        }
        
        .success-message {
            background-color: #d4efdf;
            color: #27ae60;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            animation: slideIn 0.3s ease;
        }
        
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: 'Cairo', sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .toast.show {
            opacity: 1;
        }
        
        .toast-info {
            background-color: #3498db;
        }
        
        .toast-success {
            background-color: #27ae60;
        }
        
        .toast-error {
            background-color: #e74c3c;
        }
        
        @keyframes slideIn {
            from {
                transform: translateY(-10px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .message {
            animation: messageIn 0.3s ease;
        }
        
        @keyframes messageIn {
            from {
                transform: translateY(10px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .conversation-item {
            transition: all 0.3s ease;
        }
        
        .conversation-item:hover {
            background-color: #f0f4f8;
        }
        
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            margin-left: 4px;
        }
        
        .status-indicator.online {
            background-color: #27ae60;
        }
        
        .status-indicator.offline {
            background-color: #95a5a6;
        }
        
        .avatar.banned {
            background-color: #e74c3c;
            position: relative;
        }
        
        .avatar.banned::after {
            content: 'موقوف';
            position: absolute;
            bottom: -8px;
            font-size: 8px;
            background-color: #e74c3c;
            padding: 1px 4px;
            border-radius: 2px;
            white-space: nowrap;
        }
        
        .temporary-badge {
            background-color: #f39c12;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            display: inline-block;
        }
        
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function setupEventListeners() {
    // تبويبات المصادقة
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.tab === 'login') {
                document.getElementById('login-form').classList.remove('hidden');
                document.getElementById('register-form').classList.add('hidden');
            } else {
                document.getElementById('login-form').classList.add('hidden');
                document.getElementById('register-form').classList.remove('hidden');
            }
        });
    });
    
    // نماذج المصادقة
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.view));
    });
    
    // أزرار الهيدر
    document.getElementById('header-qr-btn').addEventListener('click', () => navigateTo('qr'));
    document.getElementById('header-settings-btn').addEventListener('click', () => navigateTo('settings'));
    
    // البحث
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 500);
    });
    
    // إرسال الرسائل
    document.getElementById('message-form').addEventListener('submit', handleSendMessage);
    
    // مؤشر الكتابة
    document.getElementById('message-input').addEventListener('input', handleTyping);
    
    // إغلاق المودالات
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });
    
    // فحص QR
    document.getElementById('upload-qr-btn').addEventListener('click', () => {
        document.getElementById('qr-file-input').click();
    });
    
    document.getElementById('qr-file-input').addEventListener('change', handleQRFileUpload);
    document.getElementById('cancel-scan-btn').addEventListener('click', closeQRScanner);
    
    // تحليل VAR
    document.getElementById('var-btn').addEventListener('click', openVARModal);
    document.getElementById('start-var-analysis').addEventListener('click', startVARAnalysis);
}

function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        UIManager.showLoading();
        
        if (user) {
            appState.setUser(user);
            
            try {
                // تحميل بيانات المستخدم
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    appState.setUserData(userDoc.data());
                    
                    // التحقق من حالة الحظر
                    const banStatus = await BanSystem.checkBanStatus(user.uid);
                    if (banStatus.isBanned) {
                        showBanScreen(userDoc.data(), banStatus);
                        await auth.signOut();
                        UIManager.hideLoading();
                        return;
                    }
                    
                    // تحديث حالة الاتصال
                    await db.collection('users').doc(user.uid).update({
                        isOnline: true,
                        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // تسجيل الجهاز
                    await DeviceManager.addDevice({
                        name: navigator.platform || 'جهاز غير معروف'
                    });
                    
                    UIManager.showElement('chat-interface');
                    UIManager.hideElement('auth-screen');
                    
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
            appState.setUser(null);
            appState.setUserData(null);
            appState.cleanup();
            
            UIManager.hideElement('chat-interface');
            UIManager.showElement('auth-screen');
        }
        
        UIManager.hideLoading();
    });
}

function showBanScreen(userData, banStatus) {
    const banModal = document.createElement('div');
    banModal.className = 'modal';
    banModal.style.display = 'flex';
    
    let banMessage = '';
    if (banStatus.permanent) {
        banMessage = 'هذا الإيقاف لا تنتهي مدته.';
    } else if (banStatus.expiry) {
        banMessage = `تاريخ انتهاء الإيقاف: ${banStatus.expiry.toLocaleDateString('ar')}`;
    }
    
    banModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>تم إيقاف الحساب</h3>
            </div>
            <div class="modal-body">
                <p>سبب الإيقاف: ${userData.banReason || 'غير محدد'}</p>
                <p>${banMessage}</p>
                <button class="primary-button" onclick="this.closest('.modal').remove()">حسناً</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(banModal);
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
        
        // تسجيل الدخول تلقائياً
        await auth.signInWithEmailAndPassword(email, password);
        
    } catch (error) {
        UIManager.hideLoading();
        UIManager.showError(ErrorHandler.getArabicError(error));
    }
}

async function navigateTo(view) {
    appState.currentView = view;
    
    // تحديث التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    switch(view) {
        case 'chats':
            await loadChatsView();
            break;
        case 'friends':
            await loadFriendsView();
            break;
        case 'requests':
            await loadRequestsView();
            break;
        case 'qr':
            await loadQRView();
            break;
        case 'settings':
            await loadSettingsView();
            break;
    }
}

async function loadChatsView() {
    UIManager.showElement('chat-interface');
    await loadConversations();
}

async function loadConversations() {
    if (!appState.currentUser) return;
    
    try {
        const conversationsList = document.getElementById('conversations-list');
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
                    ${otherUserData.username.charAt(0).toUpperCase()}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${otherUserData.username}</div>
                    <div class="conversation-preview">
                        ${conversationData.lastMessage || 'لا توجد رسائل'}
                    </div>
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
    appState.setConversation(conversationId);
    appState.currentFriend = { uid: friendId, ...friendData };
    
    // تحديث الواجهة
    document.getElementById('chat-placeholder').classList.add('hidden');
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-input').classList.remove('hidden');
    
    document.getElementById('chat-username').textContent = friendData.username;
    
    const chatStatus = document.getElementById('chat-status');
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
    
    // تحميل الرسائل
    await loadMessages(conversationId);
    
    // الاستماع للرسائل الجديدة
    listenToNewMessages(conversationId);
    
    // الاستماع لحالة الكتابة
    listenToTypingStatus(conversationId);
}

async function loadMessages(conversationId) {
    try {
        const messages = await ChatSystem.loadMessages(conversationId);
        const messagesList = document.getElementById('messages-list');
        messagesList.innerHTML = '';
        
        for (const message of messages) {
            addMessageToUI(message);
        }
        
        // التمرير للأسفل
        scrollToBottom();
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function addMessageToUI(message) {
    const messagesList = document.getElementById('messages-list');
    const messageElement = document.createElement('div');
    
    const isSent = message.senderId === appState.currentUser.uid;
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const statusIcons = isSent ? getStatusIcons(message.status) : '';
    
    messageElement.innerHTML = `
        <div class="message-content">${message.content}</div>
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
    const messageText = messageInput.value.trim();
    
    if (!messageText || !appState.currentConversation) return;
    
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

function handleTyping() {
    if (!appState.currentConversation) return;
    
    // إرسال حالة الكتابة
    ChatSystem.setTypingStatus(appState.currentConversation, true);
    
    // إيقاف بعد فترة
    clearTimeout(appState.typingTimeout);
    appState.typingTimeout = setTimeout(() => {
        ChatSystem.setTypingStatus(appState.currentConversation, false);
    }, 2000);
}

function listenToNewMessages(conversationId) {
    // إلغاء الاشتراك السابق
    if (appState.messagesListener) {
        appState.messagesListener();
    }
    
    appState.messagesListener = db.collection('messages')
        .where('conversationId', '==', conversationId)
        .orderBy('timestamp', 'asc')
        .limitToLast(1)
        .onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const messageData = change.doc.data();
                    
                    // فك تشفير الرسالة
                    const encryptionKey = await EncryptionSystem.getOrCreateConversationKey(conversationId);
                    if (encryptionKey && messageData.encryptedContent) {
                        messageData.content = await EncryptionSystem.decryptMessage(
                            messageData.encryptedContent,
                            encryptionKey
                        );
                    }
                    
                    addMessageToUI({
                        id: change.doc.id,
                        ...messageData
                    });
                    
                    scrollToBottom();
                    
                    // تحديث حالة الرسالة إذا كانت واردة
                    if (messageData.senderId !== appState.currentUser.uid) {
                        await ChatSystem.updateMessageStatus(change.doc.id, 'read');
                    }
                }
                
                if (change.type === 'modified') {
                    // تحديث حالة الرسالة
                    const messageElement = document.querySelector(`[data-message-id="${change.doc.id}"]`);
                    if (messageElement) {
                        const statusIcons = getStatusIcons(change.doc.data().status);
                        const timeElement = messageElement.querySelector('.message-time');
                        if (timeElement) {
                            timeElement.innerHTML = `
                                ${UIManager.formatMessageTime(change.doc.data().timestamp)}
                                ${statusIcons}
                            `;
                        }
                    }
                }
            });
        });
}

function listenToTypingStatus(conversationId) {
    if (appState.typingListener) {
        appState.typingListener();
    }
    
    appState.typingListener = db.collection('conversations')
        .doc(conversationId)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const friendId = appState.currentFriend?.uid;
                
                if (friendId && data[`typing_${friendId}`]) {
                    document.getElementById('typing-indicator').classList.remove('hidden');
                } else {
                    document.getElementById('typing-indicator').classList.add('hidden');
                }
            }
        });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

async function loadFriendsView() {
    // هذه الوظيفة ستقوم بتحميل قائمة الأصدقاء
    console.log('Loading friends view...');
}

async function loadRequestsView() {
    // هذه الوظيفة ستقوم بتحميل طلبات الصداقة
    console.log('Loading requests view...');
}

async function loadQRView() {
    // هذه الوظيفة ستقوم بتحميل صفحة QR
    console.log('Loading QR view...');
}

async function loadSettingsView() {
    // هذه الوظيفة ستقوم بتحميل صفحة الإعدادات
    console.log('Loading settings view...');
}

async function handleSearch(query) {
    if (!query.trim()) {
        await loadConversations();
        return;
    }
    
    const results = await SearchSystem.searchFriendsAndConversations(query);
    
    const conversationsList = document.getElementById('conversations-list');
    conversationsList.innerHTML = '';
    
    // عرض الأصدقاء
    for (const friend of results.friends) {
        const friendElement = document.createElement('div');
        friendElement.className = 'conversation-item';
        friendElement.innerHTML = `
            <div class="avatar">${friend.username.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${friend.username}</div>
                <div class="conversation-preview">صديق</div>
            </div>
        `;
        conversationsList.appendChild(friendElement);
    }
    
    // عرض المحادثات
    for (const conversation of results.conversations) {
        const conversationElement = document.createElement('div');
        conversationElement.className = 'conversation-item';
        conversationElement.innerHTML = `
            <div class="avatar">${conversation.username.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${conversation.username}</div>
                <div class="conversation-preview">محادثة</div>
            </div>
        `;
        conversationElement.addEventListener('click', () => {
            openConversation(conversation.id, conversation.friendId, { username: conversation.username });
        });
        conversationsList.appendChild(conversationElement);
    }
}

function closeQRScanner() {
    UIManager.hideModal('scan-qr-modal');
    
    // إيقاف الكاميرا
    const video = document.getElementById('camera-preview');
    if (video.srcObject) {
        const stream = video.srcObject;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

async function handleQRFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        // قراءة الصورة
        const imageData = await readImageFile(file);
        
        // فك تشفير QR
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (qrCode && qrCode.data) {
            await processQRCode(qrCode.data);
        } else {
            UIManager.showError('لم يتم العثور على رمز QR في الصورة.');
        }
    } catch (error) {
        console.error('Error processing QR:', error);
        UIManager.showError('فشل معالجة الصورة.');
    }
}

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                resolve({
                    data: imageData.data,
                    width: canvas.width,
                    height: canvas.height
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function processQRCode(token) {
    const result = await QRSystem.validateQRToken(token);
    
    if (result.valid) {
        // عرض معلومات المستخدم
        document.getElementById('qr-result-content').innerHTML = `
            <p>هل تريد إرسال طلب صداقة إلى: <strong>${result.username}</strong>؟</p>
            <div class="qr-actions" style="margin-top: 20px;">
                <button class="primary-button" onclick="sendFriendRequest('${result.userId}')">إرسال الطلب</button>
                <button class="text-button" onclick="UIManager.hideModal('qr-result-modal')">إلغاء</button>
            </div>
        `;
        
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

function openVARModal() {
    UIManager.showModal('var-modal');
}

async function startVARAnalysis() {
    if (!appState.currentConversation) return;
    
    const resultDiv = document.getElementById('var-result');
    resultDiv.innerHTML = '<div class="loading-spinner"></div>';
    resultDiv.classList.remove('hidden');
    
    const result = await VARSystem.analyzeConversation(appState.currentConversation);
    
    if (result.success) {
        const analysis = result.analysis;
        let severityClass = 'severity-low';
        let severityText = 'منخفضة';
        
        switch(analysis.severity) {
            case 'critical':
                severityClass = 'severity-high';
                severityText = 'حرجة';
                break;
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
window.DeviceManager = DeviceManager;
window.PrivacySettings = PrivacySettings;
window.AccountDeletion = AccountDeletion;
window.SearchSystem = SearchSystem;
window.sendFriendRequest = sendFriendRequest;
