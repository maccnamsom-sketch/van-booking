'use client';

import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';

interface UserViewProps {
  db: any;
  user: any;
  theme: any;
  activeMenu: 'home' | 'booking' | 'history' | 'qrcode' | 'admin';
  setActiveMenu: (menu: any) => void;
  routesList: any[];
  bookingsList: any[];
  announcementsList: any[];
  recentBooking: any;
  setRecentBooking: (booking: any) => void;
  showAlert: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => void;
  supportTicketsList: any[];
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
  supportTicketsList 
}: UserViewProps) {
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketFirstMessage, setTicketFirstMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  // State สำหรับกรองประวัติการจอง
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
  const [, setActiveChatTicketId] = useState<string | null>(null);

  // State สำหรับระบบกะและการจองรถตู้
  const [shiftType, setShiftType] = useState<'Day' | 'Shift'>('Day');
  const [shiftTimeSlot, setShiftTimeSlot] = useState<string>('08:00 - 17:00');
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  
  // กรองสายรถตามกะที่เลือก (รองรับ field shiftType ของสายรถ เช่น 'Day', 'Shift' หรือถ้าไม่ระบุให้ถือว่าใช้ได้ทุกกะ)
  const filteredRoutesList = routesList.filter(r => {
    if (!r.shiftType || r.shiftType === 'All' || r.shiftType === ' ทุกกะ') return true;
    return r.shiftType === shiftType;
  });

  const [selectedRouteId, setSelectedRouteId] = useState(filteredRoutesList[0]?.id || routesList[0]?.id || '');
  const [selectedRouteName, setSelectedRouteName] = useState(filteredRoutesList[0]?.name || routesList[0]?.name || '');
  const [, setSelectedRouteMaxSeats] = useState(filteredRoutesList[0]?.totalSeats || routesList[0]?.totalSeats || 14);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [travelDate, setTravelDate] = useState('');

  const todayStr = getTodayDateString();
  const summaryBookings = bookingsList.filter(b => b.travelDate === selectedSummaryDate);
  const myBookings = bookingsList.filter(b => b.employeeEmail === (user?.email || 'employee@company.com'));

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

  const currentActiveRoute = filteredRoutesList.find(r => r.id === selectedRouteId) || filteredRoutesList[0] || routesList[0];
  const getRouteStations = (route: any) => {
    if (!route) return [];
    return route.stops || route.stations || [];
  };

  const checkCutoffTimeAndAdjustDate = (inputDate: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const cutoffTimeInMinutes = 15 * 60; // 15.00 น.

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

  const activeStations = getRouteStations(currentActiveRoute);

  return (
    <div className="text-sm text-slate-800 dark:text-slate-100">
      
      {/* 1. HOME TAB */}
      {activeMenu === 'home' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 md:p-10 rounded-2xl text-white shadow-xl border border-slate-800">
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-white/20 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-md border border-white/10">Central Transport Hub</span>
                <button 
                  onClick={() => setShowSummaryModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full transition-all shadow-md flex items-center gap-1 cursor-pointer"
                >
                  🔍 ตรวจสอบรายชื่อผู้เดินทางประจำวัน ({bookingsList.filter(b => b.travelDate === todayStr).length} ท่าน)
                </button>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-2 text-white">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</h2>
              <p className="text-xs text-slate-100 font-medium leading-relaxed opacity-90">ระบบสารสนเทศสำหรับการตรวจสอบข้อมูลเดินรถ ตารางเวลาสถานีรับส่ง และลงทะเบียนเพื่อสำรองที่นั่งพนักงานส่วนกลางขององค์กร (ตัดรอบจองเวลา 15.00 น.)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">ประกาศสำคัญจากฝ่ายธุรการ</h3>
            </div>
            {announcementsList.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {announcementsList.map(a => (
                  <div key={a.id} className="p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">{a.title}</h4>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700">
                        {new Date(a.timestamp).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                    {a.desc && <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{a.desc}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-xl text-slate-400 dark:text-slate-500 dark:border-slate-800">ไม่มีประกาศใหม่ในขณะนี้</div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">HELP & SUPPORT (ติดต่อ/แจ้งปัญหาถึงแอดมิน)</h3>
            </div>
            <form onSubmit={handleSendTicket} className="p-6 rounded-xl border bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">พบปัญหาการใช้งาน, แจ้งยกเลิกรอบรถกะทันหัน หรือติดต่อแอดมิน สามารถพิมพ์หัวข้อเพื่อเปิดเรื่องและเริ่มแชทคุยกับเจ้าหน้าที่</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">หัวข้อเรื่องที่ต้องการแจ้ง</label>
                  <input 
                    type="text" 
                    placeholder="เช่น แจ้งลืมของบนรถสาย 1" 
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">รายละเอียดข้อความแรก</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="อธิบายรายละเอียดปัญหาเริ่มต้นของคุณ..." 
                      value={ticketFirstMessage}
                      onChange={(e) => setTicketFirstMessage(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button 
                      type="submit" 
                      disabled={isSubmittingTicket}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingTicket ? 'กำลังเปิด...' : 'เริ่มคุย'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. BOOKING TAB (ระบบสำรองที่นั่งเลือกกะ Day/Shift รองรับหลายวัน และกรองสายรถตามกะอัตโนมัติ) */}
      {activeMenu === 'booking' && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-800 dark:text-white">
          <div className="bg-slate-950 text-white p-5 text-center border-b border-slate-800">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Seat Reservation</span>
            <h3 className="text-sm font-bold uppercase tracking-wider mt-0.5">ระบบสำรองสิทธิ์เดินทาง</h3>
            <p className="text-[10px] text-amber-400 mt-1">⚠️ ตัดรอบจองเวลา 15:00 น. ของทุกวัน</p>
            <div className="flex justify-center items-center gap-3 mt-3 text-[11px] font-bold">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 1 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>1</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 2 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>2</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 3 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>3</span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* ขั้นตอนที่ 1: เลือกประเภทกะ และช่วงเวลา + เลือกสายรถที่กรองแล้ว */}
            {bookingStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">1.1 เลือกประเภทกะ และช่วงเวลาทำงาน</label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setShiftType('Day');
                        setShiftTimeSlot('08:00 - 17:00');
                        // รีเซ็ตค่าสายรถไปที่ตัวแรกของกะ Day ที่กรองได้
                        const newFiltered = routesList.filter(r => !r.shiftType || r.shiftType === 'All' || r.shiftType === 'Day');
                        if (newFiltered.length > 0) {
                          setSelectedRouteId(newFiltered[0].id);
                          setSelectedRouteName(newFiltered[0].name);
                          setSelectedRouteMaxSeats(newFiltered[0].totalSeats || 14);
                        }
                        setSelectedStationIndex(0);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${shiftType === 'Day' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      ☀️ กะ Day
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setShiftType('Shift');
                        setShiftTimeSlot('06:00 - 18:30');
                        // รีเซ็ตค่าสายรถไปที่ตัวแรกของกะ Shift ที่กรองได้
                        const newFiltered = routesList.filter(r => !r.shiftType || r.shiftType === 'All' || r.shiftType === 'Shift');
                        if (newFiltered.length > 0) {
                          setSelectedRouteId(newFiltered[0].id);
                          setSelectedRouteName(newFiltered[0].name);
                          setSelectedRouteMaxSeats(newFiltered[0].totalSeats || 14);
                        }
                        setSelectedStationIndex(0);
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${shiftType === 'Shift' ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      🌙 กะ Shift
                    </button>
                  </div>

                  {shiftType === 'Day' ? (
                    <div className="p-3 bg-blue-50/40 dark:bg-slate-950 rounded-xl border border-blue-100 dark:border-slate-800">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">ช่วงเวลาทำงาน (กะ Day):</p>
                      <div className="text-xs font-bold bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400">
                        เข้างาน 08:00 น. / เลิกงาน 17:00 น.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">เลือกช่วงเวลากะ Shift:</p>
                      <div className="grid grid-cols-1 gap-2">
                        <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs font-semibold ${shiftTimeSlot === '06:00 - 18:30' ? 'border-purple-600 bg-purple-50/30 dark:bg-purple-950/20 text-purple-600' : 'border-slate-200 dark:border-slate-800'}`}>
                          <input 
                            type="radio" 
                            name="shiftSlot" 
                            checked={shiftTimeSlot === '06:00 - 18:30'} 
                            onChange={() => setShiftTimeSlot('06:00 - 18:30')} 
                          />
                          ช่วงที่ 1: เข้า 06:00 น. / ออก 18:30 น.
                        </label>
                        <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs font-semibold ${shiftTimeSlot === '18:00 - 06:30' ? 'border-purple-600 bg-purple-50/30 dark:bg-purple-950/20 text-purple-600' : 'border-slate-200 dark:border-slate-800'}`}>
                          <input 
                            type="radio" 
                            name="shiftSlot" 
                            checked={shiftTimeSlot === '18:00 - 06:30'} 
                            onChange={() => setShiftTimeSlot('18:00 - 06:30')} 
                          />
                          ช่วงที่ 2: เข้า 18:00 น. / ออก 06:30 น.
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">1.2 เลือกสายรถตู้สวัสดิการ ({shiftType})</label>
                    <span className="text-[10px] text-slate-400">พบ {filteredRoutesList.length} สายรถ</span>
                  </div>
                  
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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
                          className={`p-3.5 border rounded-xl cursor-pointer transition-all ${selectedRouteId === r.id ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/25 ring-1 ring-blue-600' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-slate-900 dark:text-white text-xs">{r.name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {r.shiftType || 'ทุกกะ'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">ทะเบียน: {r.plate || r.vanPlate} · คนขับ: {r.driver || r.driverName}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                        ไม่พบสายรถสำหรับ {shiftType} ในระบบขณะนี้
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (filteredRoutesList.length === 0) {
                      showAlert('warning', 'ไม่พบสายรถ', 'กรุณาเลือกกะที่มีสายรถให้บริการ');
                      return;
                    }
                    setBookingStep(2);
                  }} 
                  className="w-full bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-center mt-2 cursor-pointer text-xs"
                >
                  ขั้นตอนถัดไป (กรอกข้อมูลส่วนตัว & จุดขึ้นรถ) →
                </button>
              </div>
            )}

            {/* ขั้นตอนที่ 2: กรอกข้อมูลส่วนตัว, จุดขึ้นรถ, วันที่เดินทาง */}
            {bookingStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/30 dark:bg-slate-950 rounded-xl border border-blue-100 dark:border-slate-800 space-y-3">
                  <span className="block text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">ข้อมูลผู้เดินทาง (ข้อมูลติดต่อสำหรับคนขับ)</span>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">ชื่อ - นามสกุล พนักงาน</label>
                    <input 
                      type="text" 
                      placeholder="กรอกชื่อ-นามสกุลจริง" 
                      value={employeeName} 
                      onChange={(e) => setEmployeeName(e.target.value)} 
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">เบอร์โทรศัพท์ที่ติดต่อได้</label>
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
                  <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">สถานีจุดจอดรับและตารางเวลา</label>
                  <select 
                    value={selectedStationIndex} 
                    onChange={(e) => setSelectedStationIndex(Number(e.target.value))} 
                    className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-500 text-xs"
                  >
                    {activeStations.map((st: any, i: number) => (
                      <option key={i} value={i} className="dark:bg-slate-950">สถานี: {st.stationName || st.name} ({st.arrivalTime || st.time} น.)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">ระบุวันที่ต้องการเดินทาง (เพิ่มได้หลายวัน)</label>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      id="multiDateInput"
                      className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-500 text-xs" 
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
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      + เพิ่มวัน
                    </button>
                  </div>
                </div>

                {travelDate && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">วันที่เลือกไว้แล้ว:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {travelDate.split(',').map((d: string, idx: number) => (
                        <span key={idx} className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          {d.trim()}
                          <button 
                            type="button"
                            onClick={() => {
                              const list = travelDate.split(',').map((item: string) => item.trim()).filter((item: string) => item !== d.trim());
                              setTravelDate(list.join(','));
                            }}
                            className="text-rose-500 hover:text-rose-700 font-black cursor-pointer"
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
                    className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    ← ย้อนกลับ
                  </button>
                  <button 
                    onClick={() => {
                      if (!travelDate) {
                        showAlert('warning', 'ยังไม่ได้เลือกวันที่', 'กรุณาเพิ่มวันที่ต้องการเดินทางอย่างน้อย 1 วัน');
                        return;
                      }
                      setBookingStep(3);
                    }} 
                    className="w-2/3 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    ตรวจสอบข้อมูลก่อนจอง →
                  </button>
                </div>
              </div>
            )}

            {/* ขั้นตอนที่ 3: สรุปข้อมูลก่อนกดยืนยัน */}
            {bookingStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <span className="block font-black uppercase text-blue-600 dark:text-blue-400 mb-2">🔍 สรุปข้อมูลการสำรองที่นั่ง</span>
                  <p><strong>ประเภทกะ:</strong> {shiftType === 'Day' ? '☀️ กะ Day' : '🌙 กะ Shift'} ({shiftTimeSlot})</p>
                  <p><strong>เส้นทาง:</strong> {selectedRouteName}</p>
                  <p><strong>ชื่อพนักงาน:</strong> {employeeName}</p>
                  <p><strong>เบอร์โทร:</strong> {employeePhone}</p>
                  <p><strong>จุดขึ้นรถ:</strong> {activeStations[selectedStationIndex]?.stationName || activeStations[selectedStationIndex]?.name} ({activeStations[selectedStationIndex]?.arrivalTime || activeStations[selectedStationIndex]?.time} น.)</p>
                  <p><strong>วันที่เดินทางทั้งหมด:</strong> {travelDate}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setBookingStep(2)} 
                    className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    ← แก้ไข
                  </button>
                  <button 
                    onClick={async () => {
                      if (!currentActiveRoute || !travelDate || !employeeName || !employeePhone) {
                        showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'โปรดกรอกชื่อ เบอร์โทรศัพท์ และระบุวันเดินทางก่อนดำเนินการ');
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
                            pickupLocation: targetStation?.stationName || targetStation?.name || 'ไม่ระบุ', 
                            time: targetStation?.arrivalTime || targetStation?.time || 'ไม่ระบุ',
                            driverName: currentActiveRoute.driver || currentActiveRoute.driverName || 'ไม่ระบุ', 
                            vanPlate: currentActiveRoute.plate || currentActiveRoute.vanPlate || 'ไม่ระบุ',
                            travelDate: adjustedDate, 
                            shiftType,
                            shiftTimeSlot,
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
                            vanPlate: currentActiveRoute.plate || currentActiveRoute.vanPlate || 'ไม่ระบุ' 
                          });
                        }

                        showAlert('success', 'สำรองที่นั่งสำเร็จทุกวัน', 'ระบบบันทึกรายการจองตามวันที่คุณเลือกทั้งหมดเรียบร้อย', () => {
                          setActiveMenu('qrcode');
                          setBookingStep(1);
                        });
                      } catch {
                        showAlert('error', 'เกิดข้อผิดพลาด', 'ระบบขัดข้องในการเชื่อมต่อฐานข้อมูล');
                      } finally { 
                        setIsBookingLoading(false); 
                      }
                    }} 
                    disabled={isBookingLoading} 
                    className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isBookingLoading ? 'กำลังบันทึก...' : 'ยืนยันสำรองสิทธิ์หลายวัน ✓'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. HISTORY TAB */}
      {activeMenu === 'history' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">ประวัติการจอง</h3>
            <span className="text-[11px] text-slate-500">ทั้งหมด {myBookings.length} รายการ</span>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-500 mb-1">กรองตามวันที่เดินทาง</label>
              <input 
                type="date"
                value={historyFilterDate}
                onChange={(e) => setHistoryFilterDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">กรองตามสายรถ</label>
              <select
                value={historyFilterRoute}
                onChange={(e) => setHistoryFilterRoute(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- ทุกสายรถ --</option>
                {routesList.map((r: any) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((b: any, idx: number) => (
                <div key={idx} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">🚐 {b.route}</span>
                      <span className="text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-600 px-2 py-0.5 rounded font-bold">กะ {b.shiftType}: {b.shiftTimeSlot}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">จุดรับ: {b.pickupLocation} ({b.time} น.) | ทะเบียนรถ: {b.vanPlate}</p>
                    <p className="text-[11px] text-slate-400 font-mono">วันที่เดินทาง: {formatThaiDate(b.travelDate)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button 
                      onClick={() => {
                        setRecentBooking(b);
                        setActiveMenu('qrcode');
                      }}
                      className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      📱 ดู QR Code
                    </button>
                    <span className="text-[10px] font-bold px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                      ยืนยันแล้ว
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border border-dashed rounded-xl text-slate-400 dark:text-slate-500 dark:border-slate-800">
                ไม่พบประวัติการจองตามเงื่อนไขที่เลือก
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. QRCODE TAB */}
      {activeMenu === 'qrcode' && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Check-in Pass</span>
            <h3 className="font-bold text-sm mt-0.5">คิวอาร์โค้ดสำหรับเช็คอินขึ้นรถ</h3>
          </div>
          {recentBooking ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">แสดงคิวอาร์โค้ดนี้ให้คนขับรถสแกนเมื่อถึงจุดรับ</p>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(recentBooking.id || 'NO_ID')}`} 
                  alt="QR Code" 
                  className="mx-auto rounded-lg shadow-sm"
                />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>พนักงาน:</strong> {recentBooking.employeeName}</p>
                <p><strong>สายรถ:</strong> {recentBooking.route}</p>
                <p><strong>กะ:</strong> {recentBooking.shiftType} ({recentBooking.shiftTimeSlot})</p>
                <p><strong>วันที่:</strong> {recentBooking.travelDate}</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-slate-400 text-xs">
              ยังไม่มีข้อมูลการจองล่าสุดสำหรับสร้างคิวอาร์โค้ด กรุณาทำรายการจองก่อนครับ
            </div>
          )}
        </div>
      )}

      {/* 5. MODAL รายชื่อผู้เดินทางประจำวัน */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                🟢 รายชื่อพนักงานที่ขึ้นรถวันที่ <span className="text-blue-600 dark:text-blue-400 font-mono">{formatThaiDate(selectedSummaryDate)}</span>
              </h3>
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  value={selectedSummaryDate}
                  onChange={(e) => setSelectedSummaryDate(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] px-2.5 py-1 rounded-xl font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
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
                <div className="py-12 text-center text-slate-400">📭 ไม่มีรายชื่อพนักงานที่ลงทะเบียนเดินทางในวันที่ {formatThaiDate(selectedSummaryDate)}</div>
              ) : (
                routesList.map((route: any) => {
                  const routeBookings = summaryBookings.filter((b: any) => b.route === route.name);
                  return (
                    <div key={route.id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                        <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1.5">
                          🚐 {route.name} <span className="text-[10px] text-slate-400 font-normal">({routeBookings.length} ท่าน)</span>
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">ทะเบียน: {route.plate || route.vanPlate || 'ไม่ระบุ'}</span>
                      </div>

                      {routeBookings.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-1 italic">ไม่มีผู้โดยสารในสายนี้วันนี้</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {routeBookings.map((b: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 flex justify-between items-center gap-2">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                  {b.employeeName} 
                                  <span className="text-[9px] text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-1 py-0.2 rounded">กะ {b.shiftType}</span>
                                </p>
                                <p className="text-[10px] text-slate-400">จุดรับ: {b.pickupLocation}</p>
                              </div>
                              <span className="font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 px-2 py-0.5 rounded-lg text-[11px] whitespace-nowrap">
                                {b.time} น.
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={() => setShowSummaryModal(false)}
              className="w-full bg-slate-900 dark:bg-blue-600 text-white font-bold py-2.5 rounded-2xl cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}