'use client';

import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';

interface StationTime {
  stationName: string;
  arrivalTime: string;
}

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

export default function UserView({ db, user, theme, activeMenu, setActiveMenu, routesList, bookingsList, announcementsList, recentBooking, setRecentBooking, showAlert, supportTicketsList }: UserViewProps) {
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // States สำหรับระบบแจ้งปัญหาแบบ Chat
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketFirstMessage, setTicketFirstMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [replyMessages, setReplyMessages] = useState<{ [ticketId: string]: string }>({}); 
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  // State สำหรับเปิด-ปิดหน้าต่างแชทของตั๋วที่เลือก
  const [activeChatTicketId, setActiveChatTicketId] = useState<string | null>(null);

  // States สำหรับขอยกเลิกตั๋ว
  const [cancelingTicketId, setCancelingTicketId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // User Reservation States
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(routesList[0]?.id || '');
  const [selectedRouteName, setSelectedRouteName] = useState(routesList[0]?.name || '');
  const [selectedRouteMaxSeats, setSelectedRouteMaxSeats] = useState(routesList[0]?.totalSeats || 14);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [travelDate, setTravelDate] = useState('');

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayDateString();
  const todayBookings = bookingsList.filter(b => b.travelDate === todayStr);

  const getBookedSeatsCount = (routeName: string, date: string) => {
    return bookingsList.filter(b => b.route === routeName && b.travelDate === date).length;
  };

  const currentActiveRoute = routesList.find(r => r.id === selectedRouteId) || routesList[0];
  const currentTotalBooked = travelDate ? getBookedSeatsCount(selectedRouteName, travelDate) : 0;
  const currentAvailableSeats = selectedRouteMaxSeats - currentTotalBooked;

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
        messages: [
          {
            sender: 'user',
            text: ticketFirstMessage,
            timestamp: new Date().toISOString()
          }
        ]
      });

      showAlert('success', 'เปิดฟอร์มแจ้งเรื่องเรียบร้อย', 'คุณสามารถแตะเพื่อคุยรายละเอียดเพิ่มเติมได้ทันที');
      setTicketSubject('');
      setTicketFirstMessage('');
      setActiveChatTicketId(docRef.id);
    } catch (error) {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถสร้างรายการแจ้งปัญหาได้');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    const textToReply = replyMessages[ticketId]?.trim();
    if (!textToReply) return;

    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'Pending', 
        messages: arrayUnion({
          sender: 'user',
          text: textToReply,
          timestamp: new Date().toISOString()
        })
      });
      setReplyMessages(prev => ({ ...prev, [ticketId]: '' }));
    } catch (error) {
      showAlert('error', 'ส่งข้อความล้มเหลว', 'ไม่สามารถส่งข้อความตอบกลับได้ในขณะนี้');
    }
  };

  const handleRequestCancelTicket = async (ticketId: string) => {
    if (!cancelReason.trim()) {
      showAlert('warning', 'กรุณาระบุเหตุผล', 'โปรดระบุรายละเอียดเหตุผลที่ต้องการยกเลิกคำร้องนี้');
      return;
    }

    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'CancelRequested',
        cancelReason: cancelReason.trim(),
        messages: arrayUnion({
          sender: 'user',
          text: `[ขอยกเลิกเรื่องนี้] เหตุผล: ${cancelReason.trim()}`,
          timestamp: new Date().toISOString()
        })
      });
      showAlert('success', 'ส่งคำขอยกเลิกแล้ว', 'ระบบได้ส่งเรื่องขอยกเลิกไปยังแอดมินเพื่อดำเนินการลบเรียบร้อย');
      setCancelingTicketId(null);
      setCancelReason('');
      setActiveChatTicketId(null);
    } catch (error) {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถส่งคำขอยกเลิกได้ในขณะนี้');
    }
  };

  const handleCreateBooking = async () => {
    if (!currentActiveRoute || !travelDate || !employeeName || !employeePhone) {
      showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'โปรดกรอกชื่อ เบอร์โทรศัพท์ และระบุวันเดินทางก่อนดำเนินการ');
      return;
    }

    const targetStation = currentActiveRoute.stations[selectedStationIndex];
    const currentEmployeeEmail = user?.email || 'employee@company.com';

    const hasAlreadyBooked = bookingsList.some(b => 
      b.employeeEmail === currentEmployeeEmail && b.route === selectedRouteName && b.travelDate === travelDate
    );

    if (hasAlreadyBooked) {
      showAlert('warning', 'ลงทะเบียนซ้ำซ้อน', 'คุณมีรายการสำรองที่นั่งในเส้นทางนี้เรียบร้อยแล้ว');
      return;
    }

    if (currentAvailableSeats <= 0) {
      showAlert('error', 'สิทธิ์เต็มจำนวน', 'ขออภัย จำนวนที่นั่งในรอบการเดินทางนี้เต็มโควตาแล้ว');
      return;
    }

    setIsBookingLoading(true);
    try {
      const bookingData = {
        employeeEmail: currentEmployeeEmail, employeeName, employeePhone,
        route: selectedRouteName, pickupLocation: targetStation.stationName, time: targetStation.arrivalTime,
        driverName: currentActiveRoute.driverName || 'ไม่ระบุ', vanPlate: currentActiveRoute.vanPlate || 'ไม่ระบุ',
        travelDate, seatsCount: 1, status: 'Confirmed', timestamp: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'van_bookings'), bookingData);
      setRecentBooking({ id: docRef.id, ...bookingData });
      
      showAlert('success', 'สำรองที่นั่งเสร็จสิ้น', 'ระบบลงทะเบียนชื่อและเบอร์โทรของคุณเรียบร้อย', () => {
        setActiveMenu('qrcode');
        setBookingStep(1);
      });
    } catch {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ระบบขัดข้องในการเชื่อมต่อฐานข้อมูล');
    } finally { setIsBookingLoading(false); }
  };

  const myTickets = supportTicketsList?.filter(t => t.employeeEmail === (user?.email || 'employee@company.com')) || [];
  const selectedTicket = myTickets.find(t => t.id === activeChatTicketId);

  return (
    <div className="text-sm text-slate-800 dark:text-slate-100">
      {/* HOME TAB */}
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
                  🔍 ตรวจสอบรายชื่อผู้เดินทางวันนี้ ({todayBookings.length} ท่าน)
                </button>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-2 text-white">ระบบจองรถตู้พนักงานบริษัท แอร์โรเฟลกซ์ จำกัด</h2>
              <p className="text-xs text-slate-100 font-medium leading-relaxed opacity-90">ระบบสารสนเทศสำหรับการตรวจสอบข้อมูลเดินรถ ตารางเวลาสถานีรับส่ง และลงทะเบียนเพื่อสำรองที่นั่งพนักงานส่วนกลางขององค์กร</p>
            </div>
          </div>

          {/* ประกาศข่าวสาร */}
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

          {/* ฟอร์มเปิดตั๋วแจ้งปัญหา */}
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

            {/* รายการตั๋วแบบการ์ดกระชับ พร้อมปุ่ม "แตะเพื่อคุย" และ "ขอยกเลิก" */}
            <div className="space-y-3 mt-6">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">📋 รายการเรื่องที่คุณเคยแจ้งไว้</h4>
              <div className="grid grid-cols-1 gap-3">
                {myTickets.length > 0 ? (
                  myTickets.map(ticket => (
                    <div key={ticket.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">📌 เรื่อง: {ticket.subject}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                            ticket.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                            ticket.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400' :
                            ticket.status === 'CancelRequested' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}>
                            {ticket.status === 'Pending' ? '🔴 รอดำเนินการ' : 
                             ticket.status === 'Processing' ? '🟡 กำลังตรวจสอบ' : 
                             ticket.status === 'CancelRequested' ? '⚠️ รอยกเลิกคำร้อง' : '🟢 แก้ไขเรียบร้อย'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">ID: {ticket.id}</p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        {ticket.status !== 'CancelRequested' && (
                          <button 
                            onClick={() => setCancelingTicketId(ticket.id)}
                            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold px-3 py-2 rounded-xl text-xs transition-all border border-rose-200 dark:border-rose-900 whitespace-nowrap cursor-pointer"
                          >
                            ❌ ขอยกเลิกเรื่อง
                          </button>
                        )}
                        <button 
                          onClick={() => setActiveChatTicketId(ticket.id)}
                          className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold px-4 py-2 rounded-xl text-xs transition-all border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          💬 แตะเพื่อคุย / เปิดแชท
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border border-dashed rounded-xl text-slate-400 dark:text-slate-500 dark:border-slate-800 text-xs">
                    คุณยังไม่เคยส่งรายการแจ้งปัญหาในระบบ
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal แสดงรายชื่อผู้เดินทางวันนี้ */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                🟢 รายชื่อผู้เดินทางวันนี้ <span className="text-[11px] font-normal text-slate-400">({todayStr})</span>
              </h3>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {todayBookings.length === 0 ? (
                <div className="py-10 text-center text-slate-400">📭 ไม่มีรายชื่อพนักงานที่ลงทะเบียนเดินทางในวันนี้</div>
              ) : (
                todayBookings.map((b: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{b.employeeName}</p>
                      <p className="text-[10px] text-slate-400">สาย: <span className="text-blue-600 font-semibold">{b.route}</span> | จุดรับ: {b.pickupLocation}</p>
                    </div>
                    <span className="font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 px-2 py-1 rounded-xl">
                      {b.time} น.
                    </span>
                  </div>
                ))
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

      {/* Modal ยืนยันขอยกเลิกตั๋วพร้อมระบุเหตุผล */}
      {cancelingTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">❌ ระบุเหตุผลที่ต้องการยกเลิกคำร้องนี้</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">กรุณากรอกรายละเอียดเหตุผลเพื่อให้แอดมินทราบก่อนส่งคำขอยกเลิกและลบเคส</p>
            <textarea 
              rows={3}
              placeholder="เช่น แจ้งเรื่องผิดรอบ / ได้รับความช่วยเหลือแล้ว / อื่นๆ..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-xs focus:outline-none focus:border-rose-500"
            />
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => { setCancelingTicketId(null); setCancelReason(''); }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button 
                onClick={() => handleRequestCancelTicket(cancelingTicketId)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-bold shadow cursor-pointer"
              >
                ยืนยันขอยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* หน้าต่าง Modal แชทเฉพาะกิจ (เด้งขึ้นมาเมื่อกดแตะเพื่อคุย) */}
      {activeChatTicketId && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Header ของ Modal แชท */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm">💬 แชท: {selectedTicket.subject}</h3>
                <span className="text-[10px] text-slate-400 font-mono">ID: {selectedTicket.id}</span>
              </div>
              <button 
                onClick={() => setActiveChatTicketId(null)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>

            {/* ส่วนกล่องข้อความแชทข้างใน */}
            <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 overflow-y-auto space-y-3 min-h-[300px] max-h-[45vh]">
              {selectedTicket.messages && Array.isArray(selectedTicket.messages) ? (
                selectedTicket.messages.map((msg: any, mIdx: number) => {
                  const isMe = msg.sender === 'user';
                  return (
                    <div key={mIdx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] text-slate-400 mb-0.5 font-bold px-1">
                        {isMe ? 'คุณ (พนักงาน)' : '💁‍♂️ แอดมิน/เจ้าหน้าที่'}
                      </span>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs font-medium shadow-sm ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`text-[8px] font-mono mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติข้อความ</div>
              )}
            </div>

            {/* ช่องพิมพ์ข้อความตอบกลับด้านล่างใน Modal */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <input 
                type="text" 
                placeholder="พิมพ์ข้อความตอบกลับแอดมินที่นี่..."
                value={replyMessages[selectedTicket.id] || ''}
                onChange={(e) => setReplyMessages(prev => ({ ...prev, [selectedTicket.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleReplyTicket(selectedTicket.id); }}
                className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
              <button 
                type="button"
                onClick={() => handleReplyTicket(selectedTicket.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-xs font-bold transition-all shadow whitespace-nowrap cursor-pointer"
              >
                ส่ง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BOOKING TAB */}
      {activeMenu === 'booking' && (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-800 dark:text-white">
          <div className="bg-slate-950 text-white p-5 text-center border-b border-slate-800">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Seat Reservation</span>
            <h3 className="text-sm font-bold uppercase tracking-wider mt-0.5">ระบบสำรองสิทธิ์เดินทาง</h3>
            <div className="flex justify-center items-center gap-3 mt-4 text-[11px] font-bold">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 1 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>1</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 2 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>2</span>
              <span className="w-6 h-[1px] bg-slate-800"></span>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${bookingStep === 3 ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-700 text-slate-400'}`}>3</span>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {bookingStep === 1 && (
              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">ส่วนที่ 1: เลือกเส้นทางรถตู้สวัสดิการ</label>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {routesList.map(r => (
                    <div key={r.id} onClick={() => { 
                      setSelectedRouteId(r.id); setSelectedRouteName(r.name); 
                      setSelectedRouteMaxSeats(r.totalSeats || 14); setSelectedStationIndex(0);
                    }} className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedRouteId === r.id ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{r.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ยานพาหนะ: {r.vanPlate} · คนขับ: {r.driverName}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setBookingStep(2)} className="w-full bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-center mt-2 cursor-pointer">ขั้นตอนถัดไป (เลือกจุดขึ้นรถ) →</button>
              </div>
            )}

            {bookingStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/30 dark:bg-slate-950 rounded-xl border border-blue-100 dark:border-slate-800 space-y-3">
                  <span className="block text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">ข้อมูลผู้เดินทาง (ข้อมูลติดต่อสำหรับคนขับ)</span>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">ชื่อ - นามสกุล พนักงาน</label>
                    <input type="text" placeholder="กรอกชื่อ-นามสกุลจริง" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">เบอร์โทรศัพท์ที่ติดต่อได้</label>
                    <input type="tel" placeholder="เช่น 0812345678" value={employeePhone} onChange={(e) => setEmployeePhone(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">สถานีจุดจอดรับและตารางเวลา</label>
                  <select value={selectedStationIndex} onChange={(e) => setSelectedStationIndex(Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-500">
                    {currentActiveRoute?.stations?.map((st: StationTime, i: number) => (
                      <option key={i} value={i} className="dark:bg-slate-950">สถานี: {st.stationName} ({st.arrivalTime} น.)</option>
                    )) || <option value="">ไม่มีข้อมูลสถานี</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1.5">ระบุวันที่ต้องการเดินทาง</label>
                  <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-2.5 rounded-xl text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-500" />
                </div>

                {travelDate && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800"><span className="text-[10px] text-slate-400 block">ลงทะเบียนแล้ว</span><span className="text-sm font-bold text-slate-800 dark:text-white">{currentTotalBooked} ราย</span></div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700"><span className="text-[10px] text-slate-500 dark:text-slate-400 block">คงเหลือที่นั่งว่าง</span><span className="text-sm font-bold text-slate-900 dark:text-white">{currentAvailableSeats} ที่นั่ง</span></div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setBookingStep(1)} className="w-1/3 bg-slate-100 dark:bg-slate-800 dark:text-white py-2.5 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">ย้อนกลับ</button>
                  <button type="button" onClick={() => setBookingStep(3)} className="w-2/3 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-center cursor-pointer">ขั้นตอนถัดไป (ตรวจสอบข้อมูล) →</button>
                </div>
              </div>
            )}

            {bookingStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <span className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">สรุปข้อมูลส่วนบุคคลและการเดินทาง</span>
                  <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 text-sm">
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">ชื่อผู้เดินทาง:</span> <span className="font-bold">{employeeName}</span></p>
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">เบอร์ติดต่อ:</span> <span className="font-mono font-bold">{employeePhone}</span></p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">สายรถตู้:</span> <span className="font-bold text-blue-600 dark:text-blue-400">{selectedRouteName}</span></p>
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">จุดขึ้นรถ:</span> <span className="font-bold">{currentActiveRoute?.stations[selectedStationIndex]?.stationName}</span></p>
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">เวลารถออกประมาณ:</span> <span className="font-mono font-bold">{currentActiveRoute?.stations[selectedStationIndex]?.arrivalTime} น.</span></p>
                    <p className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">วันที่ออกเดินทาง:</span> <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{travelDate}</span></p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setBookingStep(2)} className="w-1/3 bg-slate-100 dark:bg-slate-800 dark:text-white py-2.5 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">ย้อนกลับ</button>
                  <button type="button" disabled={isBookingLoading} onClick={handleCreateBooking} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-center shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                    {isBookingLoading ? 'กำลังบันทึก...' : '✅ ยืนยันการสำรองที่นั่ง'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}