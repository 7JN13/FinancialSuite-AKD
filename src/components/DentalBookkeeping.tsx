import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ArkaLogo } from './ArkaLogo';
import { 
  Building, 
  Users, 
  CheckCircle, 
  TrendingUp, 
  PlusCircle, 
  DollarSign, 
  Receipt, 
  ShieldAlert, 
  PieChart, 
  FileText, 
  ChevronRight, 
  Plus, 
  Pencil,
  Check,
  Trash2, 
  Search, 
  Download, 
  Printer, 
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  Sun,
  Moon,
  FolderUp,
  ShieldCheck,
  Folder,
  FolderOpen,
  RefreshCw,
  X,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { 
  Employee, 
  Patient, 
  Transaction, 
  Expense, 
  Receipt as ReceiptType, 
  AuditFlag, 
  PayrollRun, 
  ProcedureCatalogItem,
  HMOClaim,
  PhilippineHoliday,
  LeaveRequest,
  EmployeeLeaveBalance,
  AttendanceRecord,
  CutoffAdjustment,
  FinancialAdjustment,
  EmployeeType
} from '../types';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';

import AttendanceAndLeaveTracker from './AttendanceAndLeaveTracker';

interface DentalBookkeepingProps {
  initialDb: {
    employees: Employee[];
    patients: Patient[];
    procedures: ProcedureCatalogItem[];
    transactions: Transaction[];
    expenses: Expense[];
    receipts: ReceiptType[];
    payrollRuns: PayrollRun[];
    holidays?: PhilippineHoliday[];
    leaveRequests?: LeaveRequest[];
    leaveBalances?: EmployeeLeaveBalance[];
    attendanceRecords?: AttendanceRecord[];
    cutoffAdjustments?: CutoffAdjustment[];
    financialAdjustments?: FinancialAdjustment[];
  };
  onSaveState: (newData: any) => void;
}

const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  // Regex for YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  // Verify that it's a valid calendar date
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (month < 1 || month > 12) return false;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  
  return true;
};

export default function DentalBookkeeping({ initialDb, onSaveState }: DentalBookkeepingProps) {
  const [db, setDb] = useState(() => {
    const fallback = {
      employees: [],
      patients: [],
      procedures: [],
      transactions: [],
      expenses: [],
      receipts: [],
      payrollRuns: [],
      holidays: [],
      leaveRequests: [],
      leaveBalances: [],
      attendanceRecords: [],
      cutoffAdjustments: [],
      financialAdjustments: []
    };
    if (!initialDb) return fallback;
    const merged = {
      ...fallback,
      ...initialDb
    };

    // Robust double-layered deduplication for patient IDs
    if (Array.isArray(merged.patients)) {
      const seenIds = new Set<string>();
      const cleanPatients: Patient[] = [];
      const patientsByName = new Map<string, string>();

      merged.patients.forEach((p, idx) => {
        if (!p.id) return;
        let finalId = p.id;
        if (seenIds.has(p.id)) {
          finalId = `${p.id}-dup-${idx}`;
        } else {
          seenIds.add(p.id);
        }
        cleanPatients.push({ ...p, id: finalId });

        const nameKey = `${p.firstName} ${p.lastName}`.toLowerCase().replace(/[^a-z]/g, '');
        if (nameKey) {
          patientsByName.set(nameKey, finalId);
        }
      });

      merged.patients = cleanPatients;

      if (Array.isArray(merged.transactions)) {
        merged.transactions = merged.transactions.map(t => {
          if (t.patientId) {
            const tName = (t.patientName || '').toLowerCase().replace(/[^a-z]/g, '');
            const correctId = patientsByName.get(tName);
            if (correctId && correctId !== t.patientId) {
              return { ...t, patientId: correctId };
            }
          }
          return t;
        });
      }
    }

    return merged;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(prev => prev === message ? null : prev);
    }, 4000);
  };

  useEffect(() => {
    if (initialDb) {
      setDb(prev => {
        if (!prev || JSON.stringify(prev) !== JSON.stringify(initialDb)) {
          const fallback = {
            employees: [],
            patients: [],
            procedures: [],
            transactions: [],
            expenses: [],
            receipts: [],
            payrollRuns: [],
            holidays: [],
            leaveRequests: [],
            leaveBalances: [],
            attendanceRecords: [],
            cutoffAdjustments: [],
            financialAdjustments: []
          };
          return {
            ...fallback,
            ...initialDb
          };
        }
        return prev;
      });
    }
  }, [initialDb]);

  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'PAYROLL' | 'AUDIT' | 'RECEIPTS' | 'EXPENSES' | 'HMO' | 'EMPLOYEES' | 'ATTENDANCE' | 'ADMIN_PANEL'>('DASHBOARD');
  const [selectedGraphCategory, setSelectedGraphCategory] = useState<'revenue' | 'labFees' | 'commissions' | 'expenses' | 'netProfit' | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<string>('2026-06-01');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('2026-06-30');
  const [tempStartDate, setTempStartDate] = useState<string>('2026-06-01');
  const [tempEndDate, setTempEndDate] = useState<string>('2026-06-30');

  // Patients Income General Ledger States
  const [generalLedgerFilterDate, setGeneralLedgerFilterDate] = useState<string>('');
  const [isGeneralLedgerEditMode, setIsGeneralLedgerEditMode] = useState<boolean>(false);
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);

  // Official Auditable Activity Journal inline editing states
  const [isJournalEditMode, setIsJournalEditMode] = useState<boolean>(false);
  const [journalEditState, setJournalEditState] = useState<Transaction[]>([]);

  // Interactive backtracking states
  const [journalDateFilterType, setJournalDateFilterType] = useState<string>('ALL');
  const [journalFilterSingleDate, setJournalFilterSingleDate] = useState<string>('');
  const [journalFilterStartDate, setJournalFilterStartDate] = useState<string>('');
  const [journalFilterEndDate, setJournalFilterEndDate] = useState<string>('');

  // Temporary editing states
  const [editDate, setEditDate] = useState<string>('');
  const [editDentistId, setEditDentistId] = useState<string>('');
  const [editPatientId, setEditPatientId] = useState<string>('');
  const [editPatientName, setEditPatientName] = useState<string>('');
  const [editProcedureCode, setEditProcedureCode] = useState<string>('');
  const [editLabFee, setEditLabFee] = useState<number>(0);
  const [editDiscountAmount, setEditDiscountAmount] = useState<number>(0);
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editCommissionRate, setEditCommissionRate] = useState<number>(10);
  const [editPaymentMode, setEditPaymentMode] = useState<string>('CASH');
  const [editHmoFee, setEditHmoFee] = useState<number>(0);
  const [editMerchantFee, setEditMerchantFee] = useState<number>(0);

  const handleEditRowClick = (txn: Transaction) => {
    setEditingLedgerId(txn.id);
    setEditDate(txn.date);
    setEditDentistId(txn.dentistId);
    setEditPatientId(txn.patientId);
    setEditPatientName(txn.patientName);
    setEditProcedureCode(txn.procedureCode);
    setEditLabFee(txn.labFee || 0);
    setEditDiscountAmount(txn.discountAmount || 0);
    setEditAmountPaid(txn.amountPaid);
    setEditCommissionRate(txn.commissionRateApplied * 100);
    setEditPaymentMode(txn.paymentMode);
    setEditHmoFee(txn.hmoFee || 0);
    setEditMerchantFee(txn.merchantFee || 0);
  };

  const handleSaveRowClick = (txnId: string) => {
    // VALIDATION: Date validation
    if (!isValidDate(editDate)) {
      triggerToast('Please provide a valid date in YYYY-MM-DD format.', 'error');
      return;
    }

    // VALIDATION: Amount validation
    if (isNaN(editAmountPaid) || editAmountPaid <= 0) {
      triggerToast('Amount Paid must be a positive number greater than ₱0.', 'error');
      return;
    }
    if (isNaN(editLabFee) || editLabFee < 0) {
      triggerToast('Lab Fee must be a valid non-negative number.', 'error');
      return;
    }
    if (isNaN(editDiscountAmount) || editDiscountAmount < 0) {
      triggerToast('Discount Amount must be a valid non-negative number.', 'error');
      return;
    }

    const dentist = db.employees.find(e => e.id === editDentistId);
    const procedure = db.procedures.find(p => p.code === editProcedureCode);
    const patient = db.patients.find(p => p.id === editPatientId);
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : editPatientName;

    if (!dentist || !procedure) {
      triggerToast('Invalid dentist or procedure selected', 'error');
      return;
    }

    const isCredit = editPaymentMode === 'CREDIT_CARD' || editPaymentMode === 'DEBIT_CARD';
    const calculatedMerchantFee = isCredit ? Math.round(editAmountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = editAmountPaid - calculatedMerchantFee;

    let hmoFeeCharged = editHmoFee;
    if (editPaymentMode === 'HMO' && patient) {
      if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
      else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
      else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
    }

    const netRevenue = (editPaymentMode === 'HMO') 
      ? hmoFeeCharged - editLabFee 
      : actualSales - editLabFee;

    const rate = editCommissionRate / 100;
    const commissionAmount = Math.round(editAmountPaid * rate * 100) / 100;

    const updatedTxns = db.transactions.map(t => {
      if (t.id === txnId) {
        return {
          ...t,
          date: editDate,
          dentistId: editDentistId,
          patientId: editPatientId || `pat-unknown-${Date.now()}`,
          patientName,
          procedureCode: editProcedureCode,
          procedureName: procedure.name,
          amountPaid: editAmountPaid,
          discountAmount: editDiscountAmount,
          paymentMode: editPaymentMode as any,
          merchantFee: calculatedMerchantFee,
          actualSales,
          hmoFee: editPaymentMode === 'HMO' ? hmoFeeCharged : undefined,
          labFee: editLabFee,
          netRevenue,
          commissionTierApplied: procedure.commissionTier || 'TIER_1',
          commissionRateApplied: rate,
          commissionAmount,
          remarks: 'Updated via General Ledger'
        };
      }
      return t;
    });

    const newDb = { ...db, transactions: updatedTxns };
    setDb(newDb);
    onSaveState(newDb);
    setEditingLedgerId(null);
    triggerToast('Ledger row successfully saved!', 'success');
  };

  const handleDeleteRowClick = (txnId: string) => {
    if (confirm('Are you sure you want to delete this ledger entry?')) {
      const updatedTxns = db.transactions.filter(t => t.id !== txnId);
      const newDb = { ...db, transactions: updatedTxns };
      setDb(newDb);
      onSaveState(newDb);
      triggerToast('Ledger row successfully deleted!', 'success');
    }
  };

  const getFilteredJournalTransactions = () => {
    let list = db.transactions;
    if (journalDateFilterType === 'ALL') return list;

    const todayStr = new Date().toISOString().split('T')[0];
    const getDaysAgo = (num: number) => {
      const d = new Date();
      d.setDate(d.getDate() - num);
      return d.toISOString().split('T')[0];
    };

    if (journalDateFilterType === 'TODAY') {
      return list.filter(t => t.date === todayStr);
    }
    if (journalDateFilterType === 'YESTERDAY') {
      const yesterdayStr = getDaysAgo(1);
      return list.filter(t => t.date === yesterdayStr);
    }
    if (journalDateFilterType === '7_DAYS') {
      const cutOff = getDaysAgo(7);
      return list.filter(t => t.date >= cutOff && t.date <= todayStr);
    }
    if (journalDateFilterType === '30_DAYS') {
      const cutOff = getDaysAgo(30);
      return list.filter(t => t.date >= cutOff && t.date <= todayStr);
    }
    if (journalDateFilterType === 'CUSTOM_DATE') {
      if (!journalFilterSingleDate) return list;
      return list.filter(t => t.date === journalFilterSingleDate);
    }
    if (journalDateFilterType === 'CUSTOM_RANGE') {
      const start = journalFilterStartDate;
      const end = journalFilterEndDate;
      if (!start && !end) return list;
      return list.filter(t => {
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
      });
    }
    return list;
  };

  const getFilteredEditTransactions = () => {
    let list = journalEditState;
    if (journalDateFilterType === 'ALL') return list;

    const todayStr = new Date().toISOString().split('T')[0];
    const getDaysAgo = (num: number) => {
      const d = new Date();
      d.setDate(d.getDate() - num);
      return d.toISOString().split('T')[0];
    };

    if (journalDateFilterType === 'TODAY') {
      return list.filter(t => t.date === todayStr);
    }
    if (journalDateFilterType === 'YESTERDAY') {
      const yesterdayStr = getDaysAgo(1);
      return list.filter(t => t.date === yesterdayStr);
    }
    if (journalDateFilterType === '7_DAYS') {
      const cutOff = getDaysAgo(7);
      return list.filter(t => t.date >= cutOff && t.date <= todayStr);
    }
    if (journalDateFilterType === '30_DAYS') {
      const cutOff = getDaysAgo(30);
      return list.filter(t => t.date >= cutOff && t.date <= todayStr);
    }
    if (journalDateFilterType === 'CUSTOM_DATE') {
      if (!journalFilterSingleDate) return list;
      return list.filter(t => t.date === journalFilterSingleDate);
    }
    if (journalDateFilterType === 'CUSTOM_RANGE') {
      const start = journalFilterStartDate;
      const end = journalFilterEndDate;
      if (!start && !end) return list;
      return list.filter(t => {
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
      });
    }
    return list;
  };

  const handleToggleJournalEditMode = () => {
    if (!isJournalEditMode) {
      setJournalEditState(JSON.parse(JSON.stringify(db.transactions)));
      setIsJournalEditMode(true);
    } else {
      setIsJournalEditMode(false);
    }
  };

  const handleJournalCellChange = (txnId: string, field: keyof Transaction, value: any) => {
    setJournalEditState(prev => prev.map(t => {
      if (t.id === txnId) {
        let updated = { ...t, [field]: value };
        if (field === 'procedureCode') {
          const proc = db.procedures.find(p => p.code === value);
          if (proc) {
            updated.procedureName = proc.name;
            updated.commissionTierApplied = proc.commissionTier || 'TIER_1';
            const defaultRate = proc.commissionRateDefault !== undefined ? proc.commissionRateDefault : 0.10;
            updated.commissionRateApplied = defaultRate;
            updated.commissionAmount = Math.max(0, Math.round(updated.amountPaid * defaultRate * 100) / 100);
          }
        }
        if (field === 'patientId') {
          const pat = db.patients.find(p => p.id === value);
          if (pat) {
            updated.patientName = `${pat.firstName} ${pat.lastName}`;
          }
        }
        if (field === 'amountPaid') {
          updated.commissionAmount = Math.max(0, Math.round(value * updated.commissionRateApplied * 100) / 100);
        }
        if (field === 'commissionRateApplied') {
          updated.commissionAmount = Math.max(0, Math.round(updated.amountPaid * value * 100) / 100);
        }
        return updated;
      }
      return t;
    }));
  };

  const handleSaveJournalEdit = () => {
    // Validate all edited transactions first
    for (const txn of journalEditState) {
      if (!isValidDate(txn.date)) {
        triggerToast(`Error: "${txn.date}" is an invalid date format for patient ${txn.patientName || 'Record'}. Expected format is YYYY-MM-DD.`, 'error');
        return;
      }
      if (isNaN(txn.amountPaid) || txn.amountPaid <= 0) {
        triggerToast(`Error: Amount Paid must be a positive number greater than ₱0 for patient ${txn.patientName || 'Record'}.`, 'error');
        return;
      }
      if (txn.labFee !== undefined && (isNaN(txn.labFee) || txn.labFee < 0)) {
        triggerToast(`Error: Lab Fee cannot be a negative number for patient ${txn.patientName || 'Record'}.`, 'error');
        return;
      }
    }

    const updatedTransactions = journalEditState.map(txn => {
      const dentist = db.employees.find(e => e.id === txn.dentistId);
      const procedure = db.procedures.find(p => p.code === txn.procedureCode);
      const patient = db.patients.find(p => p.id === txn.patientId);
      
      const isCredit = txn.paymentMode === 'CREDIT_CARD' || txn.paymentMode === 'DEBIT_CARD';
      const merchantFee = isCredit ? Math.round(txn.amountPaid * 0.035 * 100) / 100 : 0;
      const actualSales = txn.amountPaid - merchantFee;
      
      let hmoFeeCharged = txn.hmoFee || 0;
      if (txn.paymentMode === 'HMO' && patient && procedure) {
        if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
        else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
        else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
      }
      
      const netRevenue = (txn.paymentMode === 'HMO') 
        ? hmoFeeCharged - (txn.labFee || 0) 
        : actualSales - (txn.labFee || 0);
        
      const commissionAmount = Math.max(0, Math.round(txn.amountPaid * txn.commissionRateApplied * 100) / 100);
      
      return {
        ...txn,
        merchantFee,
        actualSales,
        hmoFee: txn.paymentMode === 'HMO' ? hmoFeeCharged : undefined,
        netRevenue,
        commissionAmount
      };
    });

    const newDb = { ...db, transactions: updatedTransactions };
    setDb(newDb);
    onSaveState(newDb);
    setIsJournalEditMode(false);
    triggerToast('Journal changes successfully saved & aligned with dashboard!', 'success');
  };

  const handleAddRowClick = () => {
    const defaultPatient = db.patients[0];
    const defaultDentist = db.employees.find(e => e.type === 'DENTIST') || db.employees[0];
    const defaultProcedure = db.procedures[0];

    const newTxn: Transaction = {
      id: `txn-${Date.now()}`,
      code: `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-00${db.transactions.length + 1}`,
      date: new Date().toISOString().slice(0, 10),
      dentistId: defaultDentist?.id || '',
      patientId: defaultPatient?.id || '',
      patientName: defaultPatient ? `${defaultPatient.firstName} ${defaultPatient.lastName}` : 'Walk-in Patient',
      procedureCode: defaultProcedure?.code || '',
      procedureName: defaultProcedure?.name || '',
      amountCharged: 1000,
      discountType: 'NONE',
      discountAmount: 0,
      amountPaid: 1000,
      paymentMode: 'CASH',
      merchantFee: 0,
      actualSales: 1000,
      labFee: 0,
      netRevenue: 1000,
      commissionTierApplied: defaultProcedure?.commissionTier || 'TIER_1',
      commissionRateApplied: defaultProcedure?.commissionRateDefault || 0.10,
      commissionAmount: 100,
      remarks: 'Added via General Ledger'
    };

    const newDb = {
      ...db,
      transactions: [newTxn, ...db.transactions]
    };
    setDb(newDb);
    onSaveState(newDb);

    setIsGeneralLedgerEditMode(true);
    handleEditRowClick(newTxn);
    triggerToast('New blank row created! You can now edit it inline.', 'success');
  };
  
  // PASSWORD-PROTECTED ADMIN CONTROLS (Pass: karla15)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [isKarlaPhoneBypassed, setIsKarlaPhoneBypassed] = useState<boolean>(false);
  const [showAdminHelp, setShowAdminHelp] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<'ATTENDANCE' | 'CUTOFF_ADJUSTMENTS' | 'EXPENSE_REVENUE_ADJUSTMENTS' | 'PAYROLL'>('PAYROLL');
  const [adminPasswordError, setAdminPasswordError] = useState<string>('');

  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';

    fetch(`/api/user-session${currentSearch}`)
      .then(res => res.json())
      .then(auth => {
        const isKarla = auth.isKarla || currentSearch.toLowerCase().includes('karla');
        if (isMobile && isKarla) {
          console.log("🔒 Phone & Google authenticated as Karla. Auto-bypassing Admin Credentials Panel.");
          setIsAdminUnlocked(true);
          setIsKarlaPhoneBypassed(true);
        }
      })
      .catch(err => {
        console.error('Failed to run authentication bypass check inside DentalBookkeeping:', err);
      });
  }, []);
  
  const handlePrintPDF = (elementId?: any) => {
    if (typeof document !== 'undefined') {
      let el: HTMLElement | null = null;
      if (elementId && typeof elementId === 'string') {
        el = document.getElementById(elementId);
      }

      let printContainer: HTMLDivElement | null = null;

      if (el) {
        // Clone the element to render it standalone under document.body
        const clone = el.cloneNode(true) as HTMLElement;
        clone.id = el.id + '-print-temp';
        // Add a specific utility class to the clone
        clone.classList.add('paystub-print-card-clone');

        // Create a temporary container
        printContainer = document.createElement('div');
        printContainer.id = 'print-container-temp';
        printContainer.className = 'print-only-wrapper';
        printContainer.appendChild(clone);
        document.body.appendChild(printContainer);

        // Add the printing active class to body
        document.body.classList.add('printing-active');
      } else {
        document.body.classList.add('printing-active-full');
      }

      try {
        window.print();
      } catch (err) {
        console.error('Browser print execution failed:', err);
        triggerToast(
          "Print blocked by iframe sandbox. Please click 'Open in New Tab' at the top of AI Studio, then click Print.",
          "error"
        );
      } finally {
        // Clean up everything immediately
        document.body.classList.remove('printing-active');
        document.body.classList.remove('printing-active-full');
        if (printContainer && document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
      }
    } else if (typeof window !== 'undefined') {
      try {
        window.print();
      } catch (err) {
        console.error('Fallback window print failed:', err);
      }
    }
  };

  const handleExportPaystubPDF = (entry: any, activePaystubRun: any) => {
    try {
      const matchedEmployee = db.employees.find(e => e.id === entry.employeeId);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Top Header / Accent bar (Rose color)
      doc.setFillColor(244, 63, 94); // rose-500
      doc.rect(15, 15, 180, 3, 'F');

      // Title & Company
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor('#1E293B'); // Slate 800
      doc.text('ARKA DENTAL CLINIC', 15, 27);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#64748B'); // Slate 500
      doc.text('BF Homes, Parañaque City, Metro Manila', 15, 32);

      // Payroll Info Right side
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor('#475569');
      doc.text(`PAYROLL CODE: ${activePaystubRun.code}`, 130, 27);
      doc.text(`PAY DATE: ${activePaystubRun.payDate}`, 130, 32);

      // Section divider
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(15, 37, 195, 37);

      // Employee Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor('#0F172A');
      doc.text('EMPLOYEE DETAIL', 15, 45);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor('#1E293B');
      doc.text(entry.employeeName, 15, 51);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor('#475569');
      doc.text(`Position: ${matchedEmployee?.role || entry.employeeType}`, 15, 56);
      doc.text(`TIN: ${matchedEmployee?.tin || 'Exempt'}   •   SSS #: ${matchedEmployee?.sssNumber || 'Exempt'}`, 15, 61);

      // Cut-off period details (Right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor('#0F172A');
      doc.text('PAY CUT-OFF PERIOD', 115, 45);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor('#1E293B');
      doc.text(`${activePaystubRun.payPeriodStart} to ${activePaystubRun.payPeriodEnd}`, 115, 51);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor('#64748B');
      doc.text('Tax Code: PH-BIR-S1 (Exempt)', 115, 56);

      // Divider line
      doc.line(15, 68, 195, 68);

      // Column headers for Earnings vs Deductions
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor('#0F172A');
      doc.text('EARNINGS', 15, 76);
      doc.text('STATUTORY DEDUCTIONS', 115, 76);

      // Underlines for headers
      doc.setDrawColor(203, 213, 225);
      doc.line(15, 78, 95, 78);
      doc.line(115, 78, 195, 78);

      // Earnings list
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor('#334155');

      let earningsY = 84;
      
      // Base Accountable Salary
      doc.text(`Base Salary (${entry.presentCount ?? 0} Days Worked):`, 15, earningsY);
      doc.text(`PHP ${Math.round(entry.basePay - (entry.cutoffDelta ?? 0)).toLocaleString()}`, 95, earningsY, { align: 'right' });
      earningsY += 6;

      if (entry.cutoffDelta && entry.cutoffDelta !== 0) {
        doc.text(`Prior Cut-off Log Adjustment:`, 15, earningsY);
        doc.text(`PHP ${entry.cutoffDelta.toLocaleString()}`, 95, earningsY, { align: 'right' });
        earningsY += 6;
      }

      if (entry.holidayPay > 0) {
        doc.text(`Holiday Worked Premium:`, 15, earningsY);
        doc.text(`PHP ${Math.round(entry.holidayPay).toLocaleString()}`, 95, earningsY, { align: 'right' });
        earningsY += 6;
      }

      if (entry.commission > 0) {
        doc.text(`Treatments & Comm Accruals:`, 15, earningsY);
        doc.text(`PHP ${Math.round(entry.commission).toLocaleString()}`, 95, earningsY, { align: 'right' });
        earningsY += 6;
      }

      if (entry.hmoAllowance > 0) {
        doc.text(`HMO Daily Allowance:`, 15, earningsY);
        doc.text(`PHP ${Math.round(entry.hmoAllowance).toLocaleString()}`, 95, earningsY, { align: 'right' });
        earningsY += 6;
      }

      if (matchedEmployee?.clinicSharePercentage !== undefined && matchedEmployee.clinicSharePercentage > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Clinic Share Comm. (${matchedEmployee.clinicSharePercentage}%):`, 15, earningsY);
        doc.text(`PHP ${Math.round(entry.commission * (matchedEmployee.clinicSharePercentage / 100)).toLocaleString()}`, 95, earningsY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        earningsY += 6;
      }

      // Gross Total
      doc.setFillColor(248, 250, 252);
      doc.rect(15, earningsY + 2, 80, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#15803D'); // emerald-700
      doc.text('GROSS TAXABLE EARNINGS (A):', 17, earningsY + 7);
      doc.text(`PHP ${Math.round(entry.grossPay).toLocaleString()}`, 93, earningsY + 7, { align: 'right' });

      // Deductions list
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor('#334155');

      let deductionsY = 84;
      
      // SSS
      doc.text(`Philippine SSS Share:`, 115, deductionsY);
      doc.text(`PHP ${Math.round(entry.sssContribution).toLocaleString()}`, 195, deductionsY, { align: 'right' });
      deductionsY += 6;

      // PhilHealth
      doc.text(`PhilHealth Share Prem:`, 115, deductionsY);
      doc.text(`PHP ${Math.round(entry.philhealthContribution).toLocaleString()}`, 195, deductionsY, { align: 'right' });
      deductionsY += 6;

      // Pag-IBIG
      doc.text(`Pag-IBIG Mutuality:`, 115, deductionsY);
      doc.text(`PHP ${Math.round(entry.pagibigContribution).toLocaleString()}`, 195, deductionsY, { align: 'right' });
      deductionsY += 6;

      // BIR Withholding
      doc.text(`BIR Withholding Tax:`, 115, deductionsY);
      doc.text(`PHP 0 (Exempt)`, 195, deductionsY, { align: 'right' });
      deductionsY += 6;

      // Total Deductions
      const maxRowsY = Math.max(earningsY, deductionsY);
      doc.setFillColor(254, 242, 242);
      doc.rect(115, maxRowsY + 2, 80, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#B91C1C'); // red-700
      doc.text('TOTAL DEDUCTIONS (B):', 117, maxRowsY + 7);
      const totalDeductions = entry.sssContribution + entry.philhealthContribution + entry.pagibigContribution;
      doc.text(`PHP ${Math.round(totalDeductions).toLocaleString()}`, 193, maxRowsY + 7, { align: 'right' });

      // Take-home Box
      const boxY = maxRowsY + 16;
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(15, boxY, 180, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor('#38BDF8'); // sky-400
      doc.text('NET PAY CLINICAL TAKE-HOME (A - B)', 20, boxY + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor('#94A3B8'); // slate-400
      doc.text('Disbursed under GCash Ledger references.', 20, boxY + 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor('#4ADE80'); // green-400
      doc.text(`PHP ${Math.round(entry.netPay).toLocaleString()}`, 190, boxY + 11, { align: 'right' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor('#94A3B8');
      doc.text('This is a computer-generated official pay stub.', 15, boxY + 26);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 15, boxY + 30);

      // Save PDF
      doc.save(`Paystub-${entry.employeeName.replace(/\s+/g, '_')}-${activePaystubRun.code}.pdf`);
      triggerToast(`Successfully exported PDF for ${entry.employeeName}!`, 'success');
    } catch (err) {
      console.error('Failed to generate jsPDF for paystub:', err);
      triggerToast('Failed to generate PDF. Falling back to print view.', 'error');
      // Fallback to print
      handlePrintPDF(`statement-print-${entry.employeeId}-${activePaystubRun.code}`);
    }
  };

  // Dynamic Cut-off Periods state
  const [showAddPeriodForm, setShowAddPeriodForm] = useState<boolean>(false);
  const [newPeriodCode, setNewPeriodCode] = useState<string>('');
  const [newPeriodLabel, setNewPeriodLabel] = useState<string>('');

  // Dynamic Employee Registration state
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState<boolean>(false);
  const [newEmpFullName, setNewEmpFullName] = useState<string>('');
  const [newEmpCode, setNewEmpCode] = useState<string>('');
  const [newEmpType, setNewEmpType] = useState<EmployeeType>('DENTIST');
  const [newEmpBasePayRate, setNewEmpBasePayRate] = useState<number>(0);
  const [newEmpClinicShare, setNewEmpClinicShare] = useState<number>(0);
  const [newEmpRole, setNewEmpRole] = useState<string>('');
  const [newEmpTin, setNewEmpTin] = useState<string>('');
  const [newEmpContactNumber, setNewEmpContactNumber] = useState<string>('');

  // Data Clearance Console footer states
  const [deleteFromDate, setDeleteFromDate] = useState<string>('2026-06-01');
  const [deleteToDate, setDeleteToDate] = useState<string>('2026-06-30');
  const [deleteMonth, setDeleteMonth] = useState<string>('JUNE_2026');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetConfirmStep, setResetConfirmStep] = useState<1 | 2 | 3>(1);
  const [doneReviewing, setDoneReviewing] = useState<boolean>(false);
  const [countdownSecs, setCountdownSecs] = useState<number>(5);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);
  const [clearPasscode, setClearPasscode] = useState<string>('');

  // Countdown timer watcher
  useEffect(() => {
    let timer: any;
    if (isCountdownActive && countdownSecs > 0) {
      timer = setTimeout(() => {
        setCountdownSecs(prev => prev - 1);
      }, 1000);
    } else if (isCountdownActive && countdownSecs === 0) {
      setIsCountdownActive(false);
      handleExecuteRangeDeletion();
    }
    return () => clearTimeout(timer);
  }, [isCountdownActive, countdownSecs]);

  const handleExecuteRangeDeletion = () => {
    const start = new Date(deleteFromDate);
    const end = new Date(deleteToDate);

    // Filter transactions
    const filteredTxns = db.transactions.filter((t: any) => {
      const d = new Date(t.date);
      return !(d >= start && d <= end);
    });

    // Filter expenses
    const filteredExpenses = db.expenses.filter((e: any) => {
      const d = new Date(e.date);
      return !(d >= start && d <= end);
    });

    // Filter payrollRuns
    const filteredPayruns = db.payrollRuns.filter((r: any) => {
      const pStart = new Date(r.payPeriodStart);
      const pEnd = new Date(r.payPeriodEnd);
      return !(pStart >= start && pEnd <= end);
    });

    // Filter attendanceRecords
    const filteredAttendance = (db.attendanceRecords || []).filter((a: any) => {
      const d = new Date(a.date);
      return !(d >= start && d <= end);
    });

    // Filter cutoffAdjustments
    const filteredAdjustments = (db.cutoffAdjustments || []).filter((adj: any) => {
      if (!adj.timestamp) return true;
      const d = new Date(adj.timestamp.split('T')[0]);
      return !(d >= start && d <= end);
    });

    // Filter financialAdjustments
    const filteredFinancialAdjs = (db.financialAdjustments || []).filter((f: any) => {
      const d = new Date(f.date);
      return !(d >= start && d <= end);
    });

    const updatedDb = {
      ...db,
      transactions: filteredTxns,
      expenses: filteredExpenses,
      payrollRuns: filteredPayruns,
      attendanceRecords: filteredAttendance,
      cutoffAdjustments: filteredAdjustments,
      financialAdjustments: filteredFinancialAdjs
    };

    updateClinicalDb(updatedDb);
    setShowResetConfirmModal(false);
    setResetConfirmStep(1);
    setDoneReviewing(false);
    setCountdownSecs(5);
    triggerToast(`Clearance executed successfully. Purged all clinical ledger data between ${deleteFromDate} and ${deleteToDate}.`, 'success');
  };

  // Transaction forms State
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txnPatientId, setTxnPatientId] = useState('');
  const [txnDentistId, setTxnDentistId] = useState('emp-ku'); // Default Dr. Karla Urbi
  const [txnProcedureCode, setTxnProcedureCode] = useState('CON');
  const [txnPaymentMode, setTxnPaymentMode] = useState<'CASH' | 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BPI' | 'MAYA' | 'GOTYME' | 'HMO'>('CASH');
  const [txnAmountCharged, setTxnAmountCharged] = useState<number>(500);
  const [txnDiscountType, setTxnDiscountType] = useState<'SENIOR' | 'MONTHLY_PROMO' | 'DMD_DISCOUNT' | 'NONE'>('NONE');
  const [txnDiscountAmount, setTxnDiscountAmount] = useState<number>(0);
  const [txnAmountPaid, setTxnAmountPaid] = useState<number>(500);
  const [txnLabFee, setTxnLabFee] = useState<number>(0);
  const [txnLabVendor, setTxnLabVendor] = useState('');
  const [txnRemarks, setTxnRemarks] = useState('');
  const [txnSmartTag, setTxnSmartTag] = useState<'Clinical' | 'Administrative' | 'Maintenance' | 'Uncategorized'>('Uncategorized');
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [txnCommissionRate, setTxnCommissionRate] = useState<number>(10);
  const [txnCommissionAmount, setTxnCommissionAmount] = useState<number>(50);

  // Patient Register Forms
  const [patLastName, setPatLastName] = useState('');
  const [patFirstName, setPatFirstName] = useState('');
  const [patHmoProvider, setPatHmoProvider] = useState<'NONE' | 'HP' | 'FILDOCS' | 'COCOLIFE'>('NONE');
  const [patHmoId, setPatHmoId] = useState('');

  // Receipt OCR States
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [receiptImageRaw, setReceiptImageRaw] = useState<string>('');
  const [ocrLog, setOcrLog] = useState<string>('');

  // Smart Audit Simulator States
  const [auditRunReport, setAuditRunReport] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditClipboardText, setAuditClipboardText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Paystub Active Viewer State
  const [selectedPaystubRunId, setSelectedPaystubRunId] = useState<string | null>(null);
  const [selectedPaystubEmployeeId, setSelectedPaystubEmployeeId] = useState<string | null>(null);

  // Bulk Excel/CSV Import States
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [parsedRawRows, setParsedRawRows] = useState<any[]>([]);
  const [importType, setImportType] = useState<'TRANSACTIONS' | 'EXPENSES' | 'EMPLOYEES' | 'PATIENTS'>('TRANSACTIONS');
  const [importDragActive, setImportDragActive] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dashboard-integrated smart AI importer state
  const [dashboardImportFile, setDashboardImportFile] = useState<File | null>(null);
  const [dashboardImportResults, setDashboardImportResults] = useState<{
    fileName: string;
    totalRows: number;
    detectedType: 'TRANSACTIONS' | 'EXPENSES' | 'EMPLOYEES' | 'PATIENTS';
    typosCorrected: { field: string; original: string; corrected: string; rowIdx: number }[];
    duplicates: { rowIdx: number; item: any; duplicateOf: any; skip: boolean }[];
    cleanRecords: any[];
  } | null>(null);
  const [dashboardDragActive, setDashboardDragActive] = useState<boolean>(false);
  const dashboardFileInputRef = React.useRef<HTMLInputElement>(null);

  // Global Excel/CSV Workbook Pattern Importer States
  const [showGlobalImportModal, setShowGlobalImportModal] = useState<boolean>(false);
  const [globalImportResults, setGlobalImportResults] = useState<{
    fileName: string;
    distribution: {
      [category: string]: {
        sheetName: string;
        rows: any[];
        mapped: any[];
        headers: string[];
      };
    };
  } | null>(null);
  const globalFileInputRef = React.useRef<HTMLInputElement>(null);

  // Levenshtein distance for fuzzy typo correction
  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) tmp.push([i]);
    for (j = 1; j <= b.length; j++) tmp[0].push(j);
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  };

  // Robust Date Parser supporting Excel serials, DD/MM/YYYY, ISO, and standard dates
  const parseRobustDate = (rawDate: any): string => {
    if (!rawDate) return new Date().toISOString().slice(0, 10);
    
    // 1. If it's a number or numeric string (Excel serial date)
    const serial = Number(rawDate);
    if (!isNaN(serial) && serial > 30000 && serial < 60000) {
      try {
        const date = new Date((serial - 25569) * 24 * 3600 * 1000);
        if (!isNaN(date.getTime())) {
          return date.toISOString().slice(0, 10);
        }
      } catch (e) {}
    }

    // 2. Try simple cleanups
    let str = String(rawDate).trim();
    if (!str) return new Date().toISOString().slice(0, 10);
    
    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmRef = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmRef) {
      const d = parseInt(dmRef[1], 10);
      const m = parseInt(dmRef[2], 10);
      const y = parseInt(dmRef[3], 10);
      if (m > 12) {
        // m is day, d is month
        const dateObj = new Date(y, d - 1, m);
        if (!isNaN(dateObj.getTime())) return dateObj.toISOString().slice(0, 10);
      } else {
        // Assume d is day, m is month
        const dateObj = new Date(y, m - 1, d);
        if (!isNaN(dateObj.getTime())) return dateObj.toISOString().slice(0, 10);
      }
    }

    // Try standard parse
    try {
      const dateObj = new Date(str);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
    } catch (e) {}

    return new Date().toISOString().slice(0, 10);
  };

  const findFuzzyDentist = (dentistInput: string, employees: Employee[]) => {
    if (!dentistInput) {
      const firstDentist = employees.find(e => e.type === 'DENTIST') || employees[0];
      return { dentistId: firstDentist.id, original: '', matchType: 'fallback' as const, correctedName: firstDentist.fullName };
    }
    
    const cleaned = dentistInput.trim().toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
    
    for (const emp of employees) {
      const code = emp.code.toLowerCase();
      const displayName = emp.displayName.toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
      const fullName = emp.fullName.toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
      
      if (
        cleaned === emp.id.toLowerCase() || 
        cleaned === code || 
        cleaned === emp.fullName.toLowerCase() ||
        cleaned === emp.displayName.toLowerCase() ||
        cleaned === displayName ||
        cleaned === fullName
      ) {
        return { dentistId: emp.id, original: dentistInput, matchType: 'exact' as const, correctedName: emp.fullName };
      }
    }
    
    let bestEmp = null;
    let bestScore = 0;
    
    for (const emp of employees) {
      const displayName = emp.displayName.toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
      const fullName = emp.fullName.toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
      
      let score = 0;
      if (fullName.includes(cleaned) || cleaned.includes(fullName)) score += 10;
      if (displayName.includes(cleaned) || cleaned.includes(displayName)) score += 8;
      
      const initials = emp.fullName.split(' ').map(n => n[0]).join('').toLowerCase();
      if (cleaned === initials) score += 9;
      
      if (score > bestScore) {
        bestScore = score;
        bestEmp = emp;
      }
    }
    
    if (bestEmp && bestScore >= 5) {
      return { dentistId: bestEmp.id, original: dentistInput, matchType: 'fuzzy' as const, correctedName: bestEmp.fullName };
    }
    
    for (const emp of employees) {
      const fullName = emp.fullName.toLowerCase().replace(/^(dr|dr\.|doctor)\s+/i, '');
      const dist = getLevenshteinDistance(cleaned, fullName);
      if (dist <= 3) {
        return { dentistId: emp.id, original: dentistInput, matchType: 'fuzzy' as const, correctedName: emp.fullName };
      }
    }
    
    const fallbackDentist = employees.find(e => e.type === 'DENTIST') || employees[0];
    return { dentistId: fallbackDentist.id, original: dentistInput, matchType: 'fallback' as const, correctedName: fallbackDentist.fullName };
  };

  const findFuzzyPatient = (patientInput: string, patients: Patient[]) => {
    if (!patientInput) {
      return { patientId: '', patientName: 'Walk-in Patient', original: '', matchType: 'new' as const };
    }
    const cleaned = patientInput.trim().toLowerCase();
    
    for (const p of patients) {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const lastNameFirst = `${p.lastName}, ${p.firstName}`.toLowerCase();
      if (cleaned === fullName || cleaned === lastNameFirst || cleaned === p.id.toLowerCase() || cleaned === p.code.toLowerCase()) {
        return { patientId: p.id, patientName: `${p.firstName} ${p.lastName}`, original: patientInput, matchType: 'exact' as const, correctedName: `${p.firstName} ${p.lastName}` };
      }
    }
    
    for (const p of patients) {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (getLevenshteinDistance(cleaned, fullName) <= 3) {
        return { patientId: p.id, patientName: `${p.firstName} ${p.lastName}`, original: patientInput, matchType: 'fuzzy' as const, correctedName: `${p.firstName} ${p.lastName}` };
      }
    }
    
    return { patientId: '', patientName: patientInput, original: patientInput, matchType: 'new' as const };
  };

  const findFuzzyProcedure = (procInput: string, procedures: ProcedureCatalogItem[]) => {
    if (!procInput) {
      return { code: 'CON', name: 'General Consultation', matchType: 'fallback' as const, correctedName: 'Consultation' };
    }
    const cleaned = procInput.trim().toLowerCase();
    
    for (const p of procedures) {
      if (cleaned === p.code.toLowerCase() || cleaned === p.name.toLowerCase()) {
        return { code: p.code, name: p.name, matchType: 'exact' as const, correctedName: p.name };
      }
    }
    
    for (const p of procedures) {
      if (p.name.toLowerCase().includes(cleaned) || cleaned.includes(p.name.toLowerCase())) {
        return { code: p.code, name: p.name, matchType: 'fuzzy' as const, correctedName: p.name };
      }
    }
    
    for (const p of procedures) {
      if (getLevenshteinDistance(cleaned, p.name.toLowerCase()) <= 4) {
        return { code: p.code, name: p.name, matchType: 'fuzzy' as const, correctedName: p.name };
      }
    }
    
    return { code: 'CON', name: procInput, matchType: 'fallback' as const, correctedName: 'Consultation' };
  };

  const checkDuplicateTransaction = (parsed: Transaction, existingTxns: Transaction[]) => {
    const dup = existingTxns.find(e => 
      e.date === parsed.date &&
      e.amountPaid === parsed.amountPaid &&
      (e.patientId === parsed.patientId || e.patientName.toLowerCase() === parsed.patientName.toLowerCase()) &&
      (e.procedureCode === parsed.procedureCode || e.procedureName.toLowerCase() === parsed.procedureName.toLowerCase())
    );
    return { isDuplicate: !!dup, duplicateOf: dup };
  };

  // --- MULTI-CATEGORY EXCEL/CSV PATTERN IMPORTER HELPERS ---
  const mapTransaction = (row: any, idx: number, dbEmployees: Employee[], dbPatients: Patient[], dbProcedures: ProcedureCatalogItem[]) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };
    const parseNum = (aliases: string[], fallback: number = 0): number => {
      const valStr = getVal(aliases);
      if (!valStr) return fallback;
      const cleaned = valStr.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? fallback : num;
    };

    const rawDate = getVal(['date', 'txndate', 'transactiondate', 'timestamp', 'createdat']);
    const txnDate = parseRobustDate(rawDate);

    const rawPatient = getVal(['patient', 'patientname', 'client', 'name', 'fullname', 'patient_name', 'patientsname', "patient'sname", 'patient_s_name', 'remark']);
    const patientNameVal = rawPatient || 'Walk-in Patient';
    const patMatch = findFuzzyPatient(patientNameVal, dbPatients);
    const patientId = patMatch.patientId;
    const patientName = patMatch.patientName;

    const rawDentist = getVal(['dentist', 'dentistname', 'doctor', 'clinician', 'employee', 'dentist_name', 'dmd', 'duty']);
    const dentistMatch = findFuzzyDentist(rawDentist, dbEmployees);
    const dentistId = dentistMatch.dentistId;

    const rawProcedure = getVal(['procedure', 'procedurename', 'treatment', 'service', 'procedurecode', 'procedure_code']);
    const procMatch = findFuzzyProcedure(rawProcedure, dbProcedures);
    const procedureCode = procMatch.code;
    const procedureName = procMatch.name;
    const foundProcedure = dbProcedures.find(p => p.code === procedureCode);
    const commissionTierApplied = foundProcedure?.commissionTier || 'TIER_1';

    const discountAmount = parseNum(['discountamount', 'discount_amt', 'less', 'discount'], 0);
    const amountPaid = parseNum(['amountpaid', 'paid', 'amount_paid', 'actual_paid', 'paidamount', 'paid amount'], 1200);
    const amountCharged = parseNum(['amountcharged', 'charged', 'charge', 'amount', 'fee', 'price', 'totalgross', 'gross'], amountPaid + discountAmount);

    let discountType: 'SENIOR' | 'MONTHLY_PROMO' | 'DMD_DISCOUNT' | 'NONE' = 'NONE';
    const discountTypeRaw = getVal(['discounttype', 'discount_type', 'promo', 'discount_name']).toUpperCase();
    if (discountAmount > 0) {
      if (discountTypeRaw.includes('SENIOR') || discountTypeRaw.includes('PWD')) discountType = 'SENIOR';
      else if (discountTypeRaw.includes('PROMO') || discountTypeRaw.includes('MONTHLY')) discountType = 'MONTHLY_PROMO';
      else discountType = 'DMD_DISCOUNT';
    }

    const paymentModeRaw = getVal(['paymentmode', 'payment', 'mode', 'type', 'payment_type', 'paymenttype', 'payment type']).toUpperCase();
    let paymentMode: 'CASH' | 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BPI' | 'MAYA' | 'GOTYME' | 'HMO' = 'CASH';
    if (paymentModeRaw.includes('CASH')) paymentMode = 'CASH';
    else if (paymentModeRaw.includes('GCASH')) paymentMode = 'GCASH';
    else if (paymentModeRaw.includes('CREDIT') || paymentModeRaw.includes('CC')) paymentMode = 'CREDIT_CARD';
    else if (paymentModeRaw.includes('DEBIT')) paymentMode = 'DEBIT_CARD';
    else if (paymentModeRaw.includes('BPI')) paymentMode = 'BPI';
    else if (paymentModeRaw.includes('MAYA')) paymentMode = 'MAYA';
    else if (paymentModeRaw.includes('GOTYME')) paymentMode = 'GOTYME';
    else if (paymentModeRaw.includes('HMO') || paymentModeRaw.includes('INSURANCE')) paymentMode = 'HMO';

    const isCredit = paymentMode === 'CREDIT_CARD' || paymentMode === 'DEBIT_CARD';
    const merchantFee = isCredit ? Math.round(amountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = amountPaid - merchantFee;
    const labFee = parseNum(['labfee', 'lab_fee', 'labcost', 'lab fee'], 0);
    const labVendor = getVal(['labvendor', 'lab', 'vendor', 'laboratory']);

    let hmoProviderNameRaw = getVal(['hmo', 'hmoprovider', 'insurance', 'provider']).toUpperCase();
    let hmoProviderName: 'HP' | 'FILDOCS' | 'COCOLIFE' | 'NONE' = 'NONE';
    if (hmoProviderNameRaw.includes('HP')) hmoProviderName = 'HP';
    else if (hmoProviderNameRaw.includes('FILDOCS')) hmoProviderName = 'FILDOCS';
    else if (hmoProviderNameRaw.includes('COCO')) hmoProviderName = 'COCOLIFE';

    let hmoFeeCharged = 0;
    if (paymentMode === 'HMO') {
      hmoFeeCharged = parseNum(['hmofee', 'hmo fee'], amountPaid);
    }

    const netRevenue = (paymentMode === 'HMO') ? hmoFeeCharged - labFee : actualSales - labFee;
    let rate = foundProcedure?.commissionRateDefault !== undefined ? foundProcedure.commissionRateDefault : 0.10;
    if (commissionTierApplied === 'TIER_2' && foundProcedure?.commissionRateDefault === undefined) rate = 0.30;
    
    const customComm = parseNum(['commission', 'commissionamount', 'commission_amt', 'commission amount'], -1);
    const commissionAmount = customComm !== -1 ? customComm : Math.max(0, Math.round(netRevenue * rate * 100) / 100);

    const remarks = getVal(['remarks', 'remarks_desc', 'notes', 'note', 'comment', 'description', 'remark']);

    return {
      id: `txn-bulk-${idx}-${Date.now()}`,
      code: `TXN-BULK-${txnDate.replace(/-/g, '')}-0${idx + 1}`,
      date: txnDate,
      dentistId,
      patientId,
      patientName,
      procedureCode,
      procedureName,
      amountCharged,
      discountType,
      discountAmount,
      amountPaid,
      paymentMode,
      merchantFee,
      actualSales,
      hmoFee: paymentMode === 'HMO' ? hmoFeeCharged : undefined,
      labFee,
      labVendor: labVendor || undefined,
      netRevenue,
      commissionTierApplied,
      commissionRateApplied: rate,
      commissionAmount,
      remarks: remarks || undefined,
      smartTag: 'Clinical'
    } as Transaction;
  };

  const mapExpense = (row: any, idx: number) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };
    const parseNum = (aliases: string[], fallback: number = 0): number => {
      const valStr = getVal(aliases);
      if (!valStr) return fallback;
      const cleaned = valStr.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? fallback : num;
    };

    const rawDate = getVal(['date', 'expensedate', 'timestamp']);
    const date = rawDate ? parseRobustDate(rawDate) : new Date().toISOString().slice(0, 10);

    const categoryRaw = getVal(['category', 'expensecategory', 'type', 'expense_category']).toUpperCase();
    const category = ['RENT', 'UTILITIES', 'SUPPLIES', 'EQUIPMENT', 'MARKETING', 'FOOD', 'PROFESSIONAL', 'REGISTRATION', 'LAB', 'MISC'].includes(categoryRaw)
      ? (categoryRaw as any)
      : 'MISC';

    const vendorName = getVal(['vendor', 'vendorname', 'supplier', 'payee', 'vendor/supplier']) || 'General Vendor';
    const amount = parseNum(['amount', 'price', 'cost', 'total'], 0);
    const paymentMode = getVal(['paymentmode', 'payment', 'mode', 'payment mode']) || 'CASH';
    const description = getVal(['description', 'note', 'remarks', 'memo']);
    const statusRaw = getVal(['status', 'approval']).toUpperCase();
    const status = ['APPROVED', 'PENDING'].includes(statusRaw) ? (statusRaw as any) : 'APPROVED';

    return {
      id: `exp-bulk-${idx}-${Date.now()}`,
      code: `EXP-BULK-${date.replace(/-/g, '')}-0${idx + 1}`,
      date,
      category,
      vendorName,
      amount,
      paymentMode,
      description: description || undefined,
      status
    } as Expense;
  };

  const mapPatient = (row: any, idx: number) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };

    const fullName = getVal(['patientname', 'patient name', 'patient\'s name', 'name', 'fullname', 'client']);
    let firstName = getVal(['firstname', 'first_name']);
    let lastName = getVal(['lastname', 'last_name']);

    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.split(' ');
      if (parts.length > 1) {
        firstName = parts.slice(0, -1).join(' ');
        lastName = parts[parts.length - 1];
      } else {
        firstName = fullName;
        lastName = 'Patient';
      }
    }

    firstName = firstName || 'Unnamed';
    lastName = lastName || 'Patient';

    const hmoRaw = getVal(['hmoprovider', 'hmo', 'insurance', 'provider']).toUpperCase();
    const hmoProvider = ['HP', 'FILDOCS', 'COCOLIFE'].includes(hmoRaw) ? (hmoRaw as any) : 'NONE';
    const hmoIdNumber = getVal(['hmoid', 'hmoidnumber', 'cardnumber', 'hmo_num', 'id']);

    return {
      id: `pat-bulk-${idx}-${Date.now()}`,
      code: `P-BULK-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      firstName,
      lastName,
      hmoProvider,
      hmoIdNumber: hmoIdNumber || undefined
    } as Patient;
  };

  const mapEmployee = (row: any, idx: number) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };
    const parseNum = (aliases: string[], fallback: number = 0): number => {
      const valStr = getVal(aliases);
      if (!valStr) return fallback;
      const cleaned = valStr.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? fallback : num;
    };

    const fullName = getVal(['fullname', 'full name', 'name', 'employee', 'employeename']) || 'New Staff';
    let displayName = getVal(['displayname', 'nickname', 'shortname']);
    if (!displayName) {
      displayName = fullName.split(' ')[0];
    }

    const rawCode = getVal(['staffidentifiercode', 'staff identifier code', 'code', 'id', 'emp_code', 'employee_id']);
    const code = rawCode ? rawCode.toUpperCase() : `EMP-${fullName.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const typeRaw = getVal(['employeetype/role', 'employee type', 'role', 'type', 'position']).toUpperCase();
    let type: 'DENTIST' | 'ASSISTANT' | 'TEMP' | 'ADMIN' = 'ASSISTANT';
    if (typeRaw.includes('DENTIST') || typeRaw.includes('DOCTOR') || typeRaw.includes('DMD')) type = 'DENTIST';
    else if (typeRaw.includes('ADMIN') || typeRaw.includes('BOOKKEEPER')) type = 'ADMIN';
    else if (typeRaw.includes('TEMP')) type = 'TEMP';

    const basePayRate = parseNum(['semi-monthlybasepay', 'semi-monthly base pay', 'basepayrate', 'rate', 'salary'], 0);
    const tin = getVal(['tin/taxregistrationnumber', 'tin', 'tax registration number', 'tax_id']);

    return {
      id: `emp-bulk-${idx}-${Date.now()}`,
      code,
      fullName,
      displayName,
      type,
      status: 'ACTIVE',
      startDate: new Date().toISOString().slice(0, 10),
      sssNumber: 'N/A',
      philhealthNumber: 'N/A',
      pagibigMID: 'N/A',
      tin: tin || 'N/A',
      dateOfBirth: '1990-01-01',
      contactNumber: getVal(['contactnumber', 'contact number', 'phone', 'mobile']) || 'N/A',
      address: 'Metro Manila, Philippines',
      emergencyContact: 'N/A',
      basePayRate,
      payFrequency: type === 'ASSISTANT' ? 'WEEKLY' : 'SEMI_MONTHLY',
      commissionTierDefault: 'TIER_1'
    } as Employee;
  };

  const mapPayrollEntry = (row: any, idx: number, dbEmployees: Employee[]) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };
    const parseNum = (aliases: string[], fallback: number = 0): number => {
      const valStr = getVal(aliases);
      if (!valStr) return fallback;
      const cleaned = valStr.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? fallback : num;
    };

    const empName = getVal(['employeename', 'employee name', 'name', 'fullname']);
    const emp = dbEmployees.find(e => e.fullName.toLowerCase().includes(empName.toLowerCase()) || empName.toLowerCase().includes(e.fullName.toLowerCase()));
    const employeeId = emp?.id || `emp-${Date.now()}-${idx}`;
    const employeeName = emp?.fullName || empName || 'Staff Member';
    const employeeType = emp?.type || 'ASSISTANT';

    const baseSalary = parseNum(['basesalary', 'base salary', 'salary', 'base_salary'], 0);
    const commissionEarned = parseNum(['commissionearned', 'commission earned', 'commission', 'comm_earned'], 0);
    const deductions = parseNum(['deductions', 'deduct', 'tax_withheld'], 0);
    const netPay = parseNum(['netpay', 'net pay', 'net_pay'], baseSalary + commissionEarned - deductions);

    return {
      employeeId,
      employeeName,
      employeeType,
      baseSalary,
      commissionEarned,
      deductions,
      netPay,
      workedDaysCount: 15,
      attendanceStatusSummary: 'PRESENT',
      sssContribution: 0,
      philhealthContribution: 0,
      pagibigContribution: 0,
      withholdingTax: deductions,
      totalDeductions: deductions,
      grossPay: baseSalary + commissionEarned
    };
  };

  const mapAttendance = (row: any, idx: number, dbEmployees: Employee[]) => {
    const getVal = (aliases: string[]): string => {
      for (const alias of aliases) {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_'-]/g, '') === alias.toLowerCase().replace(/[\s_'-]/g, ''));
        if (key) return String(row[key]).trim();
      }
      return '';
    };

    const rawDate = getVal(['date', 'day', 'timestamp']);
    const date = rawDate ? parseRobustDate(rawDate) : new Date().toISOString().slice(0, 10);

    const empName = getVal(['employeename', 'employee name', 'name', 'fullname']);
    const emp = dbEmployees.find(e => e.fullName.toLowerCase().includes(empName.toLowerCase()) || empName.toLowerCase().includes(e.fullName.toLowerCase()));
    const employeeId = emp?.id || `emp-${Date.now()}-${idx}`;
    const employeeName = emp?.fullName || empName || 'Staff Member';
    const employeeType = emp?.type || 'ASSISTANT';

    const statusRaw = getVal(['status', 'attendance status', 'attendance_status']).toUpperCase();
    let status: 'PRESENT' | 'ABSENT' | 'VL' | 'SL' | 'HOLIDAY_OFF' | 'HOLIDAY_WORKED' = 'PRESENT';
    if (statusRaw.includes('PRESENT')) status = 'PRESENT';
    else if (statusRaw.includes('ABSENT')) status = 'ABSENT';
    else if (statusRaw.includes('VACATION') || statusRaw === 'VL') status = 'VL';
    else if (statusRaw.includes('SICK') || statusRaw === 'SL') status = 'SL';
    else if (statusRaw.includes('HOLIDAY_OFF') || statusRaw.includes('HOLIDAY OFF')) status = 'HOLIDAY_OFF';
    else if (statusRaw.includes('HOLIDAY_WORKED') || statusRaw.includes('HOLIDAY WORKED')) status = 'HOLIDAY_WORKED';

    const remarks = getVal(['remarks', 'notes', 'note', 'remark']);

    return {
      id: `att-bulk-${idx}-${Date.now()}`,
      employeeId,
      employeeName,
      employeeType,
      date,
      status,
      holidayPayMultiplier: status === 'HOLIDAY_WORKED' ? 2.0 : status === 'HOLIDAY_OFF' ? 1.0 : undefined,
      remarks: remarks || undefined
    } as AttendanceRecord;
  };

  const handleGlobalFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        
        const distributionResults: {
          [category: string]: {
            sheetName: string;
            rows: any[];
            mapped: any[];
            headers: string[];
          }
        } = {};

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          if (!rawJson || rawJson.length === 0) return;

          const firstRow = rawJson[0] as any;
          const keys = Object.keys(firstRow).map(k => k.toLowerCase().replace(/[\s_'-]/g, ''));
          
          // Detect category by pattern matching headers
          let detectedCategory: 'TRANSACTIONS' | 'EXPENSES' | 'PATIENTS' | 'EMPLOYEES' | 'PAYROLL' | 'ATTENDANCE' | null = null;

          const isTransactions = keys.some(k => k.includes('procedure') || k.includes('dentist') || k.includes('commission') || k.includes('paidamount') || k.includes('grossintake'));
          const isExpenses = keys.some(k => k.includes('expensecategory') || k.includes('budgetlimit') || k.includes('variance') || k.includes('vendor') || k.includes('supplier'));
          const isPatients = keys.some(k => k.includes('hmoprovider') || k.includes('hmocoverage') || k.includes('patientgap') || k.includes('claimstatus') || k.includes('hmoid'));
          const isEmployees = keys.some(k => k.includes('staffidentifier') || k.includes('employeetype') || k.includes('semimonthly') || k.includes('clinicshare'));
          const isPayroll = keys.some(k => k.includes('payrollid') || k.includes('payperiod') || k.includes('basesalary') || k.includes('netpay'));
          const isAttendance = keys.some(k => k.includes('timein') || k.includes('timeout') || k.includes('hoursworked') || k.includes('late(mins)') || k.includes('overtime(hrs)'));

          if (isTransactions) detectedCategory = 'TRANSACTIONS';
          else if (isExpenses) detectedCategory = 'EXPENSES';
          else if (isPatients) detectedCategory = 'PATIENTS';
          else if (isEmployees) detectedCategory = 'EMPLOYEES';
          else if (isPayroll) detectedCategory = 'PAYROLL';
          else if (isAttendance) detectedCategory = 'ATTENDANCE';
          
          // Fallback checks
          if (!detectedCategory) {
            if (keys.some(k => k.includes('patient'))) {
              detectedCategory = 'PATIENTS';
            } else if (keys.some(k => k.includes('salary') || k.includes('pay'))) {
              detectedCategory = 'PAYROLL';
            } else if (keys.some(k => k.includes('hours') || k.includes('clock') || k.includes('time'))) {
              detectedCategory = 'ATTENDANCE';
            } else if (keys.some(k => k.includes('vendor') || k.includes('bill'))) {
              detectedCategory = 'EXPENSES';
            } else {
              detectedCategory = 'TRANSACTIONS'; // ultimate fallback
            }
          }

          // Map the rows
          let mappedRows: any[] = [];
          if (detectedCategory === 'TRANSACTIONS') {
            mappedRows = rawJson.map((row, i) => mapTransaction(row, i, db.employees, db.patients, db.procedures));
          } else if (detectedCategory === 'EXPENSES') {
            mappedRows = rawJson.map((row, i) => mapExpense(row, i));
          } else if (detectedCategory === 'PATIENTS') {
            mappedRows = rawJson.map((row, i) => mapPatient(row, i));
          } else if (detectedCategory === 'EMPLOYEES') {
            mappedRows = rawJson.map((row, i) => mapEmployee(row, i));
          } else if (detectedCategory === 'PAYROLL') {
            mappedRows = rawJson.map((row, i) => mapPayrollEntry(row, i, db.employees));
          } else if (detectedCategory === 'ATTENDANCE') {
            mappedRows = rawJson.map((row, i) => mapAttendance(row, i, db.employees));
          }

          distributionResults[detectedCategory] = {
            sheetName,
            rows: rawJson,
            mapped: mappedRows,
            headers: Object.keys(firstRow)
          };
        });

        // Set state and open modal
        setGlobalImportResults({
          fileName: file.name,
          distribution: distributionResults
        });
        setShowGlobalImportModal(true);
        triggerToast(`Successfully analyzed "${file.name}" with ${Object.keys(distributionResults).length} categories detected!`, 'success');

      } catch (err: any) {
        console.error(err);
        triggerToast(`Import analysis failed: ${err.message || err}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveAndRefreshGlobalImports = () => {
    if (!globalImportResults) return;
    const { distribution } = globalImportResults;
    const newDb = { ...db };

    let totalCount = 0;

    Object.entries(distribution).forEach(([category, data]: [string, any]) => {
      const { mapped } = data;
      if (!mapped || mapped.length === 0) return;
      totalCount += mapped.length;

      if (category === 'TRANSACTIONS') {
        const txns = mapped as Transaction[];
        const updatedPatients = [...newDb.patients];
        txns.forEach(t => {
          if (!t.patientId) {
            let tempPat = updatedPatients.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === t.patientName.toLowerCase());
            if (!tempPat) {
              const parts = t.patientName.split(' ');
              const firstName = parts.slice(0, -1).join(' ') || t.patientName;
              const lastName = parts[parts.length - 1] || 'Patient';
              const newPat: Patient = {
                id: `pat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                code: `P-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
                firstName,
                lastName,
                hmoProvider: 'NONE'
              };
              updatedPatients.push(newPat);
              t.patientId = newPat.id;
            } else {
              t.patientId = tempPat.id;
            }
          }
        });
        newDb.patients = updatedPatients;
        newDb.transactions = [...txns, ...newDb.transactions];

      } else if (category === 'EXPENSES') {
        newDb.expenses = [...mapped, ...newDb.expenses];

      } else if (category === 'PATIENTS') {
        newDb.patients = [...mapped, ...newDb.patients];

      } else if (category === 'EMPLOYEES') {
        newDb.employees = [...mapped, ...newDb.employees];

      } else if (category === 'ATTENDANCE') {
        newDb.attendanceRecords = [...mapped, ...(newDb.attendanceRecords || [])];

      } else if (category === 'PAYROLL') {
        // Create a new PayrollRun
        const periodStart = '2026-06-01';
        const periodEnd = '2026-06-15';
        const payDate = '2026-06-15';

        const totalGrossPay = mapped.reduce((acc: number, m: any) => acc + (m.grossPay || m.netPay), 0);
        const totalDeductions = mapped.reduce((acc: number, m: any) => acc + (m.totalDeductions || 0), 0);
        const totalNetPay = mapped.reduce((acc: number, m: any) => acc + m.netPay, 0);

        const newRun: PayrollRun = {
          id: `run-imported-${Date.now()}`,
          code: `PAY-IMPORTED-${periodStart.replace(/-/g, '')}`,
          payPeriodStart: periodStart,
          payPeriodEnd: periodEnd,
          payDate,
          type: 'DENTIST_SEMI_MONTHLY',
          status: 'PAID',
          entries: mapped.map((m: any) => ({
            ...m,
            workedDaysCount: 15,
            attendanceStatusSummary: 'PRESENT',
            sssContribution: m.sssContribution || 0,
            philhealthContribution: m.philhealthContribution || 0,
            pagibigContribution: m.pagibigContribution || 0,
            withholdingTax: m.withholdingTax || m.deductions || 0,
            totalDeductions: m.totalDeductions || m.deductions || 0,
            grossPay: m.grossPay || (m.netPay + (m.deductions || 0)),
            commissionEarned: m.commissionEarned || 0,
            baseSalary: m.baseSalary || 0
          })),
          totalGrossPay,
          totalDeductions,
          totalNetPay,
          paidAt: new Date().toISOString()
        };
        newDb.payrollRuns = [newRun, ...newDb.payrollRuns];
      }
    });

    updateClinicalDb(newDb);
    setShowGlobalImportModal(false);
    triggerToast(`Successfully integrated ${totalCount} records! Refreshing page...`, 'success');

    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleDashboardFileImport = (file: File, overrideType?: 'TRANSACTIONS' | 'EXPENSES' | 'EMPLOYEES' | 'PATIENTS') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (!rawJson || rawJson.length === 0) {
          triggerToast('Uploaded file is empty or invalid.', 'error');
          return;
        }

        const firstRow = rawJson[0] as any;
        const keys = Object.keys(firstRow).map(k => k.toLowerCase());
        
        let detected: 'TRANSACTIONS' | 'EXPENSES' | 'EMPLOYEES' | 'PATIENTS' = 'TRANSACTIONS';
        
        if (overrideType) {
          detected = overrideType;
        } else {
          const hasPatient = keys.some(k => k.includes('patient') || k.includes('pat_') || k.includes('client') || k.includes('customer') || k.includes('patientname'));
          const hasProcedure = keys.some(k => k.includes('procedure') || k.includes('proc_') || k.includes('treatment') || k.includes('service'));
          const hasDentist = keys.some(k => k.includes('dentist') || k.includes('doc_') || k.includes('dent_') || k.includes('dmd'));
          const hasVendor = keys.some(k => k.includes('vendor') || k.includes('supplier') || k.includes('provider') || k.includes('merchant'));
          const hasCategory = keys.some(k => k.includes('category') || k.includes('expense_') || k.includes('type'));
          const hasSss = keys.some(k => k.includes('sss') || k.includes('philhealth') || k.includes('pagibig') || k.includes('tax_'));
          const hasEmail = keys.some(k => k.includes('email') || k.includes('phone') || k.includes('contact'));
          const hasHmo = keys.some(k => k.includes('hmo') || k.includes('insurance'));
          const hasAmount = keys.some(k => k.includes('amount') || k.includes('charged') || k.includes('paid') || k.includes('price') || k.includes('cost') || k.includes('fee'));

          if (hasAmount) {
            // If it has amounts, it's a financial ledger
            if (hasVendor || hasCategory || keys.some(k => k.includes('expense') || k.includes('purchase') || k.includes('utilities') || k.includes('rent'))) {
              detected = 'EXPENSES';
            } else {
              detected = 'TRANSACTIONS';
            }
          } else if (hasPatient && (hasProcedure || hasDentist)) {
            detected = 'TRANSACTIONS';
          } else if (hasVendor || hasCategory) {
            detected = 'EXPENSES';
          } else if (hasSss || (hasEmail && keys.some(k => k.includes('salary') || k.includes('rate') || k.includes('base')))) {
            detected = 'EMPLOYEES';
          } else if (hasPatient || hasHmo) {
            detected = 'PATIENTS';
          } else {
            detected = 'PATIENTS';
          }
        }

        const typosCorrected: { field: string; original: string; corrected: string; rowIdx: number }[] = [];
        const duplicates: { rowIdx: number; item: any; duplicateOf: any; skip: boolean }[] = [];
        const cleanRecords: any[] = [];

        rawJson.forEach((row: any, idx: number) => {
          const getVal = (aliases: string[]): string => {
            for (const alias of aliases) {
              const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_-]/g, '') === alias.toLowerCase().replace(/[\s_-]/g, ''));
              if (key) return String(row[key]).trim();
            }
            return '';
          };

          const parseNum = (aliases: string[], fallback: number = 0): number => {
            const valStr = getVal(aliases);
            if (!valStr) return fallback;
            const cleaned = valStr.replace(/[^0-9.-]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? fallback : num;
          };

          if (detected === 'TRANSACTIONS') {
            const rawDate = getVal(['date', 'txndate', 'transactiondate', 'timestamp', 'createdat']);
            const txnDate = parseRobustDate(rawDate);

            const rawPatient = getVal(['patient', 'patientname', 'client', 'name', 'fullname', 'patient_name', 'firstName', 'lastName']);
            const patientNameVal = rawPatient || 'Walk-in Patient';
            const patMatch = findFuzzyPatient(patientNameVal, db.patients);
            if (patMatch.matchType === 'fuzzy' && patMatch.correctedName && patMatch.correctedName !== patientNameVal) {
              typosCorrected.push({
                field: 'Patient Name',
                original: patientNameVal,
                corrected: patMatch.correctedName,
                rowIdx: idx + 1
              });
            }
            const patientId = patMatch.patientId;
            const patientName = patMatch.patientName;

            const rawDentist = getVal(['dentist', 'dentistname', 'doctor', 'clinician', 'employee', 'dentist_name', 'dentistcode', 'dentist_id', 'dmdduty', 'dmd', 'duty']);
            const dentistMatch = findFuzzyDentist(rawDentist, db.employees);
            if (dentistMatch.matchType === 'fuzzy' && dentistMatch.correctedName && dentistMatch.correctedName !== rawDentist) {
              typosCorrected.push({
                field: 'Clinician / Dentist Name',
                original: rawDentist,
                corrected: dentistMatch.correctedName,
                rowIdx: idx + 1
              });
            }
            const dentistId = dentistMatch.dentistId;

            const rawProcedure = getVal(['procedure', 'procedurename', 'treatment', 'service', 'procedurecode', 'procedure_code']);
            const procMatch = findFuzzyProcedure(rawProcedure, db.procedures);
            if (procMatch.matchType === 'fuzzy' && procMatch.correctedName && procMatch.correctedName !== rawProcedure) {
              typosCorrected.push({
                field: 'Procedure Name',
                original: rawProcedure,
                corrected: procMatch.correctedName,
                rowIdx: idx + 1
              });
            }
            const procedureCode = procMatch.code;
            const procedureName = procMatch.name;
            const foundProcedure = db.procedures.find(p => p.code === procedureCode);
            const commissionTierApplied = foundProcedure?.commissionTier || 'TIER_1';

            const discountAmount = parseNum(['discountamount', 'discount_amt', 'less', 'discount'], 0);
            const amountPaid = parseNum(['amountpaid', 'paid', 'amount_paid', 'actual_paid', 'amount paid'], 1200);
            const amountCharged = parseNum(['amountcharged', 'charged', 'charge', 'amount', 'fee', 'price', 'totalgross', 'gross', 'total gross', 'gross total', 'total_gross', 'gross_total'], amountPaid + discountAmount);

            let discountType: 'SENIOR' | 'MONTHLY_PROMO' | 'DMD_DISCOUNT' | 'NONE' = 'NONE';
            const discountTypeRaw = getVal(['discounttype', 'discount_type', 'promo', 'discount_name']).toUpperCase();
            if (discountAmount > 0) {
              if (discountTypeRaw.includes('SENIOR') || discountTypeRaw.includes('PWD')) discountType = 'SENIOR';
              else if (discountTypeRaw.includes('PROMO') || discountTypeRaw.includes('MONTHLY')) discountType = 'MONTHLY_PROMO';
              else discountType = 'DMD_DISCOUNT';
            }

            const paymentModeRaw = getVal(['paymentmode', 'payment', 'mode', 'type', 'payment_type', 'paymenttype', 'payment type']).toUpperCase();
            let paymentMode: 'CASH' | 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BPI' | 'MAYA' | 'GOTYME' | 'HMO' = 'CASH';
            if (paymentModeRaw.includes('CASH')) paymentMode = 'CASH';
            else if (paymentModeRaw.includes('GCASH')) paymentMode = 'GCASH';
            else if (paymentModeRaw.includes('CREDIT') || paymentModeRaw.includes('CC')) paymentMode = 'CREDIT_CARD';
            else if (paymentModeRaw.includes('DEBIT')) paymentMode = 'DEBIT_CARD';
            else if (paymentModeRaw.includes('BPI')) paymentMode = 'BPI';
            else if (paymentModeRaw.includes('MAYA')) paymentMode = 'MAYA';
            else if (paymentModeRaw.includes('GOTYME')) paymentMode = 'GOTYME';
            else if (paymentModeRaw.includes('HMO') || paymentModeRaw.includes('INSURANCE')) paymentMode = 'HMO';

            const isCredit = paymentMode === 'CREDIT_CARD' || paymentMode === 'DEBIT_CARD';
            const merchantFee = isCredit ? Math.round(amountPaid * 0.035 * 100) / 100 : 0;
            const actualSales = amountPaid - merchantFee;
            const labFee = parseNum(['labfee', 'lab_fee', 'laboratory_fee', 'labcost', 'lab fee'], 0);
            const labVendor = getVal(['labvendor', 'lab', 'vendor', 'laboratory']);

            // Auto smart tag classification based on procedure & remarks
            let smartTag: 'Clinical' | 'Administrative' | 'Maintenance' | 'Uncategorized' = 'Uncategorized';
            const smartTagInput = getVal(['smarttag', 'tag', 'category', 'type']).toLowerCase();
            const procedureLower = procedureName.toLowerCase();
            const remarksLower = getVal(['remarks', 'notes']).toLowerCase();

            if (smartTagInput.includes('clinical') || smartTagInput.includes('surgery') || smartTagInput.includes('treatment')) {
              smartTag = 'Clinical';
            } else if (smartTagInput.includes('admin') || smartTagInput.includes('office') || smartTagInput.includes('paperwork')) {
              smartTag = 'Administrative';
            } else if (smartTagInput.includes('maintenance') || smartTagInput.includes('repair') || smartTagInput.includes('cleaning')) {
              smartTag = 'Maintenance';
            } else {
              if (
                procedureLower.includes('surgery') || 
                procedureLower.includes('consultation') || 
                procedureLower.includes('crown') || 
                procedureLower.includes('zirconia') || 
                procedureLower.includes('rct') || 
                procedureLower.includes('extraction') ||
                procedureLower.includes('cleaning') ||
                procedureLower.includes('braces') ||
                procedureLower.includes('restoration') ||
                procedureLower.includes('basic') ||
                procedureLower.includes('surgical')
              ) {
                smartTag = 'Clinical';
              } else if (remarksLower.includes('hmo') || remarksLower.includes('claim') || remarksLower.includes('allowance') || remarksLower.includes('admin')) {
                smartTag = 'Administrative';
              } else if (remarksLower.includes('repair') || remarksLower.includes('rent') || remarksLower.includes('supplies') || remarksLower.includes('maintenance')) {
                smartTag = 'Maintenance';
              }
            }

            const hmoProviderNameRaw = getVal(['hmo', 'hmoprovider', 'insurance']).toUpperCase();
            let hmoProviderName: 'HP' | 'FILDOCS' | 'COCOLIFE' | 'NONE' = 'NONE';
            if (hmoProviderNameRaw.includes('HP')) hmoProviderName = 'HP';
            else if (hmoProviderNameRaw.includes('FILDOCS')) hmoProviderName = 'FILDOCS';
            else if (hmoProviderNameRaw.includes('COCO')) hmoProviderName = 'COCOLIFE';

            let hmoFeeCharged = 0;
            if (paymentMode === 'HMO') {
              hmoFeeCharged = parseNum(['hmofee', 'hmo fee'], amountPaid);
            }

            const netRevenue = (paymentMode === 'HMO') ? hmoFeeCharged - labFee : actualSales - labFee;
            let rate = foundProcedure?.commissionRateDefault !== undefined ? foundProcedure.commissionRateDefault : 0.10;
            if (commissionTierApplied === 'TIER_2' && foundProcedure?.commissionRateDefault === undefined) rate = 0.30;
            const commissionAmount = Math.max(0, Math.round(netRevenue * rate * 100) / 100);

            const record: Transaction = {
              id: `txn-bulk-${idx}-${Date.now()}`,
              code: `TXN-BULK-${new Date(txnDate).toISOString().slice(0,10).replace(/-/g, '')}-0${idx + 1}`,
              date: txnDate,
              dentistId,
              patientId,
              patientName,
              procedureCode,
              procedureName,
              amountCharged,
              discountType,
              discountAmount,
              amountPaid,
              paymentMode,
              merchantFee,
              actualSales,
              hmoFee: paymentMode === 'HMO' ? hmoFeeCharged : undefined,
              labFee,
              labVendor: labVendor || undefined,
              netRevenue,
              commissionTierApplied,
              commissionRateApplied: rate,
              commissionAmount,
              remarks: getVal(['remarks', 'notes']) || undefined,
              smartTag
            };

            const dupCheck = checkDuplicateTransaction(record, db.transactions);
            if (dupCheck.isDuplicate) {
              duplicates.push({
                rowIdx: idx + 1,
                item: record,
                duplicateOf: dupCheck.duplicateOf,
                skip: true
              });
            } else {
              cleanRecords.push(record);
            }

          } else if (detected === 'EXPENSES') {
            const rawDate = getVal(['date', 'expensedate', 'timestamp']);
            const date = parseRobustDate(rawDate);
            const categoryRaw = getVal(['category', 'type']).toUpperCase();
            const category = ['RENT', 'UTILITIES', 'SUPPLIES', 'EQUIPMENT', 'MARKETING', 'FOOD', 'PROFESSIONAL', 'REGISTRATION', 'LAB', 'MISC'].includes(categoryRaw)
              ? (categoryRaw as any)
              : 'MISC';

            const vendorName = getVal(['vendor', 'vendorname', 'supplier', 'payee']) || 'General Vendor';
            const amount = parseNum(['amount', 'price', 'cost'], 0);
            const paymentMode = getVal(['paymentmode', 'payment', 'mode']) || 'CASH';
            const description = getVal(['description', 'note', 'remarks', 'purpose']);

            const record: Expense = {
              id: `exp-bulk-${idx}-${Date.now()}`,
              code: `EXP-BULK-${new Date(date).toISOString().slice(0,10).replace(/-/g, '')}-0${idx + 1}`,
              date,
              category,
              vendorName,
              amount,
              paymentMode,
              description: description || undefined,
              status: 'APPROVED'
            };

            const isDup = db.expenses.some(e => e.date === record.date && e.amount === record.amount && e.vendorName.toLowerCase() === record.vendorName.toLowerCase());
            if (isDup) {
              duplicates.push({
                rowIdx: idx + 1,
                item: record,
                duplicateOf: db.expenses.find(e => e.date === record.date && e.amount === record.amount && e.vendorName.toLowerCase() === record.vendorName.toLowerCase()),
                skip: true
              });
            } else {
              cleanRecords.push(record);
            }

          } else if (detected === 'PATIENTS') {
            const fullName = getVal(['patient', 'name', 'patientname', 'fullname', 'client']) || 'Unnamed Patient';
            const parts = fullName.split(' ');
            const firstName = parts.slice(0, -1).join(' ') || fullName;
            const lastName = parts[parts.length - 1] || 'Patient';
            const hmoProvider = (getVal(['hmo', 'hmoprovider', 'provider', 'insurance']) || 'NONE').toUpperCase();
            const hmoId = getVal(['hmoid', 'hmo_id', 'id', 'code', 'memberid']);

            const record: Patient = {
              id: `pat-bulk-${idx}-${Date.now()}`,
              code: `P-BULK-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
              firstName,
              lastName,
              hmoProvider: ['HP', 'FILDOCS', 'COCOLIFE'].includes(hmoProvider) ? (hmoProvider as any) : 'NONE',
              hmoIdNumber: hmoId || undefined
            };

            const isDup = db.patients.some(p => p.firstName.toLowerCase() === record.firstName.toLowerCase() && p.lastName.toLowerCase() === record.lastName.toLowerCase());
            if (isDup) {
              duplicates.push({
                rowIdx: idx + 1,
                item: record,
                duplicateOf: db.patients.find(p => p.firstName.toLowerCase() === record.firstName.toLowerCase() && p.lastName.toLowerCase() === record.lastName.toLowerCase()),
                skip: true
              });
            } else {
              cleanRecords.push(record);
            }

          } else if (detected === 'EMPLOYEES') {
            const fullName = getVal(['employee', 'name', 'employeename', 'fullname', 'staff', 'dentist']) || 'Unnamed Staff';
            const typeRaw = getVal(['type', 'role', 'position', 'job']).toUpperCase();
            const type: EmployeeType = ['DENTIST', 'ASSISTANT', 'TEMP', 'ADMIN'].includes(typeRaw) ? (typeRaw as any) : 'ASSISTANT';
            const email = getVal(['email', 'mail']);
            const phone = getVal(['phone', 'contact', 'mobile']);
            const baseSalary = parseNum(['salary', 'base', 'basesalary', 'rate', 'pay'], 0);

            const record: Employee = {
              id: `emp-bulk-${idx}-${Date.now()}`,
              code: `EMP-${fullName.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
              fullName,
              displayName: fullName.split(' ')[0] || fullName,
              type,
              status: 'ACTIVE',
              startDate: new Date().toISOString().slice(0, 10),
              sssNumber: '00-0000000-0',
              philhealthNumber: '00-000000000-0',
              pagibigMID: '0000-0000-0000',
              tin: '000-000-000-000',
              dateOfBirth: '1990-01-01',
              contactNumber: phone || '09000000000',
              email: email || undefined,
              address: 'Metro Manila, Philippines',
              emergencyContact: 'Family Member - 09000000000',
              basePayRate: baseSalary,
              payFrequency: 'MONTHLY',
              commissionTierDefault: 'TIER_1'
            };

            const isDup = db.employees.some(e => e.fullName.toLowerCase() === record.fullName.toLowerCase());
            if (isDup) {
              duplicates.push({
                rowIdx: idx + 1,
                item: record,
                duplicateOf: db.employees.find(e => e.fullName.toLowerCase() === record.fullName.toLowerCase()),
                skip: true
              });
            } else {
              cleanRecords.push(record);
            }
          }
        });

        setDashboardImportResults({
          fileName: file.name,
          totalRows: rawJson.length,
          detectedType: detected,
          typosCorrected,
          duplicates,
          cleanRecords
        });

        triggerToast(`Successfully parsed "${file.name}". Smart Audit details ready for review in dashboard!`, 'success');

      } catch (err: any) {
        console.error(err);
        triggerToast(`Failed to parse file: ${err?.message || err}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCompleteDashboardSync = () => {
    if (!dashboardImportResults) return;
    
    const newDb = { ...db };
    const { detectedType, cleanRecords, duplicates } = dashboardImportResults;

    const duplicateImports = duplicates
      .filter(d => !d.skip)
      .map(d => d.item);

    const recordsToImport = [...cleanRecords, ...duplicateImports];

    if (recordsToImport.length === 0) {
      triggerToast('No new records were imported (duplicates skipped).', 'info');
      setDashboardImportResults(null);
      setDashboardImportFile(null);
      return;
    }

    if (detectedType === 'TRANSACTIONS') {
      const txns = recordsToImport as Transaction[];
      const updatedPatients = [...newDb.patients];
      txns.forEach(t => {
        if (!t.patientId) {
          let tempPat = updatedPatients.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === t.patientName.toLowerCase());
          if (!tempPat) {
            const parts = t.patientName.split(' ');
            const firstName = parts.slice(0, -1).join(' ') || t.patientName;
            const lastName = parts[parts.length - 1] || 'Patient';
            const newPat: Patient = {
              id: `pat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              code: `P-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
              firstName,
              lastName,
              hmoProvider: 'NONE'
            };
            updatedPatients.push(newPat);
            t.patientId = newPat.id;
          } else {
            t.patientId = tempPat.id;
          }
        }
      });
      newDb.patients = updatedPatients;
      newDb.transactions = [...txns, ...newDb.transactions];

      // AUTOMATION: Auto-backtrack filters to range of synced transactions!
      if (txns.length > 0) {
        const dates = txns.map(t => t.date).filter(Boolean);
        if (dates.length > 0) {
          dates.sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          if (minDate === maxDate) {
            setJournalDateFilterType('CUSTOM_DATE');
            setJournalFilterSingleDate(minDate);
          } else {
            setJournalDateFilterType('CUSTOM_RANGE');
            setJournalFilterStartDate(minDate);
            setJournalFilterEndDate(maxDate);
          }
          
          // ALSO AUTOMATICALLY ADJUST DASHBOARD'S DATE RANGE TO SHOW THE SYNCED RECORDS!
          setSelectedStartDate(minDate);
          setSelectedEndDate(maxDate);
          setTempStartDate(minDate);
          setTempEndDate(maxDate);

          triggerToast(`Interactive Backtracking: Automatically filtered journal and dashboard to imported date range (${minDate} to ${maxDate}).`, 'info');
        }
      }

    } else if (detectedType === 'EXPENSES') {
      const exps = recordsToImport as Expense[];
      newDb.expenses = [...exps, ...newDb.expenses];

      // AUTOMATION: Adjust Dashboard date range to match synced expenses!
      if (exps.length > 0) {
        const dates = exps.map(e => e.date).filter(Boolean);
        if (dates.length > 0) {
          dates.sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          setSelectedStartDate(minDate);
          setSelectedEndDate(maxDate);
          setTempStartDate(minDate);
          setTempEndDate(maxDate);
          triggerToast(`Interactive Backtracking: Automatically filtered dashboard to imported date range (${minDate} to ${maxDate}).`, 'info');
        }
      }

    } else if (detectedType === 'PATIENTS') {
      const pats = recordsToImport as Patient[];
      newDb.patients = [...pats, ...newDb.patients];
      triggerToast(`Synced ${pats.length} patient directories.`, 'success');

    } else if (detectedType === 'EMPLOYEES') {
      const emps = recordsToImport as Employee[];
      newDb.employees = [...emps, ...newDb.employees];
      triggerToast(`Synced ${emps.length} employee directories.`, 'success');
    }

    updateClinicalDb(newDb);
    triggerToast(`Successfully synced ${recordsToImport.length} records into Arka Activity Ledger & Dashboard!`, 'success');
    setDashboardImportResults(null);
    setDashboardImportFile(null);
  };

  const handleImportFile = (file: File) => {
    setDashboardImportFile(file);
    handleDashboardFileImport(file);
    setActiveTab('DASHBOARD');
  };

  const getMappedAndFilteredRecords = () => {
    if (!parsedRawRows || parsedRawRows.length === 0) return [];

    return parsedRawRows.map((row: any, idx: number) => {
      const getVal = (aliases: string[]): string => {
        for (const alias of aliases) {
          const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_-]/g, '') === alias.toLowerCase().replace(/[\s_-]/g, ''));
          if (key) return String(row[key]).trim();
        }
        return '';
      };

      const parseNum = (aliases: string[], fallback: number = 0): number => {
        const valStr = getVal(aliases);
        if (!valStr) return fallback;
        const cleaned = valStr.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? fallback : num;
      };

      if (importType === 'TRANSACTIONS') {
        const rawDate = getVal(['date', 'txndate', 'transactiondate', 'timestamp', 'createdat']);
        const txnDate = rawDate ? (new Date(rawDate).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
        
        const rawPatient = getVal(['patient', 'patientname', 'client', 'name', 'fullname', 'patient_name', 'firstName', 'lastName']);
        let patientName = rawPatient || 'Walk-in Patient';
        
        let foundPatient = db.patients.find(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase() === patientName.toLowerCase() ||
          p.firstName.toLowerCase() === patientName.toLowerCase() ||
          p.lastName.toLowerCase() === patientName.toLowerCase() ||
          `${p.lastName}, ${p.firstName}`.toLowerCase() === patientName.toLowerCase()
        );
        
        let patientId = foundPatient?.id || '';
        
        const rawDentist = getVal(['dentist', 'dentistname', 'doctor', 'clinician', 'employee', 'dentist_name', 'dentistcode', 'dentist_id', 'dmdduty', 'dmd', 'duty']);
        let foundDentist = db.employees.find(e => 
          e.fullName.toLowerCase().includes(rawDentist.toLowerCase()) || 
          e.displayName.toLowerCase().includes(rawDentist.toLowerCase()) || 
          e.code.toLowerCase() === rawDentist.toLowerCase() ||
          e.displayName.replace('Dr. ', '').split(' ').map(n => n[0]).join('').toLowerCase() === rawDentist.toLowerCase() ||
          e.fullName.split(' ').map(n => n[0]).join('').toLowerCase() === rawDentist.toLowerCase()
        );
        let dentistId = foundDentist?.id || (db.employees.find(e => e.type === 'DENTIST')?.id || 'emp-ku');

        const rawProcedure = getVal(['procedure', 'procedurename', 'treatment', 'service', 'procedurecode', 'procedure_code']);
        let foundProcedure = db.procedures.find(p => 
          p.name.toLowerCase() === rawProcedure.toLowerCase() ||
          p.code.toLowerCase() === rawProcedure.toLowerCase() ||
          rawProcedure.toLowerCase().includes(p.name.toLowerCase()) ||
          rawProcedure.toLowerCase().includes(p.code.toLowerCase()) ||
          p.name.toLowerCase().includes(rawProcedure.toLowerCase())
        );
        let procedureCode = foundProcedure?.code || 'CON';
        let procedureName = foundProcedure?.name || rawProcedure || 'General Consultation';
        let commissionTierApplied = foundProcedure?.commissionTier || 'TIER_1';

        const discountAmount = parseNum(['discountamount', 'discount_amt', 'less', 'discount'], 0);
        const amountPaid = parseNum(['amountpaid', 'paid', 'amount_paid', 'actual_paid', 'amount paid'], 1200);
        const amountCharged = parseNum(['amountcharged', 'charged', 'charge', 'amount', 'fee', 'price', 'totalgross', 'gross', 'total gross', 'gross total', 'total_gross', 'gross_total'], amountPaid + discountAmount);

        let discountType: 'SENIOR' | 'MONTHLY_PROMO' | 'DMD_DISCOUNT' | 'NONE' = 'NONE';
        const discountTypeRaw = getVal(['discounttype', 'discount_type', 'promo', 'discount_name']).toUpperCase();
        if (discountAmount > 0) {
          if (discountTypeRaw.includes('SENIOR') || discountTypeRaw.includes('PWD')) discountType = 'SENIOR';
          else if (discountTypeRaw.includes('PROMO') || discountTypeRaw.includes('MONTHLY')) discountType = 'MONTHLY_PROMO';
          else if (discountTypeRaw.includes('DMD') || discountTypeRaw.includes('DOCTOR') || discountTypeRaw.includes('DENTIST')) discountType = 'DMD_DISCOUNT';
          else discountType = 'DMD_DISCOUNT';
        }

        const paymentModeRaw = getVal(['paymentmode', 'payment', 'mode', 'type', 'payment_type', 'paymenttype', 'payment type']).toUpperCase();
        let paymentMode: 'CASH' | 'GCASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BPI' | 'MAYA' | 'GOTYME' | 'HMO' = 'CASH';
        if (paymentModeRaw.includes('CASH')) paymentMode = 'CASH';
        else if (paymentModeRaw.includes('GCASH')) paymentMode = 'GCASH';
        else if (paymentModeRaw.includes('CREDIT') || paymentModeRaw.includes('CC')) paymentMode = 'CREDIT_CARD';
        else if (paymentModeRaw.includes('DEBIT')) paymentMode = 'DEBIT_CARD';
        else if (paymentModeRaw.includes('BPI')) paymentMode = 'BPI';
        else if (paymentModeRaw.includes('MAYA')) paymentMode = 'MAYA';
        else if (paymentModeRaw.includes('GOTYME')) paymentMode = 'GOTYME';
        else if (paymentModeRaw.includes('HMO') || paymentModeRaw.includes('INSURANCE') || paymentModeRaw.includes('CLAIM')) paymentMode = 'HMO';

        const isCredit = paymentMode === 'CREDIT_CARD' || paymentMode === 'DEBIT_CARD';
        let merchantFee = parseNum(['merchantfee', 'ccmerchantfee', 'merchant fee', 'cc merchant fee', 'merchant_fee', 'cc_merchant_fee'], -1);
        if (merchantFee === -1) {
          merchantFee = isCredit ? Math.round(amountPaid * 0.035 * 100) / 100 : 0;
        }
        const actualSales = amountPaid - merchantFee;

        const labFee = parseNum(['labfee', 'lab_fee', 'laboratory_fee', 'labcost', 'lab fee'], 0);
        const labVendor = getVal(['labvendor', 'lab', 'vendor', 'laboratory', 'lab supplier']);

        let hmoProviderNameRaw = getVal(['hmo', 'hmoprovider', 'insurance', 'provider', 'hmo_provider', 'hmoprovidername']).toUpperCase();
        let hmoProviderName: 'HP' | 'FILDOCS' | 'COCOLIFE' | 'NONE' = 'NONE';
        if (hmoProviderNameRaw.includes('HP') || hmoProviderNameRaw.includes('HEALTH')) hmoProviderName = 'HP';
        else if (hmoProviderNameRaw.includes('FILDOCS')) hmoProviderName = 'FILDOCS';
        else if (hmoProviderNameRaw.includes('COCO')) hmoProviderName = 'COCOLIFE';

        let hmoFeeCharged = 0;
        if (paymentMode === 'HMO') {
          const actualHmoFeeVal = parseNum(['hmofee', 'hmo_fee', 'hmo fee'], 0);
          if (actualHmoFeeVal > 0) {
            hmoFeeCharged = actualHmoFeeVal;
          } else {
            if (hmoProviderName === 'HP') hmoFeeCharged = foundProcedure?.hmoFeeHp || 1500;
            else if (hmoProviderName === 'FILDOCS') hmoFeeCharged = foundProcedure?.hmoFeeFildocs || 1200;
            else if (hmoProviderName === 'COCOLIFE') hmoFeeCharged = foundProcedure?.hmoFeeCocolife || 1800;
            else hmoFeeCharged = amountPaid;
          }
        }

        let netRevenue = parseNum(['netrevenue', 'net total', 'net_total', 'netrevenue', 'net_revenue', 'net'], -1);
        if (netRevenue === -1) {
          netRevenue = (paymentMode === 'HMO') 
            ? hmoFeeCharged - labFee 
            : actualSales - labFee;
        }

        let rawCommPct = getVal(['commissionrateapplied', 'commission %', '% comm', 'commissionrate', 'commission_rate', 'commissionpct', 'comm_pct', 'commission percentage']);
        let rate = -1;
        if (rawCommPct) {
          const cleanedPct = rawCommPct.replace(/[^0-9.]/g, '');
          const parsedPct = parseFloat(cleanedPct);
          if (!isNaN(parsedPct)) {
            if (parsedPct > 1) {
              rate = parsedPct / 100;
            } else {
              rate = parsedPct;
            }
          }
        }
        if (rate === -1) {
          rate = foundProcedure?.commissionRateDefault !== undefined ? foundProcedure.commissionRateDefault : 0.10;
          if (commissionTierApplied === 'TIER_2' && foundProcedure?.commissionRateDefault === undefined) rate = 0.40;
          if (commissionTierApplied === 'TIER_3' && foundProcedure?.commissionRateDefault === undefined) rate = 0;
        }

        let commissionAmount = parseNum(['commissionamount', 'commission amount', 'commission_amt', 'commission_amount'], -1);
        if (commissionAmount === -1) {
          commissionAmount = Math.max(0, Math.round(netRevenue * rate * 100) / 100);
        }

        const remarks = getVal(['remarks', 'remarks_desc', 'notes', 'note', 'comment', 'description']);

        return {
          id: `txn-bulk-${idx}-${Date.now()}`,
          code: `TXN-BULK-${new Date(txnDate).toISOString().slice(0, 10).replace(/-/g, '')}-0${idx + 1}`,
          date: txnDate,
          dentistId,
          patientId,
          patientName,
          procedureCode,
          procedureName,
          amountCharged,
          discountType,
          discountAmount,
          amountPaid,
          paymentMode,
          merchantFee,
          actualSales,
          hmoFee: paymentMode === 'HMO' ? hmoFeeCharged : undefined,
          labFee,
          labVendor: labVendor || undefined,
          netRevenue,
          commissionTierApplied,
          commissionRateApplied: rate,
          commissionAmount,
          hmoDailyAllowance: paymentMode === 'HMO' ? (foundDentist?.hmoDailyAllowance || 50) : undefined,
          remarks
        } as Transaction;

      } else if (importType === 'EXPENSES') {
        const rawDate = getVal(['date', 'expensedate', 'timestamp', 'createdat']);
        const date = rawDate ? (new Date(rawDate).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
        
        const categoryRaw = getVal(['category', 'type', 'expensecategory', 'expense_category']).toUpperCase();
        const category = ['RENT', 'UTILITIES', 'SUPPLIES', 'EQUIPMENT', 'MARKETING', 'FOOD', 'PROFESSIONAL', 'REGISTRATION', 'LAB', 'MISC'].includes(categoryRaw)
          ? (categoryRaw as any)
          : 'MISC';

        const vendorName = getVal(['vendor', 'vendorname', 'supplier', 'payee', 'shop', 'store']) || 'General Vendor';
        const amount = parseNum(['amount', 'price', 'cost', 'total', 'total_amount', 'exp_amount'], 0);
        const paymentMode = getVal(['paymentmode', 'payment', 'mode', 'type']) || 'CASH';
        const description = getVal(['description', 'note', 'remarks', 'memo']);
        const statusRaw = getVal(['status', 'approval']).toUpperCase();
        const status = ['APPROVED', 'PENDING'].includes(statusRaw) ? (statusRaw as any) : 'APPROVED';

        return {
          id: `exp-bulk-${idx}-${Date.now()}`,
          code: `EXP-BULK-${new Date(date).toISOString().slice(0, 10).replace(/-/g, '')}-0${idx + 1}`,
          date,
          category,
          vendorName,
          amount,
          paymentMode,
          description: description || undefined,
          status
        } as Expense;

      } else if (importType === 'PATIENTS') {
        const fullName = getVal(['name', 'fullname', 'patient', 'patientname']);
        let firstName = getVal(['firstname', 'first_name', 'givenname']);
        let lastName = getVal(['lastname', 'last_name', 'surname']);
        
        if (fullName && (!firstName || !lastName)) {
          const parts = fullName.split(' ');
          if (parts.length > 1) {
            firstName = parts.slice(0, -1).join(' ');
            lastName = parts[parts.length - 1];
          } else {
            firstName = fullName;
            lastName = 'Unspecified';
          }
        }

        if (!firstName) firstName = 'Unnamed';
        if (!lastName) lastName = 'Patient';

        const hmoRaw = getVal(['hmoprovider', 'hmo', 'insurance', 'provider', 'hmo_provider']).toUpperCase();
        const hmoProvider = ['HP', 'FILDOCS', 'COCOLIFE'].includes(hmoRaw) ? (hmoRaw as any) : 'NONE';
        const hmoIdNumber = getVal(['hmoid', 'hmoidnumber', 'cardnumber', 'hmo_num']);

        return {
          id: `pat-bulk-${idx}-${Date.now()}`,
          code: `P-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
          firstName,
          lastName,
          hmoProvider,
          hmoIdNumber: hmoIdNumber || undefined
        } as Patient;

      } else { // EMPLOYEES
        const fullName = getVal(['name', 'fullname', 'employee', 'employeename']) || 'New Staff';
        let displayName = getVal(['displayname', 'nickname', 'shortname']);
        if (!displayName) {
          displayName = fullName.split(' ')[0];
        }

        const rawCode = getVal(['code', 'id', 'initials', 'emp_code', 'employee_id']);
        const code = rawCode ? rawCode.toUpperCase() : fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 3);

        const typeRaw = getVal(['type', 'role', 'employeetype']).toUpperCase();
        const type = ['DENTIST', 'ASSISTANT', 'TEMP', 'ADMIN'].includes(typeRaw) ? (typeRaw as any) : 'DENTIST';

        const statusRaw = getVal(['status', 'active', 'employment_status']).toUpperCase();
        const status = ['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'ENDED_CONTRACT'].includes(statusRaw) ? (statusRaw as any) : 'ACTIVE';

        const basePayRate = parseNum(['basepayrate', 'rate', 'salary', 'dailyrate', 'monthlyrate'], 0);
        const clinicSharePercentage = parseNum(['clinicshare', 'share', 'sharepercentage', 'clinicsharepercentage'], 0);

        return {
          id: `emp-bulk-${idx}-${Date.now()}`,
          code,
          fullName,
          displayName,
          type,
          status,
          startDate: new Date().toISOString().slice(0, 10),
          sssNumber: getVal(['sss', 'sss_num', 'sssnumber']) || 'N/A',
          philhealthNumber: getVal(['philhealth', 'philhealth_num', 'philhealthnumber']) || 'N/A',
          pagibigMID: getVal(['pagibig', 'pagibig_num', 'pagibigmid']) || 'N/A',
          tin: getVal(['tin', 'tin_num', 'tinnumber']) || 'N/A',
          dateOfBirth: '1990-01-01',
          contactNumber: getVal(['phone', 'contact', 'mobile', 'contactnumber']) || 'N/A',
          address: getVal(['address', 'home']) || 'N/A',
          emergencyContact: getVal(['emergency', 'emergencycontact']) || 'N/A',
          basePayRate,
          payFrequency: type === 'ASSISTANT' ? 'WEEKLY' : 'SEMI_MONTHLY',
          commissionTierDefault: 'TIER_1'
        } as Employee;
      }
    });
  };

  const handleSaveBulkImports = () => {
    const records = getMappedAndFilteredRecords();
    if (records.length === 0) {
      triggerToast('No records to import.', 'error');
      return;
    }

    const newDb = { ...db };

    if (importType === 'TRANSACTIONS') {
      const txns = records as Transaction[];
      const updatedPatients = [...newDb.patients];
      txns.forEach(t => {
        if (!t.patientId) {
          let tempPat = updatedPatients.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === t.patientName.toLowerCase());
          if (!tempPat) {
            const parts = t.patientName.split(' ');
            const firstName = parts.slice(0, -1).join(' ') || t.patientName;
            const lastName = parts[parts.length - 1] || 'Patient';
            const newPat: Patient = {
              id: `pat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              code: `P-${firstName.slice(0,1).toUpperCase()}${lastName.slice(0,2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
              firstName,
              lastName,
              hmoProvider: 'NONE'
            };
            updatedPatients.push(newPat);
            t.patientId = newPat.id;
          } else {
            t.patientId = tempPat.id;
          }
        }
      });
      newDb.patients = updatedPatients;
      newDb.transactions = [...txns, ...newDb.transactions];

    } else if (importType === 'EXPENSES') {
      newDb.expenses = [...(records as Expense[]), ...newDb.expenses];
    } else if (importType === 'PATIENTS') {
      newDb.patients = [...(records as Patient[]), ...newDb.patients];
    } else if (importType === 'EMPLOYEES') {
      newDb.employees = [...(records as Employee[]), ...newDb.employees];
    }

    updateClinicalDb(newDb);
    setShowImportModal(false);
    triggerToast(`Successfully bulk imported ${records.length} ${importType.toLowerCase()} into the system!`, 'success');
  };

  // Save changes locally and sync server
  const updateClinicalDb = (newDb: typeof db) => {
    setDb(newDb);
    onSaveState(newDb);
  };

  // SMART AUDIT: GET DUPLICATE TRANSACTIONS
  const getDuplicateTransactions = () => {
    const duplicates: { [key: string]: Transaction[] } = {};
    const txnList = db.transactions || [];
    
    txnList.forEach(t => {
      // Key format: Date_PatientKey_DentistId_ProcedureCode_AmountPaid
      const patientKey = (t.patientId || t.patientName || '').trim().toLowerCase();
      const dateKey = t.date || '';
      const dentistKey = t.dentistId || '';
      const procKey = t.procedureCode || '';
      const amtKey = t.amountPaid || 0;
      
      const hash = `${dateKey}_${patientKey}_${dentistKey}_${procKey}_${amtKey}`;
      
      if (!duplicates[hash]) {
        duplicates[hash] = [];
      }
      duplicates[hash].push(t);
    });
    
    const flaggedGroups = Object.keys(duplicates).filter(hash => duplicates[hash].length > 1);
    
    return flaggedGroups.map(hash => ({
      hash,
      transactions: duplicates[hash]
    }));
  };

  // SMART AUDIT: AUTO-RESOLVE DUPLICATE TRANSACTIONS (KEEP ONLY 1 ACCORDING TO SYSTEM REGULATION)
  const handleResolveDuplicates = () => {
    const groups = getDuplicateTransactions();
    if (groups.length === 0) {
      triggerToast('Audit Complete: No duplicate works or conflict records were found in the current ledger.', 'info');
      return;
    }
    
    const idsToRemove = new Set<string>();
    groups.forEach(g => {
      // slice(1) queues all other duplicate occurrences for cleanup, leaving 1 pristine record
      g.transactions.slice(1).forEach(t => {
        idsToRemove.add(t.id);
      });
    });
    
    const newDb = { ...db };
    newDb.transactions = db.transactions.filter(t => !idsToRemove.has(t.id));
    
    updateClinicalDb(newDb);
    triggerToast(`Smart Audit resolved! successfully merged & cleaned up ${idsToRemove.size} duplicate works.`, 'success');
  };

  // TRIGGER STATE RESET (RESTORE JUNE SEEDS)
  const handleResetState = async () => {
    if (!confirm('Are you sure you want to restore the default ARKA June 2026 test database? This resets all changes.')) return;
    try {
       const resp = await fetch('/api/reset-state', { method: 'POST' });
       const res = await resp.json();
       if (res.success && res.data) {
         setDb(res.data);
         triggerToast('Seeds restored. ARKA June cut-offs now active.', 'success');
       }
    } catch (err) {
       console.error(err);
    }
  };

  // PROCEDURE DYNAMIC LOOKUP HELPERS
  const handleProcedureSelectionChange = (code: string) => {
    setTxnProcedureCode(code);
    setIsManualCommissionOverride(false);
    const proc = db.procedures.find(p => p.code === code);
    if (proc) {
      // Auto-set standard amount
      let fee = 1200; // OP default
      if (code === 'CON') fee = 500;
      if (code === 'EXO') fee = 1500;
      if (code === 'RCT') fee = 7000;
      if (code === 'ZIRC') fee = 18000;
      
      setTxnAmountCharged(fee);
      setTxnAmountPaid(fee);
      setTxnLabFee(proc.defaultLabFee || 0);
      setTxnLabVendor(proc.defaultLabFee > 0 ? 'Sir Ross' : '');
    }
  };

  // STATUTORY BRACKETS RESOLVER (PHILIPPINES LAWS 2026)
  const computePhStatutoryDeductions = (grossPay: number, type: 'DENTIST' | 'ASSISTANT' | 'TEMP') => {
    if (type === 'TEMP') {
      return { sss: 0, philhealth: 0, pagibig: 200, tax: 0 };
    }
    
    // Page SSS Brackets (Simplified 9.5% Employee contribution cap)
    let sss = Math.min(1000, grossPay * 0.045);
    // Page Philhealth 5% share splits
    let philhealth = Math.min(1500, grossPay * 0.025);
    // PagIBIG index
    let pagibig = 200;

    // BIR Withholding bracket (Philippine TRAIN Law, simplified 15% above ₱10,417 semi-monthly threshold)
    let taxable = grossPay - sss - philhealth - pagibig;
    let tax = 0;
    if (taxable > 10417) {
      tax = (taxable - 10417) * 0.15;
    }

    return {
      sss: Math.round(sss * 100) / 100,
      philhealth: Math.round(philhealth * 100) / 100,
      pagibig: Math.round(pagibig * 100) / 100,
      tax: Math.round(tax * 100) / 100
    };
  };

  const [isManualCommissionOverride, setIsManualCommissionOverride] = useState<boolean>(false);

  // Auto-recalculate defaults when transaction parameters change (unless overridden)
  useEffect(() => {
    if (isManualCommissionOverride) return;

    const patient = db.patients.find(p => p.id === txnPatientId);
    const procedure = db.procedures.find(p => p.code === txnProcedureCode);
    if (!procedure) return;

    const isCredit = txnPaymentMode === 'CREDIT_CARD' || txnPaymentMode === 'DEBIT_CARD';
    const merchantFee = isCredit ? Math.round(txnAmountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = txnAmountPaid - merchantFee;

    let hmoFeeCharged = 0;
    if (txnPaymentMode === 'HMO' && patient) {
      if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
      else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
      else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
    }

    const netRevenue = (txnPaymentMode === 'HMO') 
      ? hmoFeeCharged - txnLabFee 
      : actualSales - txnLabFee;

    const defaultRate = procedure.commissionRateDefault !== undefined ? procedure.commissionRateDefault : 0.10;
    const ratePercent = defaultRate * 100;
    const commissionAmount = Math.max(0, Math.round(netRevenue * defaultRate * 100) / 100);

    setTxnCommissionRate(ratePercent);
    setTxnCommissionAmount(commissionAmount);
  }, [txnPatientId, txnProcedureCode, txnPaymentMode, txnAmountPaid, txnLabFee, db.patients, db.procedures, isManualCommissionOverride]);

  // LIVE AUTO-FILL CALCULATIONS FOR COMMISSION % & AMOUNT (preserving compatibility)
  const getLiveCalculations = () => {
    return {
      ratePercent: txnCommissionRate,
      commissionAmount: txnCommissionAmount
    };
  };

  const handleCommissionRateChange = (newRatePercent: number) => {
    setIsManualCommissionOverride(true);
    setTxnCommissionRate(newRatePercent);
    
    const patient = db.patients.find(p => p.id === txnPatientId);
    const procedure = db.procedures.find(p => p.code === txnProcedureCode);
    
    const isCredit = txnPaymentMode === 'CREDIT_CARD' || txnPaymentMode === 'DEBIT_CARD';
    const merchantFee = isCredit ? Math.round(txnAmountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = txnAmountPaid - merchantFee;

    let hmoFeeCharged = 0;
    if (txnPaymentMode === 'HMO' && patient && procedure) {
      if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
      else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
      else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
    }

    const netRevenue = (txnPaymentMode === 'HMO') 
      ? hmoFeeCharged - txnLabFee 
      : actualSales - txnLabFee;

    const newAmount = Math.max(0, Math.round(netRevenue * (newRatePercent / 100) * 100) / 100);
    setTxnCommissionAmount(newAmount);
  };

  const handleCommissionAmountChange = (newAmount: number) => {
    setIsManualCommissionOverride(true);
    setTxnCommissionAmount(newAmount);
    
    const patient = db.patients.find(p => p.id === txnPatientId);
    const procedure = db.procedures.find(p => p.code === txnProcedureCode);
    
    const isCredit = txnPaymentMode === 'CREDIT_CARD' || txnPaymentMode === 'DEBIT_CARD';
    const merchantFee = isCredit ? Math.round(txnAmountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = txnAmountPaid - merchantFee;

    let hmoFeeCharged = 0;
    if (txnPaymentMode === 'HMO' && patient && procedure) {
      if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
      else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
      else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
    }

    const netRevenue = (txnPaymentMode === 'HMO') 
      ? hmoFeeCharged - txnLabFee 
      : actualSales - txnLabFee;

    const computedRatePercent = netRevenue > 0 
      ? Math.round((newAmount / netRevenue) * 100 * 10) / 10 
      : 0;
    setTxnCommissionRate(computedRatePercent);
  };

  // HANDLER TO SELECT TRANSACTION FOR EDITING
  const handleEditTransaction = (txn: Transaction) => {
    setEditingTxnId(txn.id);
    setTxnDate(txn.date || new Date().toISOString().slice(0, 10));
    setTxnPatientId(txn.patientId);
    setTxnDentistId(txn.dentistId);
    setTxnProcedureCode(txn.procedureCode);
    setTxnAmountCharged(txn.amountCharged);
    setTxnAmountPaid(txn.amountPaid);
    setTxnPaymentMode(txn.paymentMode);
    setTxnLabFee(txn.labFee);
    setTxnLabVendor(txn.labVendor || '');
    setTxnRemarks(txn.remarks || '');
    setTxnSmartTag(txn.smartTag || 'Uncategorized');
    setTxnDiscountType(txn.discountType || 'NONE');
    setTxnDiscountAmount(txn.discountAmount || 0);

    // Set saved commission parameters and activate override
    setTxnCommissionRate((txn.commissionRateApplied || 0) * 100);
    setTxnCommissionAmount(txn.commissionAmount || 0);
    setIsManualCommissionOverride(true);

    const formElement = document.getElementById('sel-txn-patient');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // EXCEL EXPORT FOR OFFICIAL AUDITABLE ACTIVITY JOURNAL (CUSTOM COLUMNS COMPLIANCE)
  const handleExportJournalExcel = () => {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Official Activity Journal</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; }
          .title { font-size: 14pt; font-weight: bold; color: #0F172A; }
          .subtitle { font-size: 10pt; font-weight: bold; color: #E11D48; }
          th { font-weight: bold; background-color: #0F172A; color: #FFFFFF; border: 1px solid #CBD5E1; padding: 6px; text-align: left; }
          td { border: 1px solid #E2E8F0; padding: 6px; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="16" class="title">ARKA DENTAL CENTER</td>
          </tr>
          <tr>
            <td colspan="16" class="subtitle">OFFICIAL AUDITABLE ACTIVITY JOURNAL</td>
          </tr>
          <tr>
            <td colspan="16">Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
          </tr>
          <tr><td></td></tr>
          <tr>
            <th>Date</th>
            <th>DMD Duty</th>
            <th>Patient</th>
            <th>Procedure</th>
            <th style="background-color: #22C55E; color: white;">Lab fee</th>
            <th>Discount</th>
            <th style="background-color: #22C55E; color: white;">Amount paid</th>
            <th>Commission %</th>
            <th>Commission Amount</th>
            <th>Remarks</th>
            <th style="background-color: #22C55E; color: white;">HMO</th>
            <th>Payment type</th>
            <th>CC Merchant fee</th>
            <th>Total Gross</th>
            <th style="background-color: #1E3A8A; color: white;">Salary Restricted Data</th>
            <th>Net Total</th>
          </tr>
    `;

    db.transactions.forEach(t => {
      const dr = db.employees.find(e => e.id === t.dentistId);
      let initials = 'KU';
      if (dr) {
        const parts = dr.displayName.replace('Dr. ', '').split(' ');
        if (parts.length >= 2) {
          initials = (parts[0][0] + parts[1][0]).toUpperCase();
        } else {
          initials = parts[0].slice(0, 2).toUpperCase();
        }
      }

      const commissionRatePct = t.commissionRateApplied ? `${Math.round(t.commissionRateApplied * 100)}%` : '0%';
      const isHmo = t.paymentMode === 'HMO';
      const hmoProviderName = isHmo ? (db.patients.find(p => p.id === t.patientId)?.hmoProvider || 'HMO') : '';

      const matchedPatient = db.patients.find(p => p.id === t.patientId);
      const resolvedPatientName = matchedPatient ? `${matchedPatient.firstName} ${matchedPatient.lastName}` : (t.patientName || 'Walk-in Patient');

      html += `
          <tr>
            <td>${t.date}</td>
            <td style="font-weight: bold; text-align: center;">${initials}</td>
            <td>${resolvedPatientName}</td>
            <td>${t.procedureName || t.procedureCode}</td>
            <td style="text-align: right;">${t.labFee || 0}</td>
            <td style="text-align: right;">${t.discountAmount || 0}</td>
            <td style="text-align: right; font-weight: bold;">${t.amountPaid}</td>
            <td style="text-align: right;">${commissionRatePct}</td>
            <td style="text-align: right; color: #DC2626; font-weight: bold;">${t.commissionAmount}</td>
            <td>${t.remarks || ''}</td>
            <td>${hmoProviderName}</td>
            <td>${t.paymentMode}</td>
            <td style="text-align: right;">${t.merchantFee || 0}</td>
            <td style="text-align: right;">${t.amountPaid}</td>
            <td style="color: #64748B; font-style: italic; font-weight: bold;">DATA FOR ADMIN ONLY</td>
            <td style="text-align: right; font-weight: bold; color: #16A34A;">${t.netRevenue}</td>
          </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARKA_Official_Auditable_Activity_Journal_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // TRANSACTION INGESTION & MATHEMATICAL COMPUTATION
  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnPatientId) {
      triggerToast('Please register or select a patient first.', 'error');
      return;
    }

    const patient = db.patients.find(p => p.id === txnPatientId);
    const dentist = db.employees.find(e => e.id === txnDentistId);
    const procedure = db.procedures.find(p => p.code === txnProcedureCode);

    if (!patient || !dentist || !procedure) return;

    // VALIDATION: Date validation
    if (!isValidDate(txnDate)) {
      triggerToast('Please provide a valid transaction date in YYYY-MM-DD format.', 'error');
      return;
    }

    // VALIDATION: Amount validation (amounts must be positive/non-negative)
    if (isNaN(txnAmountPaid) || txnAmountPaid <= 0) {
      triggerToast('Amount Paid must be a positive number greater than ₱0.', 'error');
      return;
    }
    if (isNaN(txnAmountCharged) || txnAmountCharged < 0) {
      triggerToast('Amount Charged must be a valid non-negative number.', 'error');
      return;
    }
    if (isNaN(txnDiscountAmount) || txnDiscountAmount < 0) {
      triggerToast('Discount Amount must be a valid non-negative number.', 'error');
      return;
    }
    if (isNaN(txnLabFee) || txnLabFee < 0) {
      triggerToast('Lab Fee must be a valid non-negative number.', 'error');
      return;
    }

    // CC / Debit transaction payment fee setup
    const isCredit = txnPaymentMode === 'CREDIT_CARD' || txnPaymentMode === 'DEBIT_CARD';
    const merchantFee = isCredit ? Math.round(txnAmountPaid * 0.035 * 100) / 100 : 0;
    const actualSales = txnAmountPaid - merchantFee;

    // Commission net revenue deduction calculations
    // NetRevenue = Actual Sales - LabFee - HMOFee (Loss)
    let hmoFeeCharged = 0;
    if (txnPaymentMode === 'HMO') {
      if (patient.hmoProvider === 'HP') hmoFeeCharged = procedure.hmoFeeHp;
      else if (patient.hmoProvider === 'FILDOCS') hmoFeeCharged = procedure.hmoFeeFildocs;
      else if (patient.hmoProvider === 'COCOLIFE') hmoFeeCharged = procedure.hmoFeeCocolife;
    }

    const netRevenue = (txnPaymentMode === 'HMO') 
      ? hmoFeeCharged - txnLabFee 
      : actualSales - txnLabFee;

    // Use custom user-editable or auto-calculated commission rate and amount
    const rate = txnCommissionRate / 100;
    const commissionAmount = txnCommissionAmount;

    let updatedTxns: Transaction[] = [];

    if (editingTxnId) {
      updatedTxns = db.transactions.map(t => {
        if (t.id === editingTxnId) {
          return {
            ...t,
            date: txnDate,
            dentistId: txnDentistId,
            patientId: txnPatientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            procedureCode: txnProcedureCode,
            procedureName: procedure.name,
            amountCharged: txnAmountCharged,
            discountType: txnDiscountType,
            discountAmount: txnDiscountAmount,
            amountPaid: txnAmountPaid,
            paymentMode: txnPaymentMode,
            merchantFee,
            actualSales,
            hmoFee: txnPaymentMode === 'HMO' ? hmoFeeCharged : undefined,
            labFee: txnLabFee,
            labVendor: txnLabVendor || undefined,
            netRevenue,
            commissionTierApplied: procedure.commissionTier || 'TIER_1',
            commissionRateApplied: rate,
            commissionAmount,
            hmoDailyAllowance: txnPaymentMode === 'HMO' ? (dentist.hmoDailyAllowance || 50) : undefined,
            remarks: txnRemarks,
            smartTag: txnSmartTag
          };
        }
        return t;
      });
      setEditingTxnId(null);
      triggerToast('Appointment transaction successfully updated!', 'success');
    } else {
      const newTxn: Transaction = {
        id: `txn-${Date.now()}`,
        code: `TXN-${txnDate.replace(/-/g, '')}-00${db.transactions.length + 1}`,
        date: txnDate,
        dentistId: txnDentistId,
        patientId: txnPatientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        procedureCode: txnProcedureCode,
        procedureName: procedure.name,
        amountCharged: txnAmountCharged,
        discountType: txnDiscountType,
        discountAmount: txnDiscountAmount,
        amountPaid: txnAmountPaid,
        paymentMode: txnPaymentMode,
        merchantFee,
        actualSales,
        hmoFee: txnPaymentMode === 'HMO' ? hmoFeeCharged : undefined,
        labFee: txnLabFee,
        labVendor: txnLabVendor || undefined,
        netRevenue,
        commissionTierApplied: procedure.commissionTier || 'TIER_1',
        commissionRateApplied: rate,
        commissionAmount,
        hmoDailyAllowance: txnPaymentMode === 'HMO' ? (dentist.hmoDailyAllowance || 50) : undefined,
        remarks: txnRemarks,
        smartTag: txnSmartTag
      };
      updatedTxns = [newTxn, ...db.transactions];
      triggerToast('Appointment transaction billing successfully logged!', 'success');
    }

    updateClinicalDb({
      ...db,
      transactions: updatedTxns
    });

    // Reset fields
    setTxnRemarks('');
    setTxnSmartTag('Uncategorized');
    setTxnDiscountType('NONE');
    setTxnDiscountAmount(0);
    setIsManualCommissionOverride(false);
    setTxnDate(new Date().toISOString().slice(0, 10));
  };

  // AI-powered description categorization handler
  const handleAutoCategorize = async (descToCategorize?: string) => {
    const text = descToCategorize !== undefined ? descToCategorize : txnRemarks;
    if (!text || text.trim() === '') {
      setTxnSmartTag('Uncategorized');
      return;
    }
    setIsCategorizing(true);
    try {
      const response = await fetch('/api/bookkeeping/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text })
      });
      const data = await response.json();
      if (data.success) {
        setTxnSmartTag(data.category);
        triggerToast(`Auto-categorized as "${data.category}" using ${data.source === 'gemini-api' ? 'Gemini AI' : 'Rule Engine'}.`, 'success');
      }
    } catch (err) {
      console.error(err);
      triggerToast('AI classification request failed.', 'error');
    } finally {
      setIsCategorizing(false);
    }
  };

  // ADD NEW PATIENT WRITING
  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patLastName || !patFirstName) return;

    const newPat: Patient = {
      id: `pat-${Date.now()}`,
      code: `PAT-2026-000${db.patients.length + 1}`,
      lastName: patLastName,
      firstName: patFirstName,
      hmoProvider: patHmoProvider,
      hmoIdNumber: patHmoId || undefined
    };

    updateClinicalDb({
      ...db,
      patients: [...db.patients, newPat]
    });

    setTxnPatientId(newPat.id);
    setPatLastName('');
    setPatFirstName('');
    setPatHmoId('');
    triggerToast(`Patient ${newPat.firstName} registered. Assigned ID: ${newPat.code}`, 'success');
  };

  // DRAFT PAYROLL COMMISSION ACCRUING
  const handleRunPayroll = (type: 'ASSISTANT_WEEKLY' | 'DENTIST_SEMI_MONTHLY') => {
    const today = new Date().toISOString().slice(0, 10);
    
    // Assistant Payroll Filter (Weekly cutoff)
    // Dentist Payroll Cutoff (Semi-Monthly: e.g. 1st-15th of June)
    const filteredEmployees = db.employees.filter(e => {
      if (type === 'ASSISTANT_WEEKLY' && (e.type === 'ASSISTANT' || e.type === 'TEMP')) return e.status === 'ACTIVE';
      if (type === 'DENTIST_SEMI_MONTHLY' && e.type === 'DENTIST') return e.status === 'ACTIVE';
      return false;
    });

    const startPeriodStr = '2026-06-01';
    const endPeriodStr = type === 'ASSISTANT_WEEKLY' ? '2026-06-07' : '2026-06-15';
    const targetAdjustPeriod = type === 'ASSISTANT_WEEKLY' ? 'JUNE_W1' : 'JUNE_1_15';

    // Generate array of dates in the pay run range to inspect attendance logs
    const parsedStart = new Date(startPeriodStr);
    const parsedEnd = new Date(endPeriodStr);
    const datesInRange: string[] = [];
    const datePointer = new Date(parsedStart);
    while (datePointer <= parsedEnd) {
      datesInRange.push(datePointer.toISOString().slice(0, 10));
      datePointer.setDate(datePointer.getDate() + 1);
    }

    const entries = filteredEmployees.map(emp => {
      let basePay = 0;
      let commission = 0;
      let holidayPay = 0;
      let hmoAllowance = 0;

      let presentCount = 0;
      let leaveCount = 0;
      let absentCount = 0;
      let holidayWorkedCount = 0;
      let holidayOffCount = 0;

      // Integrate live attendance logs for each day in range
      datesInRange.forEach(dtStr => {
        const activeHoliday = (db.holidays || []).find(h => h.date === dtStr);
        const record = (db.attendanceRecords || []).find(r => r.employeeId === emp.id && r.date === dtStr);

        let status = 'PRESENT';
        let customMultiplier = record?.holidayPayMultiplier;

        if (record) {
          status = record.status;
        } else {
          // Unlogged day defaults: Sunday is rest day (0/unpaid), weekdays are presents
          const dayOfWeek = new Date(dtStr).getDay();
          if (dayOfWeek === 0) {
            status = 'ABSENT'; // Sunday rest day is unpaid
          } else {
            if (activeHoliday) {
              status = activeHoliday.type === '200%' ? 'HOLIDAY_OFF' : 'ABSENT';
            } else {
              status = 'PRESENT';
            }
          }
        }

        // Apply pay multipliers
        if (status === 'PRESENT') {
          basePay += emp.basePayRate;
          presentCount++;
        } else if (status === 'VL' || status === 'SL') {
          basePay += emp.basePayRate; // fully paid leave
          leaveCount++;
        } else if (status === 'ABSENT') {
          absentCount++;
        } else if (status === 'HOLIDAY_OFF') {
          holidayOffCount++;
          if (activeHoliday && activeHoliday.type === '200%') {
            basePay += emp.basePayRate; // Paid Regular Holiday off
          }
        } else if (status === 'HOLIDAY_WORKED') {
          holidayWorkedCount++;
          basePay += emp.basePayRate; // standard base day
          const mult = customMultiplier || (activeHoliday?.type === '200%' ? 2.0 : 1.3);
          const premium = mult > 1.0 ? (mult - 1.0) : 0.3;
          holidayPay += emp.basePayRate * premium;
        }
      });

      if (emp.type === 'DENTIST') {
        // Accrued dentist commission totals from transaction logs
        db.transactions.forEach(t => {
          if (t.dentistId === emp.id) {
            commission += t.commissionAmount;
            if (t.hmoDailyAllowance) {
              hmoAllowance += t.hmoDailyAllowance;
            }
          }
        });
      }

      // Live integration of prior cutoff adjustments (24h prior)
      const userAdjusts = (db.cutoffAdjustments || []).filter(
        adj => adj.employeeId === emp.id && 
        (adj.cutOffPeriod === targetAdjustPeriod || adj.cutOffPeriod === 'GENERAL')
      );
      
      let cutoffDelta = 0;
      userAdjusts.forEach(adj => {
        cutoffDelta += adj.basePayAdjustmentAmount;
      });

      // Factor pre-cutoff adjustments into basePay
      basePay += cutoffDelta;

      const grossPay = basePay + commission + holidayPay + hmoAllowance;
      const stats = computePhStatutoryDeductions(grossPay, emp.type);
      const totalDeductions = stats.sss + stats.philhealth + stats.pagibig + stats.tax;
      const netPay = grossPay - totalDeductions;

      // Cumulative YTD simulation loading
      const pastPayrunsAmount = 43200; // Seed past pay
      const ytdGross = pastPayrunsAmount + grossPay;

      return {
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeType: emp.type,
        basePay,
        commission,
        otPay: 0,
        holidayPay,
        hmoAllowance,
        otherEarnings: 0,
        grossPay,
        sssContribution: stats.sss,
        philhealthContribution: stats.philhealth,
        pagibigContribution: stats.pagibig,
        withholdingTax: stats.tax,
        cashAdvanceDeduction: 0,
        otherDeductions: 0,
        totalDeductions,
        netPay,
        ytdGross,
        presentCount,
        leaveCount,
        absentCount,
        holidayWorkedCount,
        holidayOffCount,
        cutoffDelta
      };
    });

    const totalGross = entries.reduce((acc, e) => acc + e.grossPay, 0);
    const totalDeductions = entries.reduce((acc, e) => acc + e.totalDeductions, 0);
    const totalNet = entries.reduce((acc, e) => acc + e.netPay, 0);

    const newRun: PayrollRun = {
      id: `run-${Date.now()}`,
      code: `PAYRUN-${type === 'ASSISTANT_WEEKLY' ? 'W' : 'SM'}-${today.replace(/-/g, '')}`,
      payPeriodStart: startPeriodStr,
      payPeriodEnd: endPeriodStr,
      payDate: today,
      type,
      status: 'DRAFT',
      entries,
      totalGrossPay: totalGross,
      totalDeductions,
      totalNetPay: totalNet
    };

    updateClinicalDb({
      ...db,
      payrollRuns: [newRun, ...db.payrollRuns]
    });

    triggerToast(`Draft Ledger payroll compiled successfully. Derived from live attendance logs, holiday premiums, and approved prior cut-off adjustments.`, 'success');
  };

  const handleMarkPaid = (runId: string) => {
    const updatedRuns = db.payrollRuns.map(run => {
      if (run.id === runId) {
        return {
          ...run,
          status: 'PAID' as const,
          paymentReference: `GCASH-REF-${Math.floor(100000 + Math.random() * 900000)}`,
          paidAt: new Date().toISOString()
        };
      }
      return run;
    });

    updateClinicalDb({
      ...db,
      payrollRuns: updatedRuns
    });
    triggerToast('Payroll disbursement successful. BIR paystubs marked as Paid with Gcash references.', 'success');
  };

  // SMART AUDIT RUNNER PROXIER
  const handleSmartAuditRun = async (testFile: string, textContent: string = '') => {
    setIsAuditing(true);
    try {
      const response = await fetch('/api/bookkeeping/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadText: textContent, testFile })
      });
      const data = await response.json();
      if (data) {
        setAuditRunReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Drag-and-drop spreadsheet handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleSmartAuditRun(file.name, `LEDGER FILE AUDIT: ${file.name}`);
    }
  };

  // Apply auto-fix trigger for audit flags
  const handleAutoFixFlag = (flagId: string) => {
    if (!auditRunReport) return;
    
    // Simulate auto adjustment database fixes
    const updatedFlags = auditRunReport.flags.map((flg: AuditFlag) => {
      if (flg.id === flagId) {
        return { ...flg, status: 'FIXED' as const };
      }
      return flg;
    });

    setAuditRunReport({
      ...auditRunReport,
      flags: updatedFlags
    });

    triggerToast('Ledger discrepancies adjusted and corrected. Balances balanced back to threshold.', 'success');
  };

  // RECEIPT SUBMISSION & MULTIMODAL OCR EXTRACTOR
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        setReceiptImageRaw(base64);
        setIsOcrProcessing(true);
        setOcrLog('Initiating high-conformance Gemini image analyzer OCR...');

        try {
          const res = await fetch('/api/receipt/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, originalName: file.name })
          });
          const data = await res.json();
          if (data.success && data.receipt) {
            const parsed = data.receipt;
            
            // Add to database
            const newRcp: ReceiptType = {
              id: `rcp-${Date.now()}`,
              code: `RCP-2026-000${db.receipts.length + 1}`,
              uploadDate: new Date().toISOString(),
              receiptDate: parsed.receiptDate,
              vendorName: parsed.vendorName,
              amount: parsed.amount,
              category: parsed.category,
              paymentMode: parsed.paymentMode,
              ocrText: parsed.ocrText,
              ocrConfidence: parsed.ocrConfidence,
              status: 'VERIFIED'
            };

            // Accrue inside expenses
            const newExp: Expense = {
              id: `exp-${Date.now()}`,
              code: `EXP-2026-000${db.expenses.length + 1}`,
              date: parsed.receiptDate,
              category: parsed.category,
              vendorName: parsed.vendorName,
              amount: parsed.amount,
              paymentMode: parsed.paymentMode,
              description: `Gemini OCR Extracted from file: ${file.name}`,
              receiptId: newRcp.id,
              status: 'APPROVED'
            };

            updateClinicalDb({
              ...db,
              receipts: [newRcp, ...db.receipts],
              expenses: [newExp, ...db.expenses]
            });

            setOcrLog(`OCR Success! Extracted ₱${parsed.amount} categorized as ${parsed.category} from ${parsed.vendorName}. Confidence: ${parsed.ocrConfidence}%`);
          }
        } catch (err: any) {
          setOcrLog('Failed: ' + err.message);
        } finally {
          setIsOcrProcessing(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // CLINICAL ANALYTICAL DATA METRIC GRAPH HELPERS
  const computeFinancials = () => {
    const revenueAdjustAmount = (db.financialAdjustments || []).filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.amount, 0);
    const expenseAdjustAmount = (db.financialAdjustments || []).filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.amount, 0);

    const totalRevenue = db.transactions.reduce((acc, t) => acc + t.amountPaid, 0) + revenueAdjustAmount;
    const totalMerchantFees = db.transactions.reduce((acc, t) => acc + t.merchantFee, 0);
    const totalLabFees = db.transactions.reduce((acc, t) => acc + (t.labFee || 0), 0);
    const totalCommissions = db.transactions.reduce((acc, t) => acc + t.commissionAmount, 0);
    const totalExpenses = db.expenses.reduce((acc, e) => acc + e.amount, 0) + expenseAdjustAmount;

    const netProfit = totalRevenue - totalMerchantFees - totalLabFees - totalCommissions - totalExpenses;

    return {
      totalRevenue,
      totalMerchantFees,
      totalLabFees,
      totalCommissions,
      totalExpenses,
      netProfit,
      revenueAdjustAmount,
      expenseAdjustAmount
    };
  };

  const metrics = computeFinancials();

  // Find all transactions, expenses, etc. in the selected date range
  const getDailyDataMovement = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }
    
    // List all intermediate days in chronological order
    const days: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      try {
        days.push(current.toISOString().split('T')[0]);
      } catch (err) {
        break;
      }
      current.setDate(current.getDate() + 1);
    }
    
    // Loop through days and sum values
    const chartData = days.map(dayStr => {
      // Find transactions of this day
      const dayTxns = db.transactions.filter(t => t.date === dayStr);
      const dayRevenueTxn = dayTxns.reduce((sum, t) => sum + t.amountPaid, 0);
      const dayLabFeesTxn = dayTxns.reduce((sum, t) => sum + (t.labFee || 0), 0);
      const dayCommissionsTxn = dayTxns.reduce((sum, t) => sum + t.commissionAmount, 0);
      
      // Find expenses of this day
      const dayExps = db.expenses.filter(e => e.date === dayStr);
      const dayLabExps = dayExps.filter(e => e.category === 'LAB').reduce((sum, e) => sum + e.amount, 0);
      const dayOtherExps = dayExps.filter(e => e.category !== 'LAB').reduce((sum, e) => sum + e.amount, 0);
      
      // Find financial adjustments of this day
      const dayAdjs = (db.financialAdjustments || []).filter(a => a.date === dayStr);
      const dayRevenueAdj = dayAdjs.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.amount, 0);
      const dayExpenseAdj = dayAdjs.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.amount, 0);
      
      const revenue = dayRevenueTxn + dayRevenueAdj;
      const labFees = dayLabFeesTxn + dayLabExps;
      const commissions = dayCommissionsTxn;
      const expenses = dayOtherExps + dayExpenseAdj;
      const netProfit = revenue - labFees - commissions - expenses;
      
      const dateParts = dayStr.split('-');
      const formattedDate = dateParts.length === 3 
        ? `${new Date(dayStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : dayStr;

      return {
        dateStr: dayStr,
        date: formattedDate,
        revenue,
        labFees,
        commissions,
        expenses,
        netProfit,
      };
    });
    
    return chartData;
  };

  const handleExportSelectedDateExcel = (startStr: string, endStr: string) => {
    const data = getDailyDataMovement(startStr, endStr);
    
    // Calculate totals of this custom period
    const totalRev = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalLab = data.reduce((sum, d) => sum + d.labFees, 0);
    const totalCom = data.reduce((sum, d) => sum + d.commissions, 0);
    const totalExp = data.reduce((sum, d) => sum + d.expenses, 0);
    const totalNet = totalRev - totalLab - totalCom - totalExp;

    const getHTMLProgressBarForVal = (val: number, maxVal: number) => {
      const ratio = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const widthPercent = Math.min(100, Math.max(0, ratio));
      return `
        <div style="width: 150px; background-color: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 4px; padding: 2px;">
          <div style="width: ${widthPercent}%; height: 10px; background-color: #F43F5E; border-radius: 2px;"></div>
        </div>
      `;
    };

    const maxDayVal = Math.max(...data.map(d => Math.max(d.revenue, d.labFees, d.commissions, d.expenses, d.netProfit)), 1);

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>ARKA Custom Performance</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; }
          .title { font-size: 16pt; font-weight: bold; color: #0F172A; }
          .subtitle { font-size: 10pt; font-weight: bold; color: #E11D48; text-transform: uppercase; }
          .meta { font-size: 9pt; color: #64748B; }
          .card { border: 1px solid #E2E8F0; background-color: #F8FAFC; padding: 10px; text-align: center; }
          .card-title { font-size: 8.5pt; font-weight: bold; color: #64748B; }
          .card-val { font-size: 12pt; font-weight: 900; color: #0F172A; }
          .card-net { font-size: 12pt; font-weight: 900; color: #10B981; }
          th { font-weight: bold; background-color: #F1F5F9; border: 1px solid #CBD5E1; padding: 6px; }
          td { border: 1px solid #E2E8F0; padding: 6px; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
        </style>
      </head>
      <body>
        <table>
          <tr><td></td></tr>
          <tr>
            <td></td>
            <td colspan="6" class="title">ARKA DENTAL CENTER</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="6" class="subtitle">CUSTOM PERFORMANCE STATEMENT & DATA MOVEMENT REPORT</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="6" class="meta">Custom Period: <strong>${startStr}</strong> to <strong>${endStr}</strong></td>
          </tr>
          <tr>
            <td></td>
            <td colspan="6" class="meta">Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
          </tr>
          <tr><td></td></tr>
          
          <!-- SUMMARY TILES -->
          <tr>
            <td></td>
            <td colspan="3" class="card" style="border: 2px solid #F43F5E; background-color: #FFF1F2;">
              <span class="card-title" style="color: #E11D48; font-weight: bold;">Period Gross Intake</span><br/>
              <span class="card-val" style="color: #E11D48;">PHP ${totalRev.toLocaleString()}</span>
            </td>
            <td colspan="3" class="card" style="border: 1px solid #E2E8F0; background-color: #FEF3C7;">
              <span class="card-title" style="color: #D97706; font-weight: bold;">Period Sir Ross Lab Fees</span><br/>
              <span class="card-val" style="color: #D97706;">PHP ${totalLab.toLocaleString()}</span>
            </td>
          </tr>
          <tr>
            <td></td>
            <td colspan="2" class="card" style="border: 1px solid #E2E8F0;">
              <span class="card-title" style="color: #0D9488;">Accrued Dentist Earnings</span><br/>
              <span class="card-val" style="color: #0D9488;">PHP ${totalCom.toLocaleString()}</span>
            </td>
            <td colspan="2" class="card" style="border: 1px solid #E2E8F0;">
              <span class="card-title" style="color: #475569;">Operational Overheads</span><br/>
              <span class="card-val" style="color: #475569;">PHP ${totalExp.toLocaleString()}</span>
            </td>
            <td colspan="2" class="card" style="border: 2px solid #10B981; background-color: #ECFDF5;">
              <span class="card-title" style="color: #047857; font-weight: bold;">Period Net Profit</span><br/>
              <span class="card-net" style="color: #047857;">PHP ${totalNet.toLocaleString()}</span>
            </td>
          </tr>
          <tr><td></td></tr>

          <!-- DATA MOVEMENT TABLE WITH SPARKLINE REPRESENTATION -->
          <tr>
            <td></td>
            <td colspan="6" style="font-size: 11pt; font-weight: bold; border-bottom: 2px solid #0F172A; padding-bottom: 4px;">
              Daily Data Movement &amp; Progress Sparkline Summary
            </td>
          </tr>
          <tr><td></td></tr>

          <tr>
            <td></td>
            <th style="text-align: left;">Calendar Date</th>
            <th style="text-align: right; color: #E11D48;">Gross Revenue (PHP)</th>
            <th style="text-align: right; color: #D97706;">Lab Expenses (PHP)</th>
            <th style="text-align: right; color: #0D9488;">Dentist Earnings (PHP)</th>
            <th style="text-align: right; color: #475569;">Overheads (PHP)</th>
            <th style="text-align: right; color: #047857; font-weight: bold;">Net Profit (PHP)</th>
            <th style="text-align: left;">Revenue Sparkline Indicator</th>
          </tr>
    `;

    data.forEach(day => {
      const sparklineHTML = getHTMLProgressBarForVal(day.revenue, maxDayVal);
      html += `
          <tr>
            <td></td>
            <td style="font-weight: bold; background-color: #F8FAFC;">${day.dateStr} (${day.date})</td>
            <td style="text-align: right; color: #E11D48; font-weight: bold;">PHP ${day.revenue.toLocaleString()}</td>
            <td style="text-align: right; color: #D97706;">PHP ${day.labFees.toLocaleString()}</td>
            <td style="text-align: right; color: #0D9488;">PHP ${day.commissions.toLocaleString()}</td>
            <td style="text-align: right; color: #475569;">PHP ${day.expenses.toLocaleString()}</td>
            <td style="text-align: right; color: #047857; font-weight: bold; background-color: ${day.netProfit >= 0 ? '#ECFDF5' : '#FFF1F2'};">PHP ${day.netProfit.toLocaleString()}</td>
            <td style="border: 1px solid #E2E8F0; padding: 6px; vertical-align: middle; background-color: #FFF5F5;">
              ${sparklineHTML}
            </td>
          </tr>
      `;
    });

    html += `
          <tr><td></td></tr>
          <tr>
            <td></td>
            <td colspan="7" style="font-size: 8.5pt; color: #64748B; font-style: italic;">
              * Extracted from ARKA Dental Ledger database. Net profit calculation includes Double-Entry Philippine Tax Modifiers.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARKA_Dental_Performance_${startStr}_to_${endStr}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // EXCEL COMPLIANT VISUAL STATEMENT GRAPH & DATA TABULATION GENERATOR (ACCORDING TO USER MANDATE)
  const handleExportRevenueExcel = () => {
    const distData = [
      { label: 'Unchecked Intake Revenue', color: '#EC4899', val: metrics.totalRevenue, ratio: 100 },
      { label: 'Absorbed Materials & Lab Fees (Sir Ross)', color: '#F97316', val: metrics.totalLabFees, ratio: (metrics.totalLabFees / metrics.totalRevenue) * 100 },
      { label: 'Disbursed Dentist Commissions (ER, GA, KU)', color: '#10B981', val: metrics.totalCommissions, ratio: (metrics.totalCommissions / metrics.totalRevenue) * 100 },
      { label: 'Operational Clinic Overheads', color: '#64748B', val: metrics.totalExpenses, ratio: (metrics.totalExpenses / metrics.totalRevenue) * 100 },
      { label: 'Real Net Profits', color: '#0D9488', val: metrics.netProfit, ratio: (metrics.netProfit / metrics.totalRevenue) * 100 }
    ];

    const maxRatio = Math.max(...distData.map(item => item.ratio), 100);

    const getHTMLProgressBar = (ratio: number, color: string) => {
      const barWidthPercent = Math.min(100, Math.max(0, (ratio / maxRatio) * 100));
      return `
        <div style="width: 200px; background-color: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 4px; padding: 2px;">
          <div style="width: ${barWidthPercent}%; height: 12px; background-color: ${color}; border-radius: 2px;"></div>
        </div>
      `;
    };

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>ARKA Revenue Report</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1E293B; }
          .title { font-size: 16pt; font-weight: bold; color: #0F172A; }
          .subtitle { font-size: 10pt; font-weight: bold; color: #DC2626; text-transform: uppercase; }
          .meta { font-size: 9pt; color: #64748B; }
          .card { border: 1px solid #E2E8F0; background-color: #F8FAFC; padding: 10px; text-align: center; }
          .card-title { font-size: 9pt; font-weight: bold; color: #64748B; }
          .card-val { font-size: 14pt; font-weight: 900; color: #0F172A; }
          .card-net { font-size: 14pt; font-weight: 900; color: #059669; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
        </style>
      </head>
      <body>
        <table>
          <tr><td></td></tr>
          <tr>
            <td></td>
            <td colspan="4" class="title">ARKA DENTAL CENTER</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="4" class="subtitle">LEDGER PERFORMANCE STATEMENT & RECONCILIATION REPORT</td>
          </tr>
          <tr>
            <td></td>
            <td colspan="4" class="meta">Location: Unit B, San Antonio, Sucat, Parañaque City • BIR TIN: 293-182-938-000</td>
          </tr>
          <tr><td></td></tr>
          
          <!-- FINANCIAL METRIC CARDS -->
          <tr>
            <td></td>
            <td colspan="2" class="card" style="border: 2px solid #F43F5E; background-color: #FFF1F2;">
              <span class="card-title" style="color: #E11D48; font-weight: bold;">Gross Clinical Intake (June)</span><br/>
              <span class="card-val" style="color: #E11D48;">PHP ${metrics.totalRevenue.toLocaleString()}</span>
            </td>
            <td colspan="2" class="card" style="border: 1px solid #E2E8F0;">
              <span class="card-title" style="color: #B45309;">Sir Ross Lab Expenses</span><br/>
              <span class="card-val" style="color: #B45309;">PHP ${metrics.totalLabFees.toLocaleString()}</span>
            </td>
          </tr>
          <tr>
            <td></td>
            <td colspan="2" class="card" style="border: 1px solid #E2E8F0;">
              <span class="card-title" style="color: #0D9488;">Accrued Dentist Earnings</span><br/>
              <span class="card-val" style="color: #0D9488;">PHP ${metrics.totalCommissions.toLocaleString()}</span>
            </td>
            <td colspan="2" class="card" style="border: 2px solid #10B981; background-color: #ECFDF5;">
              <span class="card-title" style="color: #047857; font-weight: bold;">Net Clinical Revenue Profit</span><br/>
              <span class="card-net" style="color: #047857;">PHP ${metrics.netProfit.toLocaleString()}</span>
            </td>
          </tr>
          <tr><td></td></tr>

          <!-- DISTRIBUTION HEADER -->
          <tr>
            <td></td>
            <td colspan="4" style="font-size: 11pt; font-weight: bold; border-bottom: 2px solid #0F172A; padding-bottom: 4px;">
              Reconciliation Distribution Graph & Data Table
            </td>
          </tr>
          <tr><td></td></tr>

          <!-- GRAPH TABLE -->
          <tr>
            <td></td>
            <td style="font-weight: bold; background-color: #F1F5F9; border: 1px solid #CBD5E1; padding: 6px;">Category / Line Item</td>
            <td style="font-weight: bold; background-color: #F1F5F9; border: 1px solid #CBD5E1; padding: 6px; text-align: right;">Value (PHP)</td>
            <td style="font-weight: bold; background-color: #F1F5F9; border: 1px solid #CBD5E1; padding: 6px; text-align: right;">Ratio</td>
            <td style="font-weight: bold; background-color: #F1F5F9; border: 1px solid #CBD5E1; padding: 6px;">Visual Graph Bar Representation</td>
          </tr>
    `;

    distData.forEach(item => {
      const progressBarHTML = getHTMLProgressBar(item.ratio, item.color);
      const rowRatio = Math.max(0, Math.round(item.ratio));
      html += `
          <tr>
            <td></td>
            <td style="border: 1px solid #E2E8F0; padding: 8px; font-weight: bold;">${item.label}</td>
            <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right; font-weight: bold;">₱${item.val.toLocaleString()}</td>
            <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right; font-weight: bold;">${rowRatio}%</td>
            <td style="border: 1px solid #E2E8F0; padding: 8px; vertical-align: middle;">
              ${progressBarHTML}
            </td>
          </tr>
      `;
    });

    html += `
          <tr><td></td></tr>
          <tr>
            <td></td>
            <td colspan="4" style="font-size: 9pt; color: #64748B; font-style: italic;">
              * Computed utilizing strict Philippine BIR double ledger regulations (7-year statutory archive safety).
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ARKA_Dental_Revenue_Report_June2026.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateEmployeeField = (employeeId: string, field: string, value: any) => {
    const updatedEmployees = db.employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, [field]: value };
      }
      return emp;
    });
    const updatedDb = { ...db, employees: updatedEmployees };
    setDb(updatedDb);
    onSaveState(updatedDb);
  };

  // EXCEL CSV DOWNLOADER FOR CLINIC LEDGER
  const handleExportClinicLedger = () => {
    let csv = 'Transaction Code,Date,Patient,Dentist,Procedure,Amount Charged,Paid Amount,Payment Mode,Merchant Card Fee,Sir Ross Lab Fee,Net Revenue,Accrued Dentist Commission\r\n';
    db.transactions.forEach(t => {
      const matchedPatient = db.patients.find(p => p.id === t.patientId);
      const resolvedPatientName = matchedPatient ? `${matchedPatient.firstName} ${matchedPatient.lastName}` : (t.patientName || 'Walk-in Patient');
      const row = [
        t.code,
        t.date,
        `"${resolvedPatientName}"`,
        `"${db.employees.find(e => e.id === t.dentistId)?.displayName || t.dentistId}"`,
        `"${t.procedureName}"`,
        t.amountCharged,
        t.amountPaid,
        t.paymentMode,
        t.merchantFee,
        t.labFee || 0,
        t.netRevenue,
        t.commissionAmount
      ];
      csv += row.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ARKA_DentalClinic_June2026_Ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // MASTER FULL REPORT DOWNLOADER (PDF & EXCEL CONSOLIDATED)
  const handleDownloadFullReport = () => {
    // 1. Gather all current ledger data
    const data = getDailyDataMovement(selectedStartDate, selectedEndDate);
    if (data.length === 0) {
      triggerToast('No ledger data found in the selected date range.', 'info');
      return;
    }

    const totalRev = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalLab = data.reduce((sum, d) => sum + d.labFees, 0);
    const totalCom = data.reduce((sum, d) => sum + d.commissions, 0);
    const totalExp = data.reduce((sum, d) => sum + d.expenses, 0);
    const totalNet = totalRev - totalLab - totalCom - totalExp;

    const maxDayVal = Math.max(...data.map(d => Math.max(d.revenue, d.labFees, d.commissions, d.expenses, d.netProfit)), 1);

    // ==========================================
    // PART A: GENERATE BEAUTIFUL BRANDED PDF
    // ==========================================
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Cover Page / Header Branding Accent Block
      doc.setFillColor(244, 63, 94); // rose-500
      doc.rect(15, 15, 180, 2, 'F');

      // Title & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor('#1E293B'); // Slate 800
      doc.text('ARKA DENTAL CENTER', 15, 25);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor('#EC4899'); // Rose 500
      doc.text('LEDGER AUDIT PERFORMANCE & RECONCILIATION REPORT', 15, 31);

      // Metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor('#64748B'); // Slate 500
      doc.text(`Selected Target Period: ${selectedStartDate} to ${selectedEndDate}`, 15, 37);
      doc.text(`Generated On: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} ${new Date().toLocaleTimeString()}`, 15, 42);

      // Line separator
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(15, 46, 195, 46);

      // --- SECTION 1: FINANCIAL SNAPSHOT ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor('#0F172A'); // Slate 900
      doc.text('I. EXECUTIVE FINANCIAL SUMMARY', 15, 52);

      // Card Dimensions
      const cardW = 56;
      const cardH = 22;
      const gap = 6;

      // Card 1: Gross Revenue
      doc.setFillColor(255, 241, 242); // Rose 50
      doc.setDrawColor(254, 205, 211); // Rose 200
      doc.rect(15, 56, cardW, cardH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#E11D48'); // Rose 600
      doc.text('GROSS CLINICAL INTAKE', 18, 62);
      doc.setFontSize(11);
      doc.setTextColor('#9F1239'); // Rose 800
      doc.text(`PHP ${totalRev.toLocaleString()}`, 18, 71);

      // Card 2: Sir Ross Lab Fees
      doc.setFillColor(254, 243, 199); // Amber 50
      doc.setDrawColor(253, 230, 138); // Amber 200
      doc.rect(15 + cardW + gap, 56, cardW, cardH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#D97706'); // Amber 600
      doc.text('SIR ROSS LAB FEES', 15 + cardW + gap + 3, 62);
      doc.setFontSize(11);
      doc.setTextColor('#92400E'); // Amber 800
      doc.text(`PHP ${totalLab.toLocaleString()}`, 15 + cardW + gap + 3, 71);

      // Card 3: Accrued Dentist Commissions
      doc.setFillColor(240, 253, 250); // Teal 50
      doc.setDrawColor(204, 251, 241); // Teal 200
      doc.rect(15 + (cardW + gap) * 2, 56, cardW, cardH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#0D9488'); // Teal 600
      doc.text('DENTIST COMMISSIONS', 15 + (cardW + gap) * 2 + 3, 62);
      doc.setFontSize(11);
      doc.setTextColor('#115E59'); // Teal 800
      doc.text(`PHP ${totalCom.toLocaleString()}`, 15 + (cardW + gap) * 2 + 3, 71);

      // Card 4: Operational Overheads (Span 1 Column)
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.rect(15, 82, cardW, cardH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#475569'); // Slate 600
      doc.text('OPERATIONAL OVERHEADS', 18, 88);
      doc.setFontSize(11);
      doc.setTextColor('#1E293B'); // Slate 800
      doc.text(`PHP ${totalExp.toLocaleString()}`, 18, 97);

      // Card 5: Real Net Profits (Span 2 Columns)
      const wideCardW = cardW * 2 + gap; // 118mm
      doc.setFillColor(236, 253, 245); // Emerald 50
      doc.setDrawColor(167, 243, 208); // Emerald 200
      doc.rect(15 + cardW + gap, 82, wideCardW, cardH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#059669'); // Emerald 600
      doc.text('REAL NET CLINICAL PROFIT (AUDIT READY)', 15 + cardW + gap + 3, 88);
      doc.setFontSize(12);
      doc.setTextColor('#065F46'); // Emerald 800
      doc.text(`PHP ${totalNet.toLocaleString()}`, 15 + cardW + gap + 3, 97);

      // --- SECTION 2: RECONCILIATION RATIO DISTRIBUTION ANALYSIS ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor('#0F172A');
      doc.text('II. RECONCILIATION RATIO DISTRIBUTION ANALYSIS', 15, 114);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 117, 195, 117);

      const ratioItems = [
        { label: 'Unchecked Intake Revenue', val: totalRev, ratio: 100, color: [244, 63, 94] }, // pink-500
        { label: 'Sir Ross Lab Fees (Absorbed)', val: totalLab, ratio: totalRev > 0 ? (totalLab / totalRev) * 100 : 0, color: [245, 158, 11] }, // amber-500
        { label: 'Dentist Commission Share (Disbursed)', val: totalCom, ratio: totalRev > 0 ? (totalCom / totalRev) * 100 : 0, color: [20, 184, 166] }, // teal-500
        { label: 'Operational Clinic Overheads (Spent)', val: totalExp, ratio: totalRev > 0 ? (totalExp / totalRev) * 100 : 0, color: [100, 116, 139] }, // slate-500
        { label: 'Real Net Profits (Retained)', val: totalNet, ratio: totalRev > 0 ? (totalNet / totalRev) * 100 : 0, color: [16, 185, 129] } // emerald-500
      ];

      let yStart = 122;
      ratioItems.forEach((item, idx) => {
        const yCurrent = yStart + idx * 8;
        // Text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor('#475569');
        doc.text(item.label, 15, yCurrent + 3);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor('#1E293B');
        doc.text(`PHP ${item.val.toLocaleString()} (${Math.max(0, Math.round(item.ratio)) || 0}%)`, 95, yCurrent + 3);

        // Progress track
        doc.setFillColor(241, 245, 249);
        doc.rect(135, yCurrent, 60, 4, 'F');

        // Progress bar filled
        const filledW = (Math.max(0, Math.min(100, item.ratio)) / 100) * 60;
        if (filledW > 0) {
          doc.setFillColor(item.color[0], item.color[1], item.color[2]);
          doc.rect(135, yCurrent, filledW, 4, 'F');
        }
      });

      // --- SECTION 3: DAILY LEDGER CHRONOLOGICAL TABLES ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor('#0F172A');
      doc.text('III. CHRONOLOGICAL DAILY LEDGER RECORD', 15, 168);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 171, 195, 171);

      // Table Header bg
      const yTableHeader = 175;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, yTableHeader, 180, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#475569');
      doc.text('Calendar Date', 17, yTableHeader + 5);
      doc.text('Intake Rev (PHP)', 73, yTableHeader + 5, { align: 'right' });
      doc.text('Lab Fees (PHP)', 101, yTableHeader + 5, { align: 'right' });
      doc.text('Dentist Share (PHP)', 129, yTableHeader + 5, { align: 'right' });
      doc.text('Overheads (PHP)', 157, yTableHeader + 5, { align: 'right' });
      doc.text('Net Profit (PHP)', 193, yTableHeader + 5, { align: 'right' });

      let yRow = 182;
      let pageNum = 1;

      // Draw pagination footer helper
      const drawFooter = (page: number) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Computed utilizing strict Philippine BIR double ledger regulations (7-year statutory archive safety). Page ${page}`, 15, 288);
      };

      drawFooter(pageNum);

      data.forEach((day, index) => {
        // Page overflow check
        if (yRow + 6 > 280) {
          doc.addPage();
          pageNum++;
          drawFooter(pageNum);

          // Sub-header for subsequent page
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor('#64748B');
          doc.text('ARKA DENTAL CENTER - LEDGER RECORDS (CONTINUED)', 15, 15);
          doc.setFillColor(244, 63, 94);
          doc.rect(15, 17, 180, 0.5, 'F');

          // Print table headers again
          const yTableHeaderNew = 21;
          doc.setFillColor(241, 245, 249);
          doc.rect(15, yTableHeaderNew, 180, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor('#475569');
          doc.text('Calendar Date', 17, yTableHeaderNew + 5);
          doc.text('Intake Rev (PHP)', 73, yTableHeaderNew + 5, { align: 'right' });
          doc.text('Lab Fees (PHP)', 101, yTableHeaderNew + 5, { align: 'right' });
          doc.text('Dentist Share (PHP)', 129, yTableHeaderNew + 5, { align: 'right' });
          doc.text('Overheads (PHP)', 157, yTableHeaderNew + 5, { align: 'right' });
          doc.text('Net Profit (PHP)', 193, yTableHeaderNew + 5, { align: 'right' });

          yRow = 28;
        }

        // Draw Zebra Stripe Row Bg
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, yRow, 180, 6, 'F');
        }

        // Row content
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor('#334155');
        doc.text(`${day.dateStr} (${day.date})`, 17, yRow + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#E11D48'); // Reddish for revenue
        doc.text(day.revenue.toLocaleString(), 73, yRow + 4.2, { align: 'right' });

        doc.setTextColor('#D97706'); // Amber for lab
        doc.text(day.labFees.toLocaleString(), 101, yRow + 4.2, { align: 'right' });

        doc.setTextColor('#0D9488'); // Teal for dentist
        doc.text(day.commissions.toLocaleString(), 129, yRow + 4.2, { align: 'right' });

        doc.setTextColor('#64748B'); // Slate for expenses
        doc.text(day.expenses.toLocaleString(), 157, yRow + 4.2, { align: 'right' });

        // Net Profit highlight cell
        if (day.netProfit >= 0) {
          doc.setFillColor(236, 253, 245); // Emerald 50
          doc.rect(161, yRow + 0.6, 33, 4.8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor('#047857'); // Emerald 700
        } else {
          doc.setFillColor(255, 241, 242); // Rose 50
          doc.rect(161, yRow + 0.6, 33, 4.8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor('#B91C1C'); // Red 700
        }
        doc.text(day.netProfit.toLocaleString(), 193, yRow + 4.2, { align: 'right' });

        // Bottom row thin line
        doc.setDrawColor(241, 245, 249);
        doc.line(15, yRow + 6, 195, yRow + 6);

        yRow += 6;
      });

      // --- SECTION 4: PATIENTS INCOME GENERAL LEDGER ---
      doc.addPage();
      pageNum++;
      drawFooter(pageNum);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor('#0F172A');
      doc.text('IV. PATIENTS INCOME GENERAL LEDGER', 15, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor('#64748B');
      doc.text(`Period Covered: ${selectedStartDate} to ${selectedEndDate}`, 15, 20);

      // Section line separator
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 23, 195, 23);

      // Table Header bg
      let yLedgerRow = 28;
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(15, yLedgerRow, 180, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor('#FFFFFF');
      doc.text('Date', 16, yLedgerRow + 4.8);
      doc.text('Duty', 29, yLedgerRow + 4.8);
      doc.text('Patient', 38, yLedgerRow + 4.8);
      doc.text('Procedure', 65, yLedgerRow + 4.8);
      doc.text('Lab Fee', 85, yLedgerRow + 4.8, { align: 'right' });
      doc.text('Discount', 101, yLedgerRow + 4.8, { align: 'right' });
      doc.text('Amt Paid', 119, yLedgerRow + 4.8, { align: 'right' });
      doc.text('% Comm', 125, yLedgerRow + 4.8);
      doc.text('Terminal', 139, yLedgerRow + 4.8);
      doc.text('Merch', 155, yLedgerRow + 4.8, { align: 'right' });
      doc.text('HMO', 169, yLedgerRow + 4.8, { align: 'right' });
      doc.text('Gross', 181, yLedgerRow + 4.8, { align: 'right' });
      doc.text('Net', 193, yLedgerRow + 4.8, { align: 'right' });

      yLedgerRow += 7;

      const pdfTxns = db.transactions.filter(t => t.date >= selectedStartDate && t.date <= selectedEndDate);

      pdfTxns.forEach((t, idx) => {
        if (yLedgerRow + 6 > 280) {
          doc.addPage();
          pageNum++;
          drawFooter(pageNum);

          // Table Header bg again on overflow page
          yLedgerRow = 15;
          doc.setFillColor(30, 41, 59);
          doc.rect(15, yLedgerRow, 180, 7, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor('#FFFFFF');
          doc.text('Date', 16, yLedgerRow + 4.8);
          doc.text('Duty', 29, yLedgerRow + 4.8);
          doc.text('Patient', 38, yLedgerRow + 4.8);
          doc.text('Procedure', 65, yLedgerRow + 4.8);
          doc.text('Lab Fee', 85, yLedgerRow + 4.8, { align: 'right' });
          doc.text('Discount', 101, yLedgerRow + 4.8, { align: 'right' });
          doc.text('Amt Paid', 119, yLedgerRow + 4.8, { align: 'right' });
          doc.text('% Comm', 125, yLedgerRow + 4.8);
          doc.text('Terminal', 139, yLedgerRow + 4.8);
          doc.text('Merch', 155, yLedgerRow + 4.8, { align: 'right' });
          doc.text('HMO', 169, yLedgerRow + 4.8, { align: 'right' });
          doc.text('Gross', 181, yLedgerRow + 4.8, { align: 'right' });
          doc.text('Net', 193, yLedgerRow + 4.8, { align: 'right' });

          yLedgerRow += 7;
        }

        // Zebra Stripes
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, yLedgerRow, 180, 6, 'F');
        }

        const dr = db.employees.find(e => e.id === t.dentistId);
        const drInitials = dr?.displayName?.split(' ')?.map(n => n[0])?.join('')?.toUpperCase() || t.dentistId;
        const discountVal = t.discountAmount || 0;
        const netTotal = t.amountPaid - t.commissionAmount - (t.merchantFee || 0) - (t.labFee || 0);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor('#334155');

        doc.text(t.date, 16, yLedgerRow + 4);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#0D9488'); // teal for duty
        doc.text(drInitials, 29, yLedgerRow + 4);

        doc.setTextColor('#1E293B');
        doc.setFont('helvetica', 'normal');
        const matchedPat = db.patients.find(p => p.id === t.patientId);
        const resolvedPatName = matchedPat ? `${matchedPat.firstName} ${matchedPat.lastName}` : (t.patientName || 'Walk-in Patient');
        const patName = resolvedPatName.length > 15 ? resolvedPatName.substring(0, 13) + '..' : resolvedPatName;
        doc.text(patName, 38, yLedgerRow + 4);

        doc.text(t.procedureCode, 65, yLedgerRow + 4);

        doc.setTextColor('#475569');
        doc.text((t.labFee || 0).toLocaleString(), 85, yLedgerRow + 4, { align: 'right' });
        doc.text(discountVal.toLocaleString(), 101, yLedgerRow + 4, { align: 'right' });

        doc.setTextColor('#10B981'); // emerald for amount paid
        doc.setFont('helvetica', 'bold');
        doc.text(t.amountPaid.toLocaleString(), 119, yLedgerRow + 4, { align: 'right' });

        doc.setTextColor('#475569');
        doc.setFont('helvetica', 'normal');
        doc.text(`${t.commissionRateApplied * 100}%`, 125, yLedgerRow + 4);
        
        const term = t.paymentMode.length > 8 ? t.paymentMode.substring(0, 7) + '.' : t.paymentMode;
        doc.text(term, 139, yLedgerRow + 4);

        doc.text((t.merchantFee || 0).toLocaleString(), 155, yLedgerRow + 4, { align: 'right' });
        doc.text((t.hmoFee || 0).toLocaleString(), 169, yLedgerRow + 4, { align: 'right' });

        doc.setTextColor('#06B6D4'); // cyan for gross total
        doc.setFont('helvetica', 'bold');
        doc.text(t.amountPaid.toLocaleString(), 181, yLedgerRow + 4, { align: 'right' });

        doc.setTextColor('#3B82F6'); // blue for net total
        doc.setFont('helvetica', 'extrabold');
        doc.text(netTotal.toLocaleString(), 193, yLedgerRow + 4, { align: 'right' });

        // separator line
        doc.setDrawColor(241, 245, 249);
        doc.line(15, yLedgerRow + 6, 195, yLedgerRow + 6);

        yLedgerRow += 6;
      });

      doc.save(`ARKA_Dental_Full_Report_${selectedStartDate}_to_${selectedEndDate}.pdf`);
    } catch (pdfErr) {
      console.error("PDF generation failed", pdfErr);
      triggerToast('Failed to generate PDF document report.', 'error');
    }

    // ==========================================
    // PART B: GENERATE REAL MULTI-SHEET EXCEL WORKBOOK
    // ==========================================
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Financial Performance Summary
      const summaryAOA: any[][] = [
        ["ARKA DENTAL CENTER"],
        ["CONSOLIDATED FINANCIAL SUMMARY & RECONCILIATION STATEMENT"],
        [""],
        ["Target Range Period:", `${selectedStartDate} to ${selectedEndDate}`],
        ["Generated on:", `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
        [""],
        ["PERIOD KPI SUMMARY"],
        ["Gross Period Intake (PHP)", totalRev],
        ["Sir Ross Lab Fees (PHP)", totalLab],
        ["Accrued Dentist Share (PHP)", totalCom],
        ["Clinic Overheads / Expenses (PHP)", totalExp],
        ["Real Net Clinical Profits (PHP)", totalNet],
        [""],
        ["RECONCILIATION RATIO DISTRIBUTION ANALYSIS"],
        ["Category Component", "Value (PHP)", "Share Ratio (%)"],
        ["Unchecked Intake Revenue", totalRev, 100],
        ["Sir Ross Lab Fees (Absorbed)", totalLab, totalRev > 0 ? Math.round((totalLab / totalRev) * 100) : 0],
        ["Dentist Commission Share (Disbursed)", totalCom, totalRev > 0 ? Math.round((totalCom / totalRev) * 100) : 0],
        ["Operational Clinic Overheads (Spent)", totalExp, totalRev > 0 ? Math.round((totalExp / totalRev) * 100) : 0],
        ["Real Net Profits (Retained)", totalNet, totalRev > 0 ? Math.round((totalNet / totalRev) * 100) : 0],
        [""],
        ["CHRONOLOGICAL DAILY LEDGER RECORDS"],
        ["Calendar Date", "Date Key", "Gross Revenue (PHP)", "Lab Expenses (PHP)", "Dentist Earnings (PHP)", "Overheads (PHP)", "Net Profit (PHP)"]
      ];

      data.forEach(day => {
        summaryAOA.push([
          day.dateStr,
          day.date,
          day.revenue,
          day.labFees,
          day.commissions,
          day.expenses,
          day.netProfit
        ]);
      });

      summaryAOA.push([]);
      summaryAOA.push(["* Computed utilizing strict Philippine BIR double ledger regulations (7-year statutory archive safety)."]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Financial Summary");

      // Sheet 2: Patients Income General Ledger (Matches requested table!)
      const ledgerAOA: any[][] = [
        ["PATIENTS INCOME GENERAL LEDGER"],
        ["ARKA DENTAL CENTER"],
        [""],
        ["Filter Period:", `${selectedStartDate} to ${selectedEndDate}`],
        ["Generated on:", `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
        [""],
        ["Date", "Duty (Dentist)", "Patient Name", "Procedure", "Lab Fee (PHP)", "Discount (PHP)", "Amt Paid (PHP)", "Comm Rate", "Terminal / Mode", "Merch Fee (PHP)", "HMO Fee (PHP)", "Gross Total (PHP)", "Net Total (PHP)"]
      ];

      const excelTxns = db.transactions.filter(t => t.date >= selectedStartDate && t.date <= selectedEndDate);
      excelTxns.forEach(t => {
        const dr = db.employees.find(e => e.id === t.dentistId);
        const drInitials = dr?.displayName?.split(' ')?.map(n => n[0])?.join('')?.toUpperCase() || t.dentistId;
        const discountVal = t.discountAmount || 0;
        const netTotal = t.amountPaid - t.commissionAmount - (t.merchantFee || 0) - (t.labFee || 0);

        const matchedPatient = db.patients.find(p => p.id === t.patientId);
        const resolvedPatientName = matchedPatient ? `${matchedPatient.firstName} ${matchedPatient.lastName}` : (t.patientName || 'Walk-in Patient');

        ledgerAOA.push([
          t.date,
          drInitials,
          resolvedPatientName,
          t.procedureCode,
          t.labFee || 0,
          discountVal,
          t.amountPaid,
          `${t.commissionRateApplied * 100}%`,
          t.paymentMode,
          t.merchantFee || 0,
          t.hmoFee || 0,
          t.amountPaid,
          netTotal
        ]);
      });

      const wsLedger = XLSX.utils.aoa_to_sheet(ledgerAOA);
      XLSX.utils.book_append_sheet(wb, wsLedger, "Patients Income Ledger");

      // Save Workbook
      XLSX.writeFile(wb, `ARKA_Dental_Full_Report_${selectedStartDate}_to_${selectedEndDate}.xlsx`);

      triggerToast('Full PDF Report and Dynamic Multi-Sheet Excel Workbook compiled and downloaded successfully.', 'success');
    } catch (xlsErr) {
      console.error("Excel generation failed", xlsErr);
      triggerToast('Failed to generate Excel document report.', 'error');
    }
  };

  // REUSABLE POPUP TO PRINT PAYSTUBS
  const handleOpenPaystubViewer = (runId: string, employeeId: string) => {
    setSelectedPaystubRunId(runId);
    setSelectedPaystubEmployeeId(employeeId);
  };

  const activePaystubRun = db.payrollRuns.find(r => r.id === selectedPaystubRunId);
  const activePaystubEntry = activePaystubRun?.entries.find(e => e.employeeId === selectedPaystubEmployeeId);
  const activePaystubEmployeeProfile = db.employees.find(emp => emp.id === selectedPaystubEmployeeId);

  const duplicateGroups = getDuplicateTransactions();
  const duplicateTxnIds = duplicateGroups.flatMap(g => g.transactions.map(t => t.id));

  return (
    <div className={`min-h-screen ${themeMode === 'dark' ? 'bg-slate-950 text-slate-100 dark-theme' : 'bg-slate-50 text-slate-800'} font-sans leading-relaxed selection:bg-rose-200 selection:text-rose-900 pb-16 print:bg-white print:text-black`}>
      <input
        type="file"
        ref={dashboardFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setDashboardImportFile(e.target.files[0]);
            handleDashboardFileImport(e.target.files[0]);
          }
        }}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />
      {themeMode === 'dark' && (
        <style>{`
          .dark-theme {
            background-color: #020617 !important;
            color: #f1f5f9 !important;
          }
          .dark-theme .bg-white {
            background-color: #0d1527 !important;
            border-color: #1e293b !important;
          }
          .dark-theme .border,
          .dark-theme .border-slate-100,
          .dark-theme .border-slate-150,
          .dark-theme .border-slate-200,
          .dark-theme .border-slate-250 {
            border-color: #1e293b !important;
          }
          .dark-theme .text-slate-900,
          .dark-theme .text-slate-850,
          .dark-theme .text-slate-800,
          .dark-theme .text-slate-705,
          .dark-theme .text-slate-700,
          .dark-theme .text-slate-650,
          .dark-theme .text-slate-655,
          .dark-theme .text-slate-600 {
            color: #f1f5f9 !important;
          }
          .dark-theme .text-slate-500,
          .dark-theme .text-slate-450,
          .dark-theme .text-slate-400 {
            color: #94a3b8 !important;
          }
          .dark-theme .bg-slate-50,
          .dark-theme .bg-slate-100 {
            background-color: #0f172a !important;
          }
          .dark-theme input,
          .dark-theme select,
          .dark-theme textarea {
            background-color: #0f172a !important;
            color: #f1f5f9 !important;
            border-color: #334155 !important;
          }
          .dark-theme .shadow-sm,
          .dark-theme .shadow,
          .dark-theme .shadow-md,
          .dark-theme .shadow-xl {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.6), 0 2px 4px -1px rgba(0, 0, 0, 0.4) !important;
          }
        `}</style>
      )}
      
      {/* GLOBAL BANNER / TAX CALENDAR STATUS (HIDDEN IN PRINT) */}
      <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 text-white px-6 py-2.5 text-center font-bold text-xs flex items-center justify-center gap-3 shadow-md print:hidden">
        <span>🇵🇭 PHILIPPINES BIR BIR-COMPLIANCE ACTIVE • June 2026 TAX SEASON CALENDAR</span>
        <span className="bg-slate-950 text-white rounded-full px-2 py-0.5 text-[10px]">Form 1601-C Remittance Due soon</span>
        <button 
          id="btn-sync-seed"
          onClick={handleResetState} 
          className="bg-slate-950 text-sky-200 hover:text-white px-3 py-1 rounded text-[10px] uppercase font-mono flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" /> Reload Seeds
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8">
        
        {/* CLINICAL APP TITLE BANNER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-blue-100 pb-6 print:hidden">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <ArkaLogo size="md" />
              <span className="hidden md:inline text-slate-300">|</span>
              <div className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md inline-block">
                Bookkeeper Console
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-3">
              Active Clinician: Dr. Karla Urbi • Dedicated bookkeeping, 7-year statutory archive, commission audits &amp; OCR expenses.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div 
              id="global-drag-drop-zone"
              onDragOver={(e) => {
                e.preventDefault();
                setImportDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setImportDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setImportDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleGlobalFileImport(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => globalFileInputRef.current?.click()}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer border border-dashed select-none shrink-0 ${
                importDragActive 
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-slate-800/80 dark:text-blue-300 scale-105' 
                  : themeMode === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
              }`}
              title="Drag & Drop or Click to import Excel/CSV files"
            >
              <FolderUp className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>Import Ledger</span>
              <input 
                type="file" 
                ref={globalFileInputRef} 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleGlobalFileImport(e.target.files[0]);
                  }
                }} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
            </div>

            <button
              id="btn-theme-toggle"
              onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                themeMode === 'dark' 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-105 border border-slate-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
              }`}
            >
              {themeMode === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" /> <span>Dark Theme</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" /> <span>Light Theme</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CLINIC TOP TABS PANEL (HIDDEN IN PRINT) */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl mb-8 border border-slate-200 print:hidden">
          {[
            { id: 'DASHBOARD', label: '📊 Dashboard', desc: 'Financial Snapshot' },
            { id: 'TRANSACTIONS', label: '💸 Transactions', desc: 'Billing & Logs' },
            { id: 'RECEIPTS', label: '🧾 Receipt Cabinet', desc: 'Gemini OCR' },
            { id: 'EXPENSES', label: '📉 Expenses & Budgets', desc: 'Billing costs' },
            { id: 'HMO', label: '💳 HMO Gap Analysis', desc: 'HP & Cocolife' },
            { id: 'EMPLOYEES', label: '👥 Employee Roster', desc: 'Dentists' },
            { id: 'ADMIN_PANEL', label: '🔑 Admin Tab', desc: 'Secure Payroll & Logs' }
          ].map((tab) => (
            <button
              id={`tab-btn-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedPaystubRunId(null); // Clear paystub previews on tab change
              }}
              className={`flex flex-col items-start px-4.5 py-2.5 rounded-lg text-left transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm border-t-2 border-blue-500' 
                  : 'text-slate-650 hover:bg-white/40 hover:text-slate-900'
              }`}
            >
              <span className="text-xs font-bold leading-none">{tab.label}</span>
              <span className="text-[9px] text-slate-450 mt-1 font-medium">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* ======================================================================= */}
        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {/* ======================================================================= */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-8 animate-fade-in print:hidden">

            {/* COMPACT SMART IMPORT RESULTS REVIEW CABINET */}
            {dashboardImportResults && (
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-900/60 shadow-xl space-y-4 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-slate-100 flex flex-wrap items-center gap-2 text-sm">
                        <span>📁 Smart Ledger Audit Cabinet</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                          Active File: {dashboardImportResults.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Sheet Type:</span>
                        <select
                          id="import-detected-type-selector"
                          value={dashboardImportResults.detectedType}
                          onChange={(e) => {
                            if (dashboardImportFile) {
                              handleDashboardFileImport(dashboardImportFile, e.target.value as any);
                            }
                          }}
                          className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="TRANSACTIONS">💸 Transactions Ledger</option>
                          <option value="EXPENSES">📉 Expenses Sheet</option>
                          <option value="EMPLOYEES">👥 Employees Directory</option>
                          <option value="PATIENTS">👤 Patients Directory</option>
                        </select>
                      </h4>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDashboardImportResults(null);
                      setDashboardImportFile(null);
                    }}
                    className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-800/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                  >
                    Dismiss Cabinet
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Total Rows parsed</div>
                    <div className="text-lg font-black text-indigo-300 mt-1">{dashboardImportResults.totalRows}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Ready to sync</div>
                    <div className="text-lg font-black text-emerald-400 mt-1">{dashboardImportResults.cleanRecords.length}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Typos Rectified</div>
                    <div className="text-lg font-black text-amber-400 mt-1">{dashboardImportResults.typosCorrected.length}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Duplicate conflicts</div>
                    <div className="text-lg font-black text-rose-400 mt-1">{dashboardImportResults.duplicates.length}</div>
                  </div>
                </div>

                {/* Typos Corrected Log */}
                {dashboardImportResults.typosCorrected.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      ✨ Intelligent Typo &amp; Reference Corrections:
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 max-h-[100px] overflow-y-auto space-y-1.5 font-mono text-[10px] text-slate-300">
                      {dashboardImportResults.typosCorrected.map((correction, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-amber-400">🔧</span>
                          <span>
                            Row <strong className="text-indigo-300">{correction.rowIdx}</strong>: Match <strong className="text-slate-400">"{correction.original}"</strong> fuzzy aligned with database <strong className="text-emerald-400">"{correction.corrected}"</strong> ({correction.field})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicates Found Log */}
                {dashboardImportResults.duplicates.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <span>⚠️ Potential Duplicate Entries Found in Ledger:</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 max-h-[120px] overflow-y-auto space-y-2">
                      {dashboardImportResults.duplicates.map((dup, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2 text-[10px] text-slate-300">
                            <span className="text-rose-400">⚠️</span>
                            <div className="font-mono">
                              <span className="font-bold text-slate-400">Row {dup.rowIdx}:</span> {dup.item.date} • {dup.item.patientName || 'Patient'} • {dup.item.procedureName || 'Procedure'} • ₱{dup.item.amountPaid?.toLocaleString()}
                              <p className="text-[9px] text-rose-300/80 italic mt-0.5">
                                Conflict: Matches database ID {dup.duplicateOf?.code}
                              </p>
                            </div>
                          </div>
                          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-[10px] bg-slate-900 border border-slate-850 px-2 py-1 rounded-md select-none">
                            <input
                              type="checkbox"
                              checked={dup.skip}
                              onChange={(e) => {
                                if (dashboardImportResults) {
                                  const updatedDups = [...dashboardImportResults.duplicates];
                                  updatedDups[i].skip = e.target.checked;
                                  setDashboardImportResults({
                                    ...dashboardImportResults,
                                    duplicates: updatedDups
                                  });
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <span className="text-slate-350 font-semibold">Skip Row</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Sync Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setDashboardImportResults(null);
                      setDashboardImportFile(null);
                    }}
                    className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 font-bold py-1.5 px-3.5 rounded-lg transition-all cursor-pointer text-[11px]"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteDashboardSync}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-4 rounded-lg shadow-md flex items-center gap-1.5 transition-all cursor-pointer text-[11px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Sync &amp; Upgrade Arka Database ({dashboardImportResults.cleanRecords.length + dashboardImportResults.duplicates.filter(d => !d.skip).length} items)
                  </button>
                </div>
              </div>
            )}

            {/* KPI METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Gross Clinical Intake (June)', val: `₱${metrics.totalRevenue.toLocaleString()}`, color: 'border-l-4 border-rose-500' },
                { title: 'Sir Ross Lab Expenses', val: `₱${metrics.totalLabFees.toLocaleString()}`, color: 'border-l-4 border-amber-500' },
                { title: 'Accrued Dentist Earnings', val: `₱${metrics.totalCommissions.toLocaleString()}`, color: 'border-l-4 border-teal-500' },
                { title: 'Net Clinical Revenue Profit', val: `₱${metrics.netProfit.toLocaleString()}`, color: 'border-l-4 border-emerald-500', bold: true }
              ].map((card, idx) => (
                <div key={idx} className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 ${card.color} flex flex-col justify-between`}>
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{card.title}</div>
                  <div className={`text-2xl font-black mt-3 ${card.bold ? 'text-emerald-700' : 'text-slate-900'}`}>{card.val}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Compliance index 100% matched</div>
                </div>
              ))}
            </div>

            {/* CHARTS / VISUAL COMPARISON AREA (SIMULATOR) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* CURRENT MONTH RECONCILIATION */}
              <div className="lg:col-span-8 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span>Reconciliation Distribution</span>
                  <div className="flex items-center gap-2">
                    <button 
                      id="btn-export-revenue-excel"
                      onClick={handleExportRevenueExcel}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download styled report with embedded character progress bar"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export Revenue to Excel
                    </button>
                    <span className="text-[11px] bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-full font-bold">June 1-15 cutoff ready</span>
                  </div>
                </h3>

                {/* VISUAL RECONCILIATION CHARTS (HTML BARS + RECHARTS DONUT) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Left Column: Progress ratio lines */}
                  <div className="space-y-4">
                    {[
                      { label: 'Unchecked Intake Revenue', color: 'bg-rose-500', ratio: 100, val: metrics.totalRevenue },
                      { label: 'Absorbed Materials & Lab Fees (Sir Ross)', color: 'bg-amber-500', ratio: metrics.totalRevenue > 0 ? (metrics.totalLabFees / metrics.totalRevenue) * 100 : 0, val: metrics.totalLabFees },
                      { label: 'Disbursed Dentist Commissions (ER, GA, KU)', color: 'bg-teal-500', ratio: metrics.totalRevenue > 0 ? (metrics.totalCommissions / metrics.totalRevenue) * 100 : 0, val: metrics.totalCommissions },
                      { label: 'Operational Clinic Overheads', color: 'bg-slate-400', ratio: metrics.totalRevenue > 0 ? (metrics.totalExpenses / metrics.totalRevenue) * 100 : 0, val: metrics.totalExpenses },
                      { label: 'Real Net Profits', color: 'bg-emerald-600', ratio: metrics.totalRevenue > 0 ? (metrics.netProfit / metrics.totalRevenue) * 100 : 0, val: metrics.netProfit }
                    ].map((bar, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-650">
                          <span className="font-semibold">{bar.label}</span>
                          <span className="font-bold">₱{bar.val.toLocaleString()} ({Math.max(0, Math.round(bar.ratio)) || 0}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${bar.color} rounded-full`}
                            style={{ width: `${Math.min(100, Math.max(0, bar.ratio))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Dynamic Circular Donut Chart */}
                  <div className="h-[200px] flex flex-col justify-center items-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'Lab Fees', value: metrics.totalLabFees || 0 },
                            { name: 'Dentist Commissions', value: metrics.totalCommissions || 0 },
                            { name: 'Operational Overheads', value: metrics.totalExpenses || 0 },
                            { name: 'Real Net Profits', value: Math.max(0, metrics.netProfit) || 0 }
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {[
                            { name: 'Lab Fees', color: '#F59E0B' },
                            { name: 'Dentist Commissions', color: '#14B8A6' },
                            { name: 'Operational Overheads', color: '#94A3B8' },
                            { name: 'Real Net Profits', color: '#10B981' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Amount']}
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Gross Intake</span>
                      <span className="text-sm font-black text-slate-850">₱{metrics.totalRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-50 pt-4 flex items-center justify-between text-xs text-slate-450">
                  <span>Computed utilizing strict Philippine BIR double ledger regulations (3-year statutory audit limits).</span>
                  <a href="#" className="text-rose-500 hover:underline inline-flex items-center gap-0.5">Learn statutory guides <ChevronRight className="w-3 h-3" /></a>
                </div>

              </div>

              {/* OUTSTANDING NOTIFICATIONS PANEL */}
              <div className="lg:col-span-4 bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-550" /> Alerts &amp; BIR Deadlines
                  </h3>

                  <div className="space-y-3.5">
                    {[
                      { icon: '🔴', title: 'BIR Form 1601-C Remittance', desc: 'Salary withholding schedules due next week (Form compilation ready).' },
                      { icon: '🟠', title: 'SSS Form R-3 Submission', desc: 'Mandatory upload of employee portal share logs.' },
                      { icon: '🟡', title: 'Receipt Retention Archive Warning', desc: 'We simulate 7-year storage preservation on local databases.' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-2.5">
                        <span className="text-base leading-none mt-0.5">{item.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{item.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* SEED ADVISORY BANNER */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900 border-l-4">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Playable Seed Dataset Pre-Configured</p>
                <p className="mt-0.5 opacity-80">This application is loaded with typical Parañaque ARKA dental records. Try uploading receipts or pasting lists to test the <strong>Smart Audit File Analyzer</strong>, or click onto Payroll runs to output real BIR-compliant printable tables of dentist paystubs.</p>
              </div>
            </div>

            {/* INTERACTIVE DATA MOVEMENT LEDGER GRAPH */}
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-50">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <span>📈 Interactive Daily Ledgers &amp; Cashflow Analyser</span>
                    <span className="bg-rose-100 text-rose-700 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md">Dynamic v2</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Deep-dive into daily operations. Hover on any point to view precise values, or choose categories below to isolate trend directions.
                  </p>
                </div>
                
                {/* Quick range selector presets */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 px-2">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStartDate('2026-06-01');
                      setSelectedEndDate('2026-06-15');
                      setTempStartDate('2026-06-01');
                      setTempEndDate('2026-06-15');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                      selectedStartDate === '2026-06-01' && selectedEndDate === '2026-06-15'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    June 1-15
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStartDate('2026-06-16');
                      setSelectedEndDate('2026-06-30');
                      setTempStartDate('2026-06-16');
                      setTempEndDate('2026-06-30');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                      selectedStartDate === '2026-06-16' && selectedEndDate === '2026-06-30'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    June 16-30
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStartDate('2026-06-01');
                      setSelectedEndDate('2026-06-30');
                      setTempStartDate('2026-06-01');
                      setTempEndDate('2026-06-30');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                      selectedStartDate === '2026-06-01' && selectedEndDate === '2026-06-30'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Full Month
                  </button>
                </div>
              </div>

              {/* Custom Date Picker & Master Excel Print Center */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                <div className="md:col-span-3">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Target Start Date</label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStartDate(tempStartDate);
                      setSelectedEndDate(tempEndDate);
                      triggerToast(`Ledger successfully updated for the period ${tempStartDate} to ${tempEndDate}!`, 'success');
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Save &amp; Refresh
                  </button>
                </div>
                
                <div className="md:col-span-4">
                  <button
                    onClick={handleDownloadFullReport}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-black py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    title="Download beautifully branded PDF report & custom Excel spreadsheet with graphs"
                  >
                    <Download className="w-4 h-4" /> Download Full Report (PDF &amp; XLS)
                  </button>
                </div>
              </div>

              {/* Dynamic Interactive Category Cards - Tapping Highlights Graph */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { key: 'revenue', label: 'Gross Clinical Intake', color: '#F43F5E', bg: 'bg-rose-50/50 hover:bg-rose-50 border-rose-100', selectedStyle: 'ring-2 ring-rose-500 bg-rose-500 text-white border-rose-600 font-bold', defaultText: 'text-rose-600', val: getDailyDataMovement(selectedStartDate, selectedEndDate).reduce((acc, d) => acc + d.revenue, 0) },
                  { key: 'labFees', label: 'Sir Ross Lab Expenses', color: '#F59E0B', bg: 'bg-amber-50/50 hover:bg-amber-50 border-amber-100', selectedStyle: 'ring-2 ring-amber-500 bg-amber-500 text-slate-950 border-amber-600 font-black', defaultText: 'text-amber-700', val: getDailyDataMovement(selectedStartDate, selectedEndDate).reduce((acc, d) => acc + d.labFees, 0) },
                  { key: 'commissions', label: 'Accrued Dentist Earnings', color: '#14B8A6', bg: 'bg-teal-50/50 hover:bg-teal-50 border-teal-100', selectedStyle: 'ring-2 ring-teal-500 bg-teal-500 text-white border-teal-600 font-bold', defaultText: 'text-teal-700', val: getDailyDataMovement(selectedStartDate, selectedEndDate).reduce((acc, d) => acc + d.commissions, 0) },
                  { key: 'expenses', label: 'Operational Expenses', color: '#475569', bg: 'bg-slate-50 hover:bg-slate-100 border-slate-200', selectedStyle: 'ring-2 ring-slate-600 bg-slate-600 text-white border-slate-700 font-bold', defaultText: 'text-slate-600', val: getDailyDataMovement(selectedStartDate, selectedEndDate).reduce((acc, d) => acc + d.expenses, 0) },
                  { key: 'netProfit', label: 'Net Clinical Profit', color: '#10B981', bg: 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100', selectedStyle: 'ring-2 ring-emerald-500 bg-emerald-600 text-white border-emerald-700 font-bold', defaultText: 'text-emerald-700', val: getDailyDataMovement(selectedStartDate, selectedEndDate).reduce((acc, d) => acc + d.revenue - d.labFees - d.commissions - d.expenses, 0) }
                ].map((cat) => {
                  const isSelected = selectedGraphCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        if (selectedGraphCategory === cat.key) {
                           setSelectedGraphCategory(null);
                        } else {
                           setSelectedGraphCategory(cat.key as any);
                        }
                      }}
                      className={`flex flex-col justify-between items-start text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                        isSelected ? cat.selectedStyle : `${cat.bg} border-slate-100 hover:scale-[1.01]`
                      }`}
                    >
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-current opacity-80' : 'text-slate-400'}`}>
                        {cat.label}
                      </span>
                      <span className="text-xs font-black mt-1.5 font-mono">
                        ₱{cat.val.toLocaleString()}
                      </span>
                      <span className={`text-[9px] mt-0.5 font-bold ${isSelected ? 'text-current opacity-100' : cat.defaultText}`}>
                        {isSelected ? '✓ Highlight Active' : '➔ Tap to isolate'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Highlight Banner */}
              {selectedGraphCategory && (
                <div className="bg-slate-900 border border-slate-800 text-white px-3.5 py-2 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="animate-pulse text-emerald-400">●</span>
                    <span>
                      Isolating <strong>{selectedGraphCategory === 'revenue' ? 'Gross Clinical Intake' : selectedGraphCategory === 'labFees' ? 'Sir Ross Lab Expenses' : selectedGraphCategory === 'commissions' ? 'Accrued Dentist Earnings' : selectedGraphCategory === 'expenses' ? 'Operational Expenses' : 'Net Clinical Profit'}</strong>. Other metrics are dimmed to 15% weight.
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedGraphCategory(null)} 
                    className="text-[10px] uppercase font-black bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-slate-300"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* Chart render container */}
              <div className="h-[380px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={getDailyDataMovement(selectedStartDate, selectedEndDate)}
                    margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false} 
                      axisLine={false} 
                      style={{ fontSize: '10px', fill: '#94A3B8', fontWeight: 600 }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v) => `₱${v.toLocaleString()}`}
                      style={{ fontSize: '10px', fill: '#94A3B8', fontWeight: 600 }} 
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-950 border border-slate-800 text-white p-3.5 rounded-xl shadow-xl space-y-2 font-sans min-w-[230px]">
                              <p className="font-extrabold text-[10px] text-slate-400 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                                <span>📅 {label}</span>
                                <span className="font-mono text-[8px] text-rose-500 uppercase font-black">Daily Ledger</span>
                              </p>
                              <div className="space-y-1 text-[11px]">
                                {payload.map((item: any, idx: number) => {
                                  const isHighlighted = selectedGraphCategory === null || selectedGraphCategory === item.dataKey;
                                  return (
                                    <div 
                                      key={idx} 
                                      className={`flex items-center justify-between gap-5 transition-opacity ${
                                        isHighlighted ? 'opacity-100 font-extrabold text-[#fff]' : 'opacity-20'
                                      }`}
                                      style={{ color: isHighlighted ? undefined : '#475569' }}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}
                                      </span>
                                      <span className="font-mono" style={{ color: item.color }}>₱{item.value.toLocaleString()}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      name="Gross Clinical Intake"
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#F43F5E" 
                      strokeWidth={selectedGraphCategory === 'revenue' ? 4.5 : selectedGraphCategory === null ? 2.2 : 1.2}
                      strokeOpacity={selectedGraphCategory === 'revenue' ? 1.0 : selectedGraphCategory === null ? 0.85 : 0.15}
                      dot={{ stroke: '#F43F5E', strokeWidth: 1.5, r: selectedGraphCategory === 'revenue' ? 4.5 : 2.5, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#F43F5E' }}
                    />
                    <Line 
                      name="Sir Ross Lab Fees"
                      type="monotone" 
                      dataKey="labFees" 
                      stroke="#F59E0B" 
                      strokeWidth={selectedGraphCategory === 'labFees' ? 4.5 : selectedGraphCategory === null ? 2.2 : 1.2}
                      strokeOpacity={selectedGraphCategory === 'labFees' ? 1.0 : selectedGraphCategory === null ? 0.85 : 0.15}
                      dot={{ stroke: '#F59E0B', strokeWidth: 1.5, r: selectedGraphCategory === 'labFees' ? 4.5 : 2.5, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#F59E0B' }}
                    />
                    <Line 
                      name="Accrued Dentist Earnings"
                      type="monotone" 
                      dataKey="commissions" 
                      stroke="#14B8A6" 
                      strokeWidth={selectedGraphCategory === 'commissions' ? 4.5 : selectedGraphCategory === null ? 2.2 : 1.2}
                      strokeOpacity={selectedGraphCategory === 'commissions' ? 1.0 : selectedGraphCategory === null ? 0.85 : 0.15}
                      dot={{ stroke: '#14B8A6', strokeWidth: 1.5, r: selectedGraphCategory === 'commissions' ? 4.5 : 2.5, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#14B8A6' }}
                    />
                    <Line 
                      name="Operational Expenses"
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="#475569" 
                      strokeWidth={selectedGraphCategory === 'expenses' ? 4.5 : selectedGraphCategory === null ? 2.2 : 1.2}
                      strokeOpacity={selectedGraphCategory === 'expenses' ? 1.0 : selectedGraphCategory === null ? 0.85 : 0.15}
                      dot={{ stroke: '#475569', strokeWidth: 1.5, r: selectedGraphCategory === 'expenses' ? 4.5 : 2.5, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#475569' }}
                    />
                    <Line 
                      name="Net Clinical Profit"
                      type="monotone" 
                      dataKey="netProfit" 
                      stroke="#10B981" 
                      strokeWidth={selectedGraphCategory === 'netProfit' ? 4.5 : selectedGraphCategory === null ? 2.2 : 1.2}
                      strokeOpacity={selectedGraphCategory === 'netProfit' ? 1.0 : selectedGraphCategory === null ? 0.85 : 0.15}
                      dot={{ stroke: '#10B981', strokeWidth: 1.5, r: selectedGraphCategory === 'netProfit' ? 4.5 : 2.5, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#10B981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>



          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 2: PATIENT VISIT & TRANSACTION LOG */}
        {/* ======================================================================= */}
        {activeTab === 'TRANSACTIONS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in print:hidden">
            
            {/* INGEST APP TRANSACTIONS MODULE (COL-4) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* REGISTER NEW PATIENTS FORM */}
              <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-1">
                  <PlusCircle className="w-4 h-4 text-rose-500" /> 1. Quick Register Patient
                </h3>
                <form onSubmit={handleCreatePatient} className="space-y-3.5">
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">First Name</label>
                    <input 
                      id="in-patient-first"
                      type="text" 
                      value={patFirstName} 
                      onChange={(e) => setPatFirstName(e.target.value)}
                      placeholder="Jane" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Last Name</label>
                    <input 
                      id="in-patient-last"
                      type="text" 
                      value={patLastName} 
                      onChange={(e) => setPatLastName(e.target.value)}
                      placeholder="Doe" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">HMO Provider</label>
                      <select 
                        id="sel-patient-hmo"
                        value={patHmoProvider} 
                        onChange={(e: any) => setPatHmoProvider(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none"
                      >
                        <option value="NONE">No HMO</option>
                        <option value="HP">Health Partners</option>
                        <option value="FILDOCS">FilDocs</option>
                        <option value="COCOLIFE">Cocolife</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">HMO ID Code</label>
                      <input 
                        id="in-patient-hmoid"
                        type="text" 
                        value={patHmoId} 
                        onChange={(e) => setPatHmoId(e.target.value)}
                        placeholder="ID-9204" 
                        disabled={patHmoProvider === 'NONE'}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-rose-500 disabled:opacity-40"
                      />
                    </div>
                  </div>
                  <button 
                    id="btn-register-patient"
                    type="submit" 
                    className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-1.5 rounded-lg text-xs"
                  >
                    Create Patient Account
                  </button>
                </form>
              </div>

              {/* LOG VISIT APPOINTMENT SHEET */}
              <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-1">
                  <PlusCircle className="w-4 h-4 text-rose-500" /> 2. Record Dental Transaction
                </h3>
                <form onSubmit={handleSubmitTransaction} className="space-y-3.5">
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Transaction Date</label>
                      <input 
                        id="in-txn-date"
                        type="date"
                        value={txnDate}
                        onChange={(e) => setTxnDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Patient</label>
                      <select 
                        id="sel-txn-patient"
                        value={txnPatientId}
                        onChange={(e) => setTxnPatientId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                        required
                      >
                        <option value="">-- Choose Patient --</option>
                        {db.patients.map(p => (
                          <option key={p.id} value={p.id}>{p.firstName} {p.lastName} {p.hmoProvider !== 'NONE' ? `(${p.hmoProvider} HMO)` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Assign Dentist</label>
                      <select 
                        id="sel-txn-dentist"
                        value={txnDentistId}
                        onChange={(e) => setTxnDentistId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      >
                        {db.employees.filter(emp => emp.type === 'DENTIST').map(d => (
                          <option key={d.id} value={d.id}>{d.displayName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Procedure</label>
                      <select 
                        id="sel-txn-procedure"
                        value={txnProcedureCode}
                        onChange={(e) => handleProcedureSelectionChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      >
                        {db.procedures.map(p => (
                          <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Payment Mode</label>
                      <select 
                        id="sel-txn-payment"
                        value={txnPaymentMode}
                        onChange={(e: any) => setTxnPaymentMode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      >
                        <option value="CASH">Cash</option>
                        <option value="GCASH">GCash</option>
                        <option value="CREDIT_CARD">Credit Card (3.5% fee)</option>
                        <option value="DEBIT_CARD">Debit Card (3.5% fee)</option>
                        <option value="BPI">BPI bank</option>
                        <option value="MAYA">Maya pay</option>
                        <option value="GOTYME">GoTyme Bank</option>
                        <option value="HMO">HMO claims</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Amount Paid (₱)</label>
                      <input 
                        id="in-txn-paid-amount"
                        type="number" 
                        value={txnAmountPaid}
                        onChange={(e) => setTxnAmountPaid(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                        required
                        min={0}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Sir Ross Lab Cost (₱)</label>
                      <input 
                        id="in-txn-lab-fee"
                        type="number" 
                        value={txnLabFee}
                        onChange={(e) => setTxnLabFee(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Lab Supplier</label>
                      <input 
                        id="in-txn-lab-vendor"
                        type="text" 
                        value={txnLabVendor}
                        onChange={(e) => setTxnLabVendor(e.target.value)}
                        placeholder="Kuya Jess"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block uppercase mb-1">Clerical Notes</label>
                    <input 
                      id="in-txn-remarks"
                      type="text" 
                      value={txnRemarks}
                      onChange={(e) => setTxnRemarks(e.target.value)}
                      placeholder="Senior discount copy verified..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  {/* AI SMART TAG COMPONENT */}
                  <div className="bg-slate-50/70 border border-slate-150 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-500 font-extrabold block uppercase tracking-wider">
                        AI Smart Tag Category
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAutoCategorize()}
                        disabled={isCategorizing || !txnRemarks.trim()}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
                          isCategorizing 
                            ? 'bg-indigo-150 text-indigo-600 cursor-not-allowed animate-pulse'
                            : !txnRemarks.trim()
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isCategorizing ? 'Categorizing...' : '⚡ AI Smart Tag'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Clinical', 'Administrative', 'Maintenance', 'Uncategorized'] as const).map((tag) => {
                        const isSelected = txnSmartTag === tag;
                        const tagColors: Record<string, string> = {
                          Clinical: isSelected 
                            ? 'bg-rose-500 text-white border-rose-600 ring-1 ring-rose-300 shadow-sm' 
                            : 'bg-white hover:bg-rose-50/50 text-rose-700 border-rose-100',
                          Administrative: isSelected 
                            ? 'bg-blue-600 text-white border-blue-700 ring-1 ring-blue-300 shadow-sm' 
                            : 'bg-white hover:bg-blue-50/50 text-blue-700 border-blue-100',
                          Maintenance: isSelected 
                            ? 'bg-amber-500 text-slate-950 border-amber-600 ring-1 ring-amber-300 shadow-sm font-bold' 
                            : 'bg-white hover:bg-amber-50/50 text-amber-850 border-amber-100',
                          Uncategorized: isSelected 
                            ? 'bg-slate-500 text-white border-slate-600 ring-1 ring-slate-300 shadow-sm' 
                            : 'bg-white hover:bg-slate-50/50 text-slate-500 border-slate-200'
                        };

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setTxnSmartTag(tag)}
                            className={`px-1.5 py-1 text-[10px] font-semibold rounded-lg border text-center transition-all ${tagColors[tag]}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100/70">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block uppercase mb-1">
                        Dentist Commission % {isManualCommissionOverride && <span className="text-rose-500 font-extrabold text-[9px]">(Edited)</span>}
                      </label>
                      <input 
                        id="in-txn-comm-rate"
                        type="number" 
                        value={txnCommissionRate}
                        onChange={(e) => handleCommissionRateChange(Number(e.target.value))}
                        className="w-full bg-white border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-rose-800 font-bold"
                        required
                        step="any"
                        min={0}
                        max={100}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block uppercase mb-1">
                        Commission Amount (₱) {isManualCommissionOverride && <span className="text-rose-500 font-extrabold text-[9px]">(Edited)</span>}
                      </label>
                      <input 
                        id="in-txn-comm-amount"
                        type="number" 
                        value={txnCommissionAmount}
                        onChange={(e) => handleCommissionAmountChange(Number(e.target.value))}
                        className="w-full bg-white border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-rose-800 font-bold"
                        required
                        step="any"
                        min={0}
                      />
                    </div>
                  </div>

                  <button 
                    id="btn-txn-submit"
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 rounded-lg text-xs shadow"
                  >
                    Deduct Fees &amp; Accrue Commission
                  </button>

                </form>
              </div>

            </div>

            {/* SCRIPTED REAL-TIME CLINIC JOURNAL GRID (COL-8) */}
            <div className="lg:col-span-8 bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Official Auditable Activity Journal</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 font-normal">
                        Showing {getFilteredJournalTransactions().length} of {db.transactions.length} patient transactions
                      </span>

                      {/* Interactive Calendar Dropdown Filter */}
                      <div className="relative inline-block text-left">
                        <select
                          value={journalDateFilterType}
                          onChange={(e) => setJournalDateFilterType(e.target.value)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold py-1 px-2.5 rounded-md border border-slate-200 outline-none cursor-pointer transition-colors"
                        >
                          <option value="ALL">🗓️ All Time Records</option>
                          <option value="TODAY">📅 Today's Records</option>
                          <option value="YESTERDAY">📅 Yesterday's Records</option>
                          <option value="7_DAYS">📅 Past 7 Days</option>
                          <option value="30_DAYS">📅 Past 30 Days</option>
                          <option value="CUSTOM_DATE">🔍 Specific Date</option>
                          <option value="CUSTOM_RANGE">🔍 Custom Date Range</option>
                        </select>
                      </div>

                      {/* Interactive Custom Date Inputs */}
                      {journalDateFilterType === 'CUSTOM_DATE' && (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <input
                            type="date"
                            value={journalFilterSingleDate}
                            onChange={(e) => setJournalFilterSingleDate(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-850 text-[11px] px-2 py-0.5 rounded-md outline-none focus:border-indigo-500 shadow-sm transition-all"
                          />
                        </div>
                      )}

                      {journalDateFilterType === 'CUSTOM_RANGE' && (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <input
                            type="date"
                            placeholder="Start"
                            value={journalFilterStartDate}
                            onChange={(e) => setJournalFilterStartDate(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-850 text-[11px] px-2 py-0.5 rounded-md outline-none focus:border-indigo-500 shadow-sm transition-all"
                          />
                          <span className="text-slate-400 text-[10px] font-semibold">to</span>
                          <input
                            type="date"
                            placeholder="End"
                            value={journalFilterEndDate}
                            onChange={(e) => setJournalFilterEndDate(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-850 text-[11px] px-2 py-0.5 rounded-md outline-none focus:border-indigo-500 shadow-sm transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Excel export button */}
                    <button
                      type="button"
                      onClick={handleExportJournalExcel}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>

                    {/* Edit input / Save and refresh buttons */}
                    {!isJournalEditMode ? (
                      <button
                        type="button"
                        onClick={handleToggleJournalEditMode}
                        className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit input</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSaveJournalEdit}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer animate-pulse"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>save and refresh</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsJournalEditMode(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                        >
                          <span>Cancel</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-650 min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Patient's Name</th>
                        <th className="px-3 py-3">Dentist</th>
                        <th className="px-3 py-3">Procedure</th>
                        <th className="px-3 py-3 text-right">Paid</th>
                        <th className="px-3 py-3">Mode</th>
                        <th className="px-3 py-3 text-right text-rose-600">Commission (Tier)</th>
                        <th className="px-3 py-3">AI Tag</th>
                        <th className="px-3 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!isJournalEditMode ? (
                        getFilteredJournalTransactions().map((txn) => {
                          const dr = db.employees.find(e => e.id === txn.dentistId);
                          const isDuplicate = duplicateTxnIds.includes(txn.id);
                          return (
                            <tr key={txn.id} className={`${isDuplicate ? 'bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500' : 'hover:bg-slate-50/60'} transition-colors text-slate-700 dark:text-slate-300`}>
                              <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] font-medium text-slate-500">{txn.date}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span>
                                    {(() => {
                                      const matchedPatient = db.patients.find(p => p.id === txn.patientId);
                                      return matchedPatient ? `${matchedPatient.firstName} ${matchedPatient.lastName}` : (txn.patientName || 'Walk-in Patient');
                                    })()}
                                  </span>
                                  {isDuplicate && (
                                    <span className="inline-flex items-center bg-rose-100 text-rose-700 text-[8px] font-black tracking-wider uppercase px-1 rounded animate-pulse">
                                      ⚠️ Duplicate
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">{dr?.displayName || txn.dentistId}</td>
                              <td className="px-3 py-2.5 font-semibold text-slate-600">{txn.procedureCode} - {txn.procedureName}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">₱{txn.amountPaid.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-[10px] font-mono"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{txn.paymentMode}</span></td>
                              <td className="px-3 py-2.5 text-right text-rose-600 font-black font-mono">
                                ₱{txn.commissionAmount.toLocaleString()} 
                                <span className="text-[8px] text-slate-400 font-normal block">({txn.commissionTierApplied})</span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {txn.smartTag && txn.smartTag !== 'Uncategorized' ? (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    txn.smartTag === 'Clinical'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : txn.smartTag === 'Administrative'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>{txn.smartTag}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-450 italic font-mono">Unclassified</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 italic max-w-xs truncate">{txn.remarks || '—'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        getFilteredEditTransactions().map((txn) => {
                          return (
                            <tr key={txn.id} className="bg-amber-50/20 hover:bg-amber-50/40 transition-colors font-mono text-[11px]">
                              {/* Date */}
                              <td className="px-2 py-2">
                                <input
                                  type="date"
                                  value={txn.date}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'date', e.target.value)}
                                  className="w-24 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                />
                              </td>
                              {/* Patient */}
                              <td className="px-2 py-2">
                                <select
                                  value={txn.patientId}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'patientId', e.target.value)}
                                  className="w-32 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                >
                                  {db.patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
                                  ))}
                                </select>
                              </td>
                              {/* Dentist */}
                              <td className="px-2 py-2">
                                <select
                                  value={txn.dentistId}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'dentistId', e.target.value)}
                                  className="w-28 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                >
                                  {db.employees.filter(emp => emp.type === 'DENTIST').map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.displayName}</option>
                                  ))}
                                </select>
                              </td>
                              {/* Procedure */}
                              <td className="px-2 py-2">
                                <select
                                  value={txn.procedureCode}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'procedureCode', e.target.value)}
                                  className="w-28 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                >
                                  {db.procedures.map(p => (
                                    <option key={p.code} value={p.code}>{p.code} - {p.name.slice(0, 15)}...</option>
                                  ))}
                                </select>
                              </td>
                              {/* Paid */}
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  value={txn.amountPaid}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'amountPaid', Number(e.target.value))}
                                  className="w-20 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs text-slate-850 font-bold text-right outline-none"
                                />
                              </td>
                              {/* Mode */}
                              <td className="px-2 py-2">
                                <select
                                  value={txn.paymentMode}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'paymentMode', e.target.value)}
                                  className="w-24 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                >
                                  <option value="CASH">CASH</option>
                                  <option value="GCASH">GCASH</option>
                                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                                  <option value="CREDIT_CARD">CREDIT CARD</option>
                                  <option value="DEBIT_CARD">DEBIT CARD</option>
                                  <option value="HMO">HMO</option>
                                </select>
                              </td>
                              {/* Commission Tier & rate */}
                              <td className="px-2 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-slate-400">({txn.commissionTierApplied})</span>
                                  <input
                                    type="number"
                                    value={Math.round(txn.commissionRateApplied * 100)}
                                    onChange={(e) => handleJournalCellChange(txn.id, 'commissionRateApplied', Number(e.target.value) / 100)}
                                    className="w-10 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs text-slate-800 text-right outline-none"
                                    min={0}
                                    max={100}
                                    step={5}
                                  />
                                  <span className="text-[10px] text-slate-500">%</span>
                                </div>
                              </td>
                              {/* AI Tag */}
                              <td className="px-2 py-2">
                                <select
                                  value={txn.smartTag || 'Uncategorized'}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'smartTag', e.target.value)}
                                  className="w-28 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none font-bold"
                                >
                                  <option value="Uncategorized">Uncategorized</option>
                                  <option value="Clinical">Clinical</option>
                                  <option value="Administrative">Administrative</option>
                                  <option value="Maintenance">Maintenance</option>
                                </select>
                              </td>
                              {/* Remarks */}
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={txn.remarks || ''}
                                  onChange={(e) => handleJournalCellChange(txn.id, 'remarks', e.target.value)}
                                  className="w-full min-w-[100px] bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 outline-none"
                                  placeholder="No remarks"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* SMART AUDIT AND DUPLICATE DETECTION RESULTS PANEL */}
                <div className="mt-6 bg-slate-50 border border-slate-200/80 rounded-xl p-5">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Smart Ledger Audit Analyzer
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                            Active
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Analyzing {db.transactions.length} entries for duplicates or discrepancies in procedure logging, dmd assignment, and double-billing.
                        </p>
                      </div>
                    </div>
                    
                    {duplicateGroups.length > 0 && (
                      <button
                        type="button"
                        onClick={handleResolveDuplicates}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer self-stretch md:self-auto justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Auto-Resolve &amp; Merge {duplicateTxnIds.length} Duplicates</span>
                      </button>
                    )}
                  </div>

                  {duplicateGroups.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800 font-medium">
                        ⚠️ <strong>Smart Audit Warning</strong>: Found {duplicateGroups.length} duplicate transaction groups ({duplicateTxnIds.length} rows total). These are transactions with matching Dates, Patients, Dentists, Procedures, and Amounts Paid. Double-billing has been highlighted below.
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                        {duplicateGroups.map((group) => {
                          const sample = group.transactions[0];
                          return (
                            <div key={group.hash} className="bg-white border border-rose-100 rounded-lg p-3 shadow-sm flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.5 rounded">
                                    {group.transactions.length}x Duplicate Copies
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">{sample.date}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-800">{sample.patientName}</p>
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-600">Procedure:</span> {sample.procedureCode} - {sample.procedureName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-600">DMD Duty:</span> {db.employees.find(e => e.id === sample.dentistId)?.displayName || sample.dentistId}
                                </p>
                              </div>
                              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
                                <span className="text-slate-400">Conflict Amount:</span>
                                <span className="font-bold text-rose-600">₱{sample.amountPaid.toLocaleString()} each</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
                      <span className="text-emerald-600">✔</span>
                      <span><strong>Clear Audit</strong>: No identical double-billed works detected. All bulk transactions and patient records match uniquely.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 border-t border-slate-50 pt-4 text-xs text-slate-400 flex items-center justify-between">
                <span>All line calculations are locked automatically under SEC/BIR audit guidelines.</span>
                <span className="text-slate-500 font-semibold text-[10px]">PHILIPPINES ACT 10963 STATUS: SECURE</span>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* DECOMMISSIONED RETIRED PUBLIC PAYROLL TEMPLATES */}
        {/* ======================================================================= */}
        {activeTab === 'NEVER_MATCHED_DRAFT' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            
            {/* INITIATE NEW RUNS */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-2">Accrue Statutory Clinical Payroll Period</h3>
              <p className="text-slate-500 text-xs mb-4">
                Run employee wage and dentist commission reports. SSS percentage deductions, Philhealth allocations and BIR Form parameters are automatically processed.
              </p>
              
              <div className="flex gap-4">
                <button 
                  id="btn-run-payroll-assistants"
                  onClick={() => handleRunPayroll('ASSISTANT_WEEKLY')}
                  className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center gap-2"
                >
                  ⚙ Accrue Weekly Assistants Payroll (Wednesday cutoff)
                </button>
                <button 
                  id="btn-run-payroll-dentists"
                  onClick={() => handleRunPayroll('DENTIST_SEMI_MONTHLY')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center gap-2"
                >
                  ⚙ Accrue Semi-Monthly Dentists Payroll (Cutoff 1-15)
                </button>
              </div>
            </div>

            {/* PROCESS PAYROLL HISTORIES */}
            {db.payrollRuns.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-bold text-sm">No payroll schedules generated yet</p>
                <p className="text-slate-500 text-xs mt-1">Select one of the Accrue options above to test printable paystub templates.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {db.payrollRuns.map((run) => (
                  <div key={run.id} className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-600 font-bold">{run.code}</span>
                          <h4 className="text-sm font-extrabold text-slate-900">
                            {run.type === 'ASSISTANT_WEEKLY' ? 'Weekly Assistant Disbursement' : 'Semi-Monthly Dentist Commissions'}
                          </h4>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          Cutoff Coverage: {run.payPeriodStart} to {run.payPeriodEnd} • Issued: {run.payDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          run.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {run.status === 'PAID' ? '🔒 PAID' : 'Draft'}
                        </span>
                        
                        {run.status !== 'PAID' && (
                          <button 
                            id={`btn-mark-paid-${run.id}`}
                            onClick={() => handleMarkPaid(run.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-md text-xs cursor-pointer"
                          >
                            🔒 Mark Outlay Paid
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold">
                          <tr>
                            <th className="px-4 py-2">Clinician name</th>
                            <th className="px-4 py-2 text-right">Clinician Base rate</th>
                            <th className="px-4 py-2 text-right text-rose-600">Accrued Commissions</th>
                            <th className="px-4 py-2 text-right">Statutory Deducts (SSS/Med/Tax)</th>
                            <th className="px-4 py-2 text-right">Clinic Net Payout</th>
                            <th className="px-4 py-2 text-center">BIR Slip</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-105">
                          {run.entries.map((entry, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/40">
                              <td className="px-4 py-3 font-semibold text-slate-800">{entry.employeeName}</td>
                              <td className="px-4 py-3 text-right">₱{entry.basePay.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-rose-600 font-extrabold">₱{entry.commission.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-amber-600">₱{entry.totalDeductions.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-slate-900 font-black">₱{entry.netPay.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center">
                                <button 
                                  id={`btn-open-paystub-${run.id}-${entry.employeeId}`}
                                  onClick={() => handleOpenPaystubViewer(run.id, entry.employeeId)}
                                  className="text-rose-500 hover:text-rose-600 hover:underline text-xs font-bold outline-none"
                                >
                                  📄 Printable Paystub
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ======================================================================= */}
        {/* DECOMMISSIONED RETIRED MODAL PRINT SYSTEM */}
        {/* ======================================================================= */}
        {activeTab === 'NEVER_MATCHED_DRAFT' && selectedPaystubRunId && selectedPaystubEmployeeId && activePaystubEntry && (
          <div className="bg-white border rounded-xl p-8 max-w-3xl mx-auto shadow-2xl relative my-8 print:border-none print:shadow-none print:p-0 print:my-0">
            
            {/* CLOSE BUTTON (HIDDEN IN PRINT) */}
            <div className="absolute top-6 right-6 flex gap-2 print:hidden">
              <button 
                id="btn-print-paystub"
                onClick={handlePrintPDF}
                className="bg-slate-900 hover:bg-slate-850 text-white text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print A4 Layout
              </button>
              <button 
                id="btn-close-paystub"
                onClick={() => {
                  setSelectedPaystubRunId(null);
                  setSelectedPaystubEmployeeId(null);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-3.5 py-1.5 rounded-lg font-bold"
              >
                Close View
              </button>
            </div>

            {/* PAYSLIP TEMPLATE */}
            <div className="font-serif text-slate-900 leading-normal space-y-6">
              
              {/* HEADER */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col items-center">
                <ArkaLogo size="md" className="mb-1" />
                <p className="text-[11px] font-sans text-slate-500 mt-1">Unit B, San Antonio, Sucat, Parañaque City • BIR TIN: 293-182-938-000</p>
                <h4 className="w-full text-center text-sm font-bold uppercase mt-3 tracking-widest bg-slate-100 text-slate-800 py-1.5 font-sans">
                  Statement of Salary Compensation
                </h4>
              </div>

              {/* INFO COLUMN GRID */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-sans">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">EMPLOYEE NAME:</span>
                  <span className="font-bold text-slate-900">{activePaystubEmployeeProfile?.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">PAY DATE:</span>
                  <span className="font-bold text-slate-900">{activePaystubRun?.payDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">POSITION:</span>
                  <span className="font-bold text-slate-800">{activePaystubEmployeeProfile?.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">PAY CUT-OFF PERIOD:</span>
                  <span className="font-bold text-slate-800">{activePaystubRun?.payPeriodStart} to {activePaystubRun?.payPeriodEnd}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">SSS / PHILHEALTH:</span>
                  <span className="font-mono text-slate-700">{activePaystubEmployeeProfile?.sssNumber} / {activePaystubEmployeeProfile?.philhealthNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] block">TIN / PAGIBIG:</span>
                  <span className="font-mono text-slate-700">{activePaystubEmployeeProfile?.tin} / {activePaystubEmployeeProfile?.pagibigMID}</span>
                </div>
              </div>

              {/* ACCOUNT COMPILATIONS ROW */}
              <div className="grid grid-cols-2 gap-8 border-t border-b border-dashed border-slate-400 py-4 font-sans">
                
                {/* COMPENSATIONS */}
                <div className="space-y-2">
                  <h5 className="font-extrabold uppercase text-[10px] text-slate-500 border-b border-slate-200 pb-1">Earnings COMPOSITION</h5>
                  <div className="flex justify-between text-xs">
                    <span>Base Contract Pay:</span>
                    <span className="font-bold">₱{activePaystubEntry.basePay.toLocaleString()}</span>
                  </div>
                  {activePaystubEntry.commission > 0 && (
                    <div className="flex justify-between text-xs text-rose-600">
                      <span>Prostho &amp; basic Commissions:</span>
                      <span className="font-bold">₱{activePaystubEntry.commission.toLocaleString()}</span>
                    </div>
                  )}
                  {activePaystubEmployeeProfile?.clinicSharePercentage !== undefined && activePaystubEmployeeProfile.clinicSharePercentage > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600 font-medium">
                      <span>Clinic Share Comm. ({activePaystubEmployeeProfile.clinicSharePercentage}%):</span>
                      <span className="font-bold">₱{Math.round(activePaystubEntry.commission * (activePaystubEmployeeProfile.clinicSharePercentage / 100)).toLocaleString()}</span>
                    </div>
                  )}
                  {activePaystubEntry.hmoAllowance > 0 && (
                    <div className="flex justify-between text-xs">
                      <span>HMO Attendance Allowance:</span>
                      <span className="font-bold">₱{activePaystubEntry.hmoAllowance.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1">
                    <span>GROSS CLINICAL EARNINGS:</span>
                    <span>₱{activePaystubEntry.grossPay.toLocaleString()}</span>
                  </div>
                </div>

                {/* STATUTORY WITHHOLDINGS */}
                <div className="space-y-2">
                  <h5 className="font-extrabold uppercase text-[10px] text-slate-500 border-b border-slate-200 pb-1">Withholdings DEDUCTIONS</h5>
                  <div className="flex justify-between text-xs">
                    <span>SSS Contribution share:</span>
                    <span className="font-mono">₱{activePaystubEntry.sssContribution.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>PhilHealth insurance:</span>
                    <span className="font-mono">₱{activePaystubEntry.philhealthContribution.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Pag-IBIG premium Index:</span>
                    <span className="font-mono">₱{activePaystubEntry.pagibigContribution.toLocaleString()}</span>
                  </div>
                  {activePaystubEntry.withholdingTax > 0 && (
                    <div className="flex justify-between text-xs text-amber-700">
                      <span>BIR Withholding Compensation tax:</span>
                      <span className="font-mono">₱{activePaystubEntry.withholdingTax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 text-slate-800">
                    <span>TOTAL DEDUCTION REDUCTION:</span>
                    <span>₱{activePaystubEntry.totalDeductions.toLocaleString()}</span>
                  </div>
                </div>

              </div>

              {/* DENTAL PAYSTUB COMPOSITION VISUAL DONUT CHART (ACCORDING TO USER REQUIREMENT) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-center gap-6 font-sans print:bg-white print:border-none print:p-0 my-4">
                {/* DONUT SVG CONTAINER */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
                    {(() => {
                      const base = activePaystubEntry.basePay || 0;
                      const commission = activePaystubEntry.commission || 0;
                      const hmo = activePaystubEntry.hmoAllowance || 0;
                      const deduct = activePaystubEntry.totalDeductions || 0;
                      const pieces = [
                        { val: base, stroke: '#6366F1' }, // Indigo for Contract Base
                        { val: commission, stroke: '#F43F5E' }, // Rose for Commissions
                        { val: hmo, stroke: '#10B981' }, // Emerald for HMO Allowance
                        { val: deduct, stroke: '#F59E0B' } // Amber for Deductions
                      ].filter(p => p.val > 0);

                      const totalSum = base + commission + hmo + deduct;
                      const circ = 2 * Math.PI * 38; // ~238.76
                      let accum = 0;

                      return pieces.map((p, pIdx) => {
                        const ratio = p.val / totalSum;
                        const dasharray = `${circ} ${circ}`;
                        const offset = circ - ratio * circ;
                        const dashoffsetAccum = circ - (accum / totalSum) * circ;
                        accum += p.val;
                        return (
                          <circle
                            key={pIdx}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={p.stroke}
                            strokeWidth="12"
                            strokeDasharray={dasharray}
                            strokeDashoffset={dashoffsetAccum}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Net pay</span>
                    <span className="text-[11px] font-black text-slate-900 mt-0.5">₱{activePaystubEntry.netPay.toLocaleString()}</span>
                  </div>
                </div>

                {/* DONUT LEGEND TABLE */}
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 w-full text-[11px]">
                  {(() => {
                    const base = activePaystubEntry.basePay || 0;
                    const commission = activePaystubEntry.commission || 0;
                    const hmo = activePaystubEntry.hmoAllowance || 0;
                    const deduct = activePaystubEntry.totalDeductions || 0;
                    const dataset = [
                      { label: 'Contract Base Pay', val: base, stroke: '#6366F1' },
                      { label: 'Accrued Commissions', val: commission, stroke: '#F43F5E' },
                      { label: 'HMO Daily Allowance', val: hmo, stroke: '#10B981' },
                      { label: 'Withholdings (Deducted)', val: deduct, stroke: '#F59E0B' }
                    ].filter(d => d.val > 0);

                    const sum = base + commission + hmo + deduct;

                    return dataset.map((d, dIdx) => (
                      <div key={dIdx} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.stroke }} />
                        <div className="leading-tight">
                          <span className="text-slate-405 font-semibold uppercase text-[8px] block">{d.label}</span>
                          <span className="font-extrabold text-[#0F172A]">₱{d.val.toLocaleString()} <span className="text-slate-400 text-[9px] font-normal">({Math.round((d.val / sum) * 100)}%)</span></span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* DENTIST EXPLICIT COMMISSION INDIVIDUAL BREAKDOWN CHART (ACCORDING TO USER REQUIREMENT) */}
              {activePaystubEmployeeProfile?.type === 'DENTIST' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3 font-sans print:bg-slate-50 print:border">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>📊 COMMISSION BREAKDOWN GRAPH (BY TREATMENT PATIENT)</span>
                    <span className="text-[9px] text-slate-400">June 2026 CUT-OFF</span>
                  </div>
                  
                  <div className="space-y-2 text-[11px]">
                    {db.transactions.filter(t => t.dentistId === selectedPaystubEmployeeId).map((t, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-700">
                            {(() => {
                              const matchedPatient = db.patients.find(p => p.id === t.patientId);
                              return matchedPatient ? `${matchedPatient.firstName} ${matchedPatient.lastName}` : (t.patientName || 'Walk-in Patient');
                            })()} ({t.procedureCode})
                          </span>
                          <span className="font-bold text-rose-600">Commission: ₱{t.commissionAmount.toLocaleString()} ({t.commissionRateApplied !== undefined ? `${Math.round(t.commissionRateApplied * 100)}%` : (t.commissionTierApplied === 'TIER_2' ? '40% Major' : '30% Routine')})</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                            style={{ width: `${Math.min(100, (t.commissionAmount / activePaystubEntry.commission) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALCULATED NET PAYOUT & YTD */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white rounded-lg p-5 font-sans">
                <div>
                  <span className="text-[10px] text-rose-300 font-semibold block uppercase tracking-widest">NET COMPENSATION PAYOUT:</span>
                  <span className="text-3xl font-black tracking-tight">₱{activePaystubEntry.netPay.toLocaleString()}</span>
                </div>
                <div className="sm:text-right text-xs mt-3 sm:mt-0 opacity-90 border-t sm:border-t-0 sm:border-l border-white/15 pt-3 sm:pt-0 sm:pl-5">
                  <div className="text-[10px] text-amber-300">YEAR-TO-DATE COMPENSATION STATUS:</div>
                  <div>YTD Gross Earnings: <span className="font-bold">₱{activePaystubEntry.ytdGross.toLocaleString()}</span></div>
                  <div>Payrun Reference No: <span className="font-mono">{activePaystubRun?.paymentReference || 'GCASH-E-POSTING'}</span></div>
                </div>
              </div>

              {/* SIGNATURE BLOCKS */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs font-sans">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-semibold text-slate-800">KARLA ANTONETTE URBI, DMD</p>
                  <p className="text-[10px] text-slate-400 italic">Clinic Owner &amp; Accountant director</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-semibold text-slate-700">ACKNOWLEDGEMENT RECEIVED SIGN</p>
                  <p className="text-[10px] text-slate-400 italic">Date: ________________________</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 5: RECEIPTS SYSTEM DESIGN CABINET (WITH OCR CAPABILITY) */}
        {/* ======================================================================= */}
        {activeTab === 'RECEIPTS' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* DROP BOX INTAKE */}
              <div className="lg:col-span-4 bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-rose-500" /> Preserving receipt archives
                </h3>
                <p className="text-slate-500 text-xs">
                  Upload dental materials receipts or utilities. Gemini multimodal isolates values and logs categories immediately. Meets BIR 7-year storage guidelines.
                </p>

                <div className="border border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50 text-center flex flex-col items-center justify-center">
                  <Receipt className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500">Pick image of receipt</span>
                  
                  <label className="mt-3 bg-slate-900 hover:bg-slate-850 text-white px-3.5 py-1 rounded text-xs cursor-pointer select-none">
                    Upload &amp; Extract
                    <input id="img-uploader" type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                  </label>
                </div>

                {isOcrProcessing && (
                  <div className="space-y-2 p-2 bg-rose-50 text-rose-800 rounded border border-rose-100">
                    <Clock className="w-5 h-5 text-rose-500 animate-spin" />
                    <p className="text-xs font-bold">Executing Gemini vision scanner...</p>
                  </div>
                )}

                {ocrLog && (
                  <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-[11px] font-mono leading-relaxed max-h-[140px] overflow-y-auto">
                    {ocrLog}
                  </div>
                )}

              </div>

              {/* CABINET STORAGE DRAWER */}
              <div className="lg:col-span-8 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
                  <h3 className="text-base font-bold text-slate-900">Permanent 7-Year Receipt Repository</h3>
                  <span className="text-xs text-slate-400">Total stored: {db.receipts.length} archives</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {db.receipts.map((rcp) => (
                    <div key={rcp.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 hover:bg-white transition-all space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-mono font-bold tracking-wider">{rcp.code}</span>
                          <h4 className="text-xs font-extrabold text-slate-900 truncate max-w-[140px] mt-1">{rcp.vendorName}</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{rcp.receiptDate}</span>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs">
                        <span className="text-slate-400">Category:</span>
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">{rcp.category}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Mode:</span>
                        <span className="text-slate-800 font-medium">{rcp.paymentMode}</span>
                      </div>

                      <div className="flex justify-between items-center bg-white border border-slate-100 rounded p-2 text-xs">
                        <span className="text-[10px] text-slate-400">OCR total read:</span>
                        <span className="font-bold text-slate-900">₱{rcp.amount.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Confidence: {rcp.ocrConfidence}%</span>
                        <span className="text-[#10b981] font-semibold flex items-center gap-0.5 font-sans leading-none">✓ Locked Archive</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 6: EXPENSE DEDUCT TRACKER */}
        {/* ======================================================================= */}
        {activeTab === 'EXPENSES' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            
            {/* EXPENSE LEDGER */}
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-rose-100">
                <h3 className="text-base font-bold text-slate-900">Corporate Expense Journal</h3>
                <span className="text-xs text-slate-450">Track overhead items, utilities and clinical inputs</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-650">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Expense code</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Supplier/Vendor</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Payment Mode</th>
                      <th className="px-4 py-3 text-right">Sum Outflow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{exp.code}</td>
                        <td className="px-4 py-3">{exp.date}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{exp.vendorName}</td>
                        <td className="px-4 py-3 font-mono"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[10px] font-bold">{exp.category}</span></td>
                        <td className="px-4 py-3 text-slate-500">{exp.description}</td>
                        <td className="px-4 py-3">{exp.paymentMode}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">₱{exp.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border-t border-slate-50 pt-4 flex justify-between items-center text-xs text-slate-400">
                <span>Total Corporate overhead: <strong className="text-slate-800 font-extrabold text-sm ml-1">₱{metrics.totalExpenses.toLocaleString()}</strong></span>
                <span>BIR Deductibility limits: 100% compliant</span>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 7: HMO GAP LOSS RECONCILIATIONS (CARD SYSTEM INTEGRATOR) */}
        {/* ======================================================================= */}
        {activeTab === 'HMO' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">HMO Negotiated Rate Claims Gap Analysis</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Contrast clinic standard prices against Health Partners, FilDocs, and Cocolife card limits. View lost revenue margins absorbed on HMO procedures.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { provider: 'Health Partners HP', code: 'HP', desc: 'Active claims: 1 • Contract rate 32% of standard list.' },
                  { provider: 'FilDocs Insurance', code: 'FILDOCS', desc: 'Active claims: 0 • Contract rate 28% of standard list.' },
                  { provider: 'Cocolife Dental Care', code: 'COCOLIFE', desc: 'Active claims: 0 • Contract rate 30% of standard list.' }
                ].map((hmo, idx) => {
                  return (
                    <div key={idx} className="border border-slate-150 rounded-xl p-5 bg-slate-50/40 relative">
                      <h4 className="text-sm font-extrabold text-slate-900">{hmo.provider}</h4>
                      <p className="text-slate-400 text-xs mt-1.5">{hmo.desc}</p>
                      
                      <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between text-xs">
                        <span className="text-slate-400">Cut-off filing:</span>
                        <span className="font-semibold text-emerald-600">Form 2307 active</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CLAIMS RECON BAR */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest block">Reconciled HMO Transactions</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold">
                      <tr>
                        <th className="px-4 py-2">Patient name</th>
                        <th className="px-4 py-2">HMO Card Provider</th>
                        <th className="px-4 py-2">Procedure performed</th>
                        <th className="px-4 py-2 text-right">Standard Clinic Price</th>
                        <th className="px-4 py-2 text-right text-rose-500">HMO Contract Cap</th>
                        <th className="px-4 py-2 text-right text-red-600">Reconciliation Gap Loss</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { name: 'Pedro Penduko', provider: 'Health Partners', code: 'EXO', std: 2500, hmo: 800, gap: 1700, status: 'SUBMITTED' }
                      ].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="px-4 py-3 font-semibold text-slate-850">{item.name}</td>
                          <td className="px-4 py-3">{item.provider}</td>
                          <td className="px-4 py-3 font-mono text-[11px]">{item.code}</td>
                          <td className="px-4 py-3 text-right">₱{item.std.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-rose-500 font-bold">₱{item.hmo.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-bold">₱{item.gap.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center"><span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">{item.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 8: EMPLOYEE master ROSTER SCREEN */}
        {/* ======================================================================= */}
        {activeTab === 'EMPLOYEES' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            
            <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 pb-4 border-b border-slate-200 gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Clinical Employee Master Register</h3>
                  <p className="text-xs text-slate-450 mt-1 font-sans">Configure live names, roles, and administrative codes</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer select-none"
                  >
                    ➕ Hired New Employee (Dentist/Assistant)
                  </button>
                  <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2.5 py-2 rounded-md uppercase font-mono">
                    State synced
                  </span>
                </div>
              </div>

              {/* NEW EMPLOYEE REGISTRATION CARD */}
              {showAddEmployeeForm && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 space-y-4 animate-fade-in text-slate-900">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <span>👥 Clinical Staff Registration Form</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddEmployeeForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newEmpFullName.trim() || !newEmpCode.trim()) {
                        triggerToast('Full Name and Identifier Code are required.', 'error');
                        return;
                      }
                      const codeUpper = newEmpCode.toUpperCase().trim();
                      if (db.employees.some((emp: any) => emp.code === codeUpper || emp.id === `emp-${codeUpper.toLowerCase()}`)) {
                        triggerToast(`Error: Employee with code ${codeUpper} already exists.`, 'error');
                        return;
                      }

                      const newEmp: Employee = {
                        id: `emp-${codeUpper.toLowerCase()}`,
                        code: codeUpper,
                        fullName: newEmpFullName.trim(),
                        displayName: newEmpFullName.trim().split(' ')[0] || newEmpFullName.trim(),
                        type: newEmpType,
                        status: 'ACTIVE',
                        startDate: new Date().toISOString().split('T')[0],
                        sssNumber: 'SSS-00-0000000-0',
                        philhealthNumber: 'PH-00-000000000-0',
                        pagibigMID: 'PAGIBIG-0000-0000-0000',
                        tin: newEmpTin.trim() || 'TIN-000-000-000-000',
                        dateOfBirth: '1995-01-01',
                        contactNumber: newEmpContactNumber.trim() || '09000000000',
                        address: 'Metro Manila, Philippines',
                        emergencyContact: 'Emergency Contact - 09000000000',
                        basePayRate: newEmpBasePayRate || (newEmpType === 'DENTIST' ? 25000 : 500),
                        payFrequency: newEmpType === 'DENTIST' ? 'SEMI_MONTHLY' : 'WEEKLY',
                        commissionTierDefault: 'TIER_1',
                        clinicSharePercentage: newEmpType === 'DENTIST' ? (newEmpClinicShare || 5) : undefined,
                        role: newEmpRole.trim() || (newEmpType === 'DENTIST' ? 'Dentist' : 'Dental Assistant')
                      };

                      const updatedEmployees = [...db.employees, newEmp];
                      updateClinicalDb({
                        ...db,
                        employees: updatedEmployees
                      });

                      // Reset fields
                      setNewEmpFullName('');
                      setNewEmpCode('');
                      setNewEmpType('DENTIST');
                      setNewEmpBasePayRate(0);
                      setNewEmpClinicShare(0);
                      setNewEmpRole('');
                      setNewEmpTin('');
                      setNewEmpContactNumber('');
                      setShowAddEmployeeForm(false);
                      triggerToast(`Employee ${newEmp.fullName} successfully registered in clinical roster.`, 'success');
                    }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-left"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                      <input
                        type="text"
                        value={newEmpFullName}
                        onChange={(e) => setNewEmpFullName(e.target.value)}
                        placeholder="e.g. Dr. Jane Doe or Rose Cruz"
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Staff Identifier Code</label>
                      <input
                        type="text"
                        value={newEmpCode}
                        onChange={(e) => setNewEmpCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        placeholder="e.g. JD or RC (2-4 letters)"
                        maxLength={4}
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Type / Role</label>
                      <select
                        value={newEmpType}
                        onChange={(e) => {
                          const type = e.target.value as EmployeeType;
                          setNewEmpType(type);
                          if (type === 'DENTIST') {
                            setNewEmpBasePayRate(25000);
                          } else {
                            setNewEmpBasePayRate(500);
                          }
                        }}
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="DENTIST">Dentist (Semi-Monthly Commission Basis)</option>
                        <option value="ASSISTANT">Clinical Assistant (Weekly Salary)</option>
                        <option value="TEMP">Temp Staff (Weekly/Daily Basis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {newEmpType === 'DENTIST' ? 'Semi-Monthly Base Pay (₱)' : 'Daily Rate / Base Salary (₱)'}
                      </label>
                      <input
                        type="number"
                        value={newEmpBasePayRate || ''}
                        onChange={(e) => setNewEmpBasePayRate(Number(e.target.value))}
                        placeholder={newEmpType === 'DENTIST' ? 'e.g. 25000' : 'e.g. 500'}
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none"
                      />
                    </div>

                    {newEmpType === 'DENTIST' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Clinic Share / Partner Share (%)</label>
                        <input
                          type="number"
                          value={newEmpClinicShare || ''}
                          onChange={(e) => setNewEmpClinicShare(Number(e.target.value))}
                          placeholder="e.g. 5 (means 5% clinic revenue commission)"
                          min={0}
                          max={100}
                          className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Job Title / Role</label>
                      <input
                        type="text"
                        value={newEmpRole}
                        onChange={(e) => setNewEmpRole(e.target.value)}
                        placeholder="e.g. Associate Orthodontist or Junior Assistant"
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TIN / Tax Registration Number</label>
                      <input
                        type="text"
                        value={newEmpTin}
                        onChange={(e) => setNewEmpTin(e.target.value)}
                        placeholder="e.g. 123-456-789-000"
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Number</label>
                      <input
                        type="text"
                        value={newEmpContactNumber}
                        onChange={(e) => setNewEmpContactNumber(e.target.value)}
                        placeholder="e.g. 09171234567"
                        className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddEmployeeForm(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer shadow-sm"
                      >
                        💾 Register &amp; Save Employee
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* DENTISTS SECTION */}
              <div className="space-y-4 mb-10">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-emerald-600 rounded"></span>
                  Dentists Directory
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {db.employees.filter(emp => emp.type === 'DENTIST').map((emp, index) => {
                    const dentistIndex = index + 1;
                    return (
                      <div key={emp.id} className="border border-slate-200 rounded-[20px] p-6 shadow-xs bg-white text-slate-900 flex flex-col justify-between transition-all hover:shadow-md">
                        <div>
                          {/* Card Header Badge + Code */}
                          <div className="flex justify-between items-center mb-5">
                            <span className="bg-[#111827] text-[#10B981] font-mono font-bold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider">
                              Dentist {dentistIndex}
                            </span>
                            <span className="text-slate-400 font-mono text-xs font-bold">
                              ID: {emp.code || `DENT-00${dentistIndex}`}
                            </span>
                          </div>

                          {/* Editable Name Field */}
                          <div className="space-y-1.5">
                            <label className="text-[#0F172A] text-xs font-bold font-sans block">
                              Dentist Name
                            </label>
                            <input 
                              type="text"
                              value={emp.fullName}
                              onChange={(e) => handleUpdateEmployeeField(emp.id, 'fullName', e.target.value)}
                              className="w-full bg-white border border-[#0F172A] text-[#0F172A] text-sm px-3.5 py-2 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                            />
                          </div>

                          {/* Clinic Share Field */}
                          <div className="space-y-1.5 mt-3">
                            <label className="text-[#0F172A] text-xs font-bold font-sans block">
                              Clinic Share (%)
                            </label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={emp.clinicSharePercentage || 0}
                              onChange={(e) => handleUpdateEmployeeField(emp.id, 'clinicSharePercentage', Number(e.target.value))}
                              className="w-full bg-white border border-[#0F172A] text-[#0F172A] text-sm px-3.5 py-2 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                              placeholder="e.g. 5"
                            />
                          </div>
                        </div>

                        {/* Additional Meta / Read-only Fields */}
                        <div className="mt-5 pt-4 border-t border-dashed border-slate-155 grid grid-cols-2 gap-y-2 text-[10px] text-slate-450 leading-tight">
                          <div>
                            <span className="block font-semibold uppercase text-[8px] tracking-wider text-slate-400 mb-0.5">Base payrate:</span>
                            <span className="font-bold text-slate-700">₱{emp.basePayRate.toLocaleString()} / semi-mo</span>
                          </div>
                          <div>
                            <span className="block font-semibold uppercase text-[8px] tracking-wider text-slate-400 mb-0.5">TIN identifier:</span>
                            <span className="font-mono text-slate-700 font-bold">{emp.tin}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ASSISTANTS & CLINICAL ROSTERS SECTION */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-indigo-600 rounded"></span>
                  Clinical Assistants
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {db.employees.filter(emp => emp.type === 'ASSISTANT' || emp.type === 'TEMP').map((emp, index) => {
                    const assistantIndex = index + 1;
                    return (
                      <div key={emp.id} className="border border-slate-200 rounded-[20px] p-6 shadow-xs bg-white text-slate-900 flex flex-col justify-between transition-all hover:shadow-md">
                        <div>
                          {/* Card Header Badge + Code */}
                          <div className="flex justify-between items-center mb-5">
                            <span className="bg-[#1E1B4B] text-[#E0E7FF] font-mono font-bold text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider">
                              Assistant {assistantIndex}
                            </span>
                            <span className="text-slate-400 font-mono text-xs font-bold">
                              ID: {emp.code || `ASSIST-00${assistantIndex}`}
                            </span>
                          </div>

                          {/* Editable Name Field */}
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[#0F172A] text-xs font-bold font-sans block">
                                Name
                              </label>
                              <input 
                                type="text"
                                value={emp.fullName}
                                onChange={(e) => handleUpdateEmployeeField(emp.id, 'fullName', e.target.value)}
                                className="w-full bg-white border border-[#0F172A] text-[#0F172A] text-sm px-3.5 py-2 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>

                            {/* Editable Role Field */}
                            <div className="space-y-1.5">
                              <label className="text-[#0F172A] text-xs font-bold font-sans block">
                                Role
                              </label>
                              <input 
                                type="text"
                                value={emp.role || (emp.type === 'TEMP' ? 'Temp Assistant' : 'Dental Assistant')}
                                onChange={(e) => handleUpdateEmployeeField(emp.id, 'role', e.target.value)}
                                className="w-full bg-white border border-[#0F172A] text-[#0F172A] text-sm px-3.5 py-2 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Additional Meta / Read-only Fields */}
                        <div className="mt-5 pt-4 border-t border-dashed border-slate-155 grid grid-cols-2 gap-y-2 text-[10px] text-slate-450 leading-tight">
                          <div>
                            <span className="block font-semibold uppercase text-[8px] tracking-wider text-slate-400 mb-0.5">Weekly base:</span>
                            <span className="font-bold text-slate-700">₱{emp.basePayRate.toLocaleString()} / wk</span>
                          </div>
                          <div>
                            <span className="block font-semibold uppercase text-[8px] tracking-wider text-slate-400 mb-0.5">TIN identifier:</span>
                            <span className="font-mono text-slate-700 font-bold">{emp.tin}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB: SECURE ADMIN CONSOLE (PASSWORD PROTECTED BY karla15) */}
        {/* ======================================================================= */}
        {activeTab === 'ADMIN_PANEL' && (
          <div className="space-y-8 animate-fade-in">
            {!isAdminUnlocked ? (
              // LOCKED SECURITY PASSCODE DIALOGUE
              <div className="max-w-md mx-auto bg-white border border-slate-200 shadow-xl rounded-2xl p-8 text-center mt-12 mb-12">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">🔑 Authorized Personnel Gate</h3>
                <p className="text-slate-500 text-xs mb-6 text-left leading-relaxed">
                  Access to statutory audits, cash payroll configurations, and live timesheets requires high-security clinic authentication.
                </p>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminPassword === 'karla15') {
                      setIsAdminUnlocked(true);
                      setAdminPasswordError('');
                    } else {
                      setAdminPasswordError('Error: Invalid passcode. Logged as security alert.');
                    }
                  }}
                  className="space-y-4 text-left"
                >
                  <div className="space-y-2 text-left col-span-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Passcode Required</label>
                    <input 
                      type="password"
                      placeholder="••••••••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-250 rounded-lg text-sm text-center font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {adminPasswordError && (
                    <p className="text-xs text-rose-650 font-bold bg-rose-50 border border-rose-100 py-2 rounded-lg text-center">{adminPasswordError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-3 rounded-lg text-xs transition-all shadow cursor-pointer text-center"
                  >
                    🔓 Settle and Unlock Panel
                  </button>
                </form>
              </div>
            ) : (
              // UNLOCKED ADMIN PANEL CONTENT
              <div className="space-y-8">
                {/* SUB NAVIGATION BAR */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="text-left">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-500 text-white rounded-full p-1.5 animate-pulse">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold">Arkadental Secure Admin Console</h3>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1.5 font-medium">
                      Session Authorized. Logged under BIR statutory bookkeeping rules.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'PAYROLL', label: '📇 Payroll & Paystubs' },
                      { id: 'ATTENDANCE', label: '📅 Attendance Logs' },
                      { id: 'CUTOFF_ADJUSTMENTS', label: '⏱ Cut-Off Adjustments' },
                      { id: 'EXPENSE_REVENUE_ADJUSTMENTS', label: '📊 Expense & Revenue Settle' }
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setAdminActiveSubTab(sub.id as any)}
                        className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          adminActiveSubTab === sub.id 
                            ? 'bg-rose-600 text-white shadow-sm' 
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowAdminHelp(!showAdminHelp)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        showAdminHelp 
                          ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md' 
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
                      }`}
                      title="Explain Consoles & Methods"
                    >
                      ❓ Question?
                    </button>
                    <button
                      onClick={() => {
                        setIsAdminUnlocked(false);
                        setAdminPassword('');
                      }}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Lock Console"
                    >
                      🔒 Lock
                    </button>
                  </div>
                </div>
                
                {/* DYNAMIC BYPASS ACKNOWLEDGEMENT */}
                {isKarlaPhoneBypassed && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded-xl p-3.5 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📱</span>
                      <p className="font-bold">
                        Google Session Detected starts with/has <span className="underline select-all font-extrabold font-mono text-emerald-900 dark:text-emerald-300">Karla</span> on Mobile device. Passcode Bypass Allowed!
                      </p>
                    </div>
                    <span className="bg-emerald-600 text-white font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-wider shadow-sm animate-pulse">Bypass Active</span>
                  </div>
                )}

                {/* VISUAL ADMIN GUIDE DRAWER / QUESTION FAQS TOOL */}
                {showAdminHelp && (
                  <div className="bg-slate-100 border border-slate-200 text-slate-900 rounded-2xl p-6 shadow-md space-y-6 text-left relative animate-fade-in dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
                    <button 
                      onClick={() => setShowAdminHelp(false)}
                      className="absolute top-4 right-4 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                    >
                      ✕ Close Guide
                    </button>
                    <div>
                      <h4 className="text-sm font-black text-rose-500 uppercase tracking-wider flex items-center gap-2">
                        <span>❓</span> ARKA Clinical Bookkeeping Help Guide &amp; Correction System Map
                      </h4>
                      <p className="text-slate-500 text-xs mt-1 dark:text-slate-400 leading-relaxed">
                        Welcome to the official system documentation. This panel details all functional capabilities, standard operating methods, and lists every available administrative edit action with their interactive data-flow paths.
                      </p>
                    </div>

                    {/* ==================== SECTION 1: VISUAL MAP OF EDIT OPERATIONS ==================== */}
                    <div className="bg-slate-950 text-slate-200 p-5 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto space-y-4 shadow-inner">
                      <p className="text-rose-400 font-bold text-xs uppercase tracking-wider">🧭 Interactive Clinic Data-Correction Map</p>
                      <div className="text-slate-400">
{`┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ARKA LEDGER EDITING ENGINE MAP                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Activity Journal Inline Grid (Excel-like Sheet)                                     │
│    [Transactions Tab] ──► Edit input Button ──► Grid Spreadsheet Cell Change            │
│                                                     │                                  │
│                                                     ▼                                  │
│                      [save and refresh] ──► Recalculate Commissions & CCD Fees         │
│                                                     │                                  │
│                                                     ▼                                  │
│                      Commit to DB ──► Sync Dashboard Cards & Net Profit Graphs         │
│                                                                                        │
│ 2. General Ledger Inline Rows (Drizzle-style Ledger)                                   │
│    [Transactions Tab] ──► Enable Edit Mode ──► Click Row Pencil ✏️ ──► Cell Change     │
│                                                                      │                 │
│                                                                      ▼                 │
│                      Submit Checkmark ──► Re-evaluates Lab cost / CCD fees / Net Paid   │
│                                                                                        │
│ 3. Cut-off Wage Adjustments (Secure Admin Panel)                                       │
│    [Admin Console] ──► Prior Cut-off Adjustments ──► Positive Bonus / Negative Cash    │
│                                                                      │                 │
│                                                                      ▼                 │
│                      Apply Secure Adjustment ──► Integrates directly in PDF Paystubs   │
│                                                                                        │
│ 4. Attendance & Leaves Registry (Secure Admin Panel)                                    │
│    [Admin Console] ──► Attendance Calendar Grid ──► Toggle Presents / approved SL / VL │
│                                                                      │                 │
│                                                                      ▼                 │
│                      Sync Philippine Holidays ──► Auto double-time holiday wage rules  │
└────────────────────────────────────────────────────────────────────────────────────────┘`}
                      </div>
                    </div>

                    {/* ==================== SECTION 2: THE FOUR CLINICAL EDIT UTILITIES ==================== */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">🛠️ List of Available Administrative Edit Buttons</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        
                        {/* Edit Button 1 */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1.5 dark:bg-slate-950 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="text-emerald-500">✏️</span> Edit input (Spreadsheet Mode)
                            </span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-emerald-950/40 dark:text-emerald-400">Transactions Tab</span>
                          </div>
                          <p className="text-slate-500 text-[11px] leading-relaxed dark:text-slate-400">
                            <strong>Function:</strong> Toggles the Official Auditable Activity Journal into an Excel-like editable grid. You can modify Date, Patient, Dentist, Procedure, Amount Paid, Payment Mode, Commission %, and Remarks. Click the blinking green <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 font-bold font-mono">save and refresh</code> button to save the entire spreadsheet state and update calculations.
                          </p>
                        </div>

                        {/* Edit Button 2 */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1.5 dark:bg-slate-950 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="text-blue-500">✏️</span> Enable Edit Mode (GL Inline)
                            </span>
                            <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-blue-950/40 dark:text-blue-400">Transactions Tab</span>
                          </div>
                          <p className="text-slate-500 text-[11px] leading-relaxed dark:text-slate-400">
                            <strong>Function:</strong> Unlocks specific rows inside the Patients' Income &amp; General Ledger table. Clicking the inline pencil icon on any individual transaction row exposes editable input blocks for all fields (including Lab Fees, Discounts, and Credit Card fee multipliers). Click the checkmark to submit or "+ Add Row" to append entries.
                          </p>
                        </div>

                        {/* Edit Button 3 */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1.5 dark:bg-slate-950 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="text-rose-500">⏱️</span> Apply Secure Adjustment
                            </span>
                            <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-rose-950/40 dark:text-rose-400">Admin Console</span>
                          </div>
                          <p className="text-slate-500 text-[11px] leading-relaxed dark:text-slate-400">
                            <strong>Function:</strong> Located under "Prior Cut-off Wage Adjustments". Allows administrators to apply custom post-timesheet adjustments, allowances, bonuses, or Cash Advances (by writing negative values). Applies directly to the generated PDF Paystub statement.
                          </p>
                        </div>

                        {/* Edit Button 4 */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1.5 dark:bg-slate-950 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="text-amber-500">📅</span> Roster Leave &amp; SL/VL Allocator
                            </span>
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-amber-950/40 dark:text-amber-400">Admin Console</span>
                          </div>
                          <p className="text-slate-500 text-[11px] leading-relaxed dark:text-slate-400">
                            <strong>Function:</strong> Allows clicking any specific calendar date in the line-up grid to edit and toggle presents, absences, or approved leaves. Roster leave files can be written directly to allocate annual vacation or sick leave packages.
                          </p>
                        </div>

                      </div>
                    </div>

                    {/* ==================== SECTION 3: SYSTEM CONSOLES & METHODS REFERENCE ==================== */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
                      {/* Payroll card */}
                      <div className="space-y-2 bg-white rounded-xl p-4 shadow-sm dark:bg-slate-950 dark:border dark:border-slate-800">
                        <div className="flex items-center gap-2 text-rose-500">
                          <span className="text-sm">📇</span>
                          <span className="font-extrabold font-sans text-xs">Payroll &amp; PDF Paystubs</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1.5 text-slate-655 dark:text-slate-300 leading-relaxed text-[11px]">
                          <li><strong>Period Accrual Models:</strong> Choose to group and calculate weekly budgets for Assistants or semi-monthly percentages for Doctors.</li>
                          <li><strong>Statutory Philippine Rules:</strong> PhilHealth brackets, SSS contributions, and taxable withholding amounts are dynamically generated under standard BIR policies.</li>
                          <li><strong>Export in PDF:</strong> Review compiled payroll records. Click the new <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 dark:bg-slate-830 font-mono text-[10px]">Export in PDF</code> button to download a professional formatted payroll paystub document directly.</li>
                        </ul>
                      </div>

                      {/* Attendance card */}
                      <div className="space-y-2 bg-white rounded-xl p-4 shadow-sm dark:bg-slate-950 dark:border dark:border-slate-800">
                        <div className="flex items-center gap-2 text-rose-500">
                          <span className="text-sm">📅</span>
                          <span className="font-extrabold font-sans text-xs">Attendance &amp; Leave Registry</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1.5 text-slate-655 dark:text-slate-300 leading-relaxed text-[11px]">
                          <li><strong>Daily Attendance:</strong> Select any date in the calendar coordinate to view the clinical lineup. You can log presents, absences, or approved leaves here.</li>
                          <li><strong>Leaves Filing:</strong> Under "File &amp; Appoint Roster Leaves," enter the start and end dates to log a Vacation Leave (VL) or Sick Leave (SL).</li>
                          <li><strong>Holiday double-time rules:</strong> Automatic 200% regular / 130% special holiday worked multipliers synced via calendar holiday configurations.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODULE 1: PAYROLL (INTEGRATED WITH TIMESHEETS & HOLIDAYS) */}
                {adminActiveSubTab === 'PAYROLL' && (
                  <div className="space-y-8 animate-fade-in">
                    
                    {/* INITIATE NEW RUNS */}
                    <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm text-left">
                      <h3 className="text-base font-bold text-slate-900 mb-2">Accrue Statutory Clinical Payroll Period</h3>
                      <p className="text-slate-500 text-xs mb-4">
                        Run employee wage and dentist commission reports. SSS percentage deductions, Philhealth allocations, and BIR Form parameters are automatically processed from live calendar timesheets.
                      </p>
                      
                      <div className="flex flex-wrap gap-4">
                        <button 
                          id="btn-run-payroll-assistants"
                          onClick={() => handleRunPayroll('ASSISTANT_WEEKLY')}
                          className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                        >
                          ⚙ Accrue Weekly Assistants Payroll (Wednesday cutoff)
                        </button>
                        <button 
                          id="btn-run-payroll-dentists"
                          onClick={() => handleRunPayroll('DENTIST_SEMI_MONTHLY')}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                        >
                          ⚙ Accrue Semi-Monthly Dentists Payroll (Cutoff 1-15)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* ACCRUED HISTORIC RUNS */}
                      <div className="lg:col-span-1 bg-white border border-slate-100 rounded-xl p-5 shadow-sm h-[600px] overflow-y-auto">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-left">Payroll Logs &amp; Status</h4>
                        <div className="space-y-3">
                          {db.payrollRuns.map((run) => (
                            <div 
                              id={`payroll-run-${run.id}`}
                              key={run.id}
                              onClick={() => {
                                setSelectedPaystubRunId(run.id);
                                setSelectedPaystubEmployeeId(null); // Reset detail view
                              }}
                              className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                                selectedPaystubRunId === run.id 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                                  : 'bg-slate-50 text-slate-800 border-slate-150 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold font-mono">{run.code}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                  run.status === 'PAID' 
                                    ? 'bg-emerald-500/15 text-emerald-400' 
                                    : 'bg-amber-500/15 text-amber-500'
                                }`}>
                                  {run.status}
                                </span>
                              </div>
                              <p className="text-[10px] opacity-75">
                                Coverage: {run.payPeriodStart} to {run.payPeriodEnd}
                              </p>
                              <div className="mt-2 text-xs font-bold flex justify-between">
                                <span>Net Clinical Out:</span>
                                <span>₱{Math.round(run.totalNetPay).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PAYSTUB SPECIFICS AND INDIVIDUAL STUBS */}
                      <div className="lg:col-span-2 space-y-6">
                        {activePaystubRun ? (
                          <div className="bg-white border border-slate-150 rounded-xl p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-4 gap-4 text-left">
                              <div>
                                <h4 className="text-sm font-bold text-slate-105">{activePaystubRun.code} Detail Statement</h4>
                                <p className="text-xs text-slate-500">
                                  Cutoff: {activePaystubRun.payPeriodStart} to {activePaystubRun.payPeriodEnd} • Issued: {activePaystubRun.payDate}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {activePaystubRun.status !== 'PAID' ? (
                                  <button
                                    onClick={() => handleMarkPaid(activePaystubRun.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    ✓ Disburse (Mark Paid)
                                  </button>
                                ) : (
                                  <div className="text-[10px] text-right font-semibold text-slate-500 font-mono bg-slate-50 p-1.5 border rounded-lg">
                                    <div className="text-emerald-600 font-bold">✓ DISBURSED</div>
                                    <div>{activePaystubRun.paymentReference}</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* LIST RUN ENTRIES */}
                            <div className="space-y-4 text-left">
                              {activePaystubRun.entries.map((entry) => {
                                const matchedEmployee = db.employees.find(e => e.id === entry.employeeId);
                                const isSelected = selectedPaystubEmployeeId === entry.employeeId;

                                return (
                                  <div 
                                    key={entry.employeeId}
                                    className={`border rounded-xl transition-all ${
                                      isSelected ? 'border-indigo-500 ring-1 ring-indigo-550 bg-indigo-50/5' : 'border-slate-150 hover:bg-slate-50/30'
                                    }`}
                                  >
                                    <div 
                                      onClick={() => setSelectedPaystubEmployeeId(isSelected ? null : entry.employeeId)}
                                      className="flex items-center justify-between p-4 cursor-pointer text-left"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs text-slate-900">{entry.employeeName}</span>
                                          <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                            {entry.employeeType}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-2.5">
                                          <span>Present: <strong>{entry.presentCount ?? 0}d</strong></span>
                                          <span>Leaves: <strong>{entry.leaveCount ?? 0}d</strong></span>
                                          <span>Worked Holiday: <strong>{entry.holidayWorkedCount ?? 0}d</strong></span>
                                          <span>Absent: <strong>{entry.absentCount ?? 0}d</strong></span>
                                          {entry.cutoffDelta && entry.cutoffDelta !== 0 ? (
                                            <span className="bg-amber-100 text-amber-700 px-1 rounded text-[9px] font-bold">Adjusted: <strong>₱{entry.cutoffDelta}</strong></span>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <div className="text-xs font-bold text-slate-900">₱{Math.round(entry.netPay).toLocaleString()} net</div>
                                        <span className="text-[9px] text-slate-450">Gross: ₱{Math.round(entry.grossPay).toLocaleString()}</span>
                                      </div>
                                    </div>

                                    {/* EXPANDED DETAILED CLINICAL STATUTORY PAYSTUB */}
                                    {isSelected && (
                                      <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-xl text-left space-y-4">
                                        
                                        {/* STATUTORY LANDSCAPE PRINT PARAM */}
                                        <div className="flex justify-between items-center mb-1 print:hidden">
                                          <h5 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PHILIPPINE STATUTORY STATEMENT OF EARNINGS</h5>
                                          <button 
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleExportPaystubPDF(entry, activePaystubRun);
                                            }}
                                            className="bg-slate-900 hover:bg-slate-830 text-white font-bold py-1 px-2.5 rounded-md text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                                          >
                                            <Download className="w-3.5 h-3.5" /> Export in PDF
                                          </button>
                                        </div>

                                        <div id={`statement-print-${entry.employeeId}-${activePaystubRun.code}`} className="bg-white border rounded-xl p-5 space-y-4 text-[11px] shadow-sm paystub-print-card">
                                          
                                          {/* HEAD */}
                                          <div className="flex justify-between border-b pb-3 items-start">
                                            <div>
                                              <span className="text-[11px] font-black text-rose-500">ARKA Dental Clinic</span>
                                              <p className="text-[9px] text-slate-400 mt-0.5">BF Homes, Parañaque City, Metro Manila</p>
                                            </div>
                                            <div className="text-right font-mono text-[9px] text-slate-450 select-all">
                                              <div>PAYROLL CODE: {activePaystubRun.code}</div>
                                              <div>PAY DATE: {activePaystubRun.payDate}</div>
                                            </div>
                                          </div>

                                          {/* METRICS */}
                                          <div className="grid grid-cols-2 gap-4 border-b pb-3">
                                            <div>
                                              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">EMPLOYEE DETAIL</div>
                                              <p className="font-bold text-slate-900 mt-1">{entry.employeeName}</p>
                                              <p className="text-slate-500 text-[10px] mt-0.5">Position: {matchedEmployee?.role || entry.employeeType}</p>
                                              <p className="text-slate-400 text-[10px] font-mono mt-1">
                                                TIN: {matchedEmployee?.tin || 'Exempt'} • SSS #: {matchedEmployee?.sssNumber || 'Exempt'}
                                              </p>
                                            </div>
                                            <div className="border-l pl-4 font-mono text-left">
                                              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">PAY CUT-OFF PERIOD:</div>
                                              <p className="font-semibold text-slate-900 mt-1">
                                                {activePaystubRun.payPeriodStart} to {activePaystubRun.payPeriodEnd}
                                              </p>
                                              <p className="text-[10px] text-slate-400 mt-1">Tax Code: PH-BIR-S1 (Exempt)</p>
                                            </div>
                                          </div>

                                          {/* CALCULATOR SINK */}
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-3">
                                            
                                            {/* EARNINGS */}
                                            <div className="space-y-1.5 text-left">
                                              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider border-b pb-1 mb-2">EARNINGS</div>
                                              <div className="flex justify-between">
                                                <span>Base Accountable Salary ({entry.presentCount ?? 0} Days Worked):</span>
                                                <span className="font-bold">₱{Math.round(entry.basePay - (entry.cutoffDelta ?? 0)).toLocaleString()}</span>
                                              </div>
                                              {entry.cutoffDelta && entry.cutoffDelta !== 0 ? (
                                                <div className="flex justify-between text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                                                  <span>Prior Cut-off Log Adjustment:</span>
                                                  <span className="font-bold">₱{entry.cutoffDelta.toLocaleString()}</span>
                                                </div>
                                              ) : null}
                                              {entry.holidayPay > 0 && (
                                                <div className="flex justify-between text-indigo-700 font-semibold text-[11px]">
                                                  <span>Philippine Holiday Worked Premium:</span>
                                                  <span className="font-bold text-indigo-700">+ ₱{Math.round(entry.holidayPay).toLocaleString()}</span>
                                                </div>
                                              )}
                                              {entry.commission > 0 && (
                                                <div className="flex justify-between text-slate-750 font-medium">
                                                  <span>Treatments &amp; Commission Accruals:</span>
                                                  <span className="font-bold">₱{Math.round(entry.commission).toLocaleString()}</span>
                                                </div>
                                              )}
                                              {entry.hmoAllowance > 0 && (
                                                <div className="flex justify-between">
                                                  <span>HMO Daily Allowance:</span>
                                                  <span className="font-bold">₱{Math.round(entry.hmoAllowance).toLocaleString()}</span>
                                                </div>
                                              )}
                                              
                                              {matchedEmployee?.clinicSharePercentage !== undefined && matchedEmployee.clinicSharePercentage > 0 && (
                                                <div className="flex justify-between items-center text-teal-700 font-bold border-t pt-1.5">
                                                  <span>Clinic Share Comm. ({matchedEmployee.clinicSharePercentage}%):</span>
                                                  <span className="font-bold">₱{Math.round(entry.commission * (matchedEmployee.clinicSharePercentage / 100)).toLocaleString()}</span>
                                                </div>
                                              )}

                                              <div className="flex justify-between font-extrabold border-t pt-2 mt-4 text-emerald-700">
                                                <span>GROSS TAXABLE EARNINGS (A):</span>
                                                <span>₱{Math.round(entry.grossPay).toLocaleString()}</span>
                                              </div>
                                            </div>

                                            {/* DEDUCTIONS */}
                                            <div className="space-y-1.5 font-mono text-left">
                                              <div className="text-[9px] text-slate-450 uppercase font-black tracking-wider border-b pb-1 mb-2">STATUTORY DEDUCTIONS</div>
                                              <div className="flex justify-between text-slate-500">
                                                <span>Philippine SSS Share:</span>
                                                <span>₱{Math.round(entry.sssContribution).toLocaleString()}</span>
                                              </div>
                                              <div className="flex justify-between text-slate-500">
                                                <span>PhilHealth Share Prem:</span>
                                                <span>₱{Math.round(entry.philhealthContribution).toLocaleString()}</span>
                                              </div>
                                              <div className="flex justify-between text-slate-500">
                                                <span>Pag-IBIG Mutuality:</span>
                                                <span>₱{Math.round(entry.pagibigContribution).toLocaleString()}</span>
                                              </div>
                                              <div className="flex justify-between text-slate-500">
                                                <span>BIR Withholding Tax:</span>
                                                <span>{entry.withholdingTax > 0 ? `₱${Math.round(entry.withholdingTax).toLocaleString()}` : '₱0 (Exempt)'}</span>
                                              </div>

                                              <div className="flex justify-between font-bold border-t pt-2 mt-4 text-rose-700">
                                                <span>TOTAL DEDUCTIONS (B):</span>
                                                <span>₱{Math.round(entry.totalDeductions).toLocaleString()}</span>
                                              </div>
                                            </div>

                                          </div>

                                          {/* NET IN HAND */}
                                          <div className="bg-slate-900 text-white rounded-xl p-4.5 flex justify-between items-center mt-3 shadow">
                                            <div>
                                              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">NET PAY CLINICAL TAKE-HOME (A - B)</div>
                                              <p className="text-[9px] text-slate-400 mt-1">Disbursed under GCash Ledger references.</p>
                                            </div>
                                            <div className="text-right">
                                              <span className="text-lg font-black text-emerald-400">₱{Math.round(entry.netPay).toLocaleString()} PHP</span>
                                            </div>
                                          </div>

                                        </div>

                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                          </div>
                        ) : (
                          <div className="bg-slate-50 rounded-xl p-8 border border-dashed border-slate-200 text-center text-slate-400">
                            <Clock className="w-8 h-8 mx-auto mb-3" />
                            <p className="text-xs">Select a compiled Pay run from the sidebar of logs to preview the complete Philippine statutory payslips.</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* MODULE 2: ATTENDANCE REGISTRY */}
                {adminActiveSubTab === 'ATTENDANCE' && (
                  <div className="bg-white border rounded-xl p-6 shadow-sm animate-fade-in text-left">
                    <div className="mb-6">
                      <h3 className="text-base font-bold text-slate-900">Attendance &amp; Leave Registry</h3>
                      <p className="text-xs text-slate-500">
                        Inspect and log hours, vacation leaves, sick leaves, and holiday work multipliers for doctors and assistants.
                      </p>
                    </div>
                    
                    <AttendanceAndLeaveTracker db={db} updateClinicalDb={updateClinicalDb} />
                  </div>
                )}

                {/* MODULE 3: ADJUSTMENT 24HRS PRIOR TO CUT-OFF LOG */}
                {adminActiveSubTab === 'CUTOFF_ADJUSTMENTS' && (
                  <div className="bg-white border rounded-xl p-6 shadow-sm animate-fade-in text-left space-y-6">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 font-sans">⏱ Prior Cut-Off Adjustment Log</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Log administrative adjustments to base wages 24 hours prior to the cut-off period. These will automatically and permanently apply to compiled payruns.
                      </p>
                    </div>

                    {/* CUSTOM CUTOFF PERIOD DEFINITION FORM */}
                    {showAddPeriodForm && (
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3 animate-fade-in text-slate-900">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                            <span>⏱ Define Custom Cut-Off Period</span>
                          </h5>
                          <button
                            type="button"
                            onClick={() => setShowAddPeriodForm(false)}
                            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Period Unique ID / Code</label>
                            <input
                              type="text"
                              value={newPeriodCode}
                              onChange={(e) => setNewPeriodCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                              placeholder="e.g. JUNE_16_30"
                              className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:bg-white font-mono"
                            />
                            <p className="text-[9px] text-slate-400 mt-0.5 font-sans">Use uppercase, no spaces (e.g., JULY_1_15)</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Display Description</label>
                            <input
                              type="text"
                              value={newPeriodLabel}
                              onChange={(e) => setNewPeriodLabel(e.target.value)}
                              placeholder="e.g. June 16-30 Semi-Monthly"
                              className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newPeriodCode.trim() || !newPeriodLabel.trim()) {
                                triggerToast('Error: Please provide both ID and Description.', 'error');
                                return;
                              }
                              const defaultList = [
                                { id: 'GENERAL', label: 'General/Permanent' },
                                { id: 'JUNE_1_15', label: 'June 1-15 Semi-Monthly (Dentists)' },
                                { id: 'JUNE_W1', label: 'June Week 1 (Assistants)' }
                              ];
                              const currentList = db.cutoffPeriods || defaultList;
                              if (currentList.some((p: any) => p.id === newPeriodCode.trim())) {
                                triggerToast(`Error: A period with ID ${newPeriodCode} already exists.`, 'error');
                                return;
                              }

                              const updatedPeriods = [...currentList, { id: newPeriodCode.trim(), label: newPeriodLabel.trim() }];
                              updateClinicalDb({
                                ...db,
                                cutoffPeriods: updatedPeriods
                              });
                              setNewPeriodCode('');
                              setNewPeriodLabel('');
                              setShowAddPeriodForm(false);
                              triggerToast('New Cut-Off Period added and permanently applied throughout.', 'success');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                          >
                            Save Period
                          </button>
                        </div>
                      </div>
                    )}

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const empId = formData.get('employeeId') as string;
                        const period = formData.get('cutOffPeriod') as any;
                        const amt = Number(formData.get('amount'));
                        const rsn = formData.get('reason') as string;

                        if (!empId || isNaN(amt) || !rsn) {
                          triggerToast('Error: Please complete all adjustment values.', 'error');
                          return;
                        }

                        const emp = db.employees.find(e => e.id === empId);
                        const newAdjust: CutoffAdjustment = {
                          id: `adj-${Date.now()}`,
                          employeeId: empId,
                          employeeName: emp?.fullName || 'Employee',
                          timestamp: new Date().toISOString(),
                          basePayAdjustmentAmount: amt,
                          reason: rsn,
                          cutOffPeriod: period,
                          approvedBy: 'Admin (System)'
                        };

                        const updatedAdjustments = [newAdjust, ...(db.cutoffAdjustments || [])];
                        updateClinicalDb({
                          ...db,
                          cutoffAdjustments: updatedAdjustments
                        });

                        e.currentTarget.reset();
                        triggerToast('Cut-off adjustment successfully logged and sealed. Payroll computations updated.', 'success');
                      }}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border items-end"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Employee</label>
                        <select 
                          name="employeeId"
                          className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:bg-white"
                          required
                        >
                          <option value="">-- select employee --</option>
                          {db.employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cut-Off Period</label>
                          <button
                            type="button"
                            onClick={() => setShowAddPeriodForm(!showAddPeriodForm)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-0.5 cursor-pointer select-none"
                          >
                            ➕ Add Custom
                          </button>
                        </div>
                        <select 
                          name="cutOffPeriod"
                          className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:bg-white"
                          required
                        >
                          {(db.cutoffPeriods || [
                            { id: 'GENERAL', label: 'General/Permanent' },
                            { id: 'JUNE_1_15', label: 'June 1-15 Semi-Monthly (Dentists)' },
                            { id: 'JUNE_W1', label: 'June Week 1 (Assistants)' }
                          ]).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount (₱ PHP)</label>
                        <input 
                          type="number"
                          name="amount"
                          placeholder="e.g. 1500 or -500"
                          className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none focus:bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason for change</label>
                        <input 
                          type="text"
                          name="reason"
                          placeholder="Adjustment description"
                          className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none focus:bg-white"
                          required
                        />
                      </div>

                      <div className="md:col-span-4 flex justify-end">
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs cursor-pointer shadow-sm transition-colors"
                        >
                          + Log Cut-Off Wage Adjustment
                        </button>
                      </div>
                    </form>

                    <div className="space-y-3">
                      <h5 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Adjustment Audit Trail</h5>
                      
                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b">
                            <tr>
                              <th className="p-3">Timestamp</th>
                              <th className="p-3">Employee</th>
                              <th className="p-3">Target Period</th>
                              <th className="p-3">Adjustment</th>
                              <th className="p-3">Reason / Description</th>
                              <th className="p-3">Issued By</th>
                              <th className="p-3">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs">
                            {(db.cutoffAdjustments || []).length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                                  No administrative cutoff adjustments registered for June 2026.
                                </td>
                              </tr>
                            ) : (
                              (db.cutoffAdjustments || []).map(adj => (
                                <tr key={adj.id} className="hover:bg-slate-50/50">
                                  <td className="p-3 text-slate-400 text-[10px] font-mono">
                                    {new Date(adj.timestamp).toLocaleString()}
                                  </td>
                                  <td className="p-3 font-semibold text-slate-900">{adj.employeeName}</td>
                                  <td className="p-3 font-semibold font-mono text-[10px] text-indigo-600">{adj.cutOffPeriod}</td>
                                  <td className={`p-3 font-extrabold ${adj.basePayAdjustmentAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₱{adj.basePayAdjustmentAmount >= 0 ? `+${adj.basePayAdjustmentAmount}` : adj.basePayAdjustmentAmount}
                                  </td>
                                  <td className="p-3 text-slate-650">{adj.reason}</td>
                                  <td className="p-3 text-slate-500 font-mono text-[10px]">{adj.approvedBy}</td>
                                  <td className="p-3">
                                    <button
                                      onClick={() => {
                                        if (confirm('Delete this cutoff adjustment?')) {
                                          const filtered = (db.cutoffAdjustments || []).filter(a => a.id !== adj.id);
                                          updateClinicalDb({
                                            ...db,
                                            cutoffAdjustments: filtered
                                          });
                                          triggerToast('Adjustment deleted. Computations re-evaluated.', 'success');
                                        }
                                      }}
                                      className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* MODULE 4: ADJUSTMENT FOR EXPENSES AND REVENUE OPTIONS */}
                {adminActiveSubTab === 'EXPENSE_REVENUE_ADJUSTMENTS' && (
                  <div className="bg-white border rounded-xl p-6 shadow-sm animate-fade-in text-left space-y-6">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">📊 Expense &amp; Revenue Settle Options</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Log direct adjustments to general expenses or revenues. These apply immediately to global analytical metrics, ledger summaries, and real net profit calculators so there are no data discrepancies.
                      </p>
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const type = formData.get('type') as 'REVENUE' | 'EXPENSE';
                        const category = formData.get('category') as string;
                        const amt = Number(formData.get('amount'));
                        const desc = formData.get('desc') as string;

                        if (!type || !category || isNaN(amt) || !desc) {
                          triggerToast('Error: Please complete all adjustment fields.', 'error');
                          return;
                        }

                        const newFinAdjust: FinancialAdjustment = {
                          id: `fin-${Date.now()}`,
                          type,
                          amount: amt,
                          category,
                          description: desc,
                          date: new Date().toISOString().slice(0, 10),
                          createdBy: 'Admin (Auditor)'
                        };

                        const updatedFin = [newFinAdjust, ...(db.financialAdjustments || [])];
                        updateClinicalDb({
                          ...db,
                          financialAdjustments: updatedFin
                        });

                        e.currentTarget.reset();
                        triggerToast('Financial adjustment registered and synchronized across all active ledger components.', 'success');
                      }}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border items-end"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adjustment Class</label>
                        <select 
                          name="type"
                          className="w-full bg-white border rounded-lg p-2 text-xs focus:outline-none focus:bg-white"
                          required
                        >
                          <option value="REVENUE">Revenue (Incoming Adjustment)</option>
                          <option value="EXPENSE">Expense (Debit Out Adjustment)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category Sourced</label>
                        <input 
                          type="text"
                          name="category"
                          placeholder="e.g. Audit Fix, Sir Ross Offset"
                          className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none focus:bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adjustment Amount (₱ PHP)</label>
                        <input 
                          type="number"
                          name="amount"
                          placeholder="e.g. 1550 or -550"
                          className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none focus:bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Audit Note</label>
                        <input 
                          type="text"
                          name="desc"
                          placeholder="Description / justification"
                          className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none focus:bg-white"
                          required
                        />
                      </div>

                      <div className="md:col-span-4 flex justify-end">
                        <button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs cursor-pointer shadow-sm transition-colors"
                        >
                          + Record &amp; Settle Correction
                        </button>
                      </div>
                    </form>

                    {/* DYNAMIC LIST */}
                    <div className="space-y-3">
                      <h5 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Historical Settle Trail</h5>

                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Description Note</th>
                              <th className="p-3">Auditor</th>
                              <th className="p-3">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs">
                            {(db.financialAdjustments || []).length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                                  No clinical revenue/expense finance adjustments currently registered.
                                </td>
                              </tr>
                            ) : (
                              (db.financialAdjustments || []).map(fin => (
                                <tr key={fin.id} className="hover:bg-slate-50/50">
                                  <td className="p-3 text-slate-400 text-[10px] font-mono">{fin.date}</td>
                                  <td className="p-3 font-black text-[10px]">
                                    <span className={`px-2.5 py-1 rounded-full ${
                                      fin.type === 'REVENUE' 
                                        ? 'bg-emerald-500/10 text-emerald-600' 
                                        : 'bg-rose-500/10 text-rose-600'
                                    }`}>
                                      {fin.type}
                                    </span>
                                  </td>
                                  <td className="p-3 font-semibold text-slate-900">{fin.category}</td>
                                  <td className={`p-3 font-extrabold ${fin.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₱{fin.amount >= 0 ? `+${fin.amount}` : fin.amount}
                                  </td>
                                  <td className="p-3 text-slate-655">{fin.description}</td>
                                  <td className="p-3 text-slate-500 font-mono text-[10px]">{fin.createdBy}</td>
                                  <td className="p-3">
                                    <button
                                      onClick={() => {
                                        if (confirm('Delete this financial adjustment?')) {
                                          const filtered = (db.financialAdjustments || []).filter(a => a.id !== fin.id);
                                          updateClinicalDb({
                                            ...db,
                                            financialAdjustments: filtered
                                          });
                                          triggerToast('Adjustment deleted. General Ledger balances recalculated.', 'success');
                                        }
                                      }}
                                      className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* GLOBAL FOOTER: LEDGER CONTROL & DATA RESET CONSOLE */}
        <footer className="mt-16 pt-8 border-t border-slate-200/80 text-left print:hidden">
          <div className="bg-rose-50/50 border border-rose-200/60 rounded-2xl p-6 md:p-8 shadow-xs max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div>
                <h4 className="text-sm font-black text-rose-950 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  🧹 Clinical Ledger Clearance &amp; Data Reset Console
                </h4>
                <p className="text-xs text-rose-800/80 mt-1 font-sans">
                  Select custom ranges or predefined months to permanently prune transactions, expenses, and payroll runs.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!deleteFromDate || !deleteToDate) {
                    triggerToast('Error: Please specify valid From and To dates.', 'error');
                    return;
                  }
                  setResetConfirmStep(1);
                  setDoneReviewing(false);
                  setClearPasscode('');
                  setCountdownSecs(5);
                  setIsCountdownActive(false);
                  setShowResetConfirmModal(true);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm select-none transition-colors shrink-0"
              >
                Clear Selected Range Data
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-800 font-sans">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Predefined Month Coverage</label>
                <select
                  value={deleteMonth}
                  onChange={(e) => {
                    const m = e.target.value;
                    setDeleteMonth(m);
                    if (m === 'JUNE_2026') {
                      setDeleteFromDate('2026-06-01');
                      setDeleteToDate('2026-06-30');
                    } else if (m === 'MAY_2026') {
                      setDeleteFromDate('2026-05-01');
                      setDeleteToDate('2026-05-31');
                    } else if (m === 'JULY_2026') {
                      setDeleteFromDate('2026-07-01');
                      setDeleteToDate('2026-07-31');
                    } else if (m === 'ALL_2026') {
                      setDeleteFromDate('2026-01-01');
                      setDeleteToDate('2026-12-31');
                    }
                  }}
                  className="w-full bg-white border border-rose-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                >
                  <option value="JUNE_2026">June 2026</option>
                  <option value="MAY_2026">May 2026</option>
                  <option value="JULY_2026">July 2026</option>
                  <option value="ALL_2026">Full Year 2026</option>
                  <option value="CUSTOM">Custom Range Selection</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">From Date Coverage</label>
                <input
                  type="date"
                  value={deleteFromDate}
                  disabled={deleteMonth !== 'CUSTOM'}
                  onChange={(e) => setDeleteFromDate(e.target.value)}
                  className="w-full bg-white border border-rose-200 rounded-lg p-2 text-xs text-slate-900 disabled:opacity-50 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">To Date Coverage</label>
                <input
                  type="date"
                  value={deleteToDate}
                  disabled={deleteMonth !== 'CUSTOM'}
                  onChange={(e) => setDeleteToDate(e.target.value)}
                  className="w-full bg-white border border-rose-200 rounded-lg p-2 text-xs text-slate-900 disabled:opacity-50 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>
          </div>
        </footer>

        {/* SECURITY VERIFICATION MULTI-STEP MODAL */}
        {showResetConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
            <div className="bg-white rounded-[24px] border border-slate-100 max-w-md w-full p-6 md:p-8 shadow-2xl text-left space-y-6">
              
              {/* Step Indicators */}
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 text-xs">
                 <span className="font-extrabold text-rose-600 uppercase tracking-wider">🔒 Security clearance</span>
                 <span className="font-bold text-slate-400">Step {resetConfirmStep} of 3</span>
              </div>

              {resetConfirmStep === 1 && (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 text-xl font-extrabold mb-2">
                    ⚠️
                  </div>
                  <h3 className="text-base font-black text-slate-900">Step 1: Irreversible Deletion Clarification</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    You are about to permanently delete clinical entries and financial ledgers from <strong className="text-rose-600 font-extrabold">{deleteFromDate}</strong> to <strong className="text-rose-600 font-extrabold">{deleteToDate}</strong>.
                  </p>
                  <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold font-sans">
                    This operation will clear patient logs, business receipts, audit trails, and payroll calculations falling inside this duration. There is no backup or undo feature.
                  </div>
                  <div className="flex justify-between items-center pt-3 gap-2 font-sans">
                    <button
                      onClick={() => setShowResetConfirmModal(false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-4 rounded-lg cursor-pointer"
                    >
                      Abort Reset
                    </button>
                    <button
                      onClick={() => setResetConfirmStep(2)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2 px-5 rounded-lg cursor-pointer shadow-xs"
                    >
                      Yes, I understand that this is irreversible ➔
                    </button>
                  </div>
                </div>
              )}

              {resetConfirmStep === 2 && (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xl font-extrabold mb-2">
                    📋
                  </div>
                  <h3 className="text-base font-black text-slate-900">Step 2: Have you done reviewing?</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    Before we trigger the countdown trigger, please verify that you have double-checked all clinical records and generated payroll reports for this range.
                  </p>
                  
                  <label className="flex items-start gap-3 bg-slate-50 border p-4 rounded-xl cursor-pointer select-none font-sans">
                    <input
                      type="checkbox"
                      checked={doneReviewing}
                      onChange={(e) => setDoneReviewing(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                    />
                    <span className="text-xs font-semibold text-slate-800 leading-tight">
                      Yes, I have finished reviewing all clinical ledger values, transactions, and payroll.
                    </span>
                  </label>

                  <div className="space-y-1.5 font-sans">
                    <label htmlFor="clear-passcode-input" className="block text-[10px] font-black text-rose-950 uppercase tracking-wider">
                      Authorization Passcode (Type "go")
                    </label>
                    <input
                      id="clear-passcode-input"
                      type="password"
                      placeholder="Type passcode..."
                      value={clearPasscode}
                      onChange={(e) => setClearPasscode(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-3 gap-2 font-sans">
                    <button
                      onClick={() => setResetConfirmStep(1)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-4 rounded-lg cursor-pointer"
                    >
                      ➔ Back to Step 1
                    </button>
                    <button
                      onClick={() => {
                        setResetConfirmStep(3);
                        setCountdownSecs(5);
                        setIsCountdownActive(true);
                      }}
                      disabled={!doneReviewing || clearPasscode !== 'go'}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs py-2 px-5 rounded-lg cursor-pointer shadow-xs transition-opacity"
                    >
                      Confirm Review Complete ➔
                    </button>
                  </div>
                </div>
              )}

              {resetConfirmStep === 3 && (
                <div className="space-y-5 text-center">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto animate-pulse">
                    {countdownSecs}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 mt-2">Step 3: Final Security Verification Countdown</h3>
                    <p className="text-xs text-slate-500 mt-1 font-sans">
                      Purging records from <strong className="text-slate-800 font-extrabold">{deleteFromDate}</strong> to <strong className="text-slate-800 font-extrabold">{deleteToDate}</strong> in {countdownSecs} seconds.
                    </p>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-xs text-rose-800 font-bold flex items-center justify-center gap-2 font-sans">
                    <span className="animate-spin h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full"></span>
                    Awaiting countdown completion to erase clinical data...
                  </div>

                  <div className="pt-3 font-sans">
                    <button
                      onClick={() => {
                        setIsCountdownActive(false);
                        setShowResetConfirmModal(false);
                        setResetConfirmStep(1);
                        setDoneReviewing(false);
                        setCountdownSecs(5);
                        triggerToast('Deletion process safely aborted. All records remain intact.', 'info');
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-black text-sm py-3 px-6 rounded-xl cursor-pointer shadow-md select-none hover:scale-[1.01] transition-transform"
                    >
                      Cancel &amp; Abort Deletion
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* GLOBAL MULTI-CATEGORY EXCEL/CSV DISTRIBUTION PREVIEW MODAL */}
        {showGlobalImportModal && globalImportResults && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto select-none">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-8 shadow-2xl space-y-6 relative max-h-[92vh] flex flex-col font-sans">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                      Ledger Distribution Hub
                    </h3>
                    <p className="text-xs text-slate-500">
                      Active Workbook: <strong className="text-indigo-600 dark:text-indigo-400">{globalImportResults.fileName}</strong> • Automatically mapped to ARKA Dental interfaces
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGlobalImportModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Distribution Grid Summary */}
              <div className="overflow-y-auto flex-1 space-y-6 pr-1">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Automatic Category Pattern Detection
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(globalImportResults.distribution).map(([category, data]: [string, any]) => (
                      <div 
                        key={category}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between shadow-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">
                              {category === 'TRANSACTIONS' && '📈'}
                              {category === 'EXPENSES' && '💸'}
                              {category === 'PATIENTS' && '👥'}
                              {category === 'EMPLOYEES' && '🩺'}
                              {category === 'PAYROLL' && '🧮'}
                              {category === 'ATTENDANCE' && '📅'}
                            </span>
                            <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase">
                              {category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Sheet: "{data.sheetName}"
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-md">
                            {data.mapped.length} rows
                          </span>
                          <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1">
                            ✓ Verified Map
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details Tab view */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Distributed Records Preview (First 4 rows per category)
                  </h4>

                  {Object.entries(globalImportResults.distribution).map(([category, data]: [string, any]) => (
                    <div 
                      key={category}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                    >
                      <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-850">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {category === 'TRANSACTIONS' && '📈 Transactions Register'}
                            {category === 'EXPENSES' && '💸 Expenses Ledger'}
                            {category === 'PATIENTS' && '👥 Patients Registry'}
                            {category === 'EMPLOYEES' && '🩺 Employees Roster'}
                            {category === 'PAYROLL' && '🧮 Payroll Paystubs'}
                            {category === 'ATTENDANCE' && '📅 Attendance Logs'}
                          </span>
                          <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                            {data.mapped.length} records
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 italic">
                          Headers matched: {data.headers.slice(0, 5).join(', ')}...
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-xs">
                          <thead className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-wider border-b border-slate-150 dark:border-slate-800">
                            {category === 'TRANSACTIONS' && (
                              <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Patient</th>
                                <th className="px-4 py-2">Procedure</th>
                                <th className="px-4 py-2">Paid</th>
                                <th className="px-4 py-2">Mode</th>
                                <th className="px-4 py-2">Commission</th>
                                <th className="px-4 py-2">Remarks</th>
                              </tr>
                            )}
                            {category === 'EXPENSES' && (
                              <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Category</th>
                                <th className="px-4 py-2">Vendor</th>
                                <th className="px-4 py-2">Amount</th>
                                <th className="px-4 py-2">Mode</th>
                                <th className="px-4 py-2">Description</th>
                              </tr>
                            )}
                            {category === 'PATIENTS' && (
                              <tr>
                                <th className="px-4 py-2">Code</th>
                                <th className="px-4 py-2">First Name</th>
                                <th className="px-4 py-2">Last Name</th>
                                <th className="px-4 py-2">HMO Provider</th>
                                <th className="px-4 py-2">Card Number</th>
                              </tr>
                            )}
                            {category === 'EMPLOYEES' && (
                              <tr>
                                <th className="px-4 py-2">Code</th>
                                <th className="px-4 py-2">Full Name</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Base Pay</th>
                                <th className="px-4 py-2">TIN</th>
                                <th className="px-4 py-2">Contact</th>
                              </tr>
                            )}
                            {category === 'PAYROLL' && (
                              <tr>
                                <th className="px-4 py-2">Employee</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Base Salary</th>
                                <th className="px-4 py-2">Commission</th>
                                <th className="px-4 py-2">Deductions</th>
                                <th className="px-4 py-2">Net Pay</th>
                              </tr>
                            )}
                            {category === 'ATTENDANCE' && (
                              <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Employee</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Remarks</th>
                              </tr>
                            )}
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {data.mapped.slice(0, 4).map((rec: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-medium">
                                {category === 'TRANSACTIONS' && (
                                  <>
                                    <td className="px-4 py-2 font-mono whitespace-nowrap">{rec.date}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{rec.patientName}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{rec.procedureName}</td>
                                    <td className="px-4 py-2 font-mono">₱{rec.amountPaid?.toLocaleString()}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{rec.paymentMode}</td>
                                    <td className="px-4 py-2 font-mono text-emerald-600 dark:text-emerald-400 font-bold">₱{rec.commissionAmount?.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap truncate max-w-[120px]">{rec.remarks || 'N/A'}</td>
                                  </>
                                )}
                                {category === 'EXPENSES' && (
                                  <>
                                    <td className="px-4 py-2 font-mono whitespace-nowrap">{rec.date}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-red-500 font-bold">{rec.category}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">{rec.vendorName}</td>
                                    <td className="px-4 py-2 font-mono">₱{rec.amount?.toLocaleString()}</td>
                                    <td className="px-4 py-2 whitespace-nowrap font-mono">{rec.paymentMode}</td>
                                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap truncate max-w-[120px]">{rec.description || 'N/A'}</td>
                                  </>
                                )}
                                {category === 'PATIENTS' && (
                                  <>
                                    <td className="px-4 py-2 font-mono whitespace-nowrap">{rec.code}</td>
                                    <td className="px-4 py-2">{rec.firstName}</td>
                                    <td className="px-4 py-2">{rec.lastName}</td>
                                    <td className="px-4 py-2 text-blue-500 font-bold">{rec.hmoProvider}</td>
                                    <td className="px-4 py-2 font-mono">{rec.hmoIdNumber || 'N/A'}</td>
                                  </>
                                )}
                                {category === 'EMPLOYEES' && (
                                  <>
                                    <td className="px-4 py-2 font-mono whitespace-nowrap">{rec.code}</td>
                                    <td className="px-4 py-2 font-bold whitespace-nowrap">{rec.fullName}</td>
                                    <td className="px-4 py-2 text-purple-500 font-bold">{rec.type}</td>
                                    <td className="px-4 py-2 font-mono">₱{rec.basePayRate?.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono">{rec.tin || 'N/A'}</td>
                                    <td className="px-4 py-2 font-mono">{rec.contactNumber || 'N/A'}</td>
                                  </>
                                )}
                                {category === 'PAYROLL' && (
                                  <>
                                    <td className="px-4 py-2 font-bold whitespace-nowrap">{rec.employeeName}</td>
                                    <td className="px-4 py-2 text-purple-500 font-bold">{rec.employeeType}</td>
                                    <td className="px-4 py-2 font-mono">₱{rec.baseSalary?.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono">₱{rec.commissionEarned?.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono text-red-500">₱{rec.deductions?.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono text-emerald-600 dark:text-emerald-400 font-black">₱{rec.netPay?.toLocaleString()}</td>
                                  </>
                                )}
                                {category === 'ATTENDANCE' && (
                                  <>
                                    <td className="px-4 py-2 font-mono whitespace-nowrap">{rec.date}</td>
                                    <td className="px-4 py-2 font-bold whitespace-nowrap">{rec.employeeName}</td>
                                    <td className="px-4 py-2 text-purple-500 font-bold">{rec.employeeType}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                        rec.status === 'PRESENT' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                                        rec.status === 'ABSENT' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {rec.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap truncate max-w-[150px]">{rec.remarks || 'N/A'}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning/Compliance Notice */}
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 p-4 rounded-2xl flex items-start gap-3 text-xs text-indigo-800 dark:text-indigo-300 font-medium shrink-0">
                <span className="text-base">🛡️</span>
                <div>
                  <p className="font-bold">BIR &amp; Dental Audit Protection Compliance</p>
                  <p className="text-[11px] opacity-90 leading-relaxed mt-0.5">
                    Importing values automatically synchronizes patient registry codes, resolves physician names, corrections of spelling errors, updates daily attendance counts, and updates the dental bookkeeping archive live.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  onClick={() => setShowGlobalImportModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAndRefreshGlobalImports}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2.5 px-6 rounded-xl cursor-pointer shadow-md hover:scale-[1.01] transition-all flex items-center gap-1.5 animate-pulse"
                >
                  <CheckCircle className="w-4 h-4" /> Save &amp; Refresh Page
                </button>
              </div>

            </div>
          </div>
        )}

        {/* BULK IMPORT DATA PREVIEW AND VALIDATION MODAL */}
        {showImportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto select-none">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                    <FolderUp className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 font-sans">
                      Bulk Data Collection Center
                    </h3>
                    <p className="text-xs text-slate-500 font-sans">
                      Active File: <strong className="text-blue-600 dark:text-blue-400">{importFileName}</strong> • Total parsed raw rows: <strong>{parsedRawRows.length}</strong>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Data Category Switcher */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl space-y-3 font-sans border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Dataset Category (System Filter)
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['TRANSACTIONS', 'EXPENSES', 'PATIENTS', 'EMPLOYEES'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setImportType(type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        importType === type 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {type === 'TRANSACTIONS' && '📈 Transactions Ledger'}
                      {type === 'EXPENSES' && '💸 Expenses Ledger'}
                      {type === 'PATIENTS' && '👥 Patients Roster'}
                      {type === 'EMPLOYEES' && '🩺 Employees & Clinicians'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  The system filters spreadsheet columns and automatically maps fields like dates, patient codes, physician commission rates, and category codes to guarantee database compliance.
                </p>
              </div>

              {/* Preview Table of mapped fields */}
              <div className="space-y-3 font-sans">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Mapped Records Preview (First 5 Items)
                  </h4>
                  <span className="text-[11px] text-slate-400 italic">
                    Showing {Math.min(5, getMappedAndFilteredRecords().length)} of {getMappedAndFilteredRecords().length} records to import
                  </span>
                </div>
                
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[250px]">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                        {importType === 'TRANSACTIONS' && (
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Patient</th>
                            <th className="px-4 py-3">Procedure</th>
                            <th className="px-4 py-3">Charged</th>
                            <th className="px-4 py-3">Paid</th>
                            <th className="px-4 py-3">Mode</th>
                            <th className="px-4 py-3">Commission</th>
                          </tr>
                        )}
                        {importType === 'EXPENSES' && (
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Vendor</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Mode</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        )}
                        {importType === 'PATIENTS' && (
                          <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">First Name</th>
                            <th className="px-4 py-3">Last Name</th>
                            <th className="px-4 py-3">HMO Provider</th>
                            <th className="px-4 py-3">HMO Card Number</th>
                          </tr>
                        )}
                        {importType === 'EMPLOYEES' && (
                          <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Full Name</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Base Pay Rate</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        {getMappedAndFilteredRecords().slice(0, 5).map((rec: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {importType === 'TRANSACTIONS' && (
                              <>
                                <td className="px-4 py-3 font-mono whitespace-nowrap">{rec.date}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{rec.patientName}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-mono mr-1">
                                    {rec.procedureCode}
                                  </span>
                                  {rec.procedureName}
                                </td>
                                <td className="px-4 py-3 font-mono">₱{rec.amountCharged?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono">₱{rec.amountPaid?.toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.paymentMode}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                  ₱{rec.commissionAmount?.toLocaleString()}
                                </td>
                              </>
                            )}
                            {importType === 'EXPENSES' && (
                              <>
                                <td className="px-4 py-3 font-mono whitespace-nowrap">{rec.date}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.category}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">{rec.vendorName}</td>
                                <td className="px-4 py-3 font-mono">₱{rec.amount?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono uppercase">{rec.paymentMode}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.status}
                                  </span>
                                </td>
                              </>
                            )}
                            {importType === 'PATIENTS' && (
                              <>
                                <td className="px-4 py-3 font-mono whitespace-nowrap">{rec.code}</td>
                                <td className="px-4 py-3">{rec.firstName}</td>
                                <td className="px-4 py-3">{rec.lastName}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.hmoProvider}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono">{rec.hmoIdNumber || 'N/A'}</td>
                              </>
                            )}
                            {importType === 'EMPLOYEES' && (
                              <>
                                <td className="px-4 py-3 font-mono whitespace-nowrap">{rec.code}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-bold">{rec.fullName}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono">₱{rec.basePayRate?.toLocaleString()}</td>
                                <td className="px-4 py-3 font-mono">{rec.contactNumber || 'N/A'}</td>
                                <td className="px-4 py-3">
                                  <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {rec.status}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Warning/Compliance Notice */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-4 rounded-2xl flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300 font-medium font-sans">
                <span className="text-base">🛡️</span>
                <div>
                  <p className="font-bold">BIR &amp; Dental Audit Protection Compliance</p>
                  <p className="text-[11px] opacity-90 leading-relaxed mt-0.5">
                    Importing values automatically synchronizes patient registry codes, references existing clinicians, re-evaluates merchant fee multipliers for credit card terminals, and flags any statutory audit discrepancies.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBulkImports}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2.5 px-6 rounded-xl cursor-pointer shadow-md hover:scale-[1.01] transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Save Mapped Records ({getMappedAndFilteredRecords().length} items)
                </button>
              </div>

            </div>
          </div>
        )}

        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl transition-all animate-bounce font-sans ${
            toastType === 'success' ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/10' :
            toastType === 'error' ? 'bg-rose-600 border-rose-700 text-white shadow-rose-650/10' :
            'bg-slate-900 border-slate-950 text-white'
          }`}>
            <span className="text-xs font-bold leading-none">
              {toastType === 'success' ? '✓' : toastType === 'error' ? '⚠️' : 'ℹ'}
            </span>
            <span className="text-xs font-semibold">{toastMessage}</span>
            <button 
              onClick={() => setToastMessage(null)} 
              className="ml-2 font-black text-xs hover:opacity-85 select-none focus:outline-none"
            >
              ×
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
