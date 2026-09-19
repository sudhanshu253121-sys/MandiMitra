import React, { useState, useMemo } from 'react';

/**
 * SmartSlotBooking Component (MandiMitra / KisanSeva UI)
 * 
 * Features:
 * - Replaces full monthly calendar view with smart 2-hour window express booking.
 * - Horizontal interactive date tabs with solid green active indicator (bg-emerald-600).
 * - 2-Column responsive grid (1-column on mobile) displaying 2-hour delivery slots.
 * - Capacity metrics: Throughput Cap (q), Vehicle count, dynamic progress bar, and status badges.
 * - Mobile-first optimized: touch scroll snapping, tap targets, overflow containment.
 * 
 * @param {Function} onSlotChange - Callback when active date or slot changes: (date, slotTime) => void
 * @param {string} initialDate - Initial selected date (YYYY-MM-DD)
 * @param {string} initialSlot - Initial selected time slot (e.g., '10:00 - 12:00')
 */
export default function SmartSlotBooking({
  onSlotChange,
  initialDate,
  initialSlot = '10:00 - 12:00',
}) {
  // Generate next 7 procurement days dynamically
  const dates = useMemo(() => {
    const today = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const list = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];

      list.push({
        iso,
        dayLabel: i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : dayNames[d.getDay()],
        dayNum: String(d.getDate()).padStart(2, '0'),
        month: monthNames[d.getMonth()],
        openSlots: i === 2 ? 3 : i === 5 ? 2 : 5,
      });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState(initialDate || dates[0]?.iso);
  const [selectedSlot, setSelectedSlot] = useState(initialSlot);

  // 2-Hour Time Window Templates
  const slotWindows = [
    { id: 's1', time: '08:00 - 10:00', maxThroughput: 300, maxVehicles: 15 },
    { id: 's2', time: '10:00 - 12:00', maxThroughput: 300, maxVehicles: 15 },
    { id: 's3', time: '12:00 - 14:00', maxThroughput: 300, maxVehicles: 15 },
    { id: 's4', time: '14:00 - 16:00', maxThroughput: 300, maxVehicles: 15 },
    { id: 's5', time: '16:00 - 18:00', maxThroughput: 300, maxVehicles: 15 },
  ];

  // Dynamic slot calculations based on selected date
  const activeSlots = useMemo(() => {
    const dayNum = parseInt((selectedDate || '').split('-')[2], 10) || 1;

    return slotWindows.map((sw, idx) => {
      const isFull = (dayNum % 3 === 0 && idx === 1) || (dayNum % 2 === 1 && idx === 3);
      let usedThroughput = 0;
      let usedVehicles = 0;

      if (isFull) {
        usedThroughput = sw.maxThroughput;
        usedVehicles = sw.maxVehicles;
      } else if (idx === 0) {
        usedThroughput = 0;
        usedVehicles = 0;
      } else if (idx === 1) {
        usedThroughput = 120;
        usedVehicles = 6;
      } else if (idx === 2) {
        usedThroughput = 180;
        usedVehicles = 9;
      } else {
        usedThroughput = Math.min(260, (dayNum * 35) % sw.maxThroughput);
        usedVehicles = Math.min(13, Math.round(usedThroughput / 20));
      }

      const freeThroughput = Math.max(0, sw.maxThroughput - usedThroughput);
      const pctUsed = Math.min(100, Math.round((usedThroughput / sw.maxThroughput) * 100));

      return {
        ...sw,
        usedThroughput,
        freeThroughput,
        usedVehicles,
        isFull: isFull || freeThroughput <= 0,
        pctUsed,
      };
    });
  }, [selectedDate]);

  // Handle Date Selection
  const handleDateSelect = (iso) => {
    setSelectedDate(iso);
    if (onSlotChange) {
      onSlotChange(iso, selectedSlot);
    }
  };

  // Handle Slot Selection
  const handleSlotSelect = (slot) => {
    if (slot.isFull) return;
    setSelectedSlot(slot.time);
    if (onSlotChange) {
      onSlotChange(selectedDate, slot.time);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-2.5 pb-2 border-b border-slate-100">
        <div>
          <h4 className="text-lg sm:text-xl font-bold text-[#0F1E36] tracking-tight">
            Smart Slot Booking (2-Hour Window)
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select procurement date &amp; reserve an express weighbridge entry slot
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>Live IoT Queue</span>
        </div>
      </div>

      {/* 1. Horizontal Date Tab Selector */}
      <div className="w-full overflow-hidden">
        <div 
          className="flex gap-2.5 overflow-x-auto snap-x scrollbar-thin scrollbar-thumb-slate-300 pb-2 touch-pan-x"
          role="tablist"
          aria-label="Procurement Dates"
        >
          {dates.map((d) => {
            const isSelected = d.iso === selectedDate;
            return (
              <button
                key={d.iso}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleDateSelect(d.iso)}
                className={`flex-none min-w-[92px] snap-start flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-[#15803d] border-[#15803d] text-white shadow-lg shadow-emerald-700/25 -translate-y-0.5'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {d.dayLabel}
                </span>
                <span className={`text-xl font-extrabold my-0.5 leading-none ${isSelected ? 'text-white' : 'text-[#0F1E36]'}`}>
                  {d.dayNum}
                </span>
                <span className={`text-[11px] font-medium ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                  {d.month}
                </span>
                <span className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSelected 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-200/70 text-slate-600'
                }`}>
                  {d.openSlots} Open
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 2-Hour Time Slot Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs sm:text-sm font-bold text-[#0F1E36]">
            Select 2-Hour Time Window
          </span>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Slot Full
            </span>
          </div>
        </div>

        {/* Responsive Grid: 1 col on mobile (<640px), 2 cols on tablet/desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeSlots.map((slot) => {
            const isSelected = slot.time === selectedSlot && !slot.isFull;

            return (
              <div
                key={slot.id}
                role="button"
                tabIndex={slot.isFull ? -1 : 0}
                onClick={() => handleSlotSelect(slot)}
                className={`relative flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-200 ${
                  slot.isFull
                    ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'bg-emerald-50/70 border-[#15803d] ring-2 ring-[#15803d]/30 shadow-md -translate-y-0.5 cursor-pointer'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 hover:-translate-y-0.5 cursor-pointer shadow-sm'
                }`}
              >
                {/* Active Selection Checkmark Badge */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#15803d] text-white flex items-center justify-center text-xs font-black shadow">
                    ✓
                  </div>
                )}

                {/* Time Window Label & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F1E36]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`w-4 h-4 shrink-0 ${slot.isFull ? 'text-slate-400' : 'text-[#15803d]'}`}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{slot.time}</span>
                  </div>

                  <span
                    className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border ${
                      slot.isFull
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {slot.isFull ? 'SLOT FULL' : `${slot.freeThroughput}q Free`}
                  </span>
                </div>

                {/* Capacity Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      slot.isFull
                        ? 'bg-red-500'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                    }`}
                    style={{ width: `${slot.pctUsed}%` }}
                  />
                </div>

                {/* Throughput & Vehicle Capacity Indicators */}
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Throughput Cap: <strong className="text-slate-800">{slot.usedThroughput}/{slot.maxThroughput} q</strong>
                  </span>
                  <span>
                    Vehicles: <strong className="text-slate-800">{slot.usedVehicles}/{slot.maxVehicles}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority Express RFID Note */}
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <span className="text-amber-500 text-base shrink-0">⚡</span>
        <p>
          Reserved 2-hour slots receive <strong>Priority RFID Gate Access</strong>. Arriving within your confirmed window guarantees weighbridge clearance within 20 minutes.
        </p>
      </div>
    </div>
  );
}
