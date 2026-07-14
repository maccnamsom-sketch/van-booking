'use client';

import { useState } from 'react';
import { collection, doc, updateDoc, addDoc, deleteDoc, arrayUnion } from 'firebase/firestore';

interface AdminViewProps {
  db: any;
  user: any;
  theme: any;
  routesList: any[];
  bookingsList: any[];
  announcementsList: any[];
  supportTicketsList?: any[];
  cancellationRequestsList?: any[]; 
  showAlert: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => void;
}

export default function AdminView({ 
  db, 
  user, 
  theme, 
  routesList = [], 
  bookingsList = [], 
  announcementsList = [], 
  supportTicketsList = [], 
  cancellationRequestsList = [], 
  showAlert 
}: AdminViewProps) {
  
  const [adminTab, setAdminTab] = useState<'overview' | 'routes' | 'announcements' | 'tickets' | 'cancellation'>('overview');
  const [ticketSubTab, setTicketSubTab] = useState<'Pending' | 'Processing' | 'Resolved'>('Pending');

  // State สำหรับกรองข้อมูลในหน้าสรุปภาพรวม
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedOverviewDate, setSelectedOverviewDate] = useState<string>(todayStr);

  // ฟอร์มจัดการสายรถตู้
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRoutePlate, setNewRoutePlate] = useState('');
  const [newRouteDriver, setNewRouteDriver] = useState('');
  const [newRoutePhone, setNewRoutePhone] = useState('');
  const [newRouteShift, setNewRouteShift] = useState<'กะเช้า' | 'กะดึก'>('กะเช้า');
  const [stationInput, setStationInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [stopsList, setStopsList] = useState<{ station: string; time: string }[]>([]);

  const [newAnnounceTitle, setNewAnnounceTitle] = useState('');
  const [newAnnounceContent, setNewAnnounceContent] = useState('');

  const [replyMessages, setReplyMessages] = useState<{ [ticketId: string]: string }>({}); 
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const combinedCancelRequests = [
    ...cancellationRequestsList,
    ...supportTicketsList.filter(t => t.status === 'CancelRequested' || t.status === 'รอยยกเลิกคำร้อง')
  ];

  const pendingTicketsCount = supportTicketsList.filter(t => t.status === 'Pending').length;
  const processingTicketsCount = supportTicketsList.filter(t => t.status === 'Processing').length;
  const resolvedTicketsCount = supportTicketsList.filter(t => t.status === 'Resolved').length;
  const cancelRequestsCount = combinedCancelRequests.length;

  const filteredTickets = supportTicketsList.filter(t => t.status === ticketSubTab);

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
    setNewRoutePlate(r.plate || '');
    setNewRouteDriver(r.driver || '');
    setNewRoutePhone(r.phone || '');
    setNewRouteShift(r.shift || 'กะเช้า');
    setStopsList(r.stops || []);
  };

  const handleCancelEdit = () => {
    setEditingRouteId(null);
    setNewRouteName(''); 
    setNewRoutePlate(''); 
    setNewRouteDriver(''); 
    setNewRoutePhone('');
    setNewRouteShift('กะเช้า');
    setStopsList([]);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName || !newRoutePlate) return;
    try {
      const routeData = {
        name: newRouteName,
        plate: newRoutePlate,
        driver: newRouteDriver,
        phone: newRoutePhone,
        shift: newRouteShift,
        stops: stopsList,
        time: stopsList[0]?.time || '06.30 น.'
      };

      if (editingRouteId) {
        await updateDoc(doc(db, 'van_routes', editingRouteId), routeData);
        showAlert('success', 'สำเร็จ', 'อัปเดตข้อมูลสายรถตู้เรียบร้อยแล้ว');
      } else {
        await addDoc(collection(db, 'van_routes'), routeData);
        showAlert('success', 'สำเร็จ', 'เพิ่มสายรถตู้เข้าสู่ระบบเรียบร้อยแล้ว');
      }
      handleCancelEdit();
    } catch (err) {
      showAlert('error', 'ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลเส้นทางรถตู้ได้');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    showAlert('warning', 'ยืนยันการลบ', 'คุณแน่ใจใช่ไหมที่จะลบเส้นทางเดินรถนี้ออกจากระบบ?', async () => {
      try {
        await deleteDoc(doc(db, 'van_routes', id));
        showAlert('success', 'ลบสำเร็จ', 'ลบเส้นทางเดินรถเรียบร้อยแล้ว');
      } catch (err) {
        showAlert('error', 'ผิดพลาด', 'ไม่สามารถลบเส้นทางรถตู้ออกจากฐานข้อมูลได้');
      }
    }, true);
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnounceTitle || !newAnnounceContent) return;
    try {
      await addDoc(collection(db, 'van_announcements'), {
        title: newAnnounceTitle,
        content: newAnnounceContent,
        timestamp: new Date().toISOString()
      });
      showAlert('success', 'สำเร็จ', 'เพิ่มประกาศใหม่เรียบร้อยแล้ว');
      setNewAnnounceTitle(''); setNewAnnounceContent('');
    } catch (err) {
      showAlert('error', 'ผิดพลาด', 'ไม่สามารถโพสต์ประกาศข่าวสารได้');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    showAlert('warning', 'ยืนยันการลบ', 'คุณแน่ใจใช่ไหมที่จะลบประกาศข่าวสารนี้?', async () => {
      try {
        await deleteDoc(doc(db, 'van_announcements', id));
        showAlert('success', 'ลบสำเร็จ', 'ลบประกาศออกจากระบบเรียบร้อยแล้ว');
      } catch (err) {
        showAlert('error', 'ผิดพลาด', 'ไม่สามารถลบประกาศข่าวสารได้');
      }
    }, true);
  };

  const handleReplyTicketChat = async (ticketId: string) => {
    const textToReply = replyMessages[ticketId]?.trim();
    if (!textToReply) {
      showAlert('warning', 'กรุณากรอกข้อความ', 'กรุณาพิมพ์ข้อความแชทตอบกลับก่อนกดส่ง');
      return;
    }

    setUpdatingTicketId(ticketId);
    try {
      const ticketRef = doc(db, 'support_tickets', ticketId);
      await updateDoc(ticketRef, {
        status: 'Processing',
        messages: arrayUnion({
          sender: 'admin',
          text: textToReply,
          timestamp: new Date().toISOString(),
          repliedBy: user?.email || 'admin@company.com'
        })
      });
      setReplyMessages(prev => ({ ...prev, [ticketId]: '' }));
    } catch (err) {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถส่งข้อความแชทตอบกลับพนักงานได้');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { status: newStatus });
      showAlert('success', 'อัปเดตสถานะสำเร็จ', `ย้ายใบงานแจ้งปัญหาไปยังหมวดหมู่ใหม่เรียบร้อยแล้ว`);
    } catch (err) {
      showAlert('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะของใบงานแจ้งปัญหาได้');
    }
  };

  const handleArchiveTicket = async (ticketId: string) => {
    showAlert('warning', 'ยืนยันการจัดเก็บ', 'คุณต้องการเก็บถาวรประวัติห้องแชทแจ้งปัญหานี้เข้าคลังใช่หรือไม่?', async () => {
      try {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status: 'Archived' });
        showAlert('success', 'จัดเก็บเรียบร้อย', 'ย้ายประวัติห้องแชทนี้เข้าสู่คลังเอกสารเก่าแล้ว');
      } catch (err) {
        showAlert('error', 'ผิดพลาด', 'ไม่สามารถจัดเก็บห้องแชทลงคลังเอกสารได้');
      }
    }, true);
  };

  const handleApproveCancellation = async (requestId: string, bookingId: string, collectionName = 'support_tickets') => {
    showAlert('warning', 'ยืนยันการลบตั๋ว', 'คุณต้องการอนุมัติคำขอยกเลิกและลบตั๋วนี้ออกจากฐานข้อมูลใช่หรือไม่?', async () => {
      try {
        if (bookingId) {
          await deleteDoc(doc(db, 'van_bookings', bookingId));
        }
        await deleteDoc(doc(db, collectionName, requestId));
        showAlert('success', 'ลบตั๋วสำเร็จ', 'อนุมัติคำขอยกเลิกและลบข้อมูลเรียบร้อยแล้ว');
      } catch (err) {
        showAlert('error', 'ผิดพลาด', 'ไม่สามารถลบตั๋วออกจากฐานข้อมูลได้');
      }
    }, true);
  };

  // กรองการจองตามวันที่เลือกในหน้า Overview
  const filteredBookingsByDate = selectedOverviewDate 
    ? bookingsList.filter(b => b.travelDate === selectedOverviewDate)
    : bookingsList;

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="text-sm text-slate-800 dark:text-slate-100 max-w-6xl mx-auto space-y-6">
      
      {/* Navigation Tabs -ซ่อนเวลาสั่งปริ้นท์ */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-px print:hidden">
        <button onClick={() => setAdminTab('overview')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${adminTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>📊 สรุปภาพรวมการจอง</button>
        <button onClick={() => setAdminTab('routes')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${adminTab === 'routes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>🚌 จัดการสายรถตู้ ({routesList.length})</button>
        <button onClick={() => setAdminTab('announcements')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${adminTab === 'announcements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>📢 จัดการประกาศข่าว ({announcementsList.length})</button>
        <button onClick={() => setAdminTab('tickets')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${adminTab === 'tickets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>📬 กล่องข้อความแจ้งปัญหา {pendingTicketsCount > 0 && (<span className="bg-red-500 text-white text-[10px] h-4 px-1.5 rounded-full flex items-center justify-center font-bold animate-pulse">{pendingTicketsCount}</span>)}</button>
        <button onClick={() => setAdminTab('cancellation')} className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${adminTab === 'cancellation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>❌ คำขอยกเลิกตั๋ว {cancelRequestsCount > 0 && (<span className="bg-amber-500 text-white text-[10px] h-4 px-1.5 rounded-full flex items-center justify-center font-bold">{cancelRequestsCount}</span>)}</button>
      </div>

      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* ส่วนตัวเลือกวันที่และปุ่มพิมพ์ PDF */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 print:hidden">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">📅 เลือกวันที่ต้องการสรุป:</label>
              <input 
                type="date" 
                value={selectedOverviewDate} 
                onChange={(e) => setSelectedOverviewDate(e.target.value)} 
                className="border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-xs dark:bg-slate-950 font-mono"
              />
              <button 
                onClick={() => setSelectedOverviewDate('')} 
                className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                ดูทั้งหมด
              </button>
            </div>
            <button 
              onClick={handlePrintPDF} 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              🖨️ พิมพ์เอกสาร / บันทึก PDF
            </button>
          </div>

          {/* หัวข้อรายงานตอนพิมพ์ */}
          <div className="hidden print:block text-center space-y-1 mb-6">
            <h2 className="text-xl font-bold">รายงานสรุปยอดการจองรถตู้พนักงาน</h2>
            <p className="text-sm text-slate-500">ประจำวันที่: {selectedOverviewDate || 'ทุกวันทั้งหมดในระบบ'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">ยอดจองในวันที่เลือก</span><p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{filteredBookingsByDate.length} <span className="text-xs font-normal text-slate-500">ที่นั่ง</span></p></div>
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">สายรถในระบบทั้งหมด</span><p className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">{routesList.length} <span className="text-xs font-normal text-slate-500">สาย</span></p></div>
            <div className="p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"><span className="text-[11px] font-bold text-slate-400 uppercase">ตั๋วปัญหารอดำเนินการค้างอยู่</span><p className="text-2xl font-black mt-1 text-amber-500">{pendingTicketsCount} <span className="text-xs font-normal text-slate-500">เรื่อง</span></p></div>
          </div>

          {/* สรุปแยกตามรายสายรถจริง (4 สาย) */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">🚌 สรุปยอดและรายชื่อผู้โดยสารแยกตามแต่ละสายรถตู้</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routesList.map((route) => {
                // กรองการจองที่ตรงกับชื่อสายรถนี้ และตรงกับวันที่เลือก
                const routeBookings = filteredBookingsByDate.filter(b => b.route === route.name);
                
                return (
                  <div key={route.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-base">{route.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">ทะเบียน: {route.plate || '-'} | คนขับ: {route.driver || '-'} ({route.phone || '-'})</p>
                      </div>
                      <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black text-xs px-2.5 py-1 rounded-xl border border-blue-100 dark:border-blue-900">
                        {routeBookings.length} คน
                      </span>
                    </div>

                    {routeBookings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">ไม่มีผู้โดยสารจองในสายนี้วันนี้</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {routeBookings.map((b, bIdx) => (
                          <div key={b.id || bIdx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{bIdx + 1}. {b.employeeName}</span>
                              <span className="block text-[11px] text-slate-400">จุดรับ: {b.pickupLocation} ({b.time} น.)</span>
                            </div>
                            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{b.employeePhone || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {adminTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 h-fit space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">{editingRouteId ? '✏️ แก้ไขข้อมูลสายรถ' : '➕ สร้างและเพิ่มสายรถคันใหม่'}</h3>
              {editingRouteId && (
                <button type="button" onClick={handleCancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-bold">ยกเลิกแก้ไข</button>
              )}
            </div>
            <form onSubmit={handleSaveRoute} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">เลือกกะการทำงาน</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRouteShift('กะเช้า')}
                    className={`p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                      newRouteShift === 'กะเช้า' 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    กะเช้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRouteShift('กะดึก')}
                    className={`p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                      newRouteShift === 'กะดึก' 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    กะดึก
                  </button>
                </div>
              </div>

              <div><label className="block text-slate-400 font-bold mb-1">ชื่อเรียกสายรถ (เช่น สายระยอง-มาบตาพุด)</label><input type="text" placeholder="ชื่อสายรถ..." value={newRouteName} onChange={e => setNewRouteName(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">เลขทะเบียนรถ</label><input type="text" placeholder="เช่น กข001" value={newRoutePlate} onChange={e => setNewRoutePlate(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">ชื่อพนักงานคนขับ</label><input type="text" placeholder="ชื่อคนขับ..." value={newRouteDriver} onChange={e => setNewRouteDriver(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-slate-400 font-bold mb-1">เบอร์โทรศัพท์สายตรงคนขับ</label><input type="text" placeholder="เบอร์โทร..." value={newRoutePhone} onChange={e => setNewRoutePhone(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" /></div>
              
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-slate-400 font-bold">กำหนดจุดจอดรับ ส่งพนักงาน</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="ชื่อสถานีรายทาง" value={stationInput} onChange={e => setStationInput(e.target.value)} className="w-full border p-2 rounded-xl dark:bg-slate-950" />
                  <input type="text" placeholder="เวลา (06.30)" value={timeInput} onChange={e => setTimeInput(e.target.value)} className="w-28 border p-2 rounded-xl dark:bg-slate-950" />
                  <button type="button" onClick={handleAddStop} className="bg-slate-200 dark:bg-slate-800 px-3 py-2 rounded-xl font-bold whitespace-nowrap">+ เพิ่มจุดจอด</button>
                </div>
                {stopsList.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {stopsList.map((st, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border text-[11px]">
                        <span>จุดที่ {idx + 1}: {st.station} ({st.time} น.)</span>
                        <button type="button" onClick={() => handleRemoveStop(idx)} className="text-red-500 font-bold px-1.5">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className={`w-full font-bold py-2.5 rounded-xl transition-all shadow ${editingRouteId ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {editingRouteId ? 'บันทึกการแก้ไขสายรถ' : 'บันทึกสายรถเข้าสู่ระบบ'}
              </button>
            </form>
          </div>
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">เส้นทางรถตู้ทั้งหมดในฐานข้อมูลองค์กร</h3>
            {routesList.map(r => (
              <div key={r.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-start gap-4 shadow-sm">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {r.name} 
                    <span className="ml-2 inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded font-bold border border-blue-100 dark:border-blue-900">{r.shift || 'กะเช้า'}</span>
                    <span className="block text-slate-400 font-normal text-xs font-mono mt-0.5">ทะเบียน: {r.plate || '-'} · คนขับ: {r.driver || '-'} ({r.phone || '-'})</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.stops?.map((stop: any, sIdx: number) => (
                      <div key={sIdx} className="bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-md border text-[11px] text-slate-600 dark:text-slate-300">
                        จุดที่ {sIdx + 1}: {stop.station} <span className="font-mono text-blue-600">{stop.time} น.</span>
                      </div>
                    )) || <span className="text-xs text-slate-400">ยังไม่ได้ระบุจุดจอดรถ</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <button onClick={() => handleEditRouteClick(r)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs px-2.5 py-1.5 rounded-lg font-bold">แก้ไข</button>
                  <button onClick={() => handleDeleteRoute(r.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs px-2.5 py-1.5 rounded-lg font-bold">ถอดถอนสายรถนี้</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === 'announcements' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm border-slate-200 dark:border-slate-800 h-fit space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">📢 สร้างประกาศข่าวสารใหม่ถึงพนักงาน</h3>
            <form onSubmit={handleAddAnnouncement} className="space-y-3 text-xs">
              <div><label className="block text-slate-400 font-bold mb-1">หัวข้อประกาศข่าว</label><input type="text" placeholder="หัวเรื่อง..." value={newAnnounceTitle} onChange={e => setNewAnnounceTitle(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-slate-400 font-bold mb-1">เนื้อหาประกาศ</label><textarea placeholder="รายละเอียด..." value={newAnnounceContent} onChange={e => setNewAnnounceContent(e.target.value)} className="w-full border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl h-32 dark:bg-slate-950 focus:outline-none focus:border-blue-500" required /></div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2.5 rounded-xl dark:bg-blue-600 dark:hover:bg-blue-700 transition-all shadow">โพสต์ประกาศบนระบบ</button>
            </form>
          </div>
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">📄 ประวัติและรายการประกาศข่าวสารประชาสัมพันธ์</h3>
            {announcementsList.map(a => (
              <div key={a.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-start gap-4 shadow-sm">
                <div className="space-y-1"><h4 className="font-bold text-slate-900 dark:text-white">{a.title}</h4><p className="text-xs text-slate-500 leading-relaxed">{a.content}</p><span className="block text-[10px] text-slate-400 font-mono">เมื่อ: {a.timestamp ? new Date(a.timestamp).toLocaleString('th-TH') : ''}</span></div>
                <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-500 hover:bg-red-50 text-xs px-2.5 py-1.5 rounded-lg font-bold">ลบ</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">ห้องแชทโต้ตอบจัดการข้อความและปัญหาพนักงาน</h3>
            <span className="text-xs font-medium text-slate-400">ในหน้านี้พบทั้งหมด {filteredTickets.length} เคส</span>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800/60">
            <button onClick={() => setTicketSubTab('Pending')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${ticketSubTab === 'Pending' ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-sm' : 'text-slate-500'}`}>🔴 รอดำเนินการ ({pendingTicketsCount})</button>
            <button onClick={() => setTicketSubTab('Processing')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${ticketSubTab === 'Processing' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}>🟡 กำลังตรวจสอบ ({processingTicketsCount})</button>
            <button onClick={() => setTicketSubTab('Resolved')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${ticketSubTab === 'Resolved' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>🟢 แก้ไขเรียบร้อย ({resolvedTicketsCount})</button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTickets.length === 0 ? (
              <div className="p-12 border border-dashed rounded-2xl text-center text-slate-400">📭 ไม่มีรายการแจ้งปัญหาในหมวดหมู่นี้</div>
            ) : (
              filteredTickets.map((ticket) => {
                const isResolved = ticket.status === 'Resolved';
                return (
                  <div key={ticket.id} className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm space-y-4 ${isResolved ? 'opacity-80' : ''}`}>
                    <div className="flex justify-between items-start gap-4 border-b pb-2">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono block">ID: {ticket.id}</span>
                        <h4 className="font-bold text-base">📌 เรื่อง: {ticket.subject}</h4>
                        <p className="text-xs text-slate-500">ผู้ส่ง: <strong className="text-slate-700 dark:text-slate-200">{ticket.employeeEmail}</strong></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isResolved && <button onClick={() => handleArchiveTicket(ticket.id)} className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-md font-bold">📦 จัดเก็บแชท</button>}
                        <select value={ticket.status} onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value)} className="text-xs font-bold px-2.5 py-1 rounded-md border">
                          <option value="Pending">🔴 รอดำเนินการ</option>
                          <option value="Processing">🟡 กำลังตรวจสอบ</option>
                          <option value="Resolved">🟢 แก้ไขเรียบร้อย</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-3 max-h-64 overflow-y-auto">
                      {ticket.messages?.map((msg: any, mIdx: number) => (
                        <div key={mIdx} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-slate-400 mb-0.5">{msg.sender === 'admin' ? 'คุณ (แอดมิน)' : 'พนักงาน'}</span>
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${msg.sender === 'admin' ? 'bg-slate-900 text-white dark:bg-blue-600 rounded-tr-none' : 'bg-white dark:bg-slate-800 rounded-tl-none border'}`}>{msg.text}</div>
                        </div>
                      ))}
                    </div>
                    {!isResolved && (
                      <div className="flex gap-2">
                        <input type="text" placeholder="พิมพ์ข้อความตอบกลับ..." value={replyMessages[ticket.id] || ''} onChange={(e) => setReplyMessages(prev => ({ ...prev, [ticket.id]: e.target.value }))} className="w-full border p-2.5 rounded-xl text-xs dark:bg-slate-950" />
                        <button onClick={() => handleReplyTicketChat(ticket.id)} className="bg-blue-600 text-white px-5 rounded-xl text-xs font-bold">ส่งแชท</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {adminTab === 'cancellation' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">ตรวจสอบและอนุมัติคำขอยกเลิกตั๋วพนักงาน</h3>
            <span className="text-xs text-slate-400">ทั้งหมด {combinedCancelRequests.length} รายการ</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {combinedCancelRequests.length === 0 ? (
              <div className="p-12 border border-dashed rounded-2xl text-center text-slate-400">📭 ไม่มีคำขอยกเลิกตั๋วในขณะนี้</div>
            ) : (
              combinedCancelRequests.map((req) => (
                <div key={req.id} className="p-5 rounded-2xl border border-red-200 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex justify-between items-start gap-4 border-b pb-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-mono block">รหัส: {req.id}</span>
                      <h4 className="font-bold text-base">🎫 คำขอยกเลิก: สาย {req.route || req.subject || '-'}</h4>
                      <p className="text-xs text-slate-500">พนักงาน: <strong>{req.employeeName || req.employeeEmail}</strong></p>
                    </div>
                    <button onClick={() => handleApproveCancellation(req.id, req.bookingId)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md">🗑️ อนุมัติลบตั๋วออกจากระบบ</button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">เหตุผลที่ระบุ:</span>
                    <p className="text-xs bg-white dark:bg-slate-900 p-3 rounded-lg border">{req.reason || req.message || 'ไม่ได้ระบุเหตุผล'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}