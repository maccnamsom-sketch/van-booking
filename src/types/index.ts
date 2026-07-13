// ===== User Types =====
export interface User {
  uid: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  phone: string;
  role: "employee" | "admin";
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// ===== Route Types =====
export interface Route {
  id: string;
  routeName: string;
  origin: string;
  destination: string;
  pickupPoints: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Vehicle Types =====
export interface Vehicle {
  id: string;
  licensePlate: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  status: "available" | "in-use" | "maintenance";
  createdAt: Date;
  updatedAt: Date;
}

// ===== Schedule Types =====
export interface PickupPointSchedule {
  name: string;
  estimatedTime: string;
}

export interface Schedule {
  id: string;
  routeId: string;
  routeName: string;
  vehicleId: string;
  vehiclePlate: string;
  departureTime: string;
  pickupPoints: PickupPointSchedule[];
  capacity: number;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Booking Types =====
export type BookingStatus = "pending" | "confirmed" | "checked-in" | "cancelled";

export interface Booking {
  id: string;
  bookingCode: string;
  userId: string;
  employeeName: string;
  employeeCode: string;
  scheduleId: string;
  routeId: string;
  routeName: string;
  pickupPoint: string;
  departureTime: string;
  bookingDate: string;
  status: BookingStatus;
  qrCodeData: string;
  checkedInAt?: Date;
  checkedInBy?: string;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Announcement Types =====
export type AnnouncementPriority = "normal" | "important" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  authorId: string;
  authorName: string;
  isPublished: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Dashboard Stats =====
export interface DashboardStats {
  todayBookings: number;
  totalEmployees: number;
  totalVehicles: number;
  totalRoutes: number;
}

export interface EmployeeDashboardStats {
  myTodayBookings: number;
  availableSeats: number;
  nextDeparture: string | null;
}

// ===== Report Types =====
export interface BookingReport {
  date: string;
  totalBookings: number;
  checkedIn: number;
  cancelled: number;
  noShow: number;
}

export interface RouteReport {
  routeName: string;
  totalBookings: number;
  percentage: number;
}

// ===== Queue Types =====
export interface QueueItem {
  scheduleId: string;
  routeName: string;
  departureTime: string;
  vehiclePlate: string;
  capacity: number;
  bookedSeats: number;
  availableSeats: number;
  passengers: {
    employeeName: string;
    employeeCode: string;
    pickupPoint: string;
    status: BookingStatus;
  }[];
}
