'use client';

import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, deleteDoc, arrayUnion, onSnapshot, setDoc } from 'firebase/firestore';

interface AdminViewProps {
  db: any;
  user: any;
  theme?: any;
  routesList?: any[];
  bookingsList?: any[];
  announcementsList?: any[];
  supportTicketsList?: any[];
  cancellationRequestsList?: any[]; 
  adHocRequestsList?: any[]; 
  showAlert: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => void;
}

type SystemControlMode = 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSE';
type Language = 'TH' | 'EN';

// -------------------------------------------------------------
// 🌐 Dictionary สำหรับรองรับ 2 ภาษา (TH / EN)
// -------------------------------------------------------------
const translations = {
  TH: {
    systemControl: '⏱️ ควบคุมระบบเปิด-ปิดการจองรถตู้',
    autoScheduleNote: 'ระบบตั้งเวลาอัตโนมัติ: ปิดรับจองช่วง',
    ofNextDay: 'ของวันถัดไป',
    currentStatus: 'สถานะปัจจุบัน:',
    openBooking: '🟢 เปิดรับการจอง',
    closeBooking: '🔒 ปิดรับการจอง',
    modeAuto: '🕒 อัตโนมัติ (Auto)',
    modeAutoDesc: 'เปิดจอง 08:00 - 16:00 น. อัตโนมัติ',
    modeForceOpen: '⚡ เปิดการจองฉุกเฉิน',
    modeForceOpenDesc: 'บังคับเปิดทันที แม้หลัง 16:00 น.',
    modeForceClose: '🚫 ปิดการจองฉุกเฉิน',
    modeForceCloseDesc: 'บังคับปิดทันที แม้อยู่นอกเวลาทำการ',
    inServiceHours: 'อยู่ในเวลาทำการ (08:00 - 16:00 น.)',
    outServiceHours: 'นอกเวลาทำการ (ปิดอัตโนมัติ 16:00 - 08:00 น.)',
    activeMode: 'ใช้งานอยู่',
    
    // Tabs
    tabOverview: '📊 สรุปภาพรวมการจอง',
    tabRoutes: '🚌 จัดการสายรถตู้',
    tabAnnouncements: '📢 จัดการประกาศข่าว',
    tabTickets: '📬 กล่องข้อความแจ้งปัญหา',
    tabCancellation: '❌ คำขอยกเลิกการจอง',
    tabAdHoc: '🕒 คำขอเปลี่ยนกะ/ออกก่อน',

    // Overview
    filterDate: '📅 วันที่:',
    filterShift: '⚡ กะ:',
    allShifts: 'ทุกกะ (All Shifts)',
    resetFilters: 'รีเซ็ตตัวกรอง',
    printPDF: '🖨️ พิมพ์เอกสาร / บันทึก PDF',
    printReportTitle: 'รายงานสรุปยอดการจองรถตู้พนักงาน',
    printReportDate: 'ประจำวันที่:',
    printReportAllDates: 'ทุกวันทั้งหมดในระบบ',
    statTotalBookings: 'ยอดจองตามเงื่อนไข',
    statTotalRoutes: 'สายรถในระบบทั้งหมด',
    statPendingTickets: 'ตั๋วปัญหารอดำเนินการค้างอยู่',
    seatsUnit: 'ที่นั่ง',
    routesUnit: 'สาย',
    ticketsUnit: 'เรื่อง',
    passengersSummary: '🚌 สรุปยอดและรายชื่อผู้โดยสารแยกตามแต่ละสายรถตู้และกะ',
    plate: 'ทะเบียน:',
    driver: 'คนขับ:',
    noPassengers: 'ไม่มีผู้โดยสารจองในสายและกะนี้ตามเงื่อนไขที่เลือก',
    pickup: 'จุดรับ:',
    travelDate: 'เดินทาง:',

    // Routes
    editRouteTitle: '✏️ แก้ไขข้อมูลสายรถ',
    addRouteTitle: '➕ สร้างและเพิ่มสายรถคันใหม่',
    cancelEdit: 'ยกเลิกแก้ไข',
    selectShift: 'เลือกกะการทำงานสายรถ',
    routeNameLabel: 'ชื่อเรียกสายรถ (เช่น สายบ้านฉาง)',
    routePlateLabel: 'เลขทะเบียนรถ',
    driverNameLabel: 'ชื่อพนักงานคนขับ',
    driverPhoneLabel: 'เบอร์โทรศัพท์สายตรงคนขับ',
    setStopsLabel: 'กำหนดจุดจอดรับ ส่งพนักงาน',
    stationNamePlaceholder: 'ชื่อสถานีรายทาง',
    timePlaceholder: 'เวลา (06.30)',
    addStopBtn: '+ เพิ่มจุดจอด',
    saveRouteBtn: 'บันทึกสายรถเข้าสู่ระบบ',
    saveEditBtn: 'บันทึกการแก้ไขสายรถ',
    filterRoutesByShift: '📌 เลือกดูสายรถตามกะ:',
    removeRouteBtn: 'ถอดถอนสายรถนี้',
    editRouteBtn: 'แก้ไข',
    noRoutesFound: 'ไม่พบข้อมูลสายรถในหมวดหมู่',

    // Announcements
    createAnnouncementTitle: '📢 สร้างประกาศข่าวสารใหม่ถึงพนักงาน',
    announceTitleLabel: 'หัวข้อประกาศข่าว',
    announceContentLabel: 'เนื้อหาประกาศ',
    postAnnouncementBtn: 'โพสต์ประกาศบนระบบ',
    announceHistoryTitle: '📄 ประวัติและรายการประกาศข่าวสารประชาสัมพันธ์',
    deleteBtn: 'ลบ',

    // Support Chat
    supportChatTitle: 'ห้องแชทโต้ตอบจัดการข้อความและปัญหาพนักงาน',
    totalCases: 'ในหน้านี้พบทั้งหมด',
    casesUnit: 'เคส',
    subTabPending: '🔴 รอดำเนินการ',
    subTabProcessing: '🟡 กำลังตรวจสอบ',
    subTabResolved: '🟢 แก้ไขเรียบร้อย',
    noTickets: '📭 ไม่มีรายการแจ้งปัญหาในหมวดหมู่นี้',
    subject: '📌 เรื่อง:',
    sender: 'ผู้ส่ง:',
    archiveChatBtn: '📦 จัดเก็บแชท',
    typeReplyPlaceholder: 'พิมพ์ข้อความตอบกลับ...',
    sendChatBtn: 'ส่งแชท',

    // Cancellation
    cancellationTitle: 'ตรวจสอบและอนุมัติคำขอยกเลิกตั๋วพนักงาน',
    noCancelRequests: '📭 ไม่มีคำขอยกเลิกตั๋วในขณะนี้',
    approveDeleteTicket: '🗑️ อนุมัติลบตั๋วออกจากระบบ',
    reasonSpecified: 'เหตุผลที่ระบุ:',

    // AdHoc Requests
    adhocTitle: '🕒 ตรวจสอบและอนุมัติคำขอเปลี่ยนกะ / ออกก่อนเวลาพนักงาน',
    allRequests: '📋 ทั้งหมด',
    approvedStatus: '✅ อนุมัติแล้ว',
    rejectedStatus: '❌ ถูกปฏิเสธ',
    noAdhocRequests: '📭 ไม่มีรายการคำขอในหมวดหมู่นี้',
    requestDate: 'วันที่ต้องการเปลี่ยน:',
    approveBtn: '✅ อนุมัติ',
    rejectBtn: '❌ ปฏิเสธ',
    normalShift: 'กะปกติในระบบ:',
    requestedExitTime: 'เวลาที่ขอออกจริง:',
    employeeReason: 'เหตุผลความจำเป็นของพนักงาน:',
    rejectReasonPrompt: 'กรุณาระบุเหตุผลที่ไม่สามารถอนุมัติได้ (เพื่อให้พนักงานรับทราบ):',
    confirmRejectBtn: 'ยืนยันปฏิเสธคำขอ'
  },
  EN: {
    systemControl: '⏱️ Van Booking System Control',
    autoScheduleNote: 'Auto Schedule: Automatically closes booking between',
    ofNextDay: 'of the next day',
    currentStatus: 'Current Status:',
    openBooking: '🟢 Open for Booking',
    closeBooking: '🔒 Booking Closed',
    modeAuto: '🕒 Auto Schedule',
    modeAutoDesc: 'Auto open 08:00 - 16:00',
    modeForceOpen: '⚡ Force Open',
    modeForceOpenDesc: 'Force open booking regardless of time',
    modeForceClose: '🚫 Force Close',
    modeForceCloseDesc: 'Force close booking immediately',
    inServiceHours: 'In Service Hours (08:00 - 16:00)',
    outServiceHours: 'Out of Service Hours (Auto Closed 16:00 - 08:00)',
    activeMode: 'Active',
    
    // Tabs
    tabOverview: '📊 Booking Overview',
    tabRoutes: '🚌 Van Routes',
    tabAnnouncements: '📢 Announcements',
    tabTickets: '📬 Support Tickets',
    tabCancellation: '❌ Cancellations',
    tabAdHoc: '🕒 Shift & Early Exit',

    // Overview
    filterDate: '📅 Date:',
    filterShift: '⚡ Shift:',
    allShifts: 'All Shifts',
    resetFilters: 'Reset Filters',
    printPDF: '🖨️ Print / Save PDF',
    printReportTitle: 'Employee Van Booking Summary Report',
    printReportDate: 'Date:',
    printReportAllDates: 'All System Dates',
    statTotalBookings: 'Filtered Bookings',
    statTotalRoutes: 'Total Van Routes',
    statPendingTickets: 'Pending Tickets',
    seatsUnit: 'seats',
    routesUnit: 'routes',
    ticketsUnit: 'cases',
    passengersSummary: '🚌 Passenger List Grouped by Route & Shift',
    plate: 'Plate:',
    driver: 'Driver:',
    noPassengers: 'No passengers found for the selected filter.',
    pickup: 'Pickup:',
    travelDate: 'Travel Date:',

    // Routes
    editRouteTitle: '✏️ Edit Route Information',
    addRouteTitle: '➕ Add New Van Route',
    cancelEdit: 'Cancel Edit',
    selectShift: 'Select Shift Type',
    routeNameLabel: 'Route Name (e.g. Ban Chang Line)',
    routePlateLabel: 'License Plate Number',
    driverNameLabel: 'Driver Name',
    driverPhoneLabel: 'Driver Direct Phone',
    setStopsLabel: 'Configure Bus Stops / Stations',
    stationNamePlaceholder: 'Station Name',
    timePlaceholder: 'Time (e.g. 06.30)',
    addStopBtn: '+ Add Stop',
    saveRouteBtn: 'Save New Route',
    saveEditBtn: 'Save Route Changes',
    filterRoutesByShift: '📌 Filter Routes by Shift:',
    removeRouteBtn: 'Remove Route',
    editRouteBtn: 'Edit',
    noRoutesFound: 'No routes found in category',

    // Announcements
    createAnnouncementTitle: '📢 Post New Announcement to Employees',
    announceTitleLabel: 'Title',
    announceContentLabel: 'Content Details',
    postAnnouncementBtn: 'Post Announcement',
    announceHistoryTitle: '📄 Announcement History',
    deleteBtn: 'Delete',

    // Support Chat
    supportChatTitle: 'Employee Support Ticket & Chat Management',
    totalCases: 'Total found:',
    casesUnit: 'cases',
    subTabPending: '🔴 Pending',
    subTabProcessing: '🟡 Processing',
    subTabResolved: '🟢 Resolved',
    noTickets: '📭 No tickets found in this section',
    subject: '📌 Subject:',
    sender: 'Sender:',
    archiveChatBtn: '📦 Archive Chat',
    typeReplyPlaceholder: 'Type a reply...',
    sendChatBtn: 'Send',

    // Cancellation
    cancellationTitle: 'Review & Approve Ticket Cancellation Requests',
    noCancelRequests: '📭 No cancellation requests at this time',
    approveDeleteTicket: '🗑️ Approve & Delete Ticket',
    reasonSpecified: 'Reason Provided:',

    // AdHoc Requests
    adhocTitle: '🕒 Review & Approve Shift Change / Early Exit Requests',
    allRequests: '📋 All',
    approvedStatus: '✅ Approved',
    rejectedStatus: '❌ Rejected',
    noAdhocRequests: '📭 No requests found in this section',
    requestDate: 'Request Date:',
    approveBtn: '✅ Approve',
    rejectBtn: '❌ Reject',
    normalShift: 'System Shift:',
    requestedExitTime: 'Requested Exit Time:',
    employeeReason: 'Employee Reason:',
    rejectReasonPrompt: 'Please specify the rejection reason:',
    confirmRejectBtn: 'Confirm Rejection'
  }
};

