'use client';

import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// นำเข้าหน้าย่อยที่แยกไว้
import UserView from '../components/UserView';
import AdminView from '../components/AdminView';

const firebaseConfig = {
  apiKey: "AIzaSyAKXKm-9nj24zFN1kyGt_YSOcnTfwWXGHg",
  authDomain: "employee-van-booking.firebaseapp.com",
  projectId: "employee-van-booking",
  storageBucket: "employee-van-booking.firebasestorage.app",
  messagingSenderId: "113295103792",
  appId: "1:113295103792:web:6474b89b1f275238341af5",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function EnterpriseVanBookingSystem() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'home' | 'booking' | 'history' | 'qrcode' | 'admin'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 🔥 เพิ่ม State สำหรับเปิด-ปิดเมนูบนมือถือ

  // ตรวจสอบสิทธิ์ว่าเป็นแอดมินหรือไม่ (สามารถเปลี่ยนเมลแอดมินตรงนี้ได้ครับ)
  const isAdmin = user?.email === 'admin@company.com';

  // เด้งกลับหน้าหลักอัตโนมัติถ้าแฮกเข้าเมนูแอดมินผ่าน url/state
  useEffect(() => {
    if (user && !isAdmin && activeMenu === 'admin') {
      setActiveMenu('home');
    }
  }, [activeMenu, user, isAdmin]);

  // Modal alert state
  const [modalAlert, setModalAlert] = useState<{
    isOpen: boolean; type: 'success' | 'warning' | 'error' | 'info'; title: string; message: string; onConfirm?: () => void; showCancel?: boolean;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showAlert = (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel = false) => {
    setModalAlert({ isOpen: true, type, title, message, onConfirm, showCancel });
  };

  // Live Data States
  const [routesList, setRoutesList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [ticketsList, setTicketsList] = useState<any[]>([]); // เก็บตั๋วแจ้งปัญหา
  const [recentBooking, setRecentBooking] = useState<any>(null);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const unsubscribeRoutes = onSnapshot(query(collection(db, 'van_routes')), (snapshot) => {
      setRoutesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeBookings = onSnapshot(query(collection(db, 'van_bookings'), orderBy('timestamp', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookingsList(data);
      if (user) {
        const myBookings = data.filter((b: any) => b.employeeEmail === user.email);
        if (myBookings.length > 0) setRecentBooking(myBookings[0]);
      }
    });

    const unsubscribeAnnounce = onSnapshot(query(collection(db, 'van_announcements'), orderBy('timestamp', 'desc')), (snapshot) => {
      setAnnouncementsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // ดึงข้อมูลตั๋วแจ้งปัญหาจากคอลเลกชัน support_tickets แบบ Realtime
    const unsubscribeTickets = onSnapshot(query(collection(db, 'support_tickets'), orderBy('timestamp', 'desc')), (snapshot) => {
      setTicketsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRoutes();
      unsubscribeBookings();
      unsubscribeAnnounce();
      unsubscribeTickets(); // คืนค่าปิดตัวจับการเปลี่ยนแปลงตั๋วปัญหาเมื่อเลิกใช้หน้าเว็บ
    };
  }, [user]);

  const theme = {
    bg: isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-800',
    card: isDarkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]',
    sidebar: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100',
    menuActive: isDarkMode ? 'bg-blue-600/10 text-blue-400 font-bold border-l-4 border-blue-500' : 'bg-blue-50/70 text-blue-600 font-bold border-l-4 border-blue-600',
    menuInactive: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white text-xs">Loading...</div>;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9] p-4 text-xs">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl border">
          <div className="text-center mb-6">
            <h2 className="text-base font-black text-slate-900">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</h2>
            <p className="text-slate-400 text-[11px] mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานองค์กร</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault(); setLoginError(''); setIsLoggingIn(true);
            try { await signInWithEmailAndPassword(auth, email, password); } 
            catch { setLoginError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); } 
            finally { setIsLoggingIn(false); }
          }} className="space-y-4">
            {loginError && <div className="text-red-500 text-center font-bold bg-red-50 p-2.5 rounded-xl">{loginError}</div>}
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border p-3 rounded-xl bg-slate-50 text-slate-900 focus:outline-none" required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border p-3 rounded-xl bg-slate-50 text-slate-900 focus:outline-none" required />
            <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl transition-all" disabled={isLoggingIn}>{isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${theme.bg} antialiased relative`}>
      {/* GLOBAL MODAL DIALOG */}
      {modalAlert.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm text-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4 border">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{modalAlert.title}</h3>
            <p className="text-slate-500 dark:text-slate-400">{modalAlert.message}</p>
            <div className="flex gap-2">
              {modalAlert.showCancel && <button onClick={() => setModalAlert(prev => ({ ...prev, isOpen: false }))} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl">ยกเลิก</button>}
              <button onClick={() => { if (modalAlert.onConfirm) modalAlert.onConfirm(); setModalAlert(prev => ({ ...prev, isOpen: false })); }} className="flex-1 bg-blue-600 text-white py-2 rounded-xl">ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BACKDROP */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`w-64 ${theme.sidebar} border-r flex flex-col justify-between print:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="p-6 border-b flex justify-between items-center">
            <h1 className="font-black text-xs text-slate-900 dark:text-white">AEROFLEX CO., LTD.</h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-500 font-bold p-1">✕</button>
          </div>
          <nav className="mt-4 space-y-1 text-xs">
            <button onClick={() => { setActiveMenu('home'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'home' ? theme.menuActive : theme.menuInactive}`}>หน้าหลัก & ประกาศ</button>
            <button onClick={() => { setActiveMenu('booking'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'booking' ? theme.menuActive : theme.menuInactive}`}>ลงทะเบียนจองคิวรถตู้</button>
            <button onClick={() => { setActiveMenu('history'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'history' ? theme.menuActive : theme.menuInactive}`}>ประวัติการเดินทาง</button>
            <button onClick={() => { setActiveMenu('qrcode'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'qrcode' ? theme.menuActive : theme.menuInactive}`}>คิวอาร์โค้ดเช็กอิน</button>
            
            {isAdmin && (
              <div className="pt-4 mt-4 border-t mx-4">
                <span className="px-2 text-[10px] uppercase font-bold text-slate-400 block mb-1">ADMIN DESK</span>
                <button onClick={() => { setActiveMenu('admin'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl ${activeMenu === 'admin' ? 'bg-slate-900 text-white font-bold' : theme.menuInactive}`}>แผงควบคุมแอดมิน</button>
              </div>
            )}
          </nav>
        </div>
        <div className="p-4 border-t space-y-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border">สลับโหมดมืด/สว่าง</button>
          <button onClick={() => signOut(auth)} className="w-full py-2 bg-red-50 text-red-600 font-bold rounded-lg text-[10px]">ออกจากระบบ</button>
        </div>
      </aside>

      {/* RENDER DYNAMIC VIEWS */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 px-4 md:px-8 border-b ${theme.card} flex justify-between items-center print:hidden`}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold shrink-0">
              ☰ เมนู
            </button>
            <div className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</div>
          </div>
          <div className="text-[10px] md:text-xs font-bold truncate ml-2 shrink-0">{user.email}</div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {activeMenu === 'admin' && isAdmin ? (
            <AdminView      
              db={db} user={user} theme={theme} showAlert={showAlert}
              routesList={routesList} bookingsList={bookingsList} announcementsList={announcementsList} 
              supportTicketsList={ticketsList}
            />
          ) : (
            <UserView 
              db={db} user={user} theme={theme} activeMenu={activeMenu} setActiveMenu={setActiveMenu}
              routesList={routesList} bookingsList={bookingsList} announcementsList={announcementsList}
              recentBooking={recentBooking} setRecentBooking={setRecentBooking} showAlert={showAlert}
              supportTicketsList={ticketsList}
            />
          )}
        </main>
      </div>
    </div>
  );
}