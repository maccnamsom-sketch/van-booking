import {
  Home,
  CalendarPlus,
  History,
  ListOrdered,
  Megaphone,
  MessageCircle,
  Settings,
  LayoutDashboard,
  MapPin,
  Bus,
  Clock,
  Users,
  BookOpen,
  BarChart3,
  QrCode,
  type LucideIcon,
} from "lucide-react";

// ===== Navigation Items =====
export interface NavItem {
  title: string;
  titleEn: string;
  href: string;
  icon: LucideIcon;
}

export const employeeNavItems: NavItem[] = [
  { title: "หน้าหลัก", titleEn: "Dashboard", href: "/dashboard", icon: Home },
  { title: "จองรถตู้", titleEn: "Book Van", href: "/booking", icon: CalendarPlus },
  { title: "ประวัติการจอง", titleEn: "Booking History", href: "/history", icon: History },
  { title: "คิวรถวันนี้", titleEn: "Today Queue", href: "/queue", icon: ListOrdered },
  { title: "ประกาศ", titleEn: "Announcements", href: "/announcements", icon: Megaphone },
  { title: "ติดต่อผู้ดูแล", titleEn: "Contact Admin", href: "/contact", icon: MessageCircle },
  { title: "ตั้งค่า", titleEn: "Settings", href: "/settings", icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { title: "แดชบอร์ด", titleEn: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "จัดการสายรถ", titleEn: "Routes", href: "/admin/routes", icon: MapPin },
  { title: "จัดการรถตู้", titleEn: "Vehicles", href: "/admin/vehicles", icon: Bus },
  { title: "จัดการรอบรถ", titleEn: "Schedules", href: "/admin/schedules", icon: Clock },
  { title: "จัดการพนักงาน", titleEn: "Employees", href: "/admin/employees", icon: Users },
  { title: "จัดการการจอง", titleEn: "Bookings", href: "/admin/bookings", icon: BookOpen },
  { title: "ประกาศ", titleEn: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { title: "รายงาน", titleEn: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "สแกน QR", titleEn: "QR Scanner", href: "/admin/scan", icon: QrCode },
];

// ===== Status Configs =====
export const bookingStatusConfig: Record<
  string,
  { label: string; labelEn: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "รอยืนยัน", labelEn: "Pending", variant: "secondary" },
  confirmed: { label: "ยืนยันแล้ว", labelEn: "Confirmed", variant: "default" },
  "checked-in": { label: "เช็คอินแล้ว", labelEn: "Checked In", variant: "outline" },
  cancelled: { label: "ยกเลิก", labelEn: "Cancelled", variant: "destructive" },
};

export const vehicleStatusConfig: Record<
  string,
  { label: string; labelEn: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  available: { label: "พร้อมใช้งาน", labelEn: "Available", variant: "default" },
  "in-use": { label: "กำลังใช้งาน", labelEn: "In Use", variant: "secondary" },
  maintenance: { label: "ซ่อมบำรุง", labelEn: "Maintenance", variant: "destructive" },
};

export const announcementPriorityConfig: Record<
  string,
  { label: string; labelEn: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  normal: { label: "ปกติ", labelEn: "Normal", variant: "secondary" },
  important: { label: "สำคัญ", labelEn: "Important", variant: "default" },
  urgent: { label: "ด่วน", labelEn: "Urgent", variant: "destructive" },
};

// ===== Days of Week =====
export const daysOfWeek = [
  { value: 0, label: "อาทิตย์", labelEn: "Sun" },
  { value: 1, label: "จันทร์", labelEn: "Mon" },
  { value: 2, label: "อังคาร", labelEn: "Tue" },
  { value: 3, label: "พุธ", labelEn: "Wed" },
  { value: 4, label: "พฤหัสบดี", labelEn: "Thu" },
  { value: 5, label: "ศุกร์", labelEn: "Fri" },
  { value: 6, label: "เสาร์", labelEn: "Sat" },
];

// ===== Departments =====
export const departments = [
  "ฝ่ายบุคคล (HR)",
  "ฝ่ายการเงิน (Finance)",
  "ฝ่ายไอที (IT)",
  "ฝ่ายการตลาด (Marketing)",
  "ฝ่ายผลิต (Production)",
  "ฝ่ายขาย (Sales)",
  "ฝ่ายจัดซื้อ (Procurement)",
  "ฝ่ายคลังสินค้า (Warehouse)",
  "ฝ่ายบริหาร (Management)",
  "อื่นๆ (Others)",
];

// ===== App Info =====
export const APP_NAME = "Van Booking";
export const APP_NAME_TH = "ระบบจองรถตู้";
export const APP_DESCRIPTION = "Employee Van Booking System";
export const APP_DESCRIPTION_TH = "ระบบจองรถตู้รับ-ส่งพนักงาน";
