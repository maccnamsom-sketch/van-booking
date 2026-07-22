'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, onSnapshot, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';

interface UserViewProps {
  db: any;
  user: any;
  theme: any;
  activeMenu: 'home' | 'booking' | 'history' | 'qrcode' | 'admin' | 'shiftRequest';
  setActiveMenu: (menu: any) => void;
  routesList: any[];
  bookingsList: any[];
  announcementsList: any[];
  recentBooking: any;
  setRecentBooking: (booking: any) => void;
  showAlert: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => void;
  supportTicketsList: any[];
  systemConfig?: any;
}

export default function UserView({ 
  db, 
  user, 
  theme, 
  activeMenu, 
  setActiveMenu, 
  routesList, 
  bookingsList, 
  announcementsList, 
  recentBooking, 
  setRecentBooking, 
  showAlert, 
  supportTicketsList,
  systemConfig
}: UserViewProps) {

  // ⏰ Real-time Clock State
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketFirstMessage, setTicketFirstMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [historyFilterRoute, setHistoryFilterRoute] = useState('');
  
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedSummaryDate, setSelectedSummaryDate] = useState(getTodayDateString());
  const [activeChatTicketId, setActiveChatTicketId] = useState<string | null>(null);
  const [activeTicketData, setActiveTicketData] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');

  const [shiftReqDate, setShiftReqDate] = useState(getTodayDateString());
  const [shiftReqOriginal, setShiftReqOriginal] = useState('กะ Shift (06:00 - 18:30 น.)');
  const [shiftReqNewTime, setShiftReqNewTime] = useState('17:00');
  const [shiftReqReason, setShiftReqReason] = useState('');
  const [isSubmittingShiftReq, setIsSubmittingShiftReq] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [shiftRequestsList, setShiftRequestsList] = useState<any[]>([]);

  // State สำหรับดึง Config แบบ Realtime
  const [liveConfig, setLiveConfig] = useState<any>(systemConfig);

  // 🔴 ดึงค่า Config แบบ Realtime จากทั้ง system_settings และ system_config
  useEffect(() => {
    if (!db) return;

    const unsubAdminControl = onSnapshot(doc(db, 'system_settings', 'booking_control'), (docSnap) => {
      if (docSnap.exists()) {
        setLiveConfig((prev: any) => ({ ...prev, ...docSnap.data() }));
      }
    }, () => {});

    const unsubConfigStatus = onSnapshot(doc(db, 'system_config', 'booking_status'), (docSnap) => {
      if (docSnap.exists()) {
        setLiveConfig((prev: any) => ({ ...prev, ...docSnap.data() }));
      }
    }, () => {});

    return () => {
      unsubAdminControl();
      unsubConfigStatus();
    };
  }, [db]);

  // State ข้อมูลผู้ใช้
  const [employeeName, setEmployeeName] = useState(user?.displayName || user?.name || '');
  const [employeePhone, setEmployeePhone] = useState(user?.phoneNumber || user?.phone || '');

  // ฟังก์ชันเช็กสถานะการเปิด-ปิดระบบ
  const checkIsBookingOpen = () => {
    const config = liveConfig || systemConfig || {};
    
    const rawMode = (config.mode || config.status || config.systemStatus || 'AUTO').toString().toUpperCase();

    if (rawMode === 'FORCE_CLOSE' || rawMode === 'CLOSED' || rawMode === 'CLOSE') {
      return false; 
    }

    if (rawMode === 'FORCE_OPEN' || rawMode === 'OPENED' || rawMode === 'OPEN') {
      return true; 
    }

    const now = currentTime || new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const openTimeStr = config.autoOpenTime || config.openTime || '08:00';
    const closeTimeStr = config.autoCloseTime || config.closeTime || '16:00';

    const [openH, openM] = openTimeStr.split(':').map(Number);
    const [closeH, closeM] = closeTimeStr.split(':').map(Number);

    const openMinutes = (openH || 8) * 60 + (openM || 0);
    const closeMinutes = (closeH || 16) * 60 + (closeM || 0);

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const isSystemOpen = checkIsBookingOpen();
  const closeReasonMessage = liveConfig?.closeReason || 'ระบบปิดรับการจองชั่วคราวโดยผู้ดูแลระบบ';

  useEffect(() => {
    if (user) {
      if (!employeeName && (user.displayName || user.name)) {
        setEmployeeName(user.displayName || user.name);
      }
      if (!employeePhone && (user.phoneNumber || user.phone)) {
        setEmployeePhone(user.phoneNumber || user.phone);
      }
    }
    const myLastBooking = bookingsList.find(b => b.employeeEmail === (user?.email || 'employee@company.com'));
    if (myLastBooking) {
      if (!employeeName && myLastBooking.employeeName) setEmployeeName(myLastBooking.employeeName);
      if (!employeePhone && myLastBooking.employeePhone) setEmployeePhone(myLastBooking.employeePhone);
    }
  }, [user, bookingsList]);

  const myTickets = supportTicketsList.filter(t => t.employeeEmail === (user?.email || 'employee@company.com'));
  const myBookings = bookingsList.filter(b => b.employeeEmail === (user?.email || 'employee@company.com'));
  const myShiftRequests = shiftRequestsList.filter(sr => sr.employeeEmail === (user?.email || 'employee@company.com'));

  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(collection(db, 'shiftRequests'), (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setShiftRequestsList(list);
    });
    return () => unsubscribe();
  }, [db]);

  const handleSelectBookingForShiftReq = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bookingId = e.target.value;
    setSelectedBookingId(bookingId);

    if (!bookingId) return;
    const found = myBookings.find((b: any) => b.id === bookingId);
    if (found) {
      if (found.travelDate) setShiftReqDate(found.travelDate);
      if (found.shiftType && found.shiftTimeSlot) {
        setShiftReqOriginal(`กะ ${found.shiftType} (${found.shiftTimeSlot} น.)`);
      } else if (found.shiftType) {
        setShiftReqOriginal(`กะ ${found.shiftType}`);
      }
    }
  };

  useEffect(() => {
    if (!activeChatTicketId || !db) {
      setActiveTicketData(null);
      return;
    }
    
    const unsubscribe = onSnapshot(doc(db, 'support_tickets', activeChatTicketId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveTicketData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => unsubscribe();
  }, [activeChatTicketId, db]);

  const [shiftType, setShiftType] = useState<'Day' | 'Shift'>('Day');
  const [shiftTimeSlot, setShiftTimeSlot] = useState<string>('08:00 - 17:00');
  const [tripType, setTripType] = useState<'roundTrip' | 'inboundOnly' | 'outboundOnly'>('roundTrip');

  const filteredRoutesList = routesList.filter(r => {
    if (!r.shiftType || r.shiftType === 'All' || r.shiftType === ' ทุกกะ') return true;
    return r.shiftType === shiftType;
  });

  const [selectedRouteId, setSelectedRouteId] = useState(filteredRoutesList[0]?.id || routesList[0]?.id || '');
  const [selectedRouteName, setSelectedRouteName] = useState(filteredRoutesList[0]?.name || routesList[0]?.name || '');
  const [, setSelectedRouteMaxSeats] = useState(filteredRoutesList[0]?.totalSeats || routesList[0]?.totalSeats || 14);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [travelDate, setTravelDate] = useState('');

  useEffect(() => {
    if (filteredRoutesList.length > 0 && !filteredRoutesList.some(r => r.id === selectedRouteId)) {
      setSelectedRouteId(filteredRoutesList[0].id);
      setSelectedRouteName(filteredRoutesList[0].name);
      setSelectedRouteMaxSeats(filteredRoutesList[0].totalSeats || 14);
      setSelectedStationIndex(0);
    }
  }, [shiftType, routesList]);

  const todayStr = getTodayDateString();
  const summaryBookings = bookingsList.filter(b => b.travelDate === selectedSummaryDate);

  const filteredHistory = myBookings.filter((b: any) => {
    const matchDate = historyFilterDate ? b.travelDate === historyFilterDate : true;
    const matchRoute = historyFilterRoute ? b.route === historyFilterRoute : true;
    return matchDate && matchRoute;
  });

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const yyyy = parseInt(parts[0], 10) + 543;
    const mm = parts[1];
    const dd = parts[2];
    return `${dd}/${mm}/${yyyy}`;
  };

  const getRouteStations = (route: any) => {
    if (!route) return [];
    const rawStops = route.stops || route.stations || [];
    return rawStops.map((st: any, index: number) => ({
      index: index + 1,
      name: st.stationName || st.station || st.name || 'ไม่ระบุชื่อสถานี',
      time: st.arrivalTime || st.time || '00:00'
    }));
  };

  const checkCutoffTimeAndAdjustDate = (inputDate: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const cutoffTimeInMinutes = 15 * 60;

    if (inputDate === getTodayDateString() && currentTimeInMinutes >= cutoffTimeInMinutes) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      return { adjustedDate: `${yyyy}-${mm}-${dd}`, isAdjusted: true };
    }
    return { adjustedDate: inputDate, isAdjusted: false };
  };

  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketFirstMessage) {
      showAlert('warning', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'ต้องระบุเรื่องและรายละเอียดเริ่มต้น');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const docRef = await addDoc(collection(db, 'support_tickets'), {
        employeeEmail: user?.email || 'employee@company.com',
        subject: ticketSubject,
        status: 'Pending',
        timestamp: new Date().toISOString(),
        messages: [{ sender: 'user', text: ticketFirstMessage, timestamp: new Date().toISOString() }]
      });

      showAlert('success', 'เปิดฟอร์มแจ้งเรื่องเรียบร้อย', 'คุณสามารถแตะเพื่อคุยรายละเอียดเพิ่มเติมได้ทันที');
      setTicketSubject('');
      setTicketFirstMessage('');
      setActiveChatTicketId(docRef.id);
    } catch {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถสร้างรายการแจ้งปัญหาได้');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeChatTicketId) return;

    try {
      const ticketRef = doc(db, 'support_tickets', activeChatTicketId);
      await updateDoc(ticketRef, {
        messages: arrayUnion({
          sender: 'user',
          text: replyMessage,
          timestamp: new Date().toISOString()
        }),
        status: 'Pending'
      });
      setReplyMessage('');
    } catch {
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถส่งข้อความได้');
    }
  };

  const handleSubmitShiftRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftReqDate || !shiftReqNewTime || !shiftReqReason) {
      showAlert('warning', 'กรอกข้อมูลไม่ครบถ้วน', 'กรุณาระบุวันที่ เวลาที่ต้องการออก และเหตุผลความจำเป็น');
      return;
    }

    setIsSubmittingShiftReq(true);
    try {
      await addDoc(collection(db, 'shiftRequests'), {
        employeeEmail: user?.email || 'employee@company.com',
        employeeName: employeeName || user?.email || 'พนักงาน',
        requestDate: shiftReqDate,
        originalShift: shiftReqOriginal,
        requestedTime: shiftReqNewTime,
        reason: shiftReqReason,
        status: 'Pending',
        timestamp: new Date().toISOString()
      });

      showAlert('success', 'ส่งคำขอสำเร็จ', 'ระบบได้ส่งคำขอเปลี่ยนกะ/ออกก่อนเวลาให้แอดมินพิจารณาแล้ว');
      setShiftReqReason('');
      setSelectedBookingId('');
    } catch {
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถส่งคำขอเปลี่ยนกะได้');
    } finally {
      setIsSubmittingShiftReq(false);
    }
  };

  const activeStations = getRouteStations(filteredRoutesList.find(r => r.id === selectedRouteId) || filteredRoutesList[0] || routesList[0]);

  return (
    <div className="text-sm text-slate-800 dark:text-slate-100">
      
      {/* 🟢 TOP BAR: REALTIME CLOCK & STATUS */}
      <div className="max-w-4xl mx-auto mb-5 px-4 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between gap-3 transition-all">
        
        {/* Live Status Indicator & Clock */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border transition-all ${
            isSystemOpen 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50' 
              : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSystemOpen ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isSystemOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span>{isSystemOpen ? 'เปิดรับจอง' : 'ปิดรับจอง'}</span>
          </div>

          <div className="h-3.5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

          {/* Date & Time display */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {currentTime ? currentTime.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '---'}
            </span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
              {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '00:00:00'}
            </span>
          </div>
        </div>

      </div>

      {/* 1. HOME TAB */}
      {activeMenu === 'home' && (
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* แถบเตือนสถานะเมื่อปิดระบบในหน้าหลัก */}
          {!isSystemOpen && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 flex items-center gap-3 shadow-sm animate-pulse">
              <span className="text-2xl">🔒</span>
              <div>
                <h4 className="font-bold text-sm">ขณะนี้ระบบปิดรับการจองรถตู้ชั่วคราว</h4>
                <p className="text-xs opacity-90">{closeReasonMessage}</p>
              </div>
            </div>
          )}

          <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 md:p-10 rounded-2xl text-white shadow-xl border border-slate-800">
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-white/10 text-slate-200 text-[10px] font-semibold tracking-wider uppercase px-3 py-1 rounded-full backdrop-blur-md border border-white/10">Central Transport Hub</span>
                <button 
                  onClick={() => setShowSummaryModal(true)}
                  className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  ตรวจสอบรายชื่อผู้เดินทางประจำวัน ({bookingsList.filter(b => b.travelDate === todayStr).length})
                </button>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</h2>
              <p className="text-xs text-slate-300 font-normal leading-relaxed">ระบบสารสนเทศสำหรับการตรวจสอบข้อมูลเดินรถ ตารางเวลาสถานีรับส่ง และลงทะเบียนเพื่อสำรองที่นั่งพนักงานส่วนกลางขององค์กร (ตัดรอบจองเวลา 15.00 น.)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประกาศสำคัญจากฝ่ายธุรการ</h3>
            </div>
            {announcementsList.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {announcementsList.map(a => (
                  <div key={a.id} className="p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-xs border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</h4>
                      <span className="text-[11px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700">
                        {new Date(a.timestamp).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                    {a.desc && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{a.desc}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-xl text-slate-400 dark:text-slate-500 dark:border-slate-800 text-xs">ไม่มีประกาศใหม่ในขณะนี้</div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">กล่องข้อความช่วยเหลือของฉัน</h3>
              <span className="text-[11px] text-slate-400">ทั้งหมด {myTickets.length} รายการ</span>
            </div>

            {myTickets.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {myTickets.map(tItem => {
                  const lastMsg = tItem.messages?.[tItem.messages.length - 1];
                  const isAdminReply = lastMsg?.sender === 'admin';
                  const isResolved = tItem.status === 'Resolved';

                  return (
                    <div 
                      key={tItem.id} 
                      className={`p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isAdminReply && !isResolved ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                      <div 
                        onClick={() => setActiveChatTicketId(tItem.id)}
                        className="space-y-1 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">หัวข้อเรื่อง: {tItem.subject}</span>
                          {isAdminReply && !isResolved && (
                            <span className="bg-blue-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                              แอดมินตอบกลับแล้ว
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-md">
                          {lastMsg ? `${lastMsg.sender === 'admin' ? 'Admin: ' : 'คุณ: '}${lastMsg.text}` : 'ไม่มีข้อความ'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isResolved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900'}`}>
                          {isResolved ? 'แก้ไขเรียบร้อย' : 'กำลังตรวจสอบ'}
                        </span>
                        
                        <button 
                          onClick={() => setActiveChatTicketId(tItem.id)}
                          className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          เปิดแชท
                        </button>

                        {isResolved && (
                          <button
                            onClick={async () => {
                              showAlert(
                                'warning',
                                'ยืนยันการลบ',
                                'คุณแน่ใจหรือไม่ว่าต้องการลบเคสนี้?',
                                async () => {
                                  try {
                                    await deleteDoc(doc(db, 'support_tickets', tItem.id));
                                    showAlert('success', 'ลบสำเร็จ', 'ลบเคสเรียบร้อยแล้ว');
                                  } catch {
                                    showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถลบเคสได้');
                                  }
                                },
                                true
                              );
                            }}
                            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed rounded-xl text-slate-400 dark:border-slate-800 text-xs">
                ยังไม่มีประวัติการแจ้งเรื่องหรือติดต่อแอดมิน
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ติดต่อ / แจ้งปัญหาถึงแอดมิน</h3>
            </div>
            <form onSubmit={handleSendTicket} className="p-6 rounded-xl border bg-white dark:bg-slate-900 shadow-xs border-slate-200 dark:border-slate-800 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">พบปัญหาการใช้งาน แจ้งยกเลิกรอบรถ หรือติดต่อเจ้าหน้าที่ กรุณากรอกหัวข้อเพื่อเปิดเคสและเริ่มสนทนา</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">หัวข้อเรื่อง</label>
                  <input 
                    type="text" 
                    placeholder="เช่น ลืมของบนรถสาย 1" 
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">รายละเอียด</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="อธิบายรายละเอียดปัญหาของคุณ..." 
                      value={ticketFirstMessage}
                      onChange={(e) => setTicketFirstMessage(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button 
                      type="submit" 
                      disabled={isSubmittingTicket}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingTicket ? 'กำลังเปิด...' : 'เริ่มแชท'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. BOOKING TAB */}
      {activeMenu === 'booking' && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-800 dark:text-white">
          <div className="bg-slate-950 text-white p-5 text-center border-b border-slate-800">
            <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Seat Reservation</span>
            <h3 className="text-sm font-bold tracking-wide mt-0.5">ระบบสำรองสิทธิ์เดินทาง</h3>
            <p className="text-[10px] text-amber-400/90 mt-1">ตัดรอบจองเวลา 15:00 น. ของทุกวัน</p>

            <div className="flex justify-center items-center gap-3 mt-3 text-[11px] font-bold">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 1 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>1</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 2 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>2</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 3 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>3</span>
            </div>
          </div>

          {!isSystemOpen ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
                🔒
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">ขณะนี้ระบบปิดรับการจองรถตู้ชั่วคราว</h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900 leading-relaxed">
                  {closeReasonMessage}
                </p>
                <p className="text-[11px] text-slate-400">
                  หากมีเหตุจำเป็นฉุกเฉิน กรุณาติดต่อแอดมินผ่านเมนูกล่องข้อความช่วยเหลือ
                </p>
              </div>
              <button 
                onClick={() => setActiveMenu('home')}
                className="mt-2 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white text-xs font-medium px-6 py-2.5 rounded-xl cursor-pointer transition-all"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {bookingStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">1.1 เลือกกะและช่วงเวลาทำงาน</label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setShiftType('Day');
                          setShiftTimeSlot('08:00 - 17:00');
                        }}
                        className={`p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${shiftType === 'Day' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        กะ Day
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setShiftType('Shift');
                          setShiftTimeSlot('06:00 - 18:30');
                        }}
                        className={`p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${shiftType === 'Shift' ? 'bg-purple-600 border-purple-600 text-white shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        กะ Shift
                      </button>
                    </div>

                    {shiftType === 'Day' ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">กะ Day:</p>
                        <div className="text-xs font-semibold bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                          เข้างาน 08:00 น. / เลิกงาน 17:00 น.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-slate-500">เลือกช่วงเวลากะ Shift:</p>
                        <div className="grid grid-cols-1 gap-2">
                          <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs font-medium ${shiftTimeSlot === '06:00 - 18:30' ? 'border-purple-600 bg-purple-50/20 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-800'}`}>
                            <input 
                              type="radio" 
                              name="shiftSlot" 
                              checked={shiftTimeSlot === '06:00 - 18:30'} 
                              onChange={() => setShiftTimeSlot('06:00 - 18:30')} 
                            />
                            06:00 - 18:30
                          </label>
                          <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs font-medium ${shiftTimeSlot === '18:00 - 06:30' ? 'border-purple-600 bg-purple-50/20 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-800'}`}>
                            <input 
                              type="radio" 
                              name="shiftSlot" 
                              checked={shiftTimeSlot === '18:00 - 06:30'} 
                              onChange={() => setShiftTimeSlot('18:00 - 06:30')} 
                            />
                            18:00 - 06:30
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">1.2 เลือกสายรถตู้สวัสดิการ</label>
                      <span className="text-[10px] text-slate-400">{filteredRoutesList.length} รายการ</span>
                    </div>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {filteredRoutesList.length > 0 ? (
                        filteredRoutesList.map(r => (
                          <div 
                            key={r.id} 
                            onClick={() => { 
                              setSelectedRouteId(r.id); 
                              setSelectedRouteName(r.name); 
                              setSelectedRouteMaxSeats(r.totalSeats || 14); 
                              setSelectedStationIndex(0);
                            }} 
                            className={`p-3.5 border rounded-xl cursor-pointer transition-all ${selectedRouteId === r.id ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/30 ring-1 ring-blue-600' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-slate-900 dark:text-white text-xs">{r.name}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {r.shiftType || 'ทุกกะ'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">ทะเบียน: {r.plate || r.vanPlate} | คนขับ: {r.driver || r.driverName}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                          ไม่พบสายรถตู้สำหรับกะเวลานี้
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">1.3 เลือกประเภทการเดินทาง</label>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <label className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all backdrop-blur-md ${
                        tripType === 'roundTrip' 
                          ? 'bg-blue-600/90 hover:bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white/60 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}>
                        <input 
                          type="radio" 
                          name="tripType" 
                          checked={tripType === 'roundTrip'} 
                          onChange={() => setTripType('roundTrip')} 
                          className="accent-blue-600 dark:accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>ไป-กลับ (ทั้งขามาและขากลับ)</span>
                      </label>

                      <label className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all backdrop-blur-md ${
                        tripType === 'inboundOnly' 
                          ? 'bg-blue-600/90 hover:bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white/60 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}>
                        <input 
                          type="radio" 
                          name="tripType" 
                          checked={tripType === 'inboundOnly'} 
                          onChange={() => setTripType('inboundOnly')} 
                          className="accent-blue-600 dark:accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>เฉพาะขามา (ขาไปอย่างเดียว)</span>
                      </label>

                      <label className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all backdrop-blur-md ${
                        tripType === 'outboundOnly' 
                          ? 'bg-blue-600/90 hover:bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white/60 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}>
                        <input 
                          type="radio" 
                          name="tripType" 
                          checked={tripType === 'outboundOnly'} 
                          onChange={() => setTripType('outboundOnly')} 
                          className="accent-blue-600 dark:accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>เฉพาะขากลับอย่างเดียว</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    disabled={!isSystemOpen}
                    onClick={() => {
                      if (!checkIsBookingOpen()) {
                        showAlert('error', 'ระบบปิด', closeReasonMessage);
                        return;
                      }
                      if (filteredRoutesList.length === 0) {
                        showAlert('warning', 'คำเตือน', 'กรุณาเลือกกะเวลาที่มีสายรถเปิดให้บริการ');
                        return;
                      }
                      setBookingStep(2);
                    }} 
                    className="w-full bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl text-center mt-2 cursor-pointer text-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ขั้นตอนถัดไป (กรอกข้อมูลส่วนตัว & จุดขึ้นรถ) →
                  </button>
                </div>
              )}

              {bookingStep === 2 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">ข้อมูลติดต่อสำหรับคนขับ</span>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">ชื่อ - นามสกุล พนักงาน</label>
                      <input 
                        type="text" 
                        placeholder="ชื่อ - นามสกุล" 
                        value={employeeName} 
                        onChange={(e) => setEmployeeName(e.target.value)} 
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">เบอร์โทรศัพท์</label>
                      <input 
                        type="tel" 
                        placeholder="เช่น 0812345678" 
                        value={employeePhone} 
                        onChange={(e) => setEmployeePhone(e.target.value)} 
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">สถานีจุดจอดรับและตารางเวลา</label>
                    <select 
                      value={selectedStationIndex} 
                      onChange={(e) => setSelectedStationIndex(Number(e.target.value))} 
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
                    >
                      {activeStations.map((st: any, i: number) => (
                        <option key={i} value={i} className="dark:bg-slate-950">
                          จุดที่ #{st.index}: {st.name} ({st.time})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">ระบุวันที่ต้องการจอง (เลือกได้หลายวัน)</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        id="multiDateInput"
                        min={getTodayDateString()}
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 text-xs cursor-pointer" 
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById('multiDateInput') as HTMLInputElement;
                          if (inputEl && inputEl.value) {
                            const val = inputEl.value;
                            const currentList = travelDate ? travelDate.split(',').map((d: string) => d.trim()).filter(Boolean) : [];
                            if (!currentList.includes(val)) {
                              currentList.push(val);
                              currentList.sort();
                              setTravelDate(currentList.join(','));
                            }
                            inputEl.value = '';
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-all"
                      >
                        เพิ่มวัน
                      </button>
                    </div>
                  </div>

                  {travelDate && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-500 block">วันที่เลือกไว้แล้ว:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {travelDate.split(',').map((d: string, idx: number) => (
                          <span key={idx} className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                            {formatThaiDate(d.trim())}
                            <button 
                              type="button"
                              onClick={() => {
                                const list = travelDate.split(',').map((item: string) => item.trim()).filter((item: string) => item !== d.trim());
                                setTravelDate(list.join(','));
                              }}
                              className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setBookingStep(1)} 
                      className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                    >
                      ย้อนกลับ
                    </button>
                    <button 
                      onClick={() => {
                        if (!employeeName.trim() || !employeePhone.trim()) {
                          showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อและเบอร์โทรศัพท์พนักงาน');
                          return;
                        }
                        if (!travelDate) {
                          showAlert('warning', 'ยังไม่ได้เลือกวัน', 'กรุณาเลือกวันที่ต้องการเดินทางอย่างน้อย 1 วัน');
                          return;
                        }
                        setBookingStep(3);
                      }} 
                      className="w-2/3 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-xs cursor-pointer transition-all shadow-sm"
                    >
                      ตรวจสอบข้อมูล →
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <span className="block font-bold uppercase text-slate-500 tracking-wider mb-2">สรุปข้อมูลการสำรองที่นั่ง</span>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <p><strong>กะทำงาน:</strong> {shiftType === 'Day' ? 'กะ Day' : 'กะ Shift'} ({shiftTimeSlot})</p>
                      <p><strong>ประเภทการเดินทาง:</strong> {tripType === 'roundTrip' ? 'ไป-กลับ' : tripType === 'inboundOnly' ? 'เฉพาะขามา' : 'เฉพาะขากลับ'}</p>
                      <p><strong>สายรถ:</strong> {selectedRouteName}</p>
                      <p><strong>ชื่อผู้เดินทาง:</strong> {employeeName}</p>
                      <p><strong>เบอร์โทรศัพท์:</strong> {employeePhone}</p>
                      <p><strong>จุดรับ-ส่ง:</strong> จุดที่ #{activeStations[selectedStationIndex]?.index}: {activeStations[selectedStationIndex]?.name} ({activeStations[selectedStationIndex]?.time})</p>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <strong className="block text-slate-700 dark:text-slate-300">วันที่เดินทางที่เลือก:</strong>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {travelDate.split(',').map((d: string, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-center font-mono font-medium text-blue-600 dark:text-blue-400">
                            {formatThaiDate(d.trim())}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setBookingStep(2)} 
                      className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      แก้ไข
                    </button>
                    <button 
                      disabled={isBookingLoading || !isSystemOpen} 
                      onClick={async () => {
                        if (!checkIsBookingOpen()) {
                          showAlert('error', 'ระบบปิด', closeReasonMessage);
                          return;
                        }

                        const currentActiveRoute = filteredRoutesList.find(r => r.id === selectedRouteId) || filteredRoutesList[0] || routesList[0];
                        if (!currentActiveRoute || !travelDate || !employeeName || !employeePhone) {
                          showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
                          return;
                        }

                        const datesArray = travelDate.split(',').map((d: string) => d.trim()).filter(Boolean);
                        const stationsList = getRouteStations(currentActiveRoute);
                        const targetStation = stationsList[selectedStationIndex];
                        const currentEmployeeEmail = user?.email || 'employee@company.com';

                        setIsBookingLoading(true);
                        try {
                          let lastDocRef: any = null;
                          for (const d of datesArray) {
                            const { adjustedDate } = checkCutoffTimeAndAdjustDate(d);
                            const bookingData = {
                              employeeEmail: currentEmployeeEmail, 
                              employeeName, 
                              employeePhone,
                              route: selectedRouteName, 
                              pickupLocation: `จุดที่ ${targetStation?.index || 1}: ${targetStation?.name || 'ไม่ระบุ'}`, 
                              time: targetStation?.time || 'ไม่ระบุ',
                              driverName: currentActiveRoute.driver || currentActiveRoute.driverName || 'ไม่ระบุ', 
                              vanPlate: currentActiveRoute.plate || currentActiveRoute.vanPlate || 'ไม่ระบุ',
                              travelDate: adjustedDate, 
                              shiftType,
                              shiftTimeSlot,
                              tripType,
                              seatsCount: 1, 
                              status: 'Confirmed', 
                              timestamp: new Date().toISOString()
                            };
                            lastDocRef = await addDoc(collection(db, 'van_bookings'), bookingData);
                          }

                          if (lastDocRef) {
                            setRecentBooking({ 
                              id: lastDocRef.id, 
                              employeeEmail: currentEmployeeEmail, 
                              employeeName, 
                              employeePhone, 
                              route: selectedRouteName, 
                              travelDate, 
                              shiftType, 
                              shiftTimeSlot, 
                              tripType,
                              vanPlate: currentActiveRoute.plate || currentActiveRoute.vanPlate || 'ไม่ระบุ' 
                            });
                          }

                          showAlert(
                            'success', 
                            'จองรถสำเร็จ', 
                            'ระบบบันทึกรายการจองของคุณเรียบร้อยแล้ว', 
                            () => {
                              setActiveMenu('history');
                              setBookingStep(1);
                            }
                          );
                        } catch {
                          showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรายการจองได้');
                        } finally { 
                          setIsBookingLoading(false); 
                        }
                      }} 
                      className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                      {isBookingLoading ? 'กำลังบันทึก...' : 'ยืนยันสำรองสิทธิ์'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. SHIFT REQUEST TAB */}
      {activeMenu === 'shiftRequest' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">แจ้งขอเปลี่ยนกะ / ออกก่อนเวลา (Ad-hoc Request)</h3>
            <p className="text-xs text-slate-400 mt-0.5">ใช้สำหรับกรณีมีเหตุจำเป็นต้องออกก่อนเวลากะปกติที่ระบบตั้งไว้ เพื่อให้แอดมินอนุมัติและปรับบันทึกเวลา</p>
          </div>

          <form onSubmit={handleSubmitShiftRequest} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">เลือกจากประวัติการจองของคุณ (ถ้ามี)</label>
              <select 
                value={selectedBookingId}
                onChange={handleSelectBookingForShiftReq}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- เลือกรายการจองเดิมเพื่อดึงข้อมูล -- (ไม่บังคับ)</option>
                {myBookings.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    วันที่: {formatThaiDate(b.travelDate)} | สายรถ: {b.route} | กะ: {b.shiftType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">1. เลือกวันที่ต้องการเปลี่ยนเวลา</label>
              <input 
                type="date"
                value={shiftReqDate}
                onChange={(e) => setShiftReqDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">2. กะเวลาปกติในระบบ</label>
              <input 
                type="text"
                value={shiftReqOriginal}
                onChange={(e) => setShiftReqOriginal(e.target.value)}
                placeholder="เช่น กะ Shift (06:00 - 18:30 น.)"
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">3. เวลาที่ขอออกจริง (เช่น ขอออกเร็วขึ้น)</label>
              <input 
                type="text"
                value={shiftReqNewTime}
                onChange={(e) => setShiftReqNewTime(e.target.value)}
                placeholder="เช่น 17:00"
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">4. เหตุผลความจำเป็น</label>
              <textarea 
                rows={3}
                value={shiftReqReason}
                onChange={(e) => setShiftReqReason(e.target.value)}
                placeholder="อธิบายรายละเอียดความจำเป็น..."
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmittingShiftReq}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingShiftReq ? 'กำลังส่งคำขอ...' : 'ส่งคำขอให้แอดมินอนุมัติ'}
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">📋 ประวัติและสถานะคำขอเปลี่ยนกะของคุณ</h3>
            
            <div className="space-y-3">
              {myShiftRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">คุณยังไม่มีประวัติการส่งคำขอเปลี่ยนกะ</p>
              ) : (
                myShiftRequests.map((req) => {
                  const status = req.status || 'Pending';
                  return (
                    <div key={req.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">วันที่: {formatThaiDate(req.requestDate)}</span>
                        
                        <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                          status === 'Approved' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : status === 'Rejected' 
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' 
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                          {status === 'Approved' ? '✅ อนุมัติแล้ว' : status === 'Rejected' ? '❌ ปฏิเสธ' : '⏳ รอดำเนินการ'}
                        </span>
                      </div>

                      <p className="text-slate-500">กะปกติ: {req.originalShift} | เวลาที่ขอออก: <strong className="text-blue-600">{req.requestedTime}</strong></p>
                      <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">เหตุผล: {req.reason}</p>

                      {status === 'Rejected' && req.adminRejectReason && (
                        <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-100 dark:border-red-900">
                          <strong>เหตุผลที่ไม่อนุมัติ:</strong> {req.adminRejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. HISTORY TAB */}
      {activeMenu === 'history' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประวัติการจอง</h3>
            <span className="text-[11px] text-slate-400">ทั้งหมด {myBookings.length} รายการ</span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-500 mb-1">กรองตามวันที่เดินทาง</label>
              <input 
                type="date"
                value={historyFilterDate}
                onChange={(e) => setHistoryFilterDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-500 mb-1">กรองตามสายรถ</label>
              <select
                value={historyFilterRoute}
                onChange={(e) => setHistoryFilterRoute(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">ทุกสายรถ</option>
                {routesList.map((r: any) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((b: any, idx: number) => (
                <div key={idx} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{b.route}</span>
                      <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 px-2 py-0.5 rounded font-medium">กะ: {b.shiftType}</span>
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 px-2 py-0.5 rounded font-medium">
                        {b.tripType === 'inboundOnly' ? 'เฉพาะขามา' : b.tripType === 'outboundOnly' ? 'เฉพาะขากลับ' : 'ไป-กลับ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">จุดขึ้นรถ: {b.pickupLocation} ({b.time}) | ทะเบียน: {b.vanPlate}</p>
                    <p className="text-[11px] text-slate-400 font-mono">วันที่: {formatThaiDate(b.travelDate)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button 
                      onClick={() => {
                        setRecentBooking(b);
                        setActiveMenu('qrcode');
                      }}
                      className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      ดู QR Code
                    </button>
                    <span className="text-[10px] font-medium px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                      ยืนยันแล้ว
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border border-dashed rounded-xl text-slate-400 dark:text-slate-500 dark:border-slate-800 text-xs">
                ไม่พบประวัติการจองตามเงื่อนไขที่เลือก
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. QRCODE TAB */}
      {activeMenu === 'qrcode' && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-in Pass</span>
            <h3 className="font-bold text-sm mt-0.5">คิวอาร์โค้ดสำหรับเช็คอินขึ้นรถ</h3>
          </div>
          {recentBooking ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">แสดงคิวอาร์โค้ดนี้ให้คนขับรถสแกนเมื่อถึงจุดรับ</p>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(recentBooking.id || 'NO_ID')}`} 
                  alt="QR Code" 
                  className="mx-auto rounded-lg"
                />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>ชื่อผู้เดินทาง:</strong> {recentBooking.employeeName}</p>
                <p><strong>สายรถ:</strong> {recentBooking.route}</p>
                <p><strong>กะการทำงาน:</strong> {recentBooking.shiftType} ({recentBooking.shiftTimeSlot})</p>
                <p><strong>ประเภทการเดินทาง:</strong> {recentBooking.tripType === 'inboundOnly' ? 'เฉพาะขามา' : recentBooking.tripType === 'outboundOnly' ? 'เฉพาะขากลับ' : 'ไป-กลับ'}</p>
                <p><strong>วันที่เดินทาง:</strong> {formatThaiDate(recentBooking.travelDate)}</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-slate-400 text-xs">
              ยังไม่มีข้อมูลการจองล่าสุด กรุณาทำรายการจองก่อนครับ
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL รายชื่อผู้เดินทางประจำวัน */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                รายชื่อพนักงานเดินทางวันที่ <span className="text-blue-600 dark:text-blue-400 font-mono">{formatThaiDate(selectedSummaryDate)}</span>
              </h3>
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={selectedSummaryDate}
                  onChange={(e) => setSelectedSummaryDate(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] px-2.5 py-1 rounded-xl font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                />
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {summaryBookings.length === 0 ? (
                <div className="py-12 text-center text-slate-400">ไม่มีพนักงานลงทะเบียนเดินทางสำหรับวันที่ {formatThaiDate(selectedSummaryDate)}</div>
              ) : (
                routesList.map((route: any) => {
                  const routeBookings = summaryBookings.filter((b: any) => b.route === route.name);
                  if (routeBookings.length === 0) return null;
                  return (
                    <div key={route.id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">{route.name}</span>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold">{routeBookings.length} รายการ</span>
                      </div>
                      <div className="space-y-1.5">
                        {routeBookings.map((b: any, bIdx: number) => (
                          <div key={bIdx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px]">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{bIdx + 1}. {b.employeeName || b.employeeEmail}</span>
                              <span className="block text-slate-400">จุดขึ้นรถ: {b.pickupLocation} ({b.time})</span>
                            </div>
                            <span className="font-mono text-slate-600 dark:text-slate-300">{b.employeePhone || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="bg-slate-900 text-white dark:bg-slate-800 px-5 py-2 rounded-xl text-xs font-medium cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal เปิดแชทตอบกลับในฝั่ง User */}
      {activeChatTicketId && activeTicketData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-slate-400 font-mono">ID: {activeTicketData.id}</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">หัวข้อเรื่อง: {activeTicketData.subject}</h3>
              </div>
              <button 
                onClick={() => setActiveChatTicketId(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-72">
              {activeTicketData.messages?.map((msg: any, mIdx: number) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div key={mIdx} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                    <span className="text-[9px] text-slate-400 mb-0.5">{isAdmin ? 'แอดมิน' : 'คุณ'}</span>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${isAdmin ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeTicketData.status !== 'Resolved' ? (
              <form onSubmit={handleSendReply} className="flex gap-2 pt-2">
                <input 
                  type="text"
                  placeholder="พิมพ์ข้อความตอบกลับแอดมิน..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl font-medium cursor-pointer transition-all"
                >
                  ส่ง
                </button>
              </form>
            ) : (
              <div className="text-center py-2 text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                เคสนี้ได้รับการแก้ไขเรียบร้อยแล้ว
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}