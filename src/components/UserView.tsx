'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, onSnapshot, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';

interface UserViewProps {
  db: any;
  user: any;
  theme: any;
  activeMenu: 'home' | 'booking' | 'history' | 'qrcode' | 'manual' | 'admin' | 'shiftRequest' | 'routeMap';
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

const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

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
  const [showManualModal, setShowManualModal] = useState(true);
  
  // 🗺️ State สำหรับเลือกดูสายรถในเมนูแผนที่จำลองเส้นทาง
  const [selectedRouteForMapTab, setSelectedRouteForMapTab] = useState<any>(null);

  useEffect(() => {
    if (routesList.length > 0 && !selectedRouteForMapTab) {
      setSelectedRouteForMapTab(routesList[0]);
    }
  }, [routesList]);
  
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [historyFilterRoute, setHistoryFilterRoute] = useState('');

  const formatDateToYMD = (dObj: Date) => {
    const yyyy = dObj.getFullYear();
    const mm = String(dObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  
  const getTodayDateString = () => {
    return formatDateToYMD(currentTime || new Date());
  };

  const getUpcomingDates = (daysCount = 14) => {
    const list: string[] = [];
    const refNow = currentTime || new Date();
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate() + i);
      list.push(formatDateToYMD(d));
    }
    return list;
  };

  const todayStr = getTodayDateString();
  const upcomingDatesList = getUpcomingDates(14);

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

  const [liveConfig, setLiveConfig] = useState<any>(systemConfig);
  const [employeeData, setEmployeeData] = useState<any>(null);

  // 🔴 ดึงค่า Config แบบ Realtime
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

