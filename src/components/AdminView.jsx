import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminView({ db, theme, showAlert, routesList, bookingsList, announcementsList }) {
  // States สำหรับเพิ่มสายรถใหม่
  const [newRouteName, setNewRouteName] = useState('');
  const [newTimes, setNewTimes] = useState('');
  const [newPickups, setNewPickups] = useState('');
  const [maxSeats, setMaxSeats] = useState(12);

  // States สำหรับประกาศข่าว
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  // 📈 คำนวณสถิติสำหรับ Dashboard
  const totalBookings = bookingsList.length;
  const completedTrips = bookingsList.filter(b => b.status === 'boarded').length;
  const pendingTrips = bookingsList.filter(b => b.status === 'booked').length;

  // จัดกลุ่มวิเคราะห์สายรถยอดนิยม
  const routeUsage = bookingsList.reduce((acc, current) => {
    acc[current.routeName] = (acc[current.routeName] || 0) + 1;
    return acc;
  }, {});

  // ฟังก์ชันเพิ่มสายรถตู้ลงฐานข้อมูล
  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (!newRouteName || !newTimes || !newPickups) {
      showAlert('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุฟิลด์บังคับให้ครบถ้วน');
      return;
    }

    try {
      await addDoc(collection(db, 'van_routes'), {
        routeName: newRouteName,
        times: newTimes.split(',').map(t => t.trim()), // แปลงข้อความ "07:00, 08:00" เป็น Array
        pickupPoints: newPickups.split(',').map(p => p.trim()),
        maxSeats: Number(maxSeats),
        timestamp: serverTimestamp()
      });
      showAlert('success', 'สำเร็จ', 'เพิ่มสายรถตู้เรียบร้อยแล้ว');
      setNewRouteName(''); setNewTimes(''); setNewPickups('');
    } catch {
      showAlert('error', 'ล้มเหลว', 'ไม่สามารถบันทึกสายรถตู้ได้');
    }
  };

  // ฟังก์ชันโพสต์ประกาศ
  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'van_announcements'), {
        title: annTitle,
        content: annContent,
        timestamp: serverTimestamp()
      });
      showAlert('success', 'สำเร็จ', 'เพิ่มประกาศเรียบร้อยแล้ว');
      setAnnTitle(''); setAnnContent('');
    } catch {
      showAlert('error', 'ล้มเหลว', 'ไม่สามารถสร้างประกาศได้');
    }
  };

  return (
    <div className="space-y-8">
      
      {/* 📊 SUMMARY STATISTICS DASHBOARD */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${theme.card} p-5 rounded-2xl border-l-4 border-l-blue-500`}>
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">จำนวนยอดจองทั้งหมด (เที่ยววิ่ง)</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{totalBookings}</div>
        </div>
        <div className={`${theme.card} p-5 rounded-2xl border-l-4 border-l-amber-500`}>
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">ผู้โดยสารที่กำลังรอขึ้นรถ</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{pendingTrips}</div>
        </div>
        <div className={`${theme.card} p-5 rounded-2xl border-l-4 border-l-green-500`}>
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">เช็กอินขึ้นรถเรียบร้อย</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{completedTrips}</div>
        </div>
      </section>

      {/* 🪵 GRAPH / DETAILS DATA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* รายงานสายรถยอดนิยม */}
        <div className={`${theme.card} p-6 rounded-2xl border`}>
          <h3 className="text-xs font-black mb-4 uppercase text-slate-500">📊 รายงานสถิติแยกตามสายรถตู้ (เรียงตามความนิยม)</h3>
          <div className="space-y-3">
            {Object.keys(routeUsage).length === 0 ? <p className="text-slate-400 text-center py-4">ยังไม่มีข้อมูลการจองย้อนหลัง</p> :
              Object.entries(routeUsage).map(([name, count]) => (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                    <span>{name}</span>
                    <span>{count} ครั้ง</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min((count / totalBookings) * 100, 100)}%` }}></div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* ตารางแสดงผู้โดยสารจองล่าสุด */}
        <div className={`${theme.card} p-6 rounded-2xl border`}>
          <h3 className="text-xs font-black mb-4 uppercase text-slate-500">📋 รายการผู้โดยสารที่ทำการจองล่าสุด</h3>
          <div className="overflow-y-auto max-h-60 text-[11px] space-y-2">
            {bookingsList.length === 0 ? <p className="text-slate-400 text-center">ไม่มีข้อมูล</p> :
              bookingsList.map(b => (
                <div key={b.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex justify-between items-center border">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{b.employeeEmail}</div>
                    <div className="text-slate-400 mt-0.5">{b.routeName} • {b.pickupPoint}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-blue-600">{b.date} ({b.time} น.)</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </section>

      {/* ⚙️ FORMS MANAGEMENT SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ฟอร์มเพิ่มสายรถ */}
        <div className={`${theme.card} p-6 rounded-2xl border`}>
          <h3 className="text-xs font-black mb-4 text-slate-800 dark:text-white">➕ เพิ่มเส้นทาง/สายรถตู้พนักงาน</h3>
          <form onSubmit={handleAddRoute} className="space-y-3">
            <input type="text" placeholder="ชื่อสายรถ เช่น สายบางนา - อมตะนคร" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required />
            <input type="text" placeholder="รอบเวลา (คั่นด้วยจุลภาค ,) เช่น 06:30, 07:30, 17:00" value={newTimes} onChange={(e) => setNewTimes(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required />
            <input type="text" placeholder="จุดจอดรับพนักงาน (คั่นด้วยจุลภาค ,) เช่น แยกบางนา, เซ็นทรัล" value={newPickups} onChange={(e) => setNewPickups(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required />
            <input type="number" placeholder="จำนวนที่นั่งรองรับสูงสุดต่อคัน (เช่น 12)" value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required />
            <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white font-bold py-2.5 rounded-xl">บันทึกเพิ่มสายรถ</button>
          </form>
        </div>

        {/* ฟอร์มเพิ่มประกาศบริษัท */}
        <div className={`${theme.card} p-6 rounded-2xl border`}>
          <h3 className="text-xs font-black mb-4 text-slate-800 dark:text-white">📣 เพิ่มประกาศ/แจ้งข่าวสาร</h3>
          <form onSubmit={handleAddAnnouncement} className="space-y-3">
            <input type="text" placeholder="หัวข้อประกาศ" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required />
            <textarea placeholder="เนื้อหาประกาศอย่างละเอียด..." value={annContent} onChange={(e) => setAnnContent(e.target.value)} rows={3} className="w-full border p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" required></textarea>
            <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white font-bold py-2.5 rounded-xl">เผยแพร่ประกาศ</button>
          </form>
        </div>

      </section>

    </div>
  );
}