export default function AdminView({ 
  db, 
  user, 
  theme, 
  routesList = [], 
  bookingsList = [], 
  announcementsList = [], 
  supportTicketsList = [], 
  cancellationRequestsList = [], 
  adHocRequestsList = [], 
  showAlert 
}: AdminViewProps) {

  // -------------------------------------------------------------
  // Real-time Clock & Language Toggle States
  // -------------------------------------------------------------
  const [currentTime, setCurrentTime] = useState<string>('');
  const [lang, setLang] = useState<Language>('TH');
  const t = translations[lang];

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Navigation Tabs
  const [adminTab, setAdminTab] = useState<'overview' | 'routes' | 'announcements' | 'tickets' | 'cancellation' | 'adhoc'>('overview');
  const [ticketSubTab, setTicketSubTab] = useState<'Pending' | 'Processing' | 'Resolved'>('Pending');
  const [adhocSubTab, setAdhocSubTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  // Control System States
  const [controlMode, setControlMode] = useState<SystemControlMode>('AUTO');

  // Reject Reasoning
  const [rejectReasonInputs, setRejectReasonInputs] = useState<{ [id: string]: string }>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Filters
  const [adminRouteFilter, setAdminRouteFilter] = useState<'Day' | 'Shift'>('Day');

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayDateString();
  const [selectedOverviewDate, setSelectedOverviewDate] = useState<string>(todayStr);
  const [selectedShiftTypeFilter, setSelectedShiftTypeFilter] = useState<string>('ALL');

  // Route Form States
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRoutePlate, setNewRoutePlate] = useState('');
  const [newRouteDriver, setNewRouteDriver] = useState('');
  const [newRoutePhone, setNewRoutePhone] = useState('');
  const [newRouteShift, setNewRouteShift] = useState<'Day' | 'Shift'>('Day');

  const [stationInput, setStationInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [stopsList, setStopsList] = useState<{ station: string; time: string }[]>([]);

  // Announcement Form States
  const [newAnnounceTitle, setNewAnnounceTitle] = useState('');
  const [newAnnounceContent, setNewAnnounceContent] = useState('');

  // Support Chat States
  const [replyMessages, setReplyMessages] = useState<{ [ticketId: string]: string }>({}); 
  const [, setUpdatingTicketId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // ระบบตั้งเวลา และ Manual Override (เปิด/ปิด จองรถ)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!db) return;
    const sysControlRef = doc(db, 'system_settings', 'booking_control');
    const unsubscribe = onSnapshot(sysControlRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.mode) {
          setControlMode(data.mode as SystemControlMode);
        }
      }
    });

    return () => unsubscribe();
  }, [db]);

  const checkAutoSchedule = () => {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 8 && currentHour < 16;
  };

  const isAutoOpen = checkAutoSchedule();
  const autoStatusText = isAutoOpen ? t.inServiceHours : t.outServiceHours;

  const isCurrentlyOpen = controlMode === 'FORCE_OPEN' 
    ? true 
    : controlMode === 'FORCE_CLOSE' 
    ? false 
    : isAutoOpen;

  const handleUpdateControlMode = async (newMode: SystemControlMode) => {
    try {
      setControlMode(newMode);
      
      const isAuto = checkAutoSchedule();
      let openStatus = false;
      let reasonText = '';

      if (newMode === 'FORCE_OPEN') {
        openStatus = true;
      } else if (newMode === 'FORCE_CLOSE') {
        openStatus = false;
        reasonText = 'ระบบปิดรับการจองชั่วคราวโดยผู้ดูแลระบบ';
      } else {
        openStatus = isAuto;
        reasonText = isAuto ? '' : 'ระบบปิดรับการจองนอกเวลาทำการ (เปิดรับจองเวลา 08:00 - 16:00 น.)';
      }

      const sysControlRef = doc(db, 'system_settings', 'booking_control');
      await setDoc(sysControlRef, {
        mode: newMode,
        isCurrentlyOpen: openStatus,
        closeReason: reasonText,
        updatedBy: user?.email || user?.displayName || 'Admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      showAlert('success', 'Success', `Updated mode to ${newMode}`);
    } catch {
      showAlert('error', 'Error', 'Failed to update system mode');
    }
  };

  // Lists Processing
  const combinedCancelRequests = [
    ...cancellationRequestsList,
    ...supportTicketsList.filter(t => {
      const st = (t.status || '').toLowerCase();
      return st.includes('cancel') || st.includes('ยกเลิก');
    })
  ];

  const pendingTicketsCount = supportTicketsList.filter(t => {
    const st = (t.status || 'pending').toLowerCase();
    return st === 'pending' || st.includes('รอ') || (!t.status && ticketSubTab === 'Pending');
  }).length;

  const processingTicketsCount = supportTicketsList.filter(t => {
    const st = (t.status || '').toLowerCase();
    return st === 'processing' || st.includes('กำลัง') || st.includes('ตรวจสอบ');
  }).length;

  const resolvedTicketsCount = supportTicketsList.filter(t => {
    const st = (t.status || '').toLowerCase();
    return st === 'resolved' || st === 'completed' || st.includes('เรียบร้อย');
  }).length;

  const cancelRequestsCount = combinedCancelRequests.length;
  
  const pendingAdHocCount = adHocRequestsList.filter(r => !r.status || r.status === 'Pending').length;
  const approvedAdHocCount = adHocRequestsList.filter(r => r.status === 'Approved').length;
  const rejectedAdHocCount = adHocRequestsList.filter(r => r.status === 'Rejected').length;

  const filteredAdHocList = adHocRequestsList.filter(r => {
    const st = r.status || 'Pending';
    if (adhocSubTab === 'All') return true;
    if (adhocSubTab === 'Pending') return st === 'Pending';
    if (adhocSubTab === 'Approved') return st === 'Approved';
    if (adhocSubTab === 'Rejected') return st === 'Rejected';
    return true;
  });

  const filteredTickets = supportTicketsList.filter(t => {
    const st = (t.status || 'pending').toLowerCase();
    if (ticketSubTab === 'Pending') {
      return st === 'pending' || st.includes('รอ') || (!t.status);
    }
    if (ticketSubTab === 'Processing') {
      return st === 'processing' || st.includes('กำลัง') || st.includes('ตรวจสอบ');
    }
    if (ticketSubTab === 'Resolved') {
      return st === 'resolved' || st === 'completed' || st.includes('เรียบร้อย');
    }
    return true;
  });

  const filteredAdminRoutes = routesList.filter(r => {
    const type = r.shiftType || r.shift || 'Day';
    if (type === 'All') return true;
    return type === adminRouteFilter;
  });

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    if (lang === 'EN') return dateStr;
    const yyyy = parseInt(parts[0], 10) + 543;
    const mm = parts[1];
    const dd = parts[2];
    return `${dd}/${mm}/${yyyy}`;
  };

  // Stop handlers
  const handleAddStop = () => {
    if (!stationInput || !timeInput) return;
    setStopsList(prev => [...prev, { station: stationInput, time: timeInput }]);
    setStationInput('');
    setTimeInput('');
  };

  const handleRemoveStop = (idx: number) => {
    setStopsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEditRouteClick = (r: any) => {
    setEditingRouteId(r.id);
    setNewRouteName(r.name || '');
    setNewRoutePlate(r.plate || r.vanPlate || '');
    setNewRouteDriver(r.driver || r.driverName || '');
    setNewRoutePhone(r.phone || '');
    setNewRouteShift(r.shiftType || r.shift || 'Day');
    setStopsList(r.stops || r.stations || []);
  };

  const handleCancelEdit = () => {
    setEditingRouteId(null);
    setNewRouteName(''); 
    setNewRoutePlate(''); 
    setNewRouteDriver(''); 
    setNewRoutePhone('');
    setNewRouteShift('Day');
    setStopsList([]);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName || !newRoutePlate) return;
    try {
      const routeData = {
        name: newRouteName,
        plate: newRoutePlate,
        vanPlate: newRoutePlate,
        driver: newRouteDriver,
        driverName: newRouteDriver,
        phone: newRoutePhone,
        shiftType: newRouteShift,
        shift: newRouteShift,
        stops: stopsList,
        stations: stopsList,
        totalSeats: 14,
        updatedBy: user?.email || user?.displayName || 'Admin'
      };

      if (editingRouteId) {
        await updateDoc(doc(db, 'van_routes', editingRouteId), routeData);
        showAlert('success', 'Success', 'Route updated successfully');
      } else {
        await addDoc(collection(db, 'van_routes'), routeData);
        showAlert('success', 'Success', 'New route added successfully');
      }
      handleCancelEdit();
    } catch {
      showAlert('error', 'Error', 'Failed to save route data');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    showAlert('warning', 'Confirm Delete', 'Are you sure you want to delete this route?', async () => {
      try {
        await deleteDoc(doc(db, 'van_routes', id));
        showAlert('success', 'Deleted', 'Route deleted successfully');
      } catch {
        showAlert('error', 'Error', 'Failed to delete route');
      }
    }, true);
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnounceTitle || !newAnnounceContent) return;
    try {
      await addDoc(collection(db, 'van_announcements'), {
        title: newAnnounceTitle,
        desc: newAnnounceContent,
        content: newAnnounceContent,
        createdBy: user?.email || user?.displayName || 'Admin',
        timestamp: new Date().toISOString()
      });
      showAlert('success', 'Success', 'Announcement posted');
      setNewAnnounceTitle(''); 
      setNewAnnounceContent('');
    } catch {
      showAlert('error', 'Error', 'Failed to post announcement');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    showAlert('warning', 'Confirm Delete', 'Delete this announcement?', async () => {
      try {
        await deleteDoc(doc(db, 'van_announcements', id));
        showAlert('success', 'Deleted', 'Announcement removed');
      } catch {
        showAlert('error', 'Error', 'Failed to delete announcement');
      }
    }, true);
  };

  const handleReplyTicketChat = async (ticketId: string) => {
    const textToReply = replyMessages[ticketId]?.trim();
    if (!textToReply) return;

    setUpdatingTicketId(ticketId);
    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'Processing',
        messages: arrayUnion({
          sender: 'admin',
          text: textToReply,
          timestamp: new Date().toISOString(),
          repliedBy: user?.email || user?.displayName || 'Admin'
        })
      });
      setReplyMessages(prev => ({ ...prev, [ticketId]: '' }));
    } catch {
      showAlert('error', 'Error', 'Failed to send reply');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { 
        status: newStatus,
        updatedBy: user?.email || user?.displayName || 'Admin'
      });
      showAlert('success', 'Updated', 'Ticket status updated');
    } catch {
      showAlert('error', 'Error', 'Failed to update status');
    }
  };

  const handleArchiveTicket = async (ticketId: string) => {
    showAlert('warning', 'Confirm Archive', 'Archive this ticket chat?', async () => {
      try {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status: 'Archived' });
        showAlert('success', 'Archived', 'Chat archived successfully');
      } catch {
        showAlert('error', 'Error', 'Failed to archive ticket');
      }
    }, true);
  };

  const handleApproveCancellation = async (requestId: string, bookingId: string, collectionName = 'support_tickets') => {
    showAlert('warning', 'Confirm Delete', 'Approve cancellation and delete booking?', async () => {
      try {
        if (bookingId) {
          await deleteDoc(doc(db, 'van_bookings', bookingId));
        }
        await deleteDoc(doc(db, collectionName, requestId));
        showAlert('success', 'Approved', 'Ticket canceled successfully');
      } catch {
        showAlert('error', 'Error', 'Failed to process cancellation');
      }
    }, true);
  };

  const handleApproveAdHoc = async (requestId: string, status: 'Approved' | 'Rejected') => {
    try {
      const updatePayload: any = { 
        status,
        approvedBy: user?.email || user?.displayName || 'Admin',
        approvedAt: new Date().toISOString()
      };
      if (status === 'Rejected') {
        const reasonText = rejectReasonInputs[requestId] || 'Unspecified';
        updatePayload.adminRejectReason = reasonText;
      }
      await updateDoc(doc(db, 'shiftRequests', requestId), updatePayload);
      showAlert('success', 'Success', status === 'Approved' ? 'Request Approved' : 'Request Rejected');
      setRejectingId(null);
    } catch {
      showAlert('error', 'Error', 'Failed to update request');
    }
  };

  let filteredBookingsByDate = bookingsList.filter(b => {
    const travelDate = (b.travelDate || b.date || '').trim();
    const matchDate = !selectedOverviewDate || travelDate === selectedOverviewDate;

    if (!matchDate) return false;

    if (selectedShiftTypeFilter !== 'ALL') {
      const bShift = b.shiftType || b.shift || 'Day';
      return bShift === selectedShiftTypeFilter;
    }
    return true;
  });

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="text-sm text-slate-800 dark:text-slate-100 max-w-6xl mx-auto space-y-6">
      
      {/* 🟢 PANEL ควบคุมการเปิด-ปิดระบบจอง + ปุ่มนาฬิกา Real-time & สลับภาษา TH/EN */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              {t.systemControl}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.autoScheduleNote} <strong className="text-slate-700 dark:text-slate-300">16:00 - 08:00 น.</strong> {t.ofNextDay}
            </p>
          </div>

          {/* 🌟 Widgets: นาฬิกา Real-Time + ปุ่มสลับภาษา TH / EN */}
          <div className="flex items-center gap-2.5">
            {/* Real-time Clock */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center min-w-[85px]">
              {currentTime || '00:00:00'}
            </div>

            {/* Language Switcher Button */}
            <button
              type="button"
              onClick={() => setLang(prev => prev === 'TH' ? 'EN' : 'TH')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span>{lang}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

            <div className="flex items-center gap-1.5">
              {isCurrentlyOpen ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 animate-pulse">
                  {t.openBooking}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
                  {t.closeBooking}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleUpdateControlMode('AUTO')}
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all text-left cursor-pointer ${
              controlMode === 'AUTO'
                ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-extrabold text-xs uppercase">{t.modeAuto}</span>
                {controlMode === 'AUTO' && <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">{t.activeMode}</span>}
              </div>
              <p className="text-[11px] opacity-80">{t.modeAutoDesc}</p>
            </div>
            <span className="mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {autoStatusText}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleUpdateControlMode('FORCE_OPEN')}
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all text-left cursor-pointer ${
              controlMode === 'FORCE_OPEN'
                ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-extrabold text-xs uppercase">{t.modeForceOpen}</span>
                {controlMode === 'FORCE_OPEN' && <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">{t.activeMode}</span>}
              </div>
              <p className="text-[11px] opacity-80">{t.modeForceOpenDesc}</p>
            </div>
            <span className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              Manual Force Open
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleUpdateControlMode('FORCE_CLOSE')}
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all text-left cursor-pointer ${
              controlMode === 'FORCE_CLOSE'
                ? 'border-red-600 bg-red-50/60 dark:bg-red-950/40 text-red-900 dark:text-red-200 ring-2 ring-red-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-extrabold text-xs uppercase">{t.modeForceClose}</span>
                {controlMode === 'FORCE_CLOSE' && <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">{t.activeMode}</span>}
              </div>
              <p className="text-[11px] opacity-80">{t.modeForceCloseDesc}</p>
            </div>
            <span className="mt-2 text-[10px] font-bold text-red-600 dark:text-red-400">
              Manual Force Close
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-px print:hidden">
        <button onClick={() => setAdminTab('overview')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${adminTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabOverview}</button>
        <button onClick={() => setAdminTab('routes')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${adminTab === 'routes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabRoutes} ({routesList.length})</button>
        <button onClick={() => setAdminTab('announcements')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${adminTab === 'announcements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabAnnouncements} ({announcementsList.length})</button>
        <button onClick={() => setAdminTab('tickets')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${adminTab === 'tickets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabTickets} {pendingTicketsCount > 0 && (<span className="bg-red-500 text-white text-[10px] h-4 px-1.5 rounded-full flex items-center justify-center font-bold animate-pulse">{pendingTicketsCount}</span>)}</button>
        <button onClick={() => setAdminTab('cancellation')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${adminTab === 'cancellation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabCancellation} {cancelRequestsCount > 0 && (<span className="bg-amber-500 text-white text-[10px] h-4 px-1.5 rounded-full flex items-center justify-center font-bold">{cancelRequestsCount}</span>)}</button>
        <button onClick={() => setAdminTab('adhoc')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${adminTab === 'adhoc' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>{t.tabAdHoc} {pendingAdHocCount > 0 && (<span className="bg-blue-600 text-white text-[10px] h-4 px-1.5 rounded-full flex items-center justify-center font-bold">{pendingAdHocCount}</span>)}</button>
      </div>

      {/* 1. OVERVIEW TAB */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 print:hidden">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{t.filterDate}</label>
                <input 
                  type="date" 
                  value={selectedOverviewDate} 
                  onChange={(e) => setSelectedOverviewDate(e.target.value)} 
                  className="border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-xs dark:bg-slate-950 font-mono cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{t.filterShift}</label>
                <select
                  value={selectedShiftTypeFilter}
                  onChange={(e) => setSelectedShiftTypeFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-xs dark:bg-slate-950 font-bold cursor-pointer"
                >
                  <option value="ALL">{t.allShifts}</option>
                  <option value="Day">Day</option>
                  <option value="Shift">Shift</option>
                </select>
              </div>

              <button 
                onClick={() => { setSelectedOverviewDate(''); setSelectedShiftTypeFilter('ALL'); }} 
                className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                {t.resetFilters}
              </button>
            </div>
            <button 
              onClick={handlePrintPDF} 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {t.printPDF}
            </button>
          </div>

          <div className="hidden print:block text-center space-y-1 mb-6">
            <h2 className="text-xl font-bold">{t.printReportTitle}</h2>
            <p className="text-sm text-slate-500">{t.printReportDate} {formatThaiDate(selectedOverviewDate) || t.printReportAllDates} | {t.filterShift} {selectedShiftTypeFilter === 'ALL' ? t.allShifts : selectedShiftTypeFilter}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">{t.statTotalBookings}</span><p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{filteredBookingsByDate.length} <span className="text-xs font-normal text-slate-500">{t.seatsUnit}</span></p></div>
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">{t.statTotalRoutes}</span><p className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">{routesList.length} <span className="text-xs font-normal text-slate-500">{t.routesUnit}</span></p></div>
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">{t.statPendingTickets}</span><p className="text-2xl font-black mt-1 text-amber-500">{pendingTicketsCount} <span className="text-xs font-normal text-slate-500">{t.ticketsUnit}</span></p></div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.passengersSummary}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routesList.map((route) => {
                const routeBookings = filteredBookingsByDate.filter(b => {
                  const bRoute = (b.route || b.routeName || '').trim();
                  const rName = (route.name || '').trim();
                  const matchRoute = bRoute === rName;

                  const rShift = route.shiftType || route.shift || 'Day';
                  const bShift = b.shiftType || b.shift || 'Day';

                  const matchShift = rShift === 'All' || bShift === rShift;
                  return matchRoute && matchShift;
                });
                
                return (
                  <div key={route.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-base">{route.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${(route.shiftType || route.shift) === 'Shift' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'}`}>
                            {route.shiftType || route.shift || 'Day'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{t.plate} {route.plate || route.vanPlate || '-'} | {t.driver} {route.driver || route.driverName || '-'} ({route.phone || '-'})</p>
                      </div>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs px-2.5 py-1 rounded-xl">
                        {routeBookings.length} {lang === 'TH' ? 'คน' : 'pax'}
                      </span>
                    </div>

                    {routeBookings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">{t.noPassengers}</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {routeBookings.map((b, bIdx) => {
                          const empEmail = (b.employeeEmail || '').toLowerCase();
                          const empName = (b.employeeName || b.name || '').trim();
                          const bookingDate = (b.travelDate || b.date || '').trim();

                          const approvedAdHoc = adHocRequestsList.find(adhoc => {
                            const isStatusApproved = adhoc.status === 'Approved';
                            const matchDate = (adhoc.requestDate || adhoc.date || '').trim() === bookingDate;
                            const matchUser = 
                              (adhoc.employeeEmail && adhoc.employeeEmail.toLowerCase() === empEmail) ||
                              (adhoc.employeeName && adhoc.employeeName.trim() === empName);

                            return isStatusApproved && matchDate && matchUser;
                          });

                          const displayShiftType = approvedAdHoc?.requestedShift || b.shiftType || b.shift || 'Day';
                          const displayTimeSlot = approvedAdHoc?.requestedTime 
                            ? `(${approvedAdHoc.requestedTime} น. - พิเศษ)` 
                            : (b.shiftTimeSlot ? `(${b.shiftTimeSlot})` : '(08:00 - 17:00)');

                          const isAdHocApproved = !!approvedAdHoc;
                          const isDayShift = displayShiftType === 'Day';

                          return (
                            <div key={b.id || bIdx} className="flex justify-between items-start bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">
                                    {bIdx + 1}. {b.employeeName || b.name || b.employeeEmail}
                                  </span>
                                  
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                                    isAdHocApproved
                                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                                      : isDayShift 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' 
                                        : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900'
                                  }`}>
                                    {isAdHocApproved && '⚡ '}
                                    {displayShiftType} {displayTimeSlot}
                                  </span>
                                </div>
                                <span className="block text-[11px] text-slate-400">
                                  {t.pickup} {b.pickupLocation || b.station} ({b.time || ''} น.) | {t.travelDate} {formatThaiDate(b.travelDate || b.date)}
                                </span>
                              </div>
                              <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                                {b.employeePhone || b.phone || '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. ROUTES TAB */}
      {adminTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 h-fit space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{editingRouteId ? t.editRouteTitle : t.addRouteTitle}</h3>
              {editingRouteId && (
                <button type="button" onClick={handleCancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer">{t.cancelEdit}</button>
              )}
            </div>
            <form onSubmit={handleSaveRoute} className="space-y-3 text-xs">
              
              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.selectShift}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRouteShift('Day')}
                    className={`p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                      newRouteShift === 'Day' 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    ☀️ Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRouteShift('Shift')}
                    className={`p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                      newRouteShift === 'Shift' 
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    🌙 Shift
                  </button>
                </div>
              </div>

              <div><label className="block text-slate-400 font-bold mb-1">{t.routeNameLabel}</label><input type="text" placeholder="e.g. Ban Chang Line..." value={newRouteName} onChange={e => setNewRouteName(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">{t.routePlateLabel}</label><input type="text" placeholder="e.g. Fv04..." value={newRoutePlate} onChange={e => setNewRoutePlate(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">{t.driverNameLabel}</label><input type="text" placeholder="Driver name..." value={newRouteDriver} onChange={e => setNewRouteDriver(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-slate-400 font-bold mb-1">{t.driverPhoneLabel}</label><input type="text" placeholder="Phone..." value={newRoutePhone} onChange={e => setNewRoutePhone(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" /></div>
              
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-slate-400 font-bold">{t.setStopsLabel}</label>
                <div className="flex gap-2">
                  <input type="text" placeholder={t.stationNamePlaceholder} value={stationInput} onChange={e => setStationInput(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2 rounded-xl dark:bg-slate-950" />
                  <input type="text" placeholder={t.timePlaceholder} value={timeInput} onChange={e => setTimeInput(e.target.value)} className="w-28 border border-slate-200 dark:border-slate-800 p-2 rounded-xl dark:bg-slate-950" />
                  <button type="button" onClick={handleAddStop} className="bg-slate-200 dark:bg-slate-800 px-3 py-2 rounded-xl font-bold whitespace-nowrap cursor-pointer">{t.addStopBtn}</button>
                </div>
                {stopsList.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {stopsList.map((st, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
                        <span>Stop {idx + 1}: {st.station} ({st.time} น.)</span>
                        <button type="button" onClick={() => handleRemoveStop(idx)} className="text-red-500 font-bold px-1.5 cursor-pointer">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className={`w-full font-bold py-2.5 rounded-xl transition-all shadow cursor-pointer ${editingRouteId ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {editingRouteId ? t.saveEditBtn : t.saveRouteBtn}
              </button>
            </form>
          </div>

          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="font-extrabold text-xs text-slate-600 dark:text-slate-300">{t.filterRoutesByShift}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setAdminRouteFilter('Day')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${adminRouteFilter === 'Day' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                >
                  ☀️ Day ({routesList.filter(r => { const t = r.shiftType || r.shift || 'Day'; return t === 'Day' || t === 'All'; }).length})
                </button>
                <button 
                  onClick={() => setAdminRouteFilter('Shift')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${adminRouteFilter === 'Shift' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                >
                  🌙 Shift ({routesList.filter(r => { const t = r.shiftType || r.shift; return t === 'Shift'; }).length})
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAdminRoutes.length > 0 ? (
                filteredAdminRoutes.map(r => {
                  const currentStops = r.stops || r.stations || [];
                  const isShift = (r.shiftType || r.shift) === 'Shift';
                  return (
                    <div key={r.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex justify-between items-start gap-4 shadow-sm">
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {r.name} 
                          <span className={`ml-2 inline-block text-[10px] px-2 py-0.5 rounded font-bold border ${isShift ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900' : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'}`}>
                            {r.shiftType || r.shift || 'Day'}
                          </span>
                          <span className="block text-slate-400 font-normal text-xs font-mono mt-0.5">{t.plate} {r.plate || r.vanPlate || '-'} · {t.driver} {r.driver || r.driverName || '-'} ({r.phone || '-'})</span>
                        </h4>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {currentStops.map((stop: any, sIdx: number) => (
                            <div key={sIdx} className="bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                              Stop {sIdx + 1}: {stop.stationName || stop.station} <span className="font-mono text-blue-600">{stop.arrivalTime || stop.time} น.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button onClick={() => handleEditRouteClick(r)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs px-2.5 py-1.5 rounded-lg font-bold cursor-pointer">{t.editRouteBtn}</button>
                        <button onClick={() => handleDeleteRoute(r.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs px-2.5 py-1.5 rounded-lg font-bold cursor-pointer">{t.removeRouteBtn}</button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                  {t.noRoutesFound} <span className="font-bold text-slate-600 dark:text-slate-300">({adminRouteFilter})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. ANNOUNCEMENTS TAB */}
      {adminTab === 'announcements' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 h-fit space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.createAnnouncementTitle}</h3>
            <form onSubmit={handleAddAnnouncement} className="space-y-3 text-xs">
              <div><label className="block text-slate-400 font-bold mb-1">{t.announceTitleLabel}</label><input type="text" placeholder="Title..." value={newAnnounceTitle} onChange={e => setNewAnnounceTitle(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">{t.announceContentLabel}</label><textarea placeholder="Details..." value={newAnnounceContent} onChange={e => setNewAnnounceContent(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl h-32 dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl dark:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow cursor-pointer">{t.postAnnouncementBtn}</button>
            </form>
          </div>
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.announceHistoryTitle}</h3>
            {announcementsList.map(a => (
              <div key={a.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-start gap-4 shadow-sm">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white">{a.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">{a.desc || a.content}</p>
                  <span className="block text-[10px] text-slate-400 font-mono">Date: {a.timestamp ? new Date(a.timestamp).toLocaleString('th-TH') : ''} {a.createdBy ? `By: ${a.createdBy}` : ''}</span>
                </div>
                <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-500 hover:bg-red-50 text-xs px-2.5 py-1.5 rounded-lg font-bold cursor-pointer">{t.deleteBtn}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TICKETS TAB */}
      {adminTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.supportChatTitle}</h3>
            <span className="text-xs font-medium text-slate-400">{t.totalCases} {filteredTickets.length} {t.casesUnit}</span>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800/60">
            <button onClick={() => setTicketSubTab('Pending')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${ticketSubTab === 'Pending' ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-sm' : 'text-slate-500'}`}>{t.subTabPending} ({pendingTicketsCount})</button>
            <button onClick={() => setTicketSubTab('Processing')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${ticketSubTab === 'Processing' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}>{t.subTabProcessing} ({processingTicketsCount})</button>
            <button onClick={() => setTicketSubTab('Resolved')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${ticketSubTab === 'Resolved' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>{t.subTabResolved} ({resolvedTicketsCount})</button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTickets.length === 0 ? (
              <div className="p-12 border border-dashed rounded-2xl text-center text-slate-400 border-slate-200 dark:border-slate-800">{t.noTickets}</div>
            ) : (
              filteredTickets.map((ticket) => {
                const isResolved = ticket.status === 'Resolved';
                return (
                  <div key={ticket.id} className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4 ${isResolved ? 'opacity-80' : ''}`}>
                    <div className="flex justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono block">ID: {ticket.id}</span>
                        <h4 className="font-bold text-base">{t.subject} {ticket.subject}</h4>
                        <p className="text-xs text-slate-500">{t.sender} <strong className="text-slate-700 dark:text-slate-200">{ticket.employeeEmail}</strong></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isResolved && <button onClick={() => handleArchiveTicket(ticket.id)} className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-md font-bold cursor-pointer">{t.archiveChatBtn}</button>}
                        <select value={ticket.status} onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value)} className="text-xs font-bold px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                          <option value="Pending">🔴 Pending</option>
                          <option value="Processing">🟡 Processing</option>
                          <option value="Resolved">🟢 Resolved</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-3 max-h-64 overflow-y-auto">
                      {ticket.messages?.map((msg: any, mIdx: number) => (
                        <div key={mIdx} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-slate-400 mb-0.5">{msg.sender === 'admin' ? `Admin` : 'Employee'}</span>
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${msg.sender === 'admin' ? 'bg-slate-900 text-white dark:bg-blue-600 rounded-tr-none' : 'bg-white dark:bg-slate-800 rounded-tl-none border border-slate-200 dark:border-slate-700'}`}>{msg.text}</div>
                        </div>
                      ))}
                    </div>
                    {!isResolved && (
                      <div className="flex gap-2">
                        <input type="text" placeholder={t.typeReplyPlaceholder} value={replyMessages[ticket.id] || ''} onChange={(e) => setReplyMessages(prev => ({ ...prev, [ticket.id]: e.target.value }))} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs dark:bg-slate-950" />
                        <button onClick={() => handleReplyTicketChat(ticket.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-xs font-bold cursor-pointer">{t.sendChatBtn}</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. CANCELLATION TAB */}
      {adminTab === 'cancellation' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{t.cancellationTitle}</h3>
            <span className="text-xs text-slate-400">{t.totalCases} {combinedCancelRequests.length} {t.casesUnit}</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {combinedCancelRequests.length === 0 ? (
              <div className="p-12 border border-dashed rounded-2xl text-center text-slate-400 border-slate-200 dark:border-slate-800">{t.noCancelRequests}</div>
            ) : (
              combinedCancelRequests.map((req) => (
                <div key={req.id} className="p-5 rounded-2xl border border-red-200 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-mono block">ID: {req.id}</span>
                      <h4 className="font-bold text-base">🎫 Cancel: Route {req.route || req.subject || '-'}</h4>
                      <p className="text-xs text-slate-500">{t.sender} <strong>{req.employeeName || req.employeeEmail}</strong></p>
                    </div>
                    <button onClick={() => handleApproveCancellation(req.id, req.bookingId)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">{t.approveDeleteTicket}</button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t.reasonSpecified}</span>
                    <p className="text-xs bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">{req.reason || req.message || 'Unspecified'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6. AD-HOC REQUESTS TAB */}
      {adminTab === 'adhoc' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{t.adhocTitle}</h3>
            <span className="text-xs text-slate-400">{t.totalCases} {adHocRequestsList.length} {t.casesUnit}</span>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800/60">
            <button onClick={() => setAdhocSubTab('All')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adhocSubTab === 'All' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>{t.allRequests} ({adHocRequestsList.length})</button>
            <button onClick={() => setAdhocSubTab('Pending')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adhocSubTab === 'Pending' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}>{t.subTabPending} ({pendingAdHocCount})</button>
            <button onClick={() => setAdhocSubTab('Approved')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adhocSubTab === 'Approved' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>{t.approvedStatus} ({approvedAdHocCount})</button>
            <button onClick={() => setAdhocSubTab('Rejected')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${adhocSubTab === 'Rejected' ? 'bg-white dark:bg-slate-900 text-red-600 shadow-sm' : 'text-slate-500'}`}>{t.rejectedStatus} ({rejectedAdHocCount})</button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAdHocList.length === 0 ? (
              <div className="p-12 border border-dashed rounded-2xl text-center text-slate-400 border-slate-200 dark:border-slate-800">{t.noAdhocRequests}</div>
            ) : (
              filteredAdHocList.map((req) => {
                const status = req.status || 'Pending';
                const isRejectingThis = rejectingId === req.id;

                return (
                  <div key={req.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                    <div className="flex justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono block">ID: {req.id}</span>
                        <h4 className="font-bold text-base text-blue-600 dark:text-blue-400">Employee: {req.employeeName || req.employeeEmail}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{t.requestDate} <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatThaiDate(req.requestDate)}</strong></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'Pending' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleApproveAdHoc(req.id, 'Approved')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">{t.approveBtn}</button>
                            <button onClick={() => setRejectingId(isRejectingThis ? null : req.id)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer">{t.rejectBtn}</button>
                          </div>
                        ) : (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'}`}>
                            {status === 'Approved' ? t.approvedStatus : t.rejectedStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{t.normalShift}</span>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{req.originalShift || '-'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{t.requestedExitTime}</span>
                        <p className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 text-sm">{req.requestedTime || '-'} น.</p>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">{t.employeeReason}</span>
                        <p className="text-slate-700 dark:text-slate-300 mt-1 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">{req.reason || 'Unspecified'}</p>
                      </div>

                      {status === 'Rejected' && req.adminRejectReason && (
                        <div className="sm:col-span-2 pt-2 border-t border-red-200 dark:border-red-950">
                          <span className="text-[10px] font-bold text-red-500 uppercase block">Rejection Reason:</span>
                          <p className="text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">{req.adminRejectReason}</p>
                        </div>
                      )}
                    </div>

                    {isRejectingThis && status === 'Pending' && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl space-y-3">
                        <label className="block text-xs font-bold text-red-600 dark:text-red-400">{t.rejectReasonPrompt}</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Staff shortage, Invalid info..." 
                          value={rejectReasonInputs[req.id] || ''} 
                          onChange={(e) => setRejectReasonInputs({ ...rejectReasonInputs, [req.id]: e.target.value })} 
                          className="w-full border border-red-300 dark:border-red-800 p-2.5 rounded-xl text-xs bg-white dark:bg-slate-900"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-800 rounded-lg font-bold cursor-pointer">{t.cancelEdit}</button>
                          <button onClick={() => handleApproveAdHoc(req.id, 'Rejected')} className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow cursor-pointer">{t.confirmRejectBtn}</button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}