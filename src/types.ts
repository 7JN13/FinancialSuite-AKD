export type EmployeeType = 'DENTIST' | 'ASSISTANT' | 'TEMP' | 'ADMIN';
export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'ENDED_CONTRACT';
export type PayFrequency = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type CommissionTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface Employee {
  id: string;
  code: string; // e.g. ER, GA, KU
  fullName: string;
  displayName: string;
  type: EmployeeType;
  status: EmploymentStatus;
  startDate: string;
  endDate?: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigMID: string;
  tin: string;
  dateOfBirth: string;
  contactNumber: string;
  email?: string;
  address: string;
  emergencyContact: string;
  basePayRate: number; // Daily or Monthly rate
  payFrequency: PayFrequency;
  commissionTierDefault: CommissionTier;
  clinicSharePercentage?: number; // e.g., 5 for 5% partner share in clinic net revenue
  role?: string;
  hmoDailyAllowance?: number;
  bankAccount?: string;
  gcashNumber?: string;
  mayaAccount?: string;
  notes?: string;
}

export interface Patient {
  id: string;
  code: string;
  lastName: string;
  firstName: string;
  hmoProvider: 'HP' | 'FILDOCS' | 'COCOLIFE' | 'NONE';
  hmoIdNumber?: string;
}

export interface ProcedureCatalogItem {
  code: string;
  name: string;
  category: string;
  commissionTier: CommissionTier;
  commissionRateDefault: number; // e.g., 0.10, 0.30
  defaultLabFee: number;
  hmoFeeHp: number;
  hmoFeeFildocs: number;
  hmoFeeCocolife: number;
}

export interface Transaction {
  id: string;
  code: string;
  date: string;
  dentistId: string; // FK to Employee
  patientId: string; // FK to Patient
  patientName: string; // Stored flat for audit simplicity
  procedureCode: string;
  procedureName: string;
  amountCharged: number;
  discountType: 'SENIOR' | 'MONTHLY_PROMO' | 'DMD_DISCOUNT' | 'NONE';
  discountAmount: number;
  amountPaid: number;
  paymentMode: 'CASH' | 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BPI' | 'MAYA' | 'GOTYME' | 'HMO';
  merchantFee: number;
  actualSales: number;
  hmoFee?: number;
  labFee?: number;
  labVendor?: string;
  netRevenue: number;
  commissionTierApplied: CommissionTier;
  commissionRateApplied: number;
  commissionAmount: number;
  basePay?: number;
  hmoDailyAllowance?: number;
  remarks?: string;
  smartTag?: 'Clinical' | 'Administrative' | 'Maintenance' | 'Uncategorized';
}

export interface PayrollEntry {
  employeeId: string;
  employeeName: string;
  employeeType: EmployeeType;
  basePay: number;
  commission: number;
  otPay: number;
  holidayPay: number;
  hmoAllowance: number;
  otherEarnings: number;
  grossPay: number;
  sssContribution: number;
  philhealthContribution: number;
  pagibigContribution: number;
  withholdingTax: number;
  cashAdvanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  ytdGross: number;
  presentCount?: number;
  leaveCount?: number;
  absentCount?: number;
  holidayWorkedCount?: number;
  holidayOffCount?: number;
  cutoffDelta?: number;
}

export interface PayrollRun {
  id: string;
  code: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  type: 'ASSISTANT_WEEKLY' | 'DENTIST_SEMI_MONTHLY';
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'CANCELLED';
  entries: PayrollEntry[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  paymentReference?: string;
  paidAt?: string;
}

export interface Expense {
  id: string;
  code: string;
  date: string;
  category: 'RENT' | 'UTILITIES' | 'SUPPLIES' | 'EQUIPMENT' | 'MARKETING' | 'FOOD' | 'PROFESSIONAL' | 'REGISTRATION' | 'LAB' | 'MISC';
  vendorName: string;
  amount: number;
  paymentMode: string;
  description?: string;
  receiptId?: string; // Linked receipt
  status: 'APPROVED' | 'PENDING';
}

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Receipt {
  id: string;
  code: string;
  uploadDate: string;
  receiptDate: string;
  vendorName: string;
  amount: number;
  category: string;
  paymentMode: string;
  items?: ReceiptItem[];
  description?: string;
  fileUrl?: string; // Stored base64 or link
  ocrText?: string;
  ocrConfidence: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ARCHIVED';
  linkedExpenseId?: string;
}

export interface AuditFlag {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'MATH' | 'DUPLICATE' | 'MISSING' | 'ANOMALY' | 'CROSS_REF' | 'TEMPORAL' | 'ROSTER';
  fileName: string;
  rowReference: string;
  description: string;
  expectedValue?: string;
  actualValue?: string;
  discrepancyAmount?: number;
  suggestedAction: string;
  autoFixAvailable: boolean;
  status: 'OPEN' | 'FIXED' | 'IGNORED';
}

export interface SmartAuditRun {
  id: string;
  code: string;
  auditDate: string;
  filesAudited: string[];
  totalRecords: number;
  totalFlags: number;
  flags: AuditFlag[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}

// STORYBOARD MODULE INTERFACES
export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  cameraAngle: string;
  visualPrompt: string;
  imageSize: '512px' | '1K' | '2K' | '4K';
  imageUrl?: string; // Base64 or local server path
  isGenerating?: boolean;
  error?: string;
  warning?: string;
}

export interface StoryboardProject {
  id: string;
  name: string;
  scriptText: string;
  scenes: StoryboardScene[];
  createdAt: string;
}

export interface HMOClaim {
  id: string;
  date: string;
  patientName: string;
  hmoProvider: 'HP' | 'FILDOCS' | 'COCOLIFE';
  hmoIdNumber: string;
  procedureCode: string;
  procedureName: string;
  fullAmount: number;
  hmoNegotiatedFee: number;
  gapAmount: number;
  claimStatus: 'PENDING' | 'SUBMITTED' | 'PAID' | 'DENIED';
  remedyAction?: string;
}

export type HolidayType = '200%' | 'NO_WORK_NO_PAY' | '130%';

export interface PhilippineHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  origin: 'GOOGLE_CALENDAR' | 'GOVERNMENT_ORDER' | 'SYSTEM_DEFAULT';
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeType: 'DENTIST' | 'ASSISTANT' | 'TEMP' | 'ADMIN';
  type: 'VL' | 'SL';
  startDate: string;
  endDate: string;
  daysCount: number;
  remarks?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface EmployeeLeaveBalance {
  employeeId: string;
  vlAllotted: number;
  vlUsed: number;
  slAllotted: number;
  slUsed: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeType: 'DENTIST' | 'ASSISTANT' | 'TEMP' | 'ADMIN';
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'VL' | 'SL' | 'HOLIDAY_OFF' | 'HOLIDAY_WORKED';
  holidayPayMultiplier?: number; // 2.0 (200%), 1.3 (130%), 0 (No Work No Pay)
  remarks?: string;
}

export interface CutoffAdjustment {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string; // ISO String
  basePayAdjustmentAmount: number; // e.g. +500, -200
  reason: string;
  cutOffPeriod: 'JUNE_1_15' | 'JUNE_W1' | 'GENERAL';
  approvedBy: string;
}

export interface FinancialAdjustment {
  id: string;
  type: 'REVENUE' | 'EXPENSE';
  amount: number; // positive or negative
  description: string;
  date: string;
  category: string;
  createdBy: string;
}


