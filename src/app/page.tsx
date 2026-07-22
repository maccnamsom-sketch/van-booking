'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Mail, Lock, Bus, AlertCircle } from 'lucide-react';

// นำเข้า auth และ db จากไฟล์กลาง src/lib/firebase.ts ของโปรเจกต์
import { auth, db } from '../lib/firebase';

// นำเข้าหน้าย่อยที่แยกไว้
import UserView from '../components/UserView';
import AdminView from '../components/AdminView';

export default function EnterpriseVanBookingSystem() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'home' | 'booking' | 'history' | 'qrcode' | 'admin' | 'shiftRequest'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.email === 'admin@company.com';

  useEffect(() => {
    if (user && !isAdmin && activeMenu === 'admin') {
      setActiveMenu('home');
    }
  }, [activeMenu, user, isAdmin]);

  const [modalAlert, setModalAlert] = useState<{
    isOpen: boolean; type: 'success' | 'warning' | 'error' | 'info'; title: string; message: string; onConfirm?: () => void; showCancel?: boolean;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const showAlert = (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel = false) => {
    setModalAlert({ isOpen: true, type, title, message, onConfirm, showCancel });
  };

  const [routesList, setRoutesList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<any[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [adHocRequestsList, setAdHocRequestsList] = useState<any[]>([]);
  const [recentBooking, setRecentBooking] = useState<any>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

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

    const unsubscribeTickets = onSnapshot(query(collection(db, 'support_tickets'), orderBy('timestamp', 'desc')), (snapshot) => {
      setTicketsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeShiftRequests = onSnapshot(query(collection(db, 'shiftRequests')), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdHocRequestsList(list);
    });

    return () => {
      unsubscribeRoutes();
      unsubscribeBookings();
      unsubscribeAnnounce();
      unsubscribeTickets();
      unsubscribeShiftRequests();
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

  // 🎨 ส่วนหน้าจอ Login ใหม่ (ปรับเพิ่ม Mobile First Responsive)
  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4 sm:p-6 md:p-8">
        <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-xl sm:shadow-2xl border border-slate-200/80 md:flex-row">
          
          {/* 🔷 ฝั่งซ้าย: แสดงในคอมพิวเตอร์ (Desktop View) */}
          <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-10 text-white md:flex">
            <div className="flex items-center gap-2.5 font-bold tracking-wider text-blue-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                <Bus className="h-5 w-5" />
              </div>
              <span className="text-base font-extrabold text-white">AEROFLEX</span>
            </div>

            <div className="space-y-3">
              <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-300 border border-blue-500/20">
                Enterprise Transportation
              </span>
              <h1 className="text-2xl font-black leading-snug tracking-tight">
                ระบบจองรถตู้พนักงาน
              </h1>
              <p className="text-xs font-light text-slate-300 leading-relaxed">
                บริษัท แอร์โรเฟลกซ์ จำกัด — ยกระดับความสะดวกสบายในการเดินทาง รวดเร็ว ปลอดภัย และแม่นยำ
              </p>
            </div>

            <div className="text-[11px] text-slate-400">
              © AEROFLEX CO., LTD. ALL RIGHTS RESERVED.
            </div>
          </div>

          {/* 📱 แถบ Header โลโก้เพิ่มเติมสำหรับมือถือ (Mobile Header Bar) */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 px-6 py-5 text-white md:hidden">
            <div className="flex items-center gap-2.5 font-bold tracking-wider">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30">
                <Bus className="h-4 w-4" />
              </div>
              <span className="text-sm font-black text-white">AEROFLEX</span>
            </div>
            <span className="text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              Van Booking
            </span>
          </div>

          {/* ⬜ ฝั่งขวา: ฟอร์ม Login (รองรับจอทุกขนาด) */}
          <div className="flex w-full flex-col justify-center p-6 sm:p-8 md:w-1/2 md:p-12">
            <div className="mb-6 space-y-1 text-center md:text-left">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">เข้าสู่ระบบ</h2>
              <p className="text-xs text-slate-500">
                ระบบจองรถตู้พนักงาน บริษัท แอร์โรเฟลกซ์ จำกัด
              </p>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault(); 
                setLoginError(''); 
                setIsLoggingIn(true);
                try { 
                  await signInWithEmailAndPassword(auth, email, password); 
                } catch { 
                  setLoginError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); 
                } finally { 
                  setIsLoggingIn(false); 
                }
              }} 
              className="space-y-4"
            >
              {loginError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">อีเมล</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 md:py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">รหัสผ่าน</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 md:py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900" 
                    required 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full rounded-xl bg-slate-900 py-3.5 md:py-3 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 mt-2" 
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>

            <div className="mt-8 text-center text-[11px] text-slate-400">
              พบปัญหาการใช้งาน ติดต่อ <span className="font-semibold text-slate-600 underline cursor-pointer">Admin</span>
            </div>
          </div>

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
            
            <button onClick={() => { setActiveMenu('shiftRequest'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'shiftRequest' ? theme.menuActive : theme.menuInactive}`}>แจ้งขอเปลี่ยนกะ / ออกก่อนเวลา</button>
            
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
              adHocRequestsList={adHocRequestsList}
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