  // 🟢 ดึงข้อมูลพนักงานจาก Firestore อัตโนมัติ
  useEffect(() => {
    if (!db || !user) return;
    
    const empId = user?.email ? user.email.split('@')[0].toUpperCase() : (user?.uid || '01A01');
    
    const unsubEmp = onSnapshot(doc(db, 'employees', empId), (docSnap) => {
      if (docSnap.exists()) {
        setEmployeeData(docSnap.data());
      } else {
        setEmployeeData(null);
      }
    });

    return () => unsubEmp();
  }, [db, user]);

  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');

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
    if (user && !employeeData?.name) {
      if (!employeeName && (user.displayName || user.name)) {
        setEmployeeName(user.displayName || user.name);
      }
      if (!employeePhone && (user.phoneNumber || user.phone)) {
        setEmployeePhone(user.phoneNumber || user.phone);
      }
    }
  }, [user, employeeData]);

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
  const [tripType] = useState<'roundTrip' | 'inboundOnly' | 'outboundOnly'>('roundTrip');

  const filteredRoutesList = routesList.filter(r => {
    if (!r.shiftType || r.shiftType === 'All' || r.shiftType === ' ทุกกะ') return true;
    if (r.shiftType !== shiftType) return false;
    if (shiftType === 'Shift') {
      if (!r.shiftTimeSlot) return true;
      return r.shiftTimeSlot === shiftTimeSlot;
    }
    return true;
  });

  const [selectedRouteId, setSelectedRouteId] = useState(filteredRoutesList[0]?.id || routesList[0]?.id || '');
  const [selectedRouteName, setSelectedRouteName] = useState(filteredRoutesList[0]?.name || routesList[0]?.name || '');
  const [, setSelectedRouteMaxSeats] = useState(filteredRoutesList[0]?.totalSeats || routesList[0]?.totalSeats || 14);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [travelDate, setTravelDate] = useState('');

  useEffect(() => {
    if (filteredRoutesList.length > 0) {
      if (!filteredRoutesList.some(r => r.id === selectedRouteId)) {
        setSelectedRouteId(filteredRoutesList[0].id);
        setSelectedRouteName(filteredRoutesList[0].name);
        setSelectedRouteMaxSeats(filteredRoutesList[0].totalSeats || 14);
        setSelectedStationIndex(0);
      }
    } else {
      setSelectedRouteId('');
      setSelectedRouteName('');
      setSelectedStationIndex(0);
    }
  }, [shiftType, shiftTimeSlot, routesList]);

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

  const formatShortThaiDateButton = (dateStr: string) => {
    if (!dateStr) return { dayLabel: '', dateLabel: '' };
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    const dObj = new Date(Date.UTC(yyyy || 2026, (mm || 1) - 1, dd || 1));
    const dayLabel = THAI_WEEKDAYS_SHORT[dObj.getUTCDay()] || '';
    const monthLabel = THAI_MONTHS_SHORT[(mm || 1) - 1] || '';
    return {
      dayLabel,
      dateLabel: `${dd} ${monthLabel}`
    };
  };

  const selectedDatesArray = travelDate
    ? travelDate.split(',').map((d: string) => d.trim()).filter(Boolean)
    : [];

  const toggleDateSelection = (dateStr: string) => {
    const exists = selectedDatesArray.includes(dateStr);
    const nextList = exists
      ? selectedDatesArray.filter((item) => item !== dateStr)
      : [...selectedDatesArray, dateStr];
    nextList.sort();
    setTravelDate(nextList.join(','));
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
    const now = currentTime || new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const cutoffTimeInMinutes = 15 * 60;

    if (inputDate === getTodayDateString() && currentTimeInMinutes >= cutoffTimeInMinutes) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { adjustedDate: formatDateToYMD(tomorrow), isAdjusted: true };
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
        employeeName: employeeData?.name || employeeName || 'พนักงาน',
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

  const rawIdFromEmail = user?.email ? user.email.split('@')[0] : '01A01';
  const isUserAdmin = user?.email?.includes('admin') || employeeData?.employeeId?.toUpperCase() === 'ADMIN' || employeeData?.role === 'admin';
  const displayEmployeeCode = isUserAdmin ? 'ADMIN' : (employeeData?.employeeId || rawIdFromEmail).toUpperCase();
  
  const displayEmployeeName = employeeData?.name || (employeeData === null ? 'ไม่พบชื่อในระบบ' : 'กำลังโหลดชื่อ...');
  const displayDepartment = employeeData?.department || (employeeData === null ? '-' : 'กำลังโหลดแผนก...');

  return (
    <div className="min-h-screen bg-[#D8E1F3] dark:bg-[#0B1020] p-3 sm:p-5 text-sm text-slate-800 dark:text-slate-100">
      
      {/* TOP BAR: ข้อมูลสถานะและพนักงาน */}
      <div className="max-w-5xl mx-auto mb-5 px-4 sm:px-5 py-4 bg-[#EDF2FC] dark:bg-[#151E35] border border-white/70 dark:border-slate-700 rounded-3xl shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border ${
              isSystemOpen
                ? 'bg-[#DCE5F7] text-[#202B50] border-white/70 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSystemOpen ? 'bg-[#202B50] dark:bg-sky-400' : 'bg-rose-500'}`} />
              {isSystemOpen ? 'เปิดรับจอง' : 'ปิดรับจอง'}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>📅</span>
              <span>
                {currentTime
                  ? `${THAI_WEEKDAYS_SHORT[currentTime.getDay()]} ${currentTime.getDate()} ${THAI_MONTHS_SHORT[currentTime.getMonth()]} ${currentTime.getFullYear() + 543}`
                  : '---'}
              </span>
              <span className="font-mono font-bold text-[#202B50] dark:text-sky-300 bg-[#DCE5F7] dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '00:00:00'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:border-l sm:border-[#C5D2EC] dark:sm:border-slate-700 sm:pl-4">
            <div className="w-10 h-10 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-lg">
              👤
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{displayEmployeeName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">แผนก: {displayDepartment}</p>
            </div>
            <span className="ml-auto bg-[#DCE5F7] dark:bg-sky-950/50 text-[#202B50] dark:text-sky-300 border border-white/70 dark:border-sky-800 text-xs font-bold px-3 py-1.5 rounded-xl">
              {displayEmployeeCode}
            </span>
          </div>
        </div>
      </div>

      {/* HOME TAB - NAVY & SKY MINIMAL DESIGN */}
      {activeMenu === 'home' && (
        <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">

          {/* Welcome Header */}
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#202B50] via-[#17213F] to-[#0B1020] p-6 sm:p-8 text-white shadow-[8px_8px_24px_rgba(25,38,75,0.18),-8px_-8px_24px_rgba(255,255,255,0.65)]">
            <div className="absolute -right-10 -top-14 w-48 h-48 rounded-full bg-white/10" />
            <div className="absolute right-24 -bottom-20 w-44 h-44 rounded-full bg-white/10" />
            <div className="relative z-10 max-w-xl">
              <span className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-[11px] font-semibold mb-4">
                ✨ CENTRAL TRANSPORT HUB
              </span>
              <p className="text-sky-100 text-sm mb-1">ยินดีต้อนรับ</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {displayEmployeeName}
              </h2>
              <p className="text-sky-50 text-xs sm:text-sm mt-3 leading-relaxed">
                ระบบจองรถตู้พนักงาน บริษัท แอร์โรเฟลกซ์ จำกัด
                <br />
                ตรวจสอบข้อมูลการเดินทางและสำรองที่นั่งได้ที่นี่
              </p>
            </div>
            <div className="relative z-10 mt-5 flex flex-wrap gap-2">
              <span className="bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs">
                🕒 ตัดรอบจอง 15:00 น.
              </span>
              <span className="bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs">
                🚐 ระบบจองรถพนักงาน
              </span>
            </div>
          </section>

          {/* Booking Closed Notice */}
          {!isSystemOpen && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-[#DCE5F7] text-[#202B50] dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center text-xl">🔒</span>
              <div>
                <h4 className="font-bold text-sm text-rose-700 dark:text-rose-300">ขณะนี้ระบบปิดรับการจองรถตู้ชั่วคราว</h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{closeReasonMessage}</p>
              </div>
            </div>
          )}

          {/* Main Actions */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowSummaryModal(true)}
              className="group flex items-center gap-4 p-5 bg-[#EDF2FC] dark:bg-[#151E35] rounded-3xl border border-white/70 dark:border-slate-700 shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)] hover:brightness-102 transition-all text-left cursor-pointer"
            >
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                👥
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">ตรวจรายชื่อผู้เดินทาง</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ตรวจสอบรายชื่อและสายรถของวันนี้</p>
                <span className="inline-flex mt-2 text-xs font-bold text-[#202B50] dark:text-sky-300">
                  {bookingsList.filter(b => b.travelDate === todayStr).length} คนเดินทางวันนี้
                </span>
              </div>
              <span className="text-[#202B50] dark:text-sky-300 text-xl">›</span>
            </button>

            <button
              onClick={() => {
                setBookingStep(1);
                setActiveMenu('booking');
              }}
              className="group flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-[#17213F] to-[#0B1020] text-white shadow-[6px_8px_20px_rgba(17,26,56,0.25)] hover:brightness-110 transition-all text-left cursor-pointer"
            >
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#DCE5F7] text-[#202B50] flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                🚐
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm sm:text-base">จองรถตู้ทันที</h3>
                <p className="text-xs text-sky-100 mt-1">เลือกวัน กะ และสายรถที่ต้องการ</p>
                <span className="inline-flex mt-2 text-xs font-bold text-white">
                  เริ่มจองเลย →
                </span>
              </div>
            </button>
          </section>

          {/* Quick Menu */}
          <section className="bg-[#EDF2FC] dark:bg-[#151E35] rounded-3xl border border-white/70 dark:border-slate-700 p-5 sm:p-6 shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">เมนูใช้งานด่วน</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">เลือกบริการที่ต้องการใช้งาน</p>
              </div>
              <span className="w-10 h-10 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-xl">💠</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: '🚐', title: 'ลงทะเบียนจองรถตู้', desc: 'สำรองที่นั่งเดินทาง', action: () => { setBookingStep(1); setActiveMenu('booking'); } },
                { icon: '📋', title: 'ประวัติการเดินทาง', desc: 'ตรวจสอบรายการจอง', action: () => setActiveMenu('history') },
                { icon: '🕒', title: 'ขอเปลี่ยนกะ / ออกก่อน', desc: 'ส่งคำขอถึงผู้ดูแลระบบ', action: () => setActiveMenu('shiftRequest') },
                { icon: '🗺️', title: 'แผนที่เส้นทาง', desc: 'ตรวจสอบสายรถและจุดจอด', action: () => setActiveMenu('routeMap') },
                { icon: '📖', title: 'คู่มือการใช้งาน', desc: 'อ่านวิธีใช้งานระบบ', action: () => setActiveMenu('manual') },
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={item.action}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/80 dark:bg-slate-950/80 border border-white/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 transition-all text-left cursor-pointer"
                >
                  <span className="w-11 h-11 shrink-0 rounded-xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-xl">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800 dark:text-white">{item.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</span>
                  </span>
                  <span className="text-[#202B50] dark:text-sky-300">›</span>
                </button>
              ))}
            </div>
          </section>

          {/* Announcements */}
          <section className="bg-[#EDF2FC] dark:bg-[#151E35] rounded-3xl border border-white/70 dark:border-slate-700 p-5 sm:p-6 shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-xl">📢</div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">ประกาศจากฝ่ายธุรการ</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ข่าวสารและข้อมูลสำคัญ</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#202B50] dark:text-sky-300 bg-[#DCE5F7] dark:bg-sky-950 px-3 py-1.5 rounded-full">
                {announcementsList.length} รายการ
              </span>
            </div>

            {announcementsList.length > 0 ? (
              <div className="space-y-3">
                {announcementsList.map((a: any) => {
                  const parsedDate = a?.timestamp ? new Date(a.timestamp) : new Date();
                  const safeDateObj = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
                  return (
                    <article key={a.id} className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-white/85 dark:bg-slate-950/85 border border-white/80 dark:border-slate-800">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#202B50] dark:bg-sky-400" />
                      <div className="pl-2">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white">{a.title}</h4>
                          <span className="text-[11px] font-semibold text-[#202B50] dark:text-sky-300 bg-[#DCE5F7] dark:bg-sky-950 px-2.5 py-1 rounded-full shrink-0">
                            📅 {formatThaiDate(formatDateToYMD(safeDateObj))}
                          </span>
                        </div>
                        {a.desc && (
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line mt-2">{a.desc}</p>
                        )}
                        <p className="text-[10px] text-[#202B50]/75 dark:text-sky-400 mt-3">ประกาศจากฝ่ายธุรการ</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center rounded-2xl border border-dashed border-[#B7C7E6] dark:border-slate-700 bg-white/60 dark:bg-slate-950/60">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-2xl">📨</div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ยังไม่มีประกาศใหม่</p>
                <p className="text-xs text-slate-400 mt-1">หากมีข่าวสารจะแสดงที่นี่</p>
              </div>
            )}
          </section>

          {/* Support Tickets */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">กล่องข้อความช่วยเหลือของฉัน</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ติดตามการติดต่อกับแอดมิน</p>
              </div>
              <span className="text-xs font-bold text-[#202B50] dark:text-sky-300 bg-[#DCE5F7] dark:bg-sky-950 px-3 py-1.5 rounded-full">
                {myTickets.length} รายการ
              </span>
            </div>

            {myTickets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myTickets.map(tItem => {
                  const lastMsg = tItem.messages?.[tItem.messages.length - 1];
                  const isAdminReply = lastMsg?.sender === 'admin';
                  const isResolved = tItem.status === 'Resolved';

                  return (
                    <div key={tItem.id} className={`p-4 bg-[#EDF2FC] dark:bg-[#151E35] rounded-2xl border shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)] ${isAdminReply && !isResolved ? 'border-[#202B50]' : 'border-white/70 dark:border-slate-700'}`}>
                      <div onClick={() => setActiveChatTicketId(tItem.id)} className="cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{tItem.subject}</h4>
                          {isAdminReply && !isResolved && <span className="text-[10px] bg-[#202B50] text-white px-2 py-1 rounded-full shrink-0">มีข้อความใหม่</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {lastMsg ? `${lastMsg.sender === 'admin' ? 'Admin: ' : 'คุณ: '}${lastMsg.text}` : 'ไม่มีข้อความ'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#C5D2EC] dark:border-slate-800">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full ${isResolved ? 'bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                          {isResolved ? 'แก้ไขเรียบร้อย' : 'กำลังตรวจสอบ'}
                        </span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setActiveChatTicketId(tItem.id)} className="text-xs font-bold text-[#202B50] dark:text-sky-300 hover:underline cursor-pointer">เปิดแชท</button>
                          {isResolved && (
                            <button
                              onClick={() => {
                                showAlert('warning', 'ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบเคสนี้?', async () => {
                                  try {
                                    await deleteDoc(doc(db, 'support_tickets', tItem.id));
                                    showAlert('success', 'ลบสำเร็จ', 'ลบเคสเรียบร้อยแล้ว');
                                  } catch {
                                    showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถลบเคสได้');
                                  }
                                }, true);
                              }}
                              className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg cursor-pointer"
                            >
                              ลบ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl border border-dashed border-[#B7C7E6] dark:border-slate-700 bg-[#EDF2FC]/80 dark:bg-[#151E35]/80 text-xs text-slate-500">
                ยังไม่มีประวัติการแจ้งเรื่องหรือติดต่อแอดมิน
              </div>
            )}
          </section>

          {/* Contact Admin */}
          <section className="bg-[#EDF2FC] dark:bg-[#151E35] rounded-3xl border border-white/70 dark:border-slate-700 p-5 sm:p-6 shadow-[7px_7px_18px_rgba(65,82,125,0.12),-7px_-7px_18px_rgba(255,255,255,0.75)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#DCE5F7] text-[#202B50] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-xl">💬</div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">ติดต่อ / แจ้งปัญหาถึงแอดมิน</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">เราพร้อมช่วยเหลือการใช้งานของคุณ</p>
              </div>
            </div>

            <form onSubmit={handleSendTicket} className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                พบปัญหาการใช้งาน แจ้งยกเลิกรอบรถ หรือต้องการติดต่อเจ้าหน้าที่ สามารถกรอกข้อมูลด้านล่างได้เลย
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">หัวข้อเรื่อง</label>
                <input
                  type="text"
                  placeholder="เช่น ลืมของบนรถสาย 1"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full border border-white/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950 p-3 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#202B50]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">รายละเอียด</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="อธิบายรายละเอียดปัญหาของคุณ..."
                    value={ticketFirstMessage}
                    onChange={(e) => setTicketFirstMessage(e.target.value)}
                    className="flex-1 min-w-0 border border-white/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950 p-3 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#202B50]/20"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingTicket}
                    className="bg-[#202B50] text-white hover:brightness-110 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingTicket ? 'กำลังเปิด...' : 'เริ่มแชท →'}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <div className="text-center py-3 text-[11px] text-slate-500 dark:text-slate-400">
            AEROFLEX CO., LTD. · Employee Transport System
          </div>
        </div>
      )}

      {/* 🗺️ ROUTE MAP SIMULATION TAB */}
      {activeMenu === 'routeMap' && (
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">🗺️ แผนที่และระบบจำลองเส้นทางรถสวัสดิการ</h3>
              <p className="text-xs text-slate-400 mt-0.5">เลือกสายรถด้านล่างเพื่อตรวจสอบรายละเอียดเส้นทาง จุดจอดรับ-ส่ง และเวลาเดินรถ</p>
            </div>
            <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              ทั้งหมด {routesList.length} สายรถ
            </span>
          </div>

          {routesList.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-2xl text-slate-400 text-xs bg-white dark:bg-slate-900">
              ยังไม่มีข้อมูลสายรถในระบบ
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-1 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">เลือกสายรถที่ต้องการตรวจสอบ</p>
                {routesList.map((r: any) => {
                  const isSelected = selectedRouteForMapTab?.id === r.id;
                  return (
                    <div 
                      key={r.id}
                      onClick={() => setSelectedRouteForMapTab(r)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left space-y-1.5 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20' 
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-xs">{r.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                          {r.shiftType || 'ทุกกะ'}{r.shiftType === 'Shift' && r.shiftTimeSlot ? ` (${r.shiftTimeSlot})` : ''}
                        </span>
                      </div>
                      <p className={`text-[11px] ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        🚐 ทะเบียน: {r.plate || r.vanPlate || '-'}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
                {selectedRouteForMapTab ? (
                  <>
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">
                          เส้นทางเดินรถ: {selectedRouteForMapTab.name}
                        </h4>
                        <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full text-xs font-bold shrink-0">
                          {selectedRouteForMapTab.shiftType || 'ทุกกะ'}
                          {selectedRouteForMapTab.shiftType === 'Shift' && selectedRouteForMapTab.shiftTimeSlot ? ` (${selectedRouteForMapTab.shiftTimeSlot})` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <span>🚐 ทะเบียนรถ: <strong className="text-slate-800 dark:text-white font-mono">{selectedRouteForMapTab.plate || selectedRouteForMapTab.vanPlate || '-'}</strong></span>
                        <span>👤 พนักงานขับรถ: <strong className="text-slate-800 dark:text-white">{selectedRouteForMapTab.driver || selectedRouteForMapTab.driverName || '-'}</strong></span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider">ลำดับจุดจอดรับ-ส่งตามเส้นทาง</h5>
                        <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                          <span className="animate-bounce">🚐</span> รถตู้วิ่งรับส่งพนักงาน
                        </div>
                      </div>
                      
                      <div className="max-h-[420px] overflow-y-auto pr-2 py-2">
                        {getRouteStations(selectedRouteForMapTab).length > 0 ? (
                          <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-200 dark:before:bg-indigo-900">
                            {getRouteStations(selectedRouteForMapTab).map((st: any, idx: number, arr: any[]) => {
                              const isFirst = idx === 0;
                              const isLast = idx === arr.length - 1;

                              return (
                                <div key={idx} className="relative flex items-start gap-3">
                                  <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                                    isFirst 
                                      ? 'bg-emerald-500 text-white border-emerald-600 ring-4 ring-emerald-500/20' 
                                      : isLast 
                                      ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-600/20' 
                                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-indigo-500'
                                  }`}>
                                    {st.index}
                                  </div>

                                  <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex justify-between items-center">
                                    <div>
                                      <span className="font-bold text-slate-900 dark:text-white block text-xs">
                                        {isFirst ? '🟢 จุดเริ่มต้น: ' : isLast ? '🏁 จุดสิ้นสุด/บริษัท: บริษัท แอร์โรเฟลกซ์ จำกัด' : `จุดจอดรับที่ ${st.index}: `}
                                        {!isLast ? st.name : ''}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {isFirst ? 'จุดเริ่มปล่อยรถ / รับพนักงานต้นทาง' : isLast ? 'สถานีปลายทาง สำนักงานใหญ่ระยอง' : 'จุดจอดรับส่งพนักงานระหว่างทาง'}
                                      </span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs border border-slate-200 dark:border-slate-800 shadow-2xs">
                                      {!isLast ? `⏱️ ${st.time} น.` : '🏁 ถึงที่หมาย'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-400 border border-dashed rounded-2xl">
                            ยังไม่มีการกำหนดข้อมูลสถานีจุดจอดสำหรับสายรถนี้
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-slate-400 text-xs">กรุณาเลือกสายรถทางด้านซ้าย</div>
                )}
              </div>
            </div>
          )}
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
              {/* หน้า 1: ข้อมูลพนักงาน + ติ๊กเลือกวันที่จอง */}
              {bookingStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">1.1 ข้อมูลพนักงาน</span>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">รหัสพนักงาน</label>
                        <input 
                          type="text" 
                          value={displayEmployeeCode} 
                          readOnly 
                          className="w-full border border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800 p-2.5 rounded-xl text-slate-700 dark:text-slate-200 font-mono font-bold text-xs cursor-not-allowed" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">ชื่อ - นามสกุล</label>
                        <input 
                          type="text" 
                          placeholder="ชื่อ - นามสกุล" 
                          value={employeeData?.name ? displayEmployeeName : employeeName} 
                          onChange={(e) => setEmployeeName(e.target.value)} 
                          readOnly={!!employeeData?.name} 
                          className={`w-full border p-2.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                            employeeData?.name 
                              ? 'bg-slate-200/60 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed' 
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                          }`} 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">เบอร์โทรศัพท์ (สำหรับให้คนขับติดต่อ)</label>
                      <input 
                        type="tel" 
                        placeholder="เช่น 0812345678" 
                        value={employeePhone} 
                        onChange={(e) => setEmployeePhone(e.target.value)} 
                        className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        1.2 ติ๊กเลือกวันที่ที่จะจอง (เลือกได้หลายวัน)
                      </label>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        เลือกแล้ว {selectedDatesArray.length} วัน
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {upcomingDatesList.map((dStr) => {
                        const isChecked = selectedDatesArray.includes(dStr);
                        const { dayLabel, dateLabel } = formatShortThaiDateButton(dStr);

                        return (
                          <button
                            key={dStr}
                            type="button"
                            onClick={() => toggleDateSelection(dStr)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                            }`}
                          >
                            <div>
                              <span className={`block text-[10px] font-semibold ${isChecked ? 'text-blue-100' : 'text-slate-400'}`}>
                                {dayLabel}
                              </span>
                              <span className="block text-xs font-bold">
                                {dateLabel}
                              </span>
                            </div>
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold border ${
                              isChecked
                                ? 'bg-white text-blue-600 border-white'
                                : 'bg-white dark:bg-slate-900 text-transparent border-slate-300 dark:border-slate-700'
                            }`}>
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDatesArray.length > 0 && (
                      <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 dark:border-blue-900/50 space-y-1.5">
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 block">วันที่ที่เลือกไว้:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDatesArray.map((d) => (
                            <span
                              key={d}
                              onClick={() => toggleDateSelection(d)}
                              className="bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer hover:border-rose-400"
                            >
                              {formatThaiDate(d)}
                              <span className="text-rose-500 font-bold">×</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    disabled={!isSystemOpen}
                    onClick={() => {
                      if (!checkIsBookingOpen()) {
                        showAlert('error', 'ระบบปิด', closeReasonMessage);
                        return;
                      }
                      const currentNameVal = (employeeData?.name ? displayEmployeeName : employeeName).trim();
                      if (!currentNameVal) {
                        showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ - นามสกุลพนักงาน');
                        return;
                      }
                      if (selectedDatesArray.length === 0) {
                        showAlert('warning', 'ยังไม่ได้เลือกวัน', 'กรุณาติ๊กเลือกวันที่ต้องการเดินทางอย่างน้อย 1 วัน');
                        return;
                      }
                      setBookingStep(2);
                    }} 
                    className="w-full bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-center mt-2 cursor-pointer text-xs transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ถัดไป →
                  </button>
                </div>
              )}

              {/* หน้า 2: เลือกกะ + เลือกสายรถ + เลือกจุดขึ้นรถ + ตรวจสอบข้อมูล */}
              {bookingStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">2.1 เลือกกะและช่วงเวลาทำงาน</label>
                    
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
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">ช่วงเวลากะ Day:</p>
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
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        2.2 เลือกสายรถตู้สวัสดิการ {shiftType === 'Shift' ? `(${shiftTimeSlot})` : ''}
                      </label>
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
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white text-xs">{r.name}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {r.shiftType || 'ทุกกะ'}{r.shiftType === 'Shift' && r.shiftTimeSlot ? ` (${r.shiftTimeSlot})` : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">ทะเบียน: {r.plate || r.vanPlate} | คนขับ: {r.driver || r.driverName}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                          ไม่พบสายรถตู้สำหรับกะและช่วงเวลานี้
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">2.3 เลือกจุดขึ้นรถ</label>
                    <select 
                      value={selectedStationIndex} 
                      onChange={(e) => setSelectedStationIndex(Number(e.target.value))} 
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
                    >
                      {activeStations.length > 0 ? (
                        activeStations.map((st: any, i: number) => (
                          <option key={i} value={i} className="dark:bg-slate-950">
                            จุดที่ #{st.index}: {st.name} ({st.time})
                          </option>
                        ))
                      ) : (
                        <option value={0}>ไม่พบจุดขึ้นรถในสายนี้</option>
                      )}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setBookingStep(1)} 
                      className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                    >
                      ย้อนกลับ
                    </button>
                    <button 
                      onClick={() => {
                        if (filteredRoutesList.length === 0 || !selectedRouteId) {
                          showAlert('warning', 'คำเตือน', 'กรุณาเลือกกะและช่วงเวลาที่มีสายรถเปิดให้บริการ');
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

              {/* หน้า 3: แสดงรายละเอียดทั้งหมด แล้วกดยืนยันเลย */}
              {bookingStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <span className="block font-bold uppercase text-slate-500 tracking-wider mb-2">สรุปรายละเอียดการสำรองที่นั่ง</span>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <p><strong>รหัสพนักงาน:</strong> <span className="font-mono">{displayEmployeeCode}</span></p>
                      <p><strong>ชื่อผู้เดินทาง:</strong> {employeeData?.name ? displayEmployeeName : employeeName} ({displayDepartment})</p>
                      <p><strong>เบอร์โทรศัพท์:</strong> {employeePhone || '-'}</p>
                      <p><strong>กะทำงาน:</strong> {shiftType === 'Day' ? 'กะ Day' : 'กะ Shift'} ({shiftTimeSlot})</p>
                      <p><strong>สายรถ:</strong> {selectedRouteName || '-'}</p>
                      <p><strong>จุดขึ้นรถ:</strong> {activeStations[selectedStationIndex] ? `จุดที่ #${activeStations[selectedStationIndex].index}: ${activeStations[selectedStationIndex].name} (${activeStations[selectedStationIndex].time})` : '-'}</p>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <strong className="block text-slate-700 dark:text-slate-300">วันที่เดินทางที่เลือก ({selectedDatesArray.length} วัน):</strong>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {selectedDatesArray.map((d: string, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-center font-mono font-medium text-blue-600 dark:text-blue-400">
                            {formatThaiDate(d)}
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
                      ย้อนกลับ
                    </button>
                    <button 
                      disabled={isBookingLoading || !isSystemOpen} 
                      onClick={async () => {
                        if (!checkIsBookingOpen()) {
                          showAlert('error', 'ระบบปิด', closeReasonMessage);
                          return;
                        }

                        const currentActiveRoute = filteredRoutesList.find(r => r.id === selectedRouteId) || filteredRoutesList[0] || routesList[0];
                        if (!currentActiveRoute || selectedDatesArray.length === 0) {
                          showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณาตรวจสอบข้อมูลและวันที่เดินทางให้ครบถ้วน');
                          return;
                        }

                        const stationsList = getRouteStations(currentActiveRoute);
                        const targetStation = stationsList[selectedStationIndex];
                        const currentEmployeeEmail = user?.email || 'employee@company.com';
                        const finalEmpName = employeeData?.name ? displayEmployeeName : employeeName.trim();

                        setIsBookingLoading(true);
                        try {
                          let lastDocRef: any = null;
                          for (const d of selectedDatesArray) {
                            const { adjustedDate } = checkCutoffTimeAndAdjustDate(d);
                            const bookingData = {
                              employeeEmail: currentEmployeeEmail,
                              employeeCode: displayEmployeeCode,
                              employeeName: finalEmpName, 
                              employeePhone: employeePhone || '-',
                              route: currentActiveRoute.name || selectedRouteName, 
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
                              employeeName: finalEmpName, 
                              employeePhone: employeePhone || '-', 
                              route: currentActiveRoute.name || selectedRouteName, 
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
                              setTravelDate('');
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
                      {isBookingLoading ? 'กำลังบันทึก...' : 'ยืนยัน'}
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

      {/* 4. HISTORY TAB - MODERN NEUMORPHIC DESIGN */}
      {activeMenu === 'history' && (
        <div className="max-w-5xl mx-auto space-y-6 text-[#182342] dark:text-slate-100">

          {/* Header */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#202B50] via-[#17213F] to-[#0B1020] p-6 sm:p-8 text-white shadow-[8px_10px_25px_rgba(17,26,56,0.18)]">
            <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full bg-white/[0.05]" />
            <div className="absolute right-28 -bottom-24 w-48 h-48 rounded-full bg-white/[0.05]" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] tracking-wider font-semibold text-slate-300">
                  ✦ TRANSPORT HISTORY
                </span>
                <h2 className="text-xl sm:text-2xl font-bold mt-3">
                  ประวัติการจองของฉัน
                </h2>
                <p className="text-xs text-slate-300 mt-2">
                  ตรวจสอบวันเดินทาง สายรถ และรายละเอียดการจองย้อนหลัง
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                  📋
                </div>
                <div>
                  <p className="text-[10px] text-slate-300">รายการจองทั้งหมด</p>
                  <p className="text-2xl font-bold">{myBookings.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <section className="bg-[#EDF2FC] dark:bg-[#151E35] rounded-[26px] p-5 sm:p-6 border border-white/70 dark:border-slate-700 shadow-[6px_7px_18px_rgba(65,82,125,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#202B50] dark:text-white">
                  🔎 ค้นหารายการจอง
                </h3>
                <p className="text-[11px] text-[#8493B3] mt-1">
                  เลือกวันที่หรือสายรถเพื่อค้นหารายการที่ต้องการ
                </p>
              </div>

              {(historyFilterDate || historyFilterRoute) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFilterDate('');
                    setHistoryFilterRoute('');
                  }}
                  className="text-xs font-semibold text-[#52658F] dark:text-slate-300 hover:text-[#111A38] dark:hover:text-white px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800 border border-white dark:border-slate-700 cursor-pointer"
                >
                  ↻ ล้างตัวกรอง
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#52658F] dark:text-slate-300 mb-2">
                  📅 วันที่เดินทาง
                </label>
                <input
                  type="date"
                  value={historyFilterDate}
                  onChange={(e) => setHistoryFilterDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#0E172B] border border-[#DCE4F3] dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-[#202B50] dark:text-white outline-none focus:ring-2 focus:ring-[#8499C5]/40 transition-all cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52658F] dark:text-slate-300 mb-2">
                  🚐 สายรถ
                </label>
                <select
                  value={historyFilterRoute}
                  onChange={(e) => setHistoryFilterRoute(e.target.value)}
                  className="w-full bg-white dark:bg-[#0E172B] border border-[#DCE4F3] dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-[#202B50] dark:text-white outline-none focus:ring-2 focus:ring-[#8499C5]/40 transition-all cursor-pointer"
                >
                  <option value="">ทุกสายรถ</option>
                  {routesList.map((r: any) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#DCE4F3] dark:border-slate-700 pt-3">
              <span className="text-xs text-[#8493B3] dark:text-slate-400">
                ผลการค้นหา
              </span>
              <span className="text-xs font-bold text-[#202B50] dark:text-white bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                {filteredHistory.length} รายการ
              </span>
            </div>
          </section>

          {/* Booking List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-[#202B50] dark:text-white">
                รายการเดินทาง
              </h3>
              <span className="text-[10px] text-[#8493B3] dark:text-slate-400">
                BOOKING RECORDS
              </span>
            </div>

            {filteredHistory.length > 0 ? (
              filteredHistory.map((b: any, idx: number) => (
                <article
                  key={b.id || idx}
                  className="group bg-white dark:bg-[#151E35] rounded-[24px] border border-[#E2E9F6] dark:border-slate-700 shadow-[5px_6px_16px_rgba(65,82,125,0.08)] hover:shadow-[7px_9px_22px_rgba(65,82,125,0.13)] transition-all overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Date */}
                    <div className="sm:w-32 shrink-0 bg-[#E8EEF9] dark:bg-[#202B50] p-4 flex sm:flex-col items-center justify-center gap-2 sm:gap-1 text-center">
                      <span className="text-2xl">📅</span>
                      <div>
                        <p className="text-[10px] text-[#8493B3] dark:text-slate-300">
                          วันเดินทาง
                        </p>
                        <p className="text-sm font-bold text-[#202B50] dark:text-white mt-1">
                          {formatThaiDate(b.travelDate)}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-base text-[#202B50] dark:text-white">
                          {b.route || 'ไม่ระบุสายรถ'}
                        </h4>

                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ยืนยันแล้ว
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#E8EEF9] dark:bg-[#202B50] text-[#52658F] dark:text-slate-200">
                          🕒 กะ {b.shiftType || '-'}
                          {b.shiftType === 'Shift' && b.shiftTimeSlot
                            ? ` (${b.shiftTimeSlot})`
                            : ''}
                        </span>

                        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#E8EEF9] dark:bg-[#202B50] text-[#52658F] dark:text-slate-200">
                          {b.tripType === 'inboundOnly'
                            ? '↗ เฉพาะขามา'
                            : b.tripType === 'outboundOnly'
                              ? '↙ เฉพาะขากลับ'
                              : '↔ ไป-กลับ'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#EDF1F8] dark:border-slate-700">
                        <div className="flex items-start gap-2">
                          <span className="text-base">📍</span>
                          <div className="min-w-0">
                            <p className="text-[10px] text-[#8493B3] dark:text-slate-400">
                              จุดขึ้นรถ
                            </p>
                            <p className="text-xs font-medium text-[#344365] dark:text-slate-200 mt-0.5 break-words">
                              {b.pickupLocation || 'ไม่ระบุ'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <span className="text-base">🕒</span>
                          <div>
                            <p className="text-[10px] text-[#8493B3] dark:text-slate-400">
                              เวลารับ
                            </p>
                            <p className="text-xs font-medium text-[#344365] dark:text-slate-200 mt-0.5">
                              {b.time || 'ไม่ระบุ'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 sm:col-span-2">
                          <span className="text-base">🚐</span>
                          <div>
                            <p className="text-[10px] text-[#8493B3] dark:text-slate-400">
                              ทะเบียนรถ
                            </p>
                            <p className="text-xs font-semibold text-[#344365] dark:text-slate-200 mt-0.5">
                              {b.vanPlate || 'ไม่ระบุ'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="bg-white dark:bg-[#151E35] rounded-[24px] border border-dashed border-[#C7D3E9] dark:border-slate-700 py-14 px-5 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E8EEF9] dark:bg-[#202B50] flex items-center justify-center text-3xl mb-4">
                  📭
                </div>
                <h4 className="font-bold text-sm text-[#344365] dark:text-white">
                  ไม่พบประวัติการจอง
                </h4>
                <p className="text-xs text-[#8493B3] dark:text-slate-400 mt-2">
                  ลองเปลี่ยนวันที่หรือเลือกทุกสายรถเพื่อดูรายการอื่น
                </p>
              </div>
            )}
          </section>

          {/* Back to booking */}
          <button
            type="button"
            onClick={() => {
              setBookingStep(1);
              setActiveMenu('booking');
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#202B50] to-[#111A38] hover:brightness-110 text-white px-6 py-3.5 rounded-2xl text-sm font-bold shadow-[5px_7px_16px_rgba(17,26,56,0.20)] transition-all cursor-pointer"
          >
            🚐 จองรถตู้เพิ่มเติม
            <span>→</span>
          </button>
        </div>
      )}

      {/* 5. MANUAL TAB */}
      {(activeMenu === 'qrcode' || activeMenu === 'manual') && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden text-sm text-slate-800 dark:text-slate-100">
          <div className="bg-slate-950 text-white p-6 text-center border-b border-slate-800">
            <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">User Manual & Guidelines</span>
            <h3 className="text-base font-bold tracking-wide mt-1">คู่มือการใช้งานและระเบียบปฏิบัติ</h3>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <span className="text-lg">📋</span>
                  <h4 className="font-bold text-sm">ระเบียบปฏิบัติ และ คำแนะนำ</h4>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-disc pl-5">
                  <li>กรุณาทำรายการจองล่วงหน้า <strong>ระบบจะตัดรอบจองเวลา 15:00 น. ของทุกวัน</strong></li>
                  <li>ผู้เดินทางต้องมารอที่จุดรับส่งก่อนเวลาอย่างน้อย <strong>5-10 นาที</strong> หากรถออกไปแล้วจะไม่สามารถวนกลับมารับได้</li>
                  <li>ตรวจสอบประวัติการจองทุกครั้งที่ทำรายการเสร็จ เพื่อความถูกต้องของสายรถและจุดรับส่ง</li>
                  <li>หากไม่สามารถเดินทางได้ หรือต้องการเปลี่ยนกะ กรุณาแจ้งยกเลิกล่วงหน้าเพื่อเปิดที่นั่งให้พนักงานท่านอื่น</li>
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <span className="text-lg">📱</span>
                  <h4 className="font-bold text-sm">วิธีการจอง</h4>
                </div>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-5">
                  <li>ไปที่เมนู <strong>ลงทะเบียนจองคิวรถตู้</strong></li>
                  <li>กรอกข้อมูลส่วนตัวและ <strong>ติ๊กเลือกวันที่ต้องการจอง</strong> แล้วกดถัดไป</li>
                  <li>เลือก <strong>กะการทำงาน</strong> (Day หรือ Shift) เลือก <strong>สายรถ</strong> และเลือก <strong>จุดขึ้นรถ</strong></li>
                  <li>กด <strong>ตรวจสอบข้อมูล</strong> และกด <strong>ยืนยัน</strong></li>
                </ol>
              </div>

              <div className="space-y-3 md:col-span-2 bg-rose-50 dark:bg-rose-950/30 p-5 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <span className="text-lg">📞</span>
                  <h4 className="font-bold text-sm">พบปัญหา หรือ ติดต่อสอบถาม</h4>
                </div>
                <p className="text-xs text-rose-700/90 dark:text-rose-400/90 leading-relaxed">
                  หากพบปัญหาในการเข้าใช้งานระบบ, ต้องการยกเลิกรอบเดินทางกระทันหัน, ลืมของไว้บนรถ, หรือต้องการสอบถามเส้นทางเพิ่มเติม <br className="hidden md:block"/>
                  สามารถเปิดเคสแจ้งแอดมินได้ผ่านหน้า <strong>"หน้าหลัก & ประกาศ"</strong> ในส่วนของ <strong>"ติดต่อ / แจ้งปัญหาถึงแอดมิน"</strong> <br />
                  หรือติดต่อฝ่ายธุรการ เบอร์โทรศัพท์: <strong>02-XXX-XXXX</strong>
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🟢 MODAL อัตโนมัติ: คู่มือการใช้งานและระเบียบปฏิบัติ */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 text-sm text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-950 text-white p-4 rounded-2xl text-center shadow-inner">
              <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">USER MANUAL & GUIDELINES</span>
              <h3 className="text-base font-bold tracking-wide mt-0.5">คู่มือการใช้งานและระเบียบปฏิบัติ</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <span className="text-base">📋</span>
                    <h4 className="font-bold text-xs uppercase">ระเบียบปฏิบัติ และ คำแนะนำ</h4>
                  </div>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-4 leading-relaxed">
                    <li>กรุณาทำรายการจองล่วงหน้า <strong>ระบบจะตัดรอบจองเวลา 15:00 น. ของทุกวัน</strong></li>
                    <li>ผู้เดินทางต้องมารอที่จุดรับส่งก่อนเวลาอย่างน้อย <strong>5-10 นาที</strong> หากรถออกไปแล้วจะไม่สามารถวนกลับมารับได้</li>
                    <li>ตรวจสอบประวัติการจองทุกครั้ง เพื่อความถูกต้องของสายรถและจุดรับส่ง</li>
                    <li>หากไม่สามารถเดินทางได้ กรุณาแจ้งยกเลิกล่วงหน้าเพื่อเปิดที่นั่งให้พนักงานท่านอื่น</li>
                  </ul>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <span className="text-base">📱</span>
                    <h4 className="font-bold text-xs uppercase">วิธีการจอง</h4>
                  </div>
                  <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                    <li>ไปที่เมนู <strong>ลงทะเบียนจองคิวรถตู้</strong></li>
                    <li>กรอกข้อมูลและ <strong>ติ๊กเลือกวันที่ต้องการจอง</strong> แล้วกดถัดไป</li>
                    <li>เลือก <strong>กะการทำงาน</strong> เลือก <strong>สายรถ</strong> และเลือก <strong>จุดขึ้นรถ</strong></li>
                    <li>กด <strong>ตรวจสอบข้อมูล</strong> และกด <strong>ยืนยัน</strong></li>
                  </ol>
                </div>

              </div>

              <div className="space-y-2 bg-rose-50 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <span className="text-base">📞</span>
                  <h4 className="font-bold text-xs uppercase">พบปัญหา หรือ ติดต่อสอบถาม</h4>
                </div>
                <p className="text-[11px] text-rose-700/90 dark:text-rose-400/90 leading-relaxed">
                  หากพบปัญหาในการเข้าใช้งาน, ต้องการยกเลิกรอบเดินทางกระทันหัน, หรือลืมของไว้บนรถ สามารถแจ้งแอดมินได้ผ่านหน้า <strong>"กล่องข้อความช่วยเหลือ"</strong> หรือติดต่อฝ่ายธุรการ เบอร์โทรศัพท์: <strong>02-XXX-XXXX</strong>
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowManualModal(false)}
                className="w-full md:w-auto bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
              >
                รับทราบ / ปิดหน้าต่างนี้
              </button>
            </div>

          </div>
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
                (() => {
                  const uniqueRouteKeys = Array.from(
                    new Set(
                      summaryBookings.map((b: any) => {
                        const rName = (b.route || b.routeName || 'ไม่ระบุสายรถ').trim();
                        const rShift = b.shiftType || b.shift || 'Day';
                        const rSlot = rShift === 'Shift' && b.shiftTimeSlot ? b.shiftTimeSlot : '';
                        return `${rName}__${rShift}__${rSlot}`;
                      })
                    )
                  );

                  return uniqueRouteKeys.map((key) => {
                    const [routeName, shiftLabel, slotLabel] = key.split('__');
                    const routeBookings = summaryBookings.filter((b: any) => {
                      const bName = (b.route || b.routeName || 'ไม่ระบุสายรถ').trim();
                      const bShift = b.shiftType || b.shift || 'Day';
                      const bSlot = bShift === 'Shift' && b.shiftTimeSlot ? b.shiftTimeSlot : '';
                      return bName === routeName && bShift === shiftLabel && bSlot === slotLabel;
                    });

                    return (
                      <div key={key} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">{routeName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200/70 dark:border-purple-900">
                              {shiftLabel}{slotLabel ? ` (${slotLabel})` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold shrink-0">{routeBookings.length} รายการ</span>
                        </div>
                        <div className="space-y-1.5">
                          {routeBookings.map((b: any, bIdx: number) => (
                            <div key={b.id || bIdx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px]">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{bIdx + 1}. {b.employeeName || b.name || b.employeeEmail}</span>
                                <span className="block text-slate-400">จุดขึ้นรถ: {b.pickupLocation || b.station} ({b.time || '-'})</span>
                              </div>
                              <span className="font-mono text-slate-600 dark:text-slate-300">{b.employeePhone || b.phone || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()
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