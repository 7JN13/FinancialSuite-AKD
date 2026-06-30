import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Sliders, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  Sparkles,
  Info
} from 'lucide-react';
import { Employee, PhilippineHoliday, LeaveRequest, EmployeeLeaveBalance, AttendanceRecord } from '../types';

interface AttendanceAndLeaveTrackerProps {
  db: {
    employees: Employee[];
    holidays: PhilippineHoliday[];
    leaveRequests: LeaveRequest[];
    leaveBalances: EmployeeLeaveBalance[];
    attendanceRecords: AttendanceRecord[];
    [key: string]: any;
  };
  updateClinicalDb: (newData: any) => void;
}

export default function AttendanceAndLeaveTracker({ db, updateClinicalDb }: AttendanceAndLeaveTrackerProps) {
  // Ensure lists exist to prevent crashes
  const employees = db.employees || [];
  const holidays = db.holidays || [];
  const leaveRequests = db.leaveRequests || [];
  const leaveBalances = db.leaveBalances || [];
  const attendanceRecords = db.attendanceRecords || [];

  // Local state for calendar navigation (simulated to June 2026, today is 2026-06-23)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // 0-indexed, 5 = June
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('2026-06-23');

  // Interactive syncing indicators
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Administrative State - Leave Point Allotments
  const [allotOpen, setAllotOpen] = useState<boolean>(false);
  const [defaultAllotVL, setDefaultAllotVL] = useState<number>(15);
  const [defaultAllotSL, setDefaultAllotSL] = useState<number>(15);
  const [allotEmployeeId, setAllotEmployeeId] = useState<string>('ALL');

  // Leave filing modal states
  const [isFiling, setIsFiling] = useState<boolean>(false);
  const [leaveCategory, setLeaveCategory] = useState<'DOCTOR' | 'STAFF'>('DOCTOR');
  const [leaveEmployeeId, setLeaveEmployeeId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<'VL' | 'SL'>('VL');
  const [leaveStartDate, setLeaveStartDate] = useState<string>('');
  const [leaveEndDate, setLeaveEndDate] = useState<string>('');
  const [leaveRemarks, setLeaveRemarks] = useState<string>('');

  // Daily attendance log state
  const [attendanceDate, setAttendanceDate] = useState<string>('2026-06-23');
  const [localAttendanceMap, setLocalAttendanceMap] = useState<Record<string, { status: string; remarks: string }>>({});

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Sync with system or initialize leave balances if doesn't exist
  useEffect(() => {
    let changed = false;
    const updatedBalances = [...leaveBalances];

    employees.forEach(emp => {
      const exists = updatedBalances.find(b => b.employeeId === emp.id);
      if (!exists) {
        updatedBalances.push({
          employeeId: emp.id,
          vlAllotted: emp.type === 'DENTIST' ? 20 : 12,
          vlUsed: 0,
          slAllotted: emp.type === 'DENTIST' ? 20 : 12,
          slUsed: 0
        });
        changed = true;
      }
    });

    if (changed) {
      updateClinicalDb({
        ...db,
        leaveBalances: updatedBalances
      });
    }
  }, [employees, leaveBalances]);

  // Sync today's default attendance logs map state
  useEffect(() => {
    const map: Record<string, { status: string; remarks: string }> = {};
    employees.forEach(emp => {
      // Check existing database records
      const record = attendanceRecords.find(r => r.employeeId === emp.id && r.date === attendanceDate);
      if (record) {
        map[emp.id] = { status: record.status, remarks: record.remarks || '' };
      } else {
        // Auto check if they have an approved leave first
        const onLeave = leaveRequests.find(l => 
          l.employeeId === emp.id && 
          l.status === 'APPROVED' && 
          attendanceDate >= l.startDate && 
          attendanceDate <= l.endDate
        );
        
        let status = 'PRESENT';
        let remarks = '';
        if (onLeave) {
          status = onLeave.type; // VL or SL
          remarks = `Auto-derived from Leave Request #${onLeave.id.slice(-4)}`;
        } else {
          // Check if it's a holiday
          const isHoliday = holidays.find(h => h.date === attendanceDate);
          if (isHoliday) {
            status = isHoliday.type === 'NO_WORK_NO_PAY' ? 'ABSENT' : 'HOLIDAY_OFF';
            remarks = `Default: ${isHoliday.name} (${isHoliday.type})`;
          }
        }
        map[emp.id] = { status, remarks };
      }
    });
    setLocalAttendanceMap(map);
  }, [attendanceDate, employees, attendanceRecords, leaveRequests, holidays]);

  // Google Calendar Synergizer
  const handleGoogleCalendarSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Connecting to Google API endpoint...');
    
    try {
      const res = await fetch('/api/calendar/sync-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        updateClinicalDb({
          ...db,
          holidays: data.holidays
        });
        setSyncStatus(`Sync Success! Synced ${data.holidays.length} Philippine National holidays.`);
        setTimeout(() => setSyncStatus(null), 5000);
      } else {
        throw new Error(data.error || 'Unknown server response error');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus(`Sync Error: ${err.message}. Using offline local database sync.`);
      setTimeout(() => setSyncStatus(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Administrative Point Alloter Process
  const handleApplyAllotment = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedBalances = [...leaveBalances];

    if (allotEmployeeId === 'ALL') {
      employees.forEach(emp => {
        const match = updatedBalances.find(b => b.employeeId === emp.id);
        if (match) {
          match.vlAllotted = defaultAllotVL;
          match.slAllotted = defaultAllotSL;
        } else {
          updatedBalances.push({
            employeeId: emp.id,
            vlAllotted: defaultAllotVL,
            vlUsed: 0,
            slAllotted: defaultAllotSL,
            slUsed: 0
          });
        }
      });
      alert(`Permanently applied ${defaultAllotVL} VL and ${defaultAllotSL} SL points to all roster members.`);
    } else {
      const match = updatedBalances.find(b => b.employeeId === allotEmployeeId);
      if (match) {
        match.vlAllotted = defaultAllotVL;
        match.slAllotted = defaultAllotSL;
      } else {
        updatedBalances.push({
          employeeId: allotEmployeeId,
          vlAllotted: defaultAllotVL,
          vlUsed: 0,
          slAllotted: defaultAllotSL,
          slUsed: 0
        });
      }
      const empName = employees.find(emp => emp.id === allotEmployeeId)?.fullName || '';
      alert(`Applied ${defaultAllotVL} VL and ${defaultAllotSL} SL points to ${empName} permanently.`);
    }

    updateClinicalDb({
      ...db,
      leaveBalances: updatedBalances
    });
    setAllotOpen(false);
  };

  // Days range calculator for Vacation / Sick Leaves
  const calculateDaysCount = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const sDate = new Date(start);
    const eDate = new Date(end);
    const diff = eDate.getTime() - sDate.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  // File a Leave submission
  const handleCreateLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmployeeId) {
      alert('Please select an employee.');
      return;
    }
    if (!leaveStartDate || !leaveEndDate) {
      alert('Please define both start and end days.');
      return;
    }
    
    const count = calculateDaysCount(leaveStartDate, leaveEndDate);
    if (count <= 0) {
      alert('End date must be greater or equal to start date.');
      return;
    }

    const employeeObj = employees.find(emp => emp.id === leaveEmployeeId);
    if (!employeeObj) return;

    // Check SL and VL Leave points
    const balance = leaveBalances.find(b => b.employeeId === leaveEmployeeId);
    if (balance) {
      const remaining = leaveType === 'VL' 
        ? balance.vlAllotted - balance.vlUsed 
        : balance.slAllotted - balance.slUsed;
      
      if (count > remaining) {
        if (!confirm(`Warning: Employee only has ${remaining} days left in their ${leaveType} balance points. File this leave as premium overdraft?`)) {
          return;
        }
      }
    }

    const newRequest: LeaveRequest = {
      id: `l-${Date.now()}`,
      employeeId: leaveEmployeeId,
      employeeName: employeeObj.fullName,
      employeeType: employeeObj.type as any,
      type: leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      daysCount: count,
      remarks: leaveRemarks,
      status: 'APPROVED' // Auto approved in corporate roster sandbox
    };

    // Update balances
    const nextBalances = leaveBalances.map(b => {
      if (b.employeeId === leaveEmployeeId) {
        return {
          ...b,
          vlUsed: leaveType === 'VL' ? b.vlUsed + count : b.vlUsed,
          slUsed: leaveType === 'SL' ? b.slUsed + count : b.slUsed
        };
      }
      return b;
    });

    updateClinicalDb({
      ...db,
      leaveRequests: [newRequest, ...leaveRequests],
      leaveBalances: nextBalances
    });

    setIsFiling(false);
    setLeaveRemarks('');
    setLeaveStartDate('');
    setLeaveEndDate('');
    alert(`Successfully registered ${count} days of ${leaveType} leave for ${employeeObj.fullName}!`);
  };

  // Register / Save daily attendance records
  const handleSaveAttendance = () => {
    const nextRecords = [...attendanceRecords];
    
    employees.forEach(emp => {
      const state = localAttendanceMap[emp.id];
      if (!state) return;

      const updatedRecordIndex = nextRecords.findIndex(r => r.employeeId === emp.id && r.date === attendanceDate);
      
      let payMultiplier = 1.0;
      // Derived from actual Philippine Holiday premiums:
      // 200% on Regular worked, No Work No Pay on rest, 1.3 (130%) on Special worked
      const activeHoliday = holidays.find(h => h.date === attendanceDate);
      if (activeHoliday) {
        if (state.status === 'HOLIDAY_WORKED') {
          payMultiplier = activeHoliday.type === '200%' ? 2.0 : activeHoliday.type === '130%' ? 1.3 : 1.3;
        } else if (state.status === 'HOLIDAY_OFF') {
          payMultiplier = activeHoliday.type === '200%' ? 1.0 : 0; // Regular = paid standard, special = no work no pay
        } else if (state.status === 'ABSENT') {
          payMultiplier = 0;
        }
      } else {
        if (state.status === 'ABSENT') payMultiplier = 0;
      }

      const newRecord: AttendanceRecord = {
        id: updatedRecordIndex !== -1 ? nextRecords[updatedRecordIndex].id : `att-${Date.now()}-${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeType: emp.type as any,
        date: attendanceDate,
        status: state.status as any,
        holidayPayMultiplier: payMultiplier,
        remarks: state.remarks
      };

      if (updatedRecordIndex !== -1) {
        nextRecords[updatedRecordIndex] = newRecord;
      } else {
        nextRecords.push(newRecord);
      }
    });

    updateClinicalDb({
      ...db,
      attendanceRecords: nextRecords
    });

    alert(`Successfully compiled and permanently recorded daily attendance logs for date: ${attendanceDate}`);
  };

  // Filter Employees Category wrappers:
  // "Our Doctors" (DENTIST)
  const doctors = employees.filter(emp => emp.type === 'DENTIST');
  // "Our Staff" (ASSISTANT, ADMIN, TEMP)
  const staff = employees.filter(emp => emp.type !== 'DENTIST');

  // Calendar render math helpers
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sunday) to 6 (Saturday)
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Helper to format numeric day indices cleanly
  const formatDateString = (year: number, month: number, day: number): string => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* HEADER CONTROLS STATUS TRAY */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="p-2 rounded-lg bg-teal-50 text-teal-600">📅</span>
              Real-Time Attendance & Leave Registry
            </h2>
            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-emerald-100">
              Live Connection
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking clinics, PH statutory holiday modifiers (200%/130%), leaves, and Google Calendar sync loops.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SYNC GOOGLE CALENDAR CONTROLS */}
          <button
            id="gcal-sync-button"
            onClick={handleGoogleCalendarSync}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer shadow-xs ${
              isSyncing 
                ? 'bg-slate-50 border-slate-200 text-slate-400' 
                : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing GCal...' : 'Sync Philippine Holidays'}
          </button>

          {/* SL AND VL LEAVE POINTS PANEL */}
          <button
            id="allot-leave-points-btn"
            onClick={() => setAllotOpen(!allotOpen)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-950 shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            Admins: Allot SL and VL Leave points
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 animate-fade-in">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* ADMIN CONTROLS MODAL DRAWER */}
      {allotOpen && (
        <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm animate-fade-in space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-500" />
              Corporate Leave Points Allocation Panel (Permanent)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Admin allotment of Vacation Leave (VL) and Sick Leave (SL) points for the current tax calendar year.
            </p>
          </div>

          <form onSubmit={handleApplyAllotment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">For Employee</label>
              <select
                value={allotEmployeeId}
                onChange={(e) => setAllotEmployeeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
              >
                <option value="ALL">Apply to Everyone (Roster Default)</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">VL Leave Points allotment</label>
              <input
                type="number"
                min="0"
                max="50"
                value={defaultAllotVL}
                onChange={(e) => setDefaultAllotVL(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">SL Leave Points allotment</label>
              <input
                type="number"
                min="0"
                max="50"
                value={defaultAllotSL}
                onChange={(e) => setDefaultAllotSL(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 rounded-xl border border-rose-600 cursor-pointer shadow-xs"
              >
                Permanently Apply SL and VL Leave points
              </button>
              <button
                type="button"
                onClick={() => setAllotOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 rounded-xl py-2.5 border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GRID LAYOUT: TWO MAIN COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INTERACTIVE Philippine CALENDAR & FILE LEAVE (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-4">
            
            {/* Calendar Controls bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-800 font-mono tracking-tight">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentYear(2026);
                    setCurrentMonth(5); // Reset to June 2026
                  }}
                  className="px-2.5 py-1 text-[9px] uppercase font-bold text-slate-500 hover:bg-white rounded-lg transition-colors cursor-pointer font-mono"
                >
                  2026 Shift
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-slate-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* LEGEND SLAT */}
            <div className="flex flex-wrap gap-2 text-[9px] bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-500 uppercase mr-1 flex items-center">Legend:</span>
              <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present</span>
              <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Regular Hol. (200%)</span>
              <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Special Hol. (130%)</span>
              <span className="flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-sky-500"></span> Doctor Leave</span>
              <span className="flex items-center gap-1 text-purple-600"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Staff Leave</span>
            </div>

            {/* CALENDAR WEEKDAYS HEADER */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase select-none">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* CALENDAR GRID */}
            <div className="grid grid-cols-7 gap-2 select-none">
              
              {/* Empty leading spacer grid items */}
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-24 bg-slate-50/40 rounded-xl border border-dashed border-slate-100"></div>
              ))}

              {/* Days rendering map loop */}
              {Array.from({ length: totalDaysInMonth }).map((_, dayIdx) => {
                const dayNum = dayIdx + 1;
                const dStr = formatDateString(currentYear, currentMonth, dayNum);
                
                // Matches for holidays
                const dayHoliday = holidays.find(h => h.date === dStr);
                
                // Fetch approved leaves on this day
                const matchingLeaves = leaveRequests.filter(l => 
                  l.status === 'APPROVED' && 
                  dStr >= l.startDate && 
                  dStr <= l.endDate
                );

                const isSelected = selectedCalendarDate === dStr;
                const isTodayStr = dStr === '2026-06-23';

                return (
                  <button
                    id={`cal-day-cell-${dStr}`}
                    key={`day-${dayNum}`}
                    onClick={() => {
                      setSelectedCalendarDate(dStr);
                      setAttendanceDate(dStr); // Auto select date inside attendance compiler!
                      setLeaveStartDate(dStr); // Set start date for ease of leaves filing!
                      setLeaveEndDate(dStr);
                      setIsFiling(true); // Open leaves filing prompt!
                    }}
                    className={`h-24 p-2 text-left rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden group cursor-pointer ${
                      isSelected 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/10 bg-indigo-50/10' 
                        : isTodayStr
                        ? 'border-rose-500 bg-rose-500/5'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Day indicator */}
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-bold font-mono ${isTodayStr ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md' : 'text-slate-800'}`}>
                        {dayNum}
                      </span>
                      {dayHoliday && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${
                          dayHoliday.type === '200%' 
                            ? 'bg-rose-550 text-rose-50 font-sans border border-rose-200' 
                            : 'bg-amber-150 text-amber-800'
                        }`}>
                          {dayHoliday.type}
                        </span>
                      )}
                    </div>

                    {/* Holiday names / labels bar */}
                    {dayHoliday && (
                      <div className="text-[8px] font-bold text-rose-500 leading-tight truncate w-full mt-1">
                        🎉 {dayHoliday.name}
                      </div>
                    )}

                    {/* Employee leaves listed in daily cell */}
                    <div className="space-y-0.5 w-full overflow-hidden mt-1 max-h-[48px]">
                      {matchingLeaves.map(leave => {
                        const isDentist = leave.employeeType === 'DENTIST';
                        return (
                          <div 
                            key={leave.id}
                            className={`text-[8px] px-1 py-0.5 rounded-md font-medium truncate flex items-center justify-between ${
                              isDentist 
                                ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                                : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}
                            title={`${leave.employeeName}: ${leave.type} approved`}
                          >
                            <span>👤 {leave.employeeName.split(' ')[1] || leave.employeeName}</span>
                            <span className="font-mono font-bold text-[7px]">{leave.type}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Floating plus on hover cell to ease leave tracker clicking */}
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FILED LEAVE APPLICATIONS RECENT SLAT */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">📂 Roster Leaves History Ledger</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
                {leaveRequests.length} filed
              </span>
            </h3>

            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-100 text-xs text-slate-400">
                No leave requests filed or logged for this fiscal year period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-450 uppercase text-[9px] font-bold">
                      <th className="py-2.5">Roster Rung</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Leave Type</th>
                      <th className="py-2.5">Date Range covered</th>
                      <th className="py-2.5 text-center">Days</th>
                      <th className="py-2.5">Remarks</th>
                      <th className="py-2.5 text-right">Filing Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((req) => (
                      <tr key={req.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                        <td className="py-3 font-semibold text-slate-800">{req.employeeName}</td>
                        <td className="py-3">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            req.employeeType === 'DENTIST' ? 'bg-sky-50 text-sky-800' : 'bg-purple-50 text-purple-800'
                          }`}>
                            {req.employeeType === 'DENTIST' ? 'DOCTOR' : 'STAFF'}
                          </span>
                        </td>
                        <td className="py-3 font-bold font-mono text-rose-600">{req.type}</td>
                        <td className="py-3 text-slate-500 font-mono text-[11px]">{req.startDate} to {req.endDate}</td>
                        <td className="py-3 text-center font-bold text-slate-700 font-mono">{req.daysCount} d</td>
                        <td className="py-3 text-slate-500 italic max-w-[120px] truncate">{req.remarks || '-'}</td>
                        <td className="py-3 text-right">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Approved
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION PANELS: FILE LEAVES & ATTENDANCE COMPILER */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* DIALOG BOX: LEAVE APPLICATION FILER */}
          {isFiling && (
            <div className="bg-white rounded-2xl border-2 border-indigo-500 shadow-sm p-6 space-y-4 animate-fade-in relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-910 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-bounce" />
                  File & Appoint Roster Leaves
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFiling(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold font-mono border border-slate-100 px-1.5 py-0.5 rounded"
                >
                  Close ×
                </button>
              </div>

              <form onSubmit={handleCreateLeaveRequest} className="space-y-4">
                
                {/* Employee Role Categories */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveCategory('DOCTOR');
                      // Reset default select match
                      const docList = employees.filter(e => e.type === 'DENTIST');
                      if (docList.length > 0) setLeaveEmployeeId(docList[0].id);
                    }}
                    className={`py-1.5 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                      leaveCategory === 'DOCTOR' 
                        ? 'bg-white text-indigo-600 shadow-xs' 
                        : 'text-slate-400 hover:bg-white/40'
                    }`}
                  >
                    Our Doctors
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveCategory('STAFF');
                      const staffList = employees.filter(e => e.type !== 'DENTIST');
                      if (staffList.length > 0) setLeaveEmployeeId(staffList[0].id);
                    }}
                    className={`py-1.5 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                      leaveCategory === 'STAFF' 
                        ? 'bg-white text-indigo-600 shadow-xs' 
                        : 'text-slate-400 hover:bg-white/40'
                    }`}
                  >
                    Our Staff
                  </button>
                </div>

                {/* Filter Employee Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Roster Member</label>
                  <select
                    value={leaveEmployeeId}
                    onChange={(e) => setLeaveEmployeeId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="">-- Choose employee --</option>
                    {(leaveCategory === 'DOCTOR' ? doctors : staff).map((e) => {
                      const bal = leaveBalances.find(b => b.employeeId === e.id);
                      const remVL = bal ? (bal.vlAllotted - bal.vlUsed) : 0;
                      const remSL = bal ? (bal.slAllotted - bal.slUsed) : 0;
                      return (
                        <option key={e.id} value={e.id}>
                          {e.fullName} (VL Rem: {remVL}d | SL Rem: {remSL}d)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Leave Classification type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Leave Classification</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLeaveType('VL')}
                      className={`py-1.5 border rounded-xl text-center text-xs font-bold cursor-pointer transition-all ${
                        leaveType === 'VL' 
                          ? 'bg-rose-50 border-rose-300 text-rose-700' 
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      Vacation Leave (VL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveType('SL')}
                      className={`py-1.5 border rounded-xl text-center text-xs font-bold cursor-pointer transition-all ${
                        leaveType === 'SL' 
                          ? 'bg-amber-50 border-amber-300 text-amber-700' 
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      Sick Leave (SL)
                    </button>
                  </div>
                </div>

                {/* Date range setup - VL: start and end = days count */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start date</label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End date</label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono"
                    />
                  </div>
                </div>

                {/* Days range display badge */}
                {leaveStartDate && leaveEndDate && (
                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs flex justify-between items-center border border-slate-100">
                    <span className="text-slate-500 font-medium">Leave Days Span:</span>
                    <span className="font-bold font-mono text-indigo-600 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                      {calculateDaysCount(leaveStartDate, leaveEndDate)} Day(s) Selected
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex justify-between">
                    <span>Clinical Reason / Remarks</span>
                    <span className="text-slate-400 capitalize text-[8px]">required</span>
                  </label>
                  <textarea
                    rows={2}
                    value={leaveRemarks}
                    onChange={(e) => setLeaveRemarks(e.target.value)}
                    placeholder="Enter details (e.g. Vacation cruise, dental surgery rest etc.)"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl border border-indigo-700 cursor-pointer shadow-xs"
                >
                  File approved leave range
                </button>
              </form>
            </div>
          )}

          {/* ATTENDANCE COMPILER LOGGER BOX */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  Roster Compiler Logger
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Complete logs for everyone inside our dental clinic.
                </p>
              </div>

              {/* Date selection compiler */}
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-xs font-mono font-bold text-slate-700 w-[120px]"
              />
            </div>

            {/* Check for PH statutory holiday on this day */}
            {(() => {
              const activeHoliday = holidays.find(h => h.date === attendanceDate);
              if (activeHoliday) {
                return (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-[11px] leading-relaxed text-rose-800 font-medium">
                    📍 <span className="font-bold underline">{activeHoliday.name}</span> on this date. 
                    Classified as <span className="italic font-bold">{activeHoliday.type}</span> holiday modifiers.
                  </div>
                );
              }
              return null;
            })()}

            {/* ROSTER CATEGORIES LISTINGS */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              
              {/* Category 1: Our Doctors */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Our Doctors List</h4>
                <div className="space-y-3">
                  {doctors.map(doc => {
                    const local = localAttendanceMap[doc.id] || { status: 'PRESENT', remarks: '' };
                    return (
                      <div key={doc.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{doc.fullName}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-mono">{doc.code}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 select-none">
                          <select
                            value={local.status}
                            onChange={(e) => setLocalAttendanceMap(prev => ({
                              ...prev,
                              [doc.id]: { ...prev[doc.id], status: e.target.value }
                            }))}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700"
                          >
                            <option value="PRESENT">✅ Present</option>
                            <option value="ABSENT">❌ Absent</option>
                            <option value="VL">🏖 Vacation (VL)</option>
                            <option value="SL">🤒 Sick Leave (SL)</option>
                            <option value="HOLIDAY_OFF">🏠 Holiday Out</option>
                            <option value="HOLIDAY_WORKED">🦷 Holiday worked</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Add remarks / late tags"
                            value={local.remarks}
                            onChange={(e) => setLocalAttendanceMap(prev => ({
                              ...prev,
                              [doc.id]: { ...prev[doc.id], remarks: e.target.value }
                            }))}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600 font-sans"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category 2: Our Staff */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Our Staff List</h4>
                <div className="space-y-3">
                  {staff.map(s => {
                    const local = localAttendanceMap[s.id] || { status: 'PRESENT', remarks: '' };
                    return (
                      <div key={s.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{s.fullName}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-mono">{s.role || s.type}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={local.status}
                            onChange={(e) => setLocalAttendanceMap(prev => ({
                              ...prev,
                              [s.id]: { ...prev[s.id], status: e.target.value }
                            }))}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700"
                          >
                            <option value="PRESENT">✅ Present</option>
                            <option value="ABSENT">❌ Absent</option>
                            <option value="VL">🏖 Vacation (VL)</option>
                            <option value="SL">🤒 Sick Leave (SL)</option>
                            <option value="HOLIDAY_OFF">🏠 Holiday Out</option>
                            <option value="HOLIDAY_WORKED">🦷 Holiday worked</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Add remarks / late tags"
                            value={local.remarks}
                            onChange={(e) => setLocalAttendanceMap(prev => ({
                              ...prev,
                              [s.id]: { ...prev[s.id], remarks: e.target.value }
                            }))}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600 font-sans"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            <button
              id="attendance-save-btn"
              onClick={handleSaveAttendance}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl border border-emerald-600 transition-all cursor-pointer shadow-xs"
            >
              Confirm & Save Daily Attendance Log
            </button>

          </div>

          {/* STATS SUMMARY OF ROSTER BALANCES */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              SL and VL Leave Points Balance Ratios
            </h3>
            <div className="space-y-3">
              {employees.map(emp => {
                const bal = leaveBalances.find(b => b.employeeId === emp.id) || { vlAllotted: 12, vlUsed: 0, slAllotted: 12, slUsed: 0 };
                const vlLeft = bal.vlAllotted - bal.vlUsed;
                const slLeft = bal.slAllotted - bal.slUsed;
                return (
                  <div key={emp.id} className="text-xs flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                    <div className="font-semibold text-slate-750">
                      <div>{emp.fullName}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-mono">{emp.type === 'DENTIST' ? 'DOCTOR' : 'STAFF'}</div>
                    </div>
                    <div className="font-mono text-slate-600 flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase">VL: </span>
                        <span className={`font-bold ${vlLeft <= 2 ? 'text-rose-500 font-extrabold' : 'text-slate-800'}`}>{vlLeft}</span>
                        <span className="text-slate-400 text-[10px]">/{bal.vlAllotted}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase">SL: </span>
                        <span className={`font-bold ${slLeft <= 2 ? 'text-rose-500 font-extrabold' : 'text-slate-800'}`}>{slLeft}</span>
                        <span className="text-slate-400 text-[10px]">/{bal.slAllotted}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
