'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { User, Lock, AlertCircle } from 'lucide-react'; 

import { auth, db } from '../lib/firebase';
import UserView from '../components/UserView';
import AdminView from '../components/AdminView';

export default function EnterpriseVanBookingSystem() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState<'home' | 'booking' | 'history' | 'qrcode' | 'manual' | 'admin' | 'shiftRequest' | 'routeMap'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.email === 'admin@company.com';

  const [employeeData, setEmployeeData] = useState<any>(null);

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

  const [employeeId, setEmployeeId] = useState('');
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

    let unsubscribeEmp: any = null;
    if (!isAdmin && user.email) {
      const empId = user.email.split('@')[0];
      unsubscribeEmp = onSnapshot(doc(db, 'employees', empId), (docSnap) => {
        if (docSnap.exists()) {
          setEmployeeData(docSnap.data());
        }
      });
    }

    return () => {
      unsubscribeRoutes();
      unsubscribeBookings();
      unsubscribeAnnounce();
      unsubscribeTickets();
      unsubscribeShiftRequests();
      if (unsubscribeEmp) unsubscribeEmp();
    };
  }, [user, isAdmin]);

  const theme = {
    bg: isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-800',
    card: isDarkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]',
    sidebar: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100',
    menuActive: isDarkMode ? 'bg-blue-600/10 text-blue-400 font-bold border-l-4 border-blue-500' : 'bg-blue-50/70 text-blue-600 font-bold border-l-4 border-blue-600',
    menuInactive: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white text-xs">Loading...</div>;

  if (!user) {
    const isLoginAdmin = employeeId.trim().toLowerCase() === 'admin';

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault(); 
      setLoginError(''); 
      setIsLoggingIn(true);
      
      try {
        let loginEmail = '';
        let loginPassword = '';

        if (isLoginAdmin) {
          loginEmail = 'admin@company.com';
          loginPassword = password; 
        } else {
          const empIdStr = employeeId.trim();
          loginEmail = `${empIdStr}@company.com`;
          loginPassword = `${empIdStr}@aero`; 
        }

        await signInWithEmailAndPassword(auth, loginEmail, loginPassword); 
      } catch (error) { 
        setLoginError('รหัสพนักงานไม่ถูกต้อง หรือยังไม่ได้ลงทะเบียนในระบบ'); 
      } finally { 
        setIsLoggingIn(false); 
      }
    };

    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#EAF3FF] via-[#F5F8FF] to-[#DCEAFF] p-4 sm:p-6">

        {/* Background glow */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-blue-300/40 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-sky-300/50 blur-[110px]" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-indigo-200/30 blur-[90px]" />

        <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/80 bg-white/75 shadow-[0_25px_80px_rgba(72,111,180,0.18),0_0_40px_rgba(111,170,255,0.12)] backdrop-blur-2xl md:grid md:grid-cols-2">

          {/* LEFT BRAND PANEL */}
          <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#253F76] via-[#3768AC] to-[#79A9ED] p-7 text-white sm:p-10 md:min-h-[570px]">

            {/* Light effects */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/20 bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="pointer-events-none absolute right-10 top-1/2 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl" />

            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 p-1.5 shadow-[0_0_25px_rgba(255,255,255,0.18)] backdrop-blur-md">
                <img
                  src="/aeroflex-logo.png"
                  alt="AEROFLEx Logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <h1 className="text-lg font-black tracking-[0.16em] text-white">
                  AEROFLEX
                </h1>
                <p className="text-[9px] tracking-[0.18em] text-blue-100">
                  COMPANY LIMITED
                </p>
              </div>
            </div>

            <div className="relative z-10 my-10 space-y-5 text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[10px] font-semibold tracking-wider text-white shadow-sm backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,255,190,0.9)]" />
                EMPLOYEE TRANSPORTATION
              </div>

              <h2 className="text-3xl font-bold leading-relaxed tracking-tight sm:text-4xl">
                เดินทางสะดวก
                <br />
                <span className="text-blue-100">ด้วยระบบจองรถ</span>
              </h2>

              <p className="max-w-sm text-sm leading-7 text-blue-50/90">
                ระบบสำรองสิทธิ์เดินทางสำหรับพนักงาน
                บริษัท แอร์โรเฟลกซ์ จำกัด
                ใช้งานง่าย สะดวก และรวดเร็ว
              </p>

              <div className="flex items-center gap-3 pt-2">
                <div className="h-1 w-12 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
                <div className="h-1 w-4 rounded-full bg-white/50" />
                <div className="h-1 w-4 rounded-full bg-white/30" />
              </div>
            </div>

            <div className="relative z-10 hidden text-[10px] tracking-wider text-blue-100/80 md:block">
              © AEROFLEX COMPANY LIMITED. ALL RIGHTS RESERVED.
            </div>
          </div>

          {/* RIGHT LOGIN PANEL */}
          <div className="relative flex flex-col justify-center bg-white/75 p-6 sm:p-10 md:p-12">

            {/* Top decorative glow */}
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100/60 blur-[75px]" />

            <div className="relative z-10 mx-auto w-full max-w-sm">

              {/* Logo mobile */}
              <div className="mb-7 flex items-center justify-center md:hidden">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-white p-2 shadow-[0_5px_25px_rgba(80,140,220,0.18)]">
                  <img
                    src="/aeroflex-logo.png"
                    alt="AEROFLEx Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="mb-8 text-center md:text-left">
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#6B94CF]">
                  WELCOME BACK
                </span>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#243B68]">
                  เข้าสู่ระบบ
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  กรุณากรอกรหัสพนักงานของคุณเพื่อเข้าสู่ระบบ
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">

                {loginError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50/90 p-3 text-xs font-medium text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#405579]">
                    รหัสพนักงาน
                  </label>

                  <div className="group relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A8CA] transition group-focus-within:text-blue-500" />

                    <input
                      type="text"
                      placeholder="เช่น 12345"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full rounded-2xl border border-[#DCE8F8] bg-[#F6F9FF]/90 py-4 pl-12 pr-4 text-sm text-[#263F6D] outline-none transition-all placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100/80"
                      required
                    />
                  </div>
                </div>

                {isLoginAdmin && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-2 duration-300">
                    <label className="text-xs font-bold text-[#405579]">
                      รหัสผ่านแอดมิน
                    </label>

                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91A8CA] transition group-focus-within:text-blue-500" />

                      <input
                        type="password"
                        placeholder="กรอกรหัสผ่าน"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-[#DCE8F8] bg-[#F6F9FF]/90 py-4 pl-12 pr-4 text-sm text-[#263F6D] outline-none transition-all placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100/80"
                        required={isLoginAdmin}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="group relative mt-3 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#356BC1] via-[#4D8BE3] to-[#70A9F5] py-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(67,126,215,0.30),0_0_18px_rgba(112,169,245,0.20)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(67,126,215,0.40),0_0_28px_rgba(112,169,245,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative z-10">
                    {isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                  </span>

                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </button>
              </form>

              <div className="mt-9 border-t border-blue-50 pt-6 text-center">
                <p className="text-[11px] leading-6 text-slate-400">
                  หากไม่สามารถเข้าสู่ระบบได้
                  <br />
                  กรุณาติดต่อ
                  <span className="ml-1 font-bold text-[#5478B0]">
                    แผนก HR / Admin
                  </span>
                </p>
              </div>

              <div className="mt-6 text-center text-[9px] tracking-[0.16em] text-[#A6B8D3]">
                AEROFLEX COMPANY LIMITED
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${theme.bg} antialiased relative`}>
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

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

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
            
            {/* 🟢 ย้าย "ดูแผนที่จำลองเส้นทาง" ลงมาไว้ข้างล่างประวัติการเดินทาง */}
            <button onClick={() => { setActiveMenu('routeMap'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 flex items-center gap-2 ${activeMenu === 'routeMap' ? theme.menuActive : theme.menuInactive}`}>
              <span>🗺️</span> ดูแผนที่จำลองเส้นทาง
            </button>

            <button onClick={() => { setActiveMenu('qrcode'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-6 py-3 ${activeMenu === 'qrcode' ? theme.menuActive : theme.menuInactive}`}>คู่มือการใช้งาน</button>
            
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 px-4 md:px-8 border-b ${theme.card} flex justify-between items-center print:hidden`}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold shrink-0">
              ☰ เมนู
            </button>
            <div className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</div>
          </div>
          
          <div className="flex items-center gap-3 ml-2 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                {isAdmin ? 'System Administrator' : (employeeData?.name || 'พนักงานทั่วไป')}
              </p>
              {!isAdmin && employeeData?.department && (
                <p className="text-[9px] font-medium text-slate-500">แผนก: {employeeData.department}</p>
              )}
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-200 dark:border-blue-800">
              {isAdmin ? 'ADM' : (user.email?.split('@')[0] || '')}
            </div>
          </div>
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