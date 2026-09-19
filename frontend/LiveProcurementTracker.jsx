import React from 'react';

/**
 * Standard MandiMitra 5-Stage Procurement Pipeline
 */
export const MANDIMITRA_STAGES = [
  { id: 1, key: 'SLOT_BOOKED', title: 'Slot Booked', time: '10:15 AM' },
  { id: 2, key: 'REACHED_CENTER', title: 'Reached Center', time: '11:30 AM' },
  { id: 3, key: 'QUALITY_CHECK', title: 'Quality Check', time: '12:10 PM' },
  { id: 4, key: 'WEIGHED', title: 'Weighed (कांटा)', time: 'In Progress' },
  { id: 5, key: 'PAYMENT_SENT', title: 'Payment Sent', time: 'Pending' },
];

/**
 * LiveProcurementTracker (React Component)
 *
 * @param {number} currentStepIndex - 0-based active step index (e.g., 3 for Stage 4: Weighed)
 * @param {string} currentStatus - Optional backend status string (e.g., 'WEIGHED', 'in_progress')
 * @param {Array} stages - Optional custom stage array
 * @param {Function} onSync - Optional callback for "Sync Status" button
 */
export default function LiveProcurementTracker({
  currentStepIndex = 0, // 0-based: 0 = Stage 1 (Slot Booked), default starting point
  currentStatus,
  stages = MANDIMITRA_STAGES,
  onSync,
}) {
  // If backend status string is provided, calculate active index dynamically from key
  // Otherwise fall back to the 0-based currentStepIndex prop
  const activeIndex = currentStatus
    ? Math.max(0, stages.findIndex(s => s.key === currentStatus || s.status === currentStatus))
    : currentStepIndex;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      {/* Tracker Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Live Procurement Tracker
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Real-time status of your crop token from gate arrival to bank payment disbursement.
          </p>
        </div>
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 rounded-lg transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Sync Status
          </button>
        )}
      </div>

      {/* Stepper Track */}
      <div className="py-8 px-2 md:px-6">
        <div className="flex items-center justify-between relative">
          {stages.map((stage, idx) => {
            // Determine dynamic status: completed, in_progress, or pending
            const status =
              stage.status ||
              (idx < activeIndex
                ? 'completed'
                : idx === activeIndex
                ? 'in_progress'
                : 'pending');

            const isLast = idx === stages.length - 1;

            return (
              <React.Fragment key={stage.id || idx}>
                {/* Step Node */}
                <div className="flex flex-col items-center relative z-10 select-none">
                  {/* Circle Node Indicator */}
                  <div
                    className={`
                      relative flex items-center justify-center w-11 h-11 rounded-full font-bold text-sm transition-all duration-300
                      ${
                        status === 'completed'
                          ? 'bg-emerald-700 border-2 border-emerald-700 text-white shadow-md shadow-emerald-700/25'
                          : ''
                      }
                      ${
                        status === 'in_progress'
                          ? 'bg-slate-900 border-2 border-emerald-500 text-amber-400 ring-4 ring-emerald-500/35 ring-offset-2 scale-105'
                          : ''
                      }
                      ${
                        status === 'pending'
                          ? 'bg-slate-100 border-2 border-slate-200 text-slate-400'
                          : ''
                      }
                    `}
                  >
                    {/* Active Blinking / Pulsing Radar Wave (ONLY applied when status === 'in_progress') */}
                    {status === 'in_progress' && (
                      <span className="absolute -inset-2 rounded-full border-2 border-emerald-500/70 animate-ping pointer-events-none" />
                    )}

                    {/* Step Icon or Step Number */}
                    {status === 'completed' ? (
                      <svg
                        className="w-5 h-5 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Titles & Timestamps */}
                  <div className="mt-3 text-center flex flex-col items-center">
                    <span
                      className={`text-xs md:text-sm font-semibold transition-colors ${
                        status === 'completed'
                          ? 'text-emerald-800'
                          : status === 'in_progress'
                          ? 'text-slate-900 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {stage.title}
                    </span>
                    <span
                      className={`text-[11px] font-medium mt-0.5 ${
                        status === 'in_progress'
                          ? 'text-emerald-600 font-bold animate-pulse'
                          : 'text-slate-400'
                      }`}
                    >
                      {status === 'in_progress'
                        ? 'In Progress'
                        : status === 'completed'
                        ? stage.time
                        : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Connecting Line */}
                {!isLast && (
                  <div
                    className={`flex-1 h-1 -mt-7 mx-1 transition-all duration-500 rounded-full ${
                      idx < activeIndex
                        ? 'bg-emerald-600'
                        : idx === activeIndex
                        ? 'bg-gradient-to-r from-emerald-600 to-slate-200'
                        : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Dynamic Stage Details Banner Card */}
      {(() => {
        const stageBanners = {
          0: {
            icon: '📅',
            headline: 'Stage 1: Slot Confirmed & QR Pass Issued',
            desc: 'Your designated time window is locked. Please bring your QR Token Pass and Original Land Record document to the APMC Gate Entry.',
            action: 'Download QR Pass'
          },
          1: {
            icon: '🚜',
            headline: 'Stage 2: Arrival at APMC Yard Gate Verified',
            desc: 'Gate sensor verified vehicle entry. Proceed to Inspection Bay 3 for electronic moisture and grain impurity testing.',
            action: 'View Entry Gate Slip'
          },
          2: {
            icon: '🔬',
            headline: 'Stage 3: Grain Quality & Moisture Inspection',
            desc: 'Quality inspector is testing moisture percentage. Permissible standard for MSP clearance is <= 12.0%.',
            action: 'Inspection Report'
          },
          3: {
            icon: '⚖️',
            headline: 'Stage 4: Automated Digital Weighbridge (Kanta #2)',
            desc: 'Vehicle has entered the digital weighbridge. Gross weight calculation is streaming from IoT sensors. Direct DBT clearance will trigger after tare subtraction.',
            action: 'View Digital Slip'
          },
          4: {
            icon: '💳',
            headline: 'Stage 5: Payment Disbursed via Direct Benefit Transfer (DBT)',
            desc: 'Procurement completed! Total settlement credit has been triggered directly to your Aadhaar-seeded Bank Account.',
            action: 'View DBT Receipt'
          }
        };

        const activeBanner = stageBanners[activeIndex] || stageBanners[0];

        return (
          <div className="mt-4 p-4 md:p-5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-md">
            <div className="flex items-start gap-3.5">
              <span className="text-2xl p-2 bg-slate-800 rounded-lg flex-shrink-0" role="img" aria-label="stage-icon">
                {activeBanner.icon}
              </span>
              <div>
                <h4 className="text-sm md:text-base font-bold text-amber-400">
                  {activeBanner.headline}
                </h4>
                <p className="text-xs md:text-sm text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  {activeBanner.desc}
                </p>
              </div>
            </div>
            {activeBanner.action && (
              <button
                type="button"
                onClick={() => alert(`${activeBanner.headline}\n${activeBanner.desc}`)}
                className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition-all active:scale-95 whitespace-nowrap"
              >
                {activeBanner.action}
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
