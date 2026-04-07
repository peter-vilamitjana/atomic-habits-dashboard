import React, { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const TRACKER_CONFIG = {
  madrugar: {
    rows: [
      { key: 'phone', label: 'Celular afuera', sub: 'a la hora objetivo' },
      { key: 'up',    label: 'De pie con la primera alarma', sub: 'sin negociar' },
      { key: 'bed',   label: 'En cama dentro del rango', sub: 'cerrar bien la noche' },
    ],
  },
  cocina: {
    rows: [
      { key: 'ready',     label: 'Cocina lista', sub: 'bacha + mesada' },
      { key: 'breakfast', label: 'Desayuno preparado', sub: 'taza / base / zona lista' },
      { key: 'under10',   label: 'Cierre en 10 min o menos', sub: 'simple, corto, real' },
    ],
  },
};

// ─────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────

const BA_TZ = 'America/Argentina/Buenos_Aires';

// Devuelve { year, month (1-12), day, dateStr } en zona BA
// El weekday se calcula matemáticamente desde una fecha ancla conocida (lunes fijo),
// para evitar depender de strings localizados que varían por browser/OS.
function getBADateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  // Calcular weekday (0=Dom..6=Sáb) usando epoch math sobre la medianoche UTC del día BA
  const epochDays = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  // 1970-01-01 fue jueves (4). (epochDays + 4) % 7 → 0=Dom
  const weekday = (epochDays + 4) % 7;
  return { year, month, day, weekday, dateStr: `${parts.year}-${parts.month}-${parts.day}` };
}

function getMonday(date = new Date()) {
  const { year, month, day, weekday } = getBADateParts(date);
  // weekday: 0=domingo, 1=lunes, ..., 6=sábado
  // Si es domingo (0), retroceder 6 días para llegar al lunes anterior
  // Si es cualquier otro día, retroceder (weekday - 1) días
  const daysToMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(Date.UTC(year, month - 1, day - daysToMonday));
}

function formatDay(date) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: BA_TZ, weekday: 'short', day: '2-digit' }).format(date);
}

function formatDateRange(start) {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: BA_TZ, day: '2-digit', month: 'short' });
  return `Semana ${fmt.format(start)} – ${fmt.format(end)}`;
}

function ensureStateShape(state) {
  const result = { ...state };
  for (const habit of Object.keys(TRACKER_CONFIG)) {
    if (!result[habit]) result[habit] = {};
    TRACKER_CONFIG[habit].rows.forEach(row => {
      if (!result[habit][row.key]) result[habit][row.key] = Array(7).fill(false);
    });
  }
  return result;
}

// ─────────────────────────────────────────────
// NEW STORAGE LAYER (clave-por-día)
// ─────────────────────────────────────────────

// Formatea un Date como YYYY-MM-DD en zona BA
function formatDateStr(date) {
  return getBADateParts(date).dateStr;
}

function getEffectiveToday() {
  // Corte de día a las 4am BA: antes de las 4am sigue siendo "ayer"
  const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return formatDateStr(d);
}

function getMondayWithOffset(offset = 0) {
  const monday = getMonday();
  monday.setUTCDate(monday.getUTCDate() + offset * 7);
  return monday;
}

function getDateStrForDay(weekOffset, dayIndex) {
  const monday = getMondayWithOffset(weekOffset);
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + dayIndex);
  return formatDateStr(d);
}

function getHabitCheck(habitKey, dateStr) {
  try {
    const raw = localStorage.getItem(`habit-check-${habitKey}-${dateStr}`);
    return raw ? JSON.parse(raw) : { rows: {}, completedCount: 0, totalCount: 0 };
  } catch {
    return { rows: {}, completedCount: 0, totalCount: 0 };
  }
}

function saveHabitCheck(habitKey, rowKey, dateStr, checked) {
  const key = `habit-check-${habitKey}-${dateStr}`;
  const existing = getHabitCheck(habitKey, dateStr);
  const rows = { ...existing.rows, [rowKey]: checked };
  const completedCount = Object.values(rows).filter(Boolean).length;
  const totalCount = TRACKER_CONFIG[habitKey].rows.length;
  localStorage.setItem(key, JSON.stringify({
    date: dateStr,
    habitKey,
    rows,
    completedCount,
    totalCount,
    updatedAt: new Date().toISOString(),
  }));
}

function loadWeekStateNew(weekOffset = 0) {
  const result = {};
  const monday = getMondayWithOffset(weekOffset);
  for (const habitKey of Object.keys(TRACKER_CONFIG)) {
    result[habitKey] = {};
    for (const row of TRACKER_CONFIG[habitKey].rows) {
      result[habitKey][row.key] = Array(7).fill(false);
    }
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const dateStr = formatDateStr(d);
      const dayData = getHabitCheck(habitKey, dateStr);
      for (const row of TRACKER_CONFIG[habitKey].rows) {
        result[habitKey][row.key][i] = dayData.rows[row.key] || false;
      }
    }
  }
  return result;
}

function migrateOldData() {
  if (localStorage.getItem('habit-tracker-migrated-v3')) return;
  const keysToMigrate = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('habit-tracker-v2-')) keysToMigrate.push(k);
  }
  for (const storKey of keysToMigrate) {
    const mondayStr = storKey.replace('habit-tracker-v2-', '');
    const monday = new Date(mondayStr + 'T12:00:00Z');
    if (isNaN(monday.getTime())) continue;
    try {
      const data = JSON.parse(localStorage.getItem(storKey) || '{}');
      for (const habitKey of Object.keys(TRACKER_CONFIG)) {
        if (!data[habitKey]) continue;
        for (const row of TRACKER_CONFIG[habitKey].rows) {
          const dayArray = data[habitKey][row.key] || [];
          dayArray.forEach((checked, dayIndex) => {
            if (checked) {
              const d = new Date(monday);
              d.setUTCDate(monday.getUTCDate() + dayIndex);
              saveHabitCheck(habitKey, row.key, formatDateStr(d), true);
            }
          });
        }
      }
    } catch { /* skip malformed */ }
  }
  localStorage.setItem('habit-tracker-migrated-v3', 'true');
}

// ─────────────────────────────────────────────
// STREAK & STATS UTILITIES
// ─────────────────────────────────────────────

function calcCurrentStreak(habitKey) {
  let date = new Date(getEffectiveToday() + 'T12:00:00Z');
  let streak = 0;
  while (streak <= 365) {
    const dateStr = formatDateStr(date);
    const data = getHabitCheck(habitKey, dateStr);
    if (data.completedCount === 0) break;
    streak++;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return streak;
}

function calcWeekStats(checks) {
  const state = ensureStateShape(checks);
  let done = 0, possible = 0;
  for (const hk of Object.keys(TRACKER_CONFIG)) {
    const rows = TRACKER_CONFIG[hk].rows;
    possible += rows.length * 7;
    rows.forEach(row => {
      (state[hk][row.key] || []).forEach(v => { if (v) done++; });
    });
  }
  const pct = possible === 0 ? 0 : Math.round((done / possible) * 100);
  return { done, possible, pct };
}

function isDayCompleted(dateStr) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.endsWith(dateStr)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.completedCount > 0) return true;
      } catch { /* skip */ }
    }
  }
  return false;
}

function HabitHeatmap({ habitKey }) {
  const today = getEffectiveToday();
  const todayDate = new Date(today + 'T12:00:00Z');
  const year = todayDate.getUTCFullYear();

  const jan1 = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
  const jan1Weekday = getBADateParts(jan1).weekday;
  const daysToMonday = jan1Weekday === 0 ? 6 : jan1Weekday - 1;
  const gridStart = new Date(jan1);
  gridStart.setUTCDate(jan1.getUTCDate() - daysToMonday);

  const totalRows = TRACKER_CONFIG[habitKey].rows.length;

  const dots = [];
  let current = new Date(gridStart);

  while (true) {
    const dateStr = formatDateStr(current);
    const isThisYear = current.getUTCFullYear() === year;

    let type = 'outside';
    if (isThisYear) {
      const data = getHabitCheck(habitKey, dateStr);
      if (data.completedCount === totalRows && data.completedCount > 0) type = 'total';
      else if (data.completedCount > 0) type = 'parcial';
      else type = 'empty';
    }

    dots.push({ id: dateStr, type, dateStr, isToday: dateStr === today });

    // Cortar DESPUÉS de agregar el dot de hoy
    if (dateStr === today) break;

    // Seguridad: no pasar de 400 días
    if (dots.length > 400) break;

    current = new Date(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Padding al final para completar la última columna
  const remainder = dots.length % 7;
  if (remainder !== 0) {
    for (let p = 0; p < 7 - remainder; p++) {
      dots.push({ id: `end-pad-${p}`, type: 'outside', dateStr: null, isToday: false });
    }
  }

  const totalCols = Math.ceil(dots.length / 7);
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const monthLabels = [];
  let lastMonth = -1;
  for (let col = 0; col < totalCols; col++) {
    const dot = dots[col * 7];
    if (dot && dot.type !== 'outside') {
      const m = new Date(dot.dateStr + 'T12:00:00Z').getUTCMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col, label: monthNames[m] });
        lastMonth = m;
      }
    }
  }

  const isMadrugar = habitKey === 'madrugar';
  const accentColor = isMadrugar ? '#bd9dff' : '#6bff8f';
  const accentGlow = isMadrugar ? 'rgba(189,157,255,0.4)' : 'rgba(107,255,143,0.4)';
  const parcialColor = isMadrugar ? 'rgba(189,157,255,0.25)' : 'rgba(107,255,143,0.25)';
  const headerGradient = isMadrugar
    ? 'linear-gradient(90deg, rgba(138,76,252,0.8), rgba(189,157,255,0.3))'
    : 'linear-gradient(90deg, rgba(0,110,47,0.8), rgba(107,255,143,0.3))';
  const title = isMadrugar ? 'MAÑANA' : 'COCINA';

  const DOT = 11;
  const GAP = 4;
  const STEP = DOT + GAP;

  const dotColor = (type) => {
    if (type === 'outside') return 'transparent';
    if (type === 'total') return accentColor;
    if (type === 'parcial') return parcialColor;
    return 'rgba(255,255,255,0.07)';
  };

  return (
    <div style={{
      background: 'rgba(22,31,63,0.6)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '24px',
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
    }}>
      {/* Header con gradiente de color */}
      <div style={{
        background: headerGradient,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'white' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {[
            { color: 'rgba(255,255,255,0.15)', label: 'Sin datos' },
            { color: parcialColor, label: 'Parcial' },
            { color: accentColor, label: 'Total' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>

          {/* Labels meses */}
          <div style={{ position: 'relative', height: '16px', marginLeft: '30px', marginBottom: '4px' }}>
            {monthLabels.map(({ col, label }) => (
              <span key={label} style={{
                position: 'absolute',
                left: `${col * STEP}px`,
                fontSize: '10px', fontWeight: 700, color: '#a6aac0', whiteSpace: 'nowrap',
              }}>{label}</span>
            ))}
          </div>

          {/* Días + dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            {/* Labels L M M J V S D */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, flexShrink: 0, width: '24px' }}>
              {['Lun','','Mié','','Vie','','Dom'].map((d, i) => (
                <div key={i} style={{ height: `${DOT}px`, fontSize: '9px', color: '#a6aac0', fontWeight: 600, lineHeight: `${DOT}px`, textAlign: 'right' }}>{d}</div>
              ))}
            </div>
            {/* Grid por columnas con separadores */}
            <div style={{ display: 'flex', gap: `${GAP}px`, alignItems: 'flex-start' }}>
              {Array.from({ length: totalCols }).map((_, col) => {
                const colDots = dots.slice(col * 7, col * 7 + 7);
                const isFirstColOfMonth = monthLabels.some(m => m.col === col) && col > 0;
                return (
                  <React.Fragment key={col}>
                    {isFirstColOfMonth && (
                      <div style={{
                        width: '1px',
                        height: `${7 * DOT + 6 * GAP}px`,
                        background: 'rgba(255,255,255,0.1)',
                        flexShrink: 0,
                      }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                      {Array.from({ length: 7 }).map((_, row) => {
                        const dot = colDots[row];
                        return (
                          <div key={row} title={dot?.dateStr || ''} style={{
                            width: `${DOT}px`, height: `${DOT}px`,
                            borderRadius: '3px',
                            background: dot ? dotColor(dot.type) : 'transparent',
                            boxShadow: dot?.isToday
                              ? `0 0 0 1.5px ${accentColor}`
                              : dot?.type === 'total' ? `0 0 5px ${accentGlow}` : 'none',
                            flexShrink: 0,
                          }} />
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MonthlyCard() {
  const today = getEffectiveToday();
  const todayDate = new Date(today + 'T12:00:00Z');
  const year = todayDate.getUTCFullYear();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div style={{ marginTop: '32px', width: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.25em', color: '#a6aac0', margin: '0 0 4px' }}>
          Consistencia {year}
        </p>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#e0e4fb' }}>
          Enero → {monthNames[todayDate.getUTCMonth()]} {year}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
        <HabitHeatmap habitKey="madrugar" />
        <HabitHeatmap habitKey="cocina" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────

function calcWeekStatsByOffset(offset) {
  const weekChecks = loadWeekStateNew(offset);
  const state = ensureStateShape(weekChecks);
  let done = 0, possible = 0;
  for (const hk of Object.keys(TRACKER_CONFIG)) {
    const rows = TRACKER_CONFIG[hk].rows;
    possible += rows.length * 7;
    rows.forEach(row => {
      (state[hk][row.key] || []).forEach(v => { if (v) done++; });
    });
  }
  const pct = possible === 0 ? 0 : Math.round((done / possible) * 100);
  return { done, possible, pct };
}

function StatsRow({ checks }) {
  const { done, possible, pct } = calcWeekStats(checks);
  const bestStreak = Math.max(calcCurrentStreak('madrugar'), calcCurrentStreak('cocina'));
  const { pct: pctPrevWeek } = calcWeekStatsByOffset(-1);
  const delta = pct - pctPrevWeek;
  const deltaText = delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : `=`;
  const deltaColor = delta > 0 ? '#6bff8f' : delta < 0 ? '#fb7185' : '#a6aac0';
  return (
    <header className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
      <div className="space-y-1">
        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a6aac0', whiteSpace: 'nowrap' }}>Checks esta semana</p>
        <p style={{ fontSize: '60px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: 'white' }}>{done}</p>
      </div>
      <div className="space-y-1">
        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a6aac0', whiteSpace: 'nowrap' }}>Racha actual</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '60px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: '#bd9dff' }}>{bestStreak}</span>
          <span style={{ fontSize: '20px', fontWeight: 500, color: '#a6aac0' }}>días</span>
        </div>
      </div>
      <div className="space-y-1">
        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a6aac0', whiteSpace: 'nowrap' }}>Completitud semanal</p>
        <p style={{ fontSize: '60px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: '#6bff8f' }}>{pct}%</p>
      </div>
      <div className="space-y-1">
        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a6aac0', whiteSpace: 'nowrap' }}>vs semana anterior</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '60px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', color: deltaColor }}>{deltaText}</span>
        </div>
        <p style={{ fontSize: '11px', color: '#a6aac0', marginTop: '4px' }}>semana pasada: {pctPrevWeek}%</p>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// PROGRESS CARD
// ─────────────────────────────────────────────

const NewHabitCard = ({ habitKey, activeTab, weekOffset, onWeekOffsetChange, checks, onCheck, children }) => {
  if (activeTab === 'sistemas') {
     return children;
  }
  if (activeTab === 'dashboard') {
     const [selectedPastDay, setSelectedPastDay] = React.useState(6);
     React.useEffect(() => {
       setSelectedPastDay(6);
     }, [weekOffset]);

     const streak = calcCurrentStreak(habitKey);
     const title = habitKey === 'madrugar' ? 'MAÑANA' : 'ENFOQUE';
     const headerClass = habitKey === 'madrugar' ? 'bg-gradient-to-r from-[#8a4cfc] to-[#bd9dff]/40' : 'bg-gradient-to-r from-secondary-container to-secondary/40';
     
     const cfg = TRACKER_CONFIG[habitKey];
     const state = ensureStateShape(checks);
     const rows = cfg.rows;
     
     const monday = getMondayWithOffset(weekOffset);
     const todayStr = getEffectiveToday();
     const todayIndex = Array.from({ length: 7 }).findIndex((_, i) => {
       const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i);
       return formatDateStr(d) === todayStr;
     });
     const isCurrentWeek = todayIndex !== -1;
     
     let doneTotal = 0;
     rows.forEach(row => { (state[habitKey][row.key] || []).forEach(v => { if (v) doneTotal++; }); });
     const total = rows.length * 7;
     const pct = total === 0 ? 0 : Math.round((doneTotal / total) * 100);

     const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

     return (
        <div className="glass-card rounded-lg overflow-hidden flex flex-col group transition-all duration-500 hover:shadow-2xl">
          <div className={`px-8 py-5 ${headerClass} flex justify-between items-center`}>
            <h3 className="text-sm font-black tracking-[0.2em] uppercase text-white">{title}</h3>
            <span className="flex items-center gap-1 text-[10px] font-black bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm text-white/90">
              <span className="material-symbols-outlined text-[12px] text-white/60">local_fire_department</span>
              {String(streak).padStart(2, '0')}
            </span>
          </div>
          <div className="p-8 flex flex-col flex-1">
            <div className="space-y-6 mb-10">
              {!isCurrentWeek && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', color: '#a6aac0', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    ✏ Editando semana pasada — seleccioná el día:
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((label, i) => {
                      const d = new Date(getMondayWithOffset(weekOffset));
                      d.setUTCDate(d.getUTCDate() + i);
                      const isSelected = selectedPastDay === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedPastDay(i)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: isSelected ? '1px solid rgba(189,157,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                            background: isSelected ? 'rgba(189,157,255,0.15)' : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#bd9dff' : '#a6aac0',
                            transition: 'all 0.15s',
                            fontFamily: 'inherit',
                          }}
                        >
                          {label} {d.getUTCDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {rows.map(row => {
                 // En semana actual: mostrar el día de hoy
                 // En semana pasada: mostrar el último día con datos, o el domingo (día 6) como default
                 const renderIndex = isCurrentWeek ? todayIndex : selectedPastDay;
                 const isChecked = Boolean(state[habitKey][row.key][renderIndex]);
                 return (
                    <label key={row.key} className="flex items-center justify-between cursor-pointer group/item">
                      <span className="text-lg font-medium text-on-surface">{row.label}</span>
                      <input 
                         type="checkbox" 
                         className="sr-only peer" 
                         checked={isChecked}
                         onChange={e => onCheck(habitKey, row.key, renderIndex, e.target.checked, getDateStrForDay(weekOffset, renderIndex))}
                      />
                      <div className={`w-8 h-8 flex items-center justify-center transition-all ${isChecked ? 'progress-glow' : ''} group-hover/item:border-secondary`} style={{ borderRadius: '50%', border: isChecked ? '2px solid #6bff8f' : '2px solid rgba(255,255,255,0.15)', background: isChecked ? 'rgba(107,255,143,0.1)' : 'rgba(255,255,255,0.03)' }}>
                        <span className={`material-symbols-outlined text-xl ${isChecked ? 'text-secondary' : 'text-transparent'}`} style={isChecked ? {fontVariationSettings: "'FILL' 1"} : {}}>check</span>
                      </div>
                    </label>
                 );
              })}
            </div>
            
            <div className="h-px bg-white/5 w-full mb-8"></div>

            <div style={{ width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr repeat(7, 1fr)', gap: '8px', width: '100%' }} className="mb-8">
                <div className="flex flex-col gap-5 pt-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                   {rows.map(row => <div key={row.key} className="whitespace-nowrap overflow-hidden text-ellipsis mr-2" style={{ lineHeight: '1.2' }}>{row.label.split(' ').slice(0, 2).join(' ')}</div>)}
                </div>
                {weekLabels.map((lbl, i) => {
                   const isColToday = isCurrentWeek && i === todayIndex;
                   const isFuture = isCurrentWeek && i > todayIndex;
                   return (
                     <div key={i} className={`flex flex-col items-center gap-5 ${isFuture ? 'opacity-40' : ''}`} style={isColToday ? { background: 'rgba(124,58,237,0.35)', padding: '12px 0', marginTop: '-12px', borderRadius: '999px', border: '1px solid rgba(167,139,250,0.5)' } : {}}>
                        <span className={`text-[0.6rem] font-bold ${isColToday ? 'font-black' : 'text-on-surface-variant'}`} style={isColToday ? { color: '#a78bfa' } : {}}>{lbl}</span>
                        {rows.map(row => {
                           const dotChecked = Boolean(state[habitKey][row.key][i]);
                           return (
                              <div key={row.key} style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotChecked ? '#6bff8f' : 'rgba(255,255,255,0.05)', boxShadow: dotChecked ? '0 0 10px rgba(107,255,143,0.3)' : 'none' }}></div>
                           );
                        })}
                     </div>
                   );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-3">
                <span className="text-on-surface-variant">Compleción Semanal</span>
                <span className="text-on-surface">{pct}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-secondary progress-glow" style={{width: `${pct}%`, transition: 'width 0.5s'}}></div>
              </div>
              <div className="flex justify-center items-center gap-6">
                <button 
                  onClick={() => onWeekOffsetChange(weekOffset - 1)}
                  disabled={weekOffset <= -4}
                  className="material-symbols-outlined text-sm text-on-surface-variant hover:text-white cursor-pointer"
                >chevron_left</button>
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">{formatDateRange(getMondayWithOffset(weekOffset))}</span>
                <button 
                  onClick={() => onWeekOffsetChange(weekOffset + 1)}
                  disabled={weekOffset >= 0}
                  className="material-symbols-outlined text-sm text-on-surface-variant hover:text-white cursor-pointer"
                >chevron_right</button>
              </div>
            </div>

          </div>
        </div>
     );
  }
  return null;
}

// ─────────────────────────────────────────────
// MADRUGAR SECTION
// ─────────────────────────────────────────────

function MadrugarSection({ checks, onCheck, activeTab, weekOffset, onWeekOffsetChange }) {
  return (
    <NewHabitCard habitKey="madrugar" activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={onWeekOffsetChange} checks={checks} onCheck={onCheck}>
      <section id="madrugar" className="habit">
      <div className="habit-head">
        <div>
          <div className="habit-eyebrow">🌅 Mañanas</div>
          <div className="habit-title">
            <h2>Levantarme temprano y dormir temprano</h2>
            <span className="badge">Hábito de energía</span>
            <span className="badge">Meta: 6:00 AM</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Sistema para proteger la noche, simplificar el cierre del día y ganar la mañana sin depender de fuerza de voluntad.
          </p>
        </div>
        <span className="streak-badge">RACHA: {String(calcCurrentStreak('madrugar')).padStart(2, '0')}</span>
      </div>

      <div className="grid">

        <article className="card cols-6">
          <h3><span className="icon">A</span>Plan de identidad</h3>
          <p><strong>Declaración:</strong> Soy un madrugador que protege la noche para ganar la mañana.</p>
          <ul>
            <li>Dejo el celular cargando fuera del cuarto a las 22:30.</li>
            <li>Cierro la compu y anoto el próximo paso del proyecto antes de las 22:35.</li>
            <li>Me pongo de pie dentro del primer minuto de la alarma y voy directo a la cocina.</li>
          </ul>
          <div className="quote">Hoy voté por ser madrugador cuando ______ a las ______.</div>
        </article>

        {/* Sistema del 1% */}
        <article className="card cols-6">
          <h3><span className="icon">B</span>Sistema del 1%</h3>
          <p><strong>Versión mínima:</strong> a las 22:30 dejo el celular fuera del cuarto y a las 6:00 me pongo de pie y camino hasta la cocina.</p>
          <p><strong>Regla de los dos minutos:</strong> cuando marque 22:30, cierro la compu, dejo el celular lejos de la cama y preparo agua/ropa para la mañana en menos de 2 minutos.</p>
          <div className="pill-list">
            <span className="pill">Celular afuera</span>
            <span className="pill">Compu cerrada</span>
            <span className="pill">Agua lista</span>
            <span className="pill">Ropa lista</span>
            <span className="pill">Cocina directo</span>
          </div>
        </article>

        {/* Plan de aumento */}
        <article className="card cols-12">
          <h3><span className="icon">📈</span>Plan de aumento — 4 semanas</h3>
          <div className="timeline">
            <div className="step"><b>Semana 1</b>Celular afuera 22:45<br />Cama 23:30<br />Alarma 6:50</div>
            <div className="step"><b>Semana 2</b>Celular afuera 22:30<br />Cama 23:15<br />Alarma 6:30</div>
            <div className="step"><b>Semana 3</b>Celular afuera 22:15<br />Cama 23:00<br />Alarma 6:15</div>
            <div className="step"><b>Semana 4</b>Celular afuera 22:00<br />Cama 22:45<br />Alarma 6:00</div>
          </div>
          <div className="footer-note small">
            Regla fija: no se negocia el horario de "celular afuera". Sólo se ajusta 15 minutos por semana.
          </div>
        </article>

        {/* Cuatro Leyes */}
        <article className="card cols-12">
          <h3><span className="icon">C</span>Diseño de las Cuatro Leyes</h3>
          <table>
            <thead>
              <tr>
                <th>Ley</th>
                <th>Qué haré</th>
                <th>Cambio de entorno</th>
                <th>Guion</th>
                <th>Plan B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Ley"><strong>Hazlo Obvio</strong></td>
                <td data-label="Qué haré">Activaré una alarma de cierre a las 22:30 y otra para levantarme a las 6:00.</td>
                <td data-label="Cambio de entorno">Cargador fuera del cuarto, vaso de agua listo, ropa lista, persiana apenas abierta.</td>
                <td data-label="Guion">"No estoy cortando la noche; estoy preparando mi mañana."</td>
                <td data-label="Plan B">Si estoy pasado de hora, igual dejo el celular afuera y me acuesto sin intentar "aprovechar 20 minutos más".</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Atractivo</strong></td>
                <td data-label="Qué haré">Reservaré el mejor desayuno y la mejor calma sólo para la mañana temprana.</td>
                <td data-label="Cambio de entorno">Desayuno premium visible y listo desde la noche anterior.</td>
                <td data-label="Guion">"A las 6:00 me espera mi mejor momento del día."</td>
                <td data-label="Plan B">Si estoy cansado, sólo hago agua + desayuno simple + 10 minutos de calma.</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Fácil</strong></td>
                <td data-label="Qué haré">Reduciré la rutina nocturna a 3 pasos: cerrar compu, cargar celular afuera, preparar mañana.</td>
                <td data-label="Cambio de entorno">Nada de decisiones a la noche; todo listo antes.</td>
                <td data-label="Guion">"Mi trabajo es empezar, no hacerlo perfecto."</td>
                <td data-label="Plan B">Si llego destruido, hago sólo esos 3 pasos y me voy a dormir.</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Satisfactorio</strong></td>
                <td data-label="Qué haré">Marcaré una X apenas cumpla el combo noche + mañana.</td>
                <td data-label="Cambio de entorno">Hoja visible o nota en el celu con 2 casillas.</td>
                <td data-label="Guion">"Ya gané la mañana."</td>
                <td data-label="Plan B">Si no salió perfecto, marco medio punto por cumplir la versión mínima.</td>
              </tr>
            </tbody>
          </table>
        </article>

        {/* Guiones de acumulación */}
        <article className="card cols-6">
          <h3><span className="icon">D</span>Guiones de acumulación</h3>
          <ul className="check">
            <li>Después de cerrar la computadora, dejaré cargando el celular fuera del cuarto a las 22:30 en la cocina.</li>
            <li>Después de lavarme los dientes, me meteré en la cama sin volver a tocar pantallas a las 22:40 en mi cuarto.</li>
            <li>Después de apagar la luz del escritorio, prepararé el vaso de agua y la ropa del día siguiente a las 22:35.</li>
            <li>Después de apagar la alarma, me pondré de pie y caminaré a la cocina a las 6:00.</li>
            <li>Después de servirme el desayuno, abriré la ventana y me quedaré 5 minutos en calma a las 6:05.</li>
          </ul>
        </article>

        {/* Ingeniería de fricción */}
        <article className="card cols-6">
          <h3><span className="icon">E</span>Ingeniería de fricción</h3>
          <p><strong>Eliminar fricción:</strong></p>
          <ul>
            <li>Un único cargador nocturno en la cocina o lejos de la cama.</li>
            <li>Compu cerrada y guardada a las 22:30.</li>
            <li>Desayuno base preparado la noche anterior.</li>
            <li>Modo "No molestar" automático de 22:15 a 6:30.</li>
            <li>Hoja visible con dos casillas: "celular afuera" y "de pie 6:00".</li>
          </ul>
          <p><strong>Agregar fricción al mal hábito:</strong></p>
          <ul>
            <li>Sacar el cargador del dormitorio.</li>
            <li>Bloquear apps tentadoras desde las 22:15.</li>
            <li>Nota arriba de la compu: "Anotá el próximo paso y cerrá".</li>
            <li>Cama = dormir, no scrollear.</li>
            <li>Si agarrás el celular de noche, lo devolvés lejos y hacés 3 respiraciones.</li>
          </ul>
        </article>

        {/* Hazlo atractivo */}
        <article className="card cols-6">
          <h3><span className="icon">F</span>Hazlo atractivo</h3>
          <ul>
            <li><strong>Agrupación de tentaciones:</strong> el mejor desayuno, la música tranquila, el silencio y el contenido que disfrutes van sólo con el combo "celular afuera + levantada 6:00".</li>
            <li><strong>Gravedad social:</strong> check-in silencioso con un amigo, grupo o foto del desayuno antes de las 6:15.</li>
            <li><strong>Refuerzo de identidad:</strong> no "estoy intentando madrugar"; sino "yo cuido la noche porque soy de mañana".</li>
          </ul>
        </article>

        {/* Hazlo satisfactorio */}
        <article className="card cols-6">
          <h3><span className="icon">G</span>Hazlo satisfactorio</h3>
          <ul>
            <li><strong>Recompensa inmediata:</strong> desayuno rico + 10 minutos de paz total sin interrupciones.</li>
            <li><strong>Seguimiento:</strong> dos casillas por día: "celular afuera" y "de pie 6:00".</li>
            <li><strong>Celebración:</strong> "Ya estoy arriba; el día arrancó a mi favor."</li>
          </ul>
        </article>

        {/* A prueba de fallos */}
        <article className="card cols-12">
          <h3><span className="icon">H</span>A prueba de fallos</h3>
          <div className="ifthen">
            <div className="box"><strong>Si me engancho con el celular a la noche</strong>, entonces lo dejo a cargar fuera del cuarto en ese mismo segundo y cierro el día sin negociar.</div>
            <div className="box"><strong>Si me engancho con proyectos en la compu</strong>, entonces anoto el próximo paso en una línea, cierro la tapa y sigo mañana.</div>
            <div className="box"><strong>Si siento que alguien puede invadirme la mañana</strong>, entonces dejo lista una versión mínima de mi rincón de paz en la cocina y arranco igual aunque sea con 10 minutos.</div>
          </div>
          <div className="footer-note small">
            <strong>Regla de no fallar dos veces:</strong> al día siguiente sólo exijo versión mínima obligatoria: celular afuera a horario y cuerpo fuera de la cama con la primera alarma.<br />
            <strong>Ritual de reinicio (2 minutos):</strong> dejo el celular lejos, tomo agua, abro la ventana, respiro 3 veces y preparo la mañana de una.
          </div>
        </article>

        {/* Revisión semanal */}
        <article className="card cols-12">
          <h3><span className="icon">I</span>Revisión semanal</h3>
          <div className="metrics">
            <div className="metric">
              <div className="label">Indicador 1</div>
              <div className="value">Noches con celular afuera a la hora objetivo</div>
            </div>
            <div className="metric">
              <div className="label">Indicador 2</div>
              <div className="value">Mañanas de pie dentro de 1 minuto de la alarma</div>
            </div>
            <div className="metric">
              <div className="label">Indicador 3</div>
              <div className="value">Noches en cama dentro del rango objetivo</div>
            </div>
          </div>
          <ul>
            <li>¿Qué me robó más tiempo a la noche esta semana?</li>
            <li>¿Qué app o conducta rompió más el cierre?</li>
            <li>¿Qué parte de la rutina nocturna puedo hacer todavía más corta?</li>
          </ul>
          <div className="quote">
            Única modificación de la próxima semana: adelantar 15 minutos la hora de "celular afuera" y no tocar nada más.
          </div>
        </article>

      </div>
    </section>
    </NewHabitCard>
  );
}

// ─────────────────────────────────────────────
// COCINA SECTION
// ─────────────────────────────────────────────

function CocinaSection({ checks, onCheck, activeTab, weekOffset, onWeekOffsetChange }) {
  return (
    <NewHabitCard habitKey="cocina" activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={onWeekOffsetChange} checks={checks} onCheck={onCheck}>
      <section id="cocina" className="habit">
      <div className="habit-head kitchen">
        <div>
          <div className="habit-eyebrow">🍳 Orden</div>
          <div className="habit-title">
            <h2>Limpieza de cocina</h2>
            <span className="badge">Hábito de orden</span>
            <span className="badge">Meta: cocina lista</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Sistema corto, realista y sin volverte empleado de la casa: bacha, mesada y desayuno listo.
          </p>
        </div>
        <span className="streak-badge">RACHA: {String(calcCurrentStreak('cocina')).padStart(2, '0')}</span>
      </div>

      <div className="grid">

        <article className="card cols-6">
          <h3><span className="icon">A</span>Plan de identidad</h3>
          <p><strong>Declaración:</strong> Soy un hombre que deja la cocina lista para su mejor mañana.</p>
          <ul>
            <li>Lavo lo que usé antes de salir de la cocina.</li>
            <li>Dejo la bacha y la mesada despejadas antes de dormir.</li>
            <li>Preparo la zona del desayuno para la mañana siguiente.</li>
          </ul>
          <div className="quote">Hoy voté por el orden cuando dejé ______ limpio antes de dormir.</div>
        </article>

        {/* Sistema del 1% */}
        <article className="card cols-6">
          <h3><span className="icon">B</span>Sistema del 1%</h3>
          <p><strong>Versión mínima:</strong> lavo lo que usé, despejo la mesada principal y dejo lista la zona del desayuno en 3 minutos.</p>
          <p><strong>Regla de los dos minutos:</strong> cuando termine el último uso de la cocina a la noche, lavo mi plato/vaso/taza y paso un trapo rápido por la mesada durante 2 minutos.</p>
          <div className="pill-list">
            <span className="pill">Lo mío lavado</span>
            <span className="pill">Bacha despejada</span>
            <span className="pill">Mesada lista</span>
            <span className="pill">Desayuno preparado</span>
          </div>
        </article>

        {/* Plan de aumento */}
        <article className="card cols-12">
          <h3><span className="icon">📈</span>Plan de aumento — 4 semanas</h3>
          <div className="timeline">
            <div className="step"><b>Semana 1</b>Sólo lo mío + mesada principal en 3 minutos.</div>
            <div className="step"><b>Semana 2</b>Lo mío + bacha vacía + mesada en 5 minutos.</div>
            <div className="step"><b>Semana 3</b>Lo anterior + dejar desayuno listo en 7 minutos.</div>
            <div className="step"><b>Semana 4</b>Lo anterior + máximo 10 minutos para ordenar lo común si hay caos.</div>
          </div>
          <div className="footer-note small">
            Regla fija: no te convertís en empleado de la casa; tu zona no negociable es bacha, mesada y desayuno.
          </div>
        </article>

        {/* Cuatro Leyes */}
        <article className="card cols-12">
          <h3><span className="icon">C</span>Diseño de las Cuatro Leyes</h3>
          <table>
            <thead>
              <tr>
                <th>Ley</th>
                <th>Qué haré</th>
                <th>Cambio de entorno</th>
                <th>Guion</th>
                <th>Plan B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Ley"><strong>Hazlo Obvio</strong></td>
                <td data-label="Qué haré">Haré un "cierre de cocina" antes de dormir.</td>
                <td data-label="Cambio de entorno">Esponja, detergente, trapo y secaplatos listos y visibles.</td>
                <td data-label="Guion">"No estoy limpiando por todos; estoy cuidando mi mañana."</td>
                <td data-label="Plan B">Si llego muerto, lavo sólo lo mío, despejo una mesada y dejo el desayuno listo.</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Atractivo</strong></td>
                <td data-label="Qué haré">Lo uniré con música o audio que me guste sólo durante el cierre.</td>
                <td data-label="Cambio de entorno">Playlist de 10 minutos reservada para ese momento.</td>
                <td data-label="Guion">"En 10 minutos me compro paz para mañana."</td>
                <td data-label="Plan B">Si no tengo ganas, pongo un timer de 2 minutos y empiezo por una sola cosa.</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Fácil</strong></td>
                <td data-label="Qué haré">Reduciré el cierre a una zona mínima no negociable.</td>
                <td data-label="Cambio de entorno">Defino una sola zona crítica: bacha + mesada + desayuno.</td>
                <td data-label="Guion">"No necesito dejar todo perfecto; necesito dejarlo listo."</td>
                <td data-label="Plan B">Si la cocina está explotada, apilo lo ajeno prolijo a un costado y limpio sólo mi zona.</td>
              </tr>
              <tr>
                <td data-label="Ley"><strong>Hazlo Satisfactorio</strong></td>
                <td data-label="Qué haré">Haré visible el antes y después.</td>
                <td data-label="Cambio de entorno">Foto rápida o check simple de "cocina lista".</td>
                <td data-label="Guion">"Mañana me lo voy a agradecer."</td>
                <td data-label="Plan B">Si quedó a medias, marco medio punto por haber dejado la zona crítica resuelta.</td>
              </tr>
            </tbody>
          </table>
        </article>

        {/* Guiones de acumulación */}
        <article className="card cols-6">
          <h3><span className="icon">D</span>Guiones de acumulación</h3>
          <ul className="check">
            <li>Después de terminar de cenar, lavaré lo que usé a las 21:30 en la cocina.</li>
            <li>Después de servirme un vaso de agua a la noche, despejaré la mesada principal a las 22:00.</li>
            <li>Después de apagar la computadora, haré el cierre de cocina a las 22:20.</li>
            <li>Después de guardar la comida, dejaré lista la taza y el desayuno de mañana a las 22:25.</li>
            <li>Después de lavarme los dientes, revisaré que la bacha quede vacía a las 22:35.</li>
          </ul>
        </article>

        {/* Ingeniería de fricción */}
        <article className="card cols-6">
          <h3><span className="icon">E</span>Ingeniería de fricción</h3>
          <p><strong>Eliminar fricción:</strong></p>
          <ul>
            <li>Esponja, detergente y trapo siempre en el mismo lugar y listos.</li>
            <li>Secaplatos vacío antes de la noche.</li>
            <li>Bandeja o rincón fijo para dejar armado el desayuno.</li>
            <li>Timer de 5 o 10 minutos.</li>
            <li>Zona mínima no negociable: bacha, mesada principal y desayuno listo.</li>
          </ul>
          <p><strong>Agregar fricción al mal hábito:</strong></p>
          <ul>
            <li>No irte con el plato/vaso en la mano; apoyado = pendiente.</li>
            <li>No conectar el celular a cargar hasta hacer el cierre.</li>
            <li>Cartel visible: "Cocina lista = mañana ganada".</li>
            <li>Si hay caos ajeno, apilarlo prolijo a un costado.</li>
            <li>No empezar algo nuevo en la compu sin hacer la versión mínima de 3 minutos.</li>
          </ul>
        </article>

        {/* Hazlo atractivo */}
        <article className="card cols-6">
          <h3><span className="icon">F</span>Hazlo atractivo</h3>
          <ul>
            <li><strong>Agrupación de tentaciones:</strong> playlist, audio o mini recompensa sólo durante el cierre de cocina.</li>
            <li><strong>Gravedad social:</strong> tu referencia es la gente ordenada que se prepara el terreno antes de dormir.</li>
            <li><strong>Refuerzo de identidad:</strong> no es "me tocó limpiar"; es "yo dejo el escenario listo porque soy un tipo ordenado".</li>
          </ul>
        </article>

        {/* Hazlo satisfactorio */}
        <article className="card cols-6">
          <h3><span className="icon">G</span>Hazlo satisfactorio</h3>
          <ul>
            <li><strong>Recompensa inmediata:</strong> irte a dormir con la cocina visualmente limpia y el desayuno medio armado.</li>
            <li><strong>Seguimiento:</strong> una sola casilla por noche: "cocina lista". Si además quedó desayuno preparado, agregás un "+".</li>
            <li><strong>Celebración:</strong> "Listo, mañana entro y está todo a favor mío."</li>
          </ul>
        </article>

        {/* A prueba de fallos */}
        <article className="card cols-12">
          <h3><span className="icon">H</span>A prueba de fallos</h3>
          <div className="ifthen">
            <div className="box"><strong>Si llego tarde y la cocina está detonada</strong>, entonces hago sólo la zona mínima no negociable durante 5 minutos.</div>
            <div className="box"><strong>Si me da bronca sentir que siempre soy yo</strong>, entonces limpio sólo lo mío + bacha + mesada y apilo prolijo lo demás sin cargarme toda la casa.</div>
            <div className="box"><strong>Si no tengo ganas</strong>, entonces pongo timer de 2 minutos y empiezo por el objeto más grande o más molesto.</div>
          </div>
          <div className="footer-note small">
            <strong>Regla de no fallar dos veces:</strong> la noche siguiente hago sí o sí la versión mínima de 3 minutos, aunque no haga nada más.<br />
            <strong>Ritual de reinicio (2 minutos):</strong> abrís agua caliente, agarrás esponja, limpiás un solo objeto grande, pasás trapo a una mesada y dejás la taza del desayuno lista.
          </div>
        </article>

        {/* Revisión semanal */}
        <article className="card cols-12">
          <h3><span className="icon">I</span>Revisión semanal</h3>
          <div className="metrics">
            <div className="metric">
              <div className="label">Indicador 1</div>
              <div className="value">Noches con cocina lista</div>
            </div>
            <div className="metric">
              <div className="label">Indicador 2</div>
              <div className="value">Noches con desayuno preparado</div>
            </div>
            <div className="metric">
              <div className="label">Indicador 3</div>
              <div className="value">Tiempo real promedio del cierre de cocina</div>
            </div>
          </div>
          <ul>
            <li>¿Qué parte me dio más fiaca: lavar, secar, ordenar o empezar?</li>
            <li>¿Dónde se traba más el cierre: bacha llena, secaplatos ocupado o bronca por limpiar ajeno?</li>
            <li>¿Qué puedo preparar antes para que el cierre dure menos?</li>
          </ul>
          <div className="quote">
            Única modificación de la próxima semana: poner un límite de 10 minutos al cierre y respetar la zona mínima no negociable.
          </div>
        </article>

      </div>
    </section>
    </NewHabitCard>
  );
}

// ─────────────────────────────────────────────
// NUEVO TAB — Generador de sistemas con IA
// ─────────────────────────────────────────────

const TEMPLATES = {
  estudio: {
    tipo: 'Construir',
    habito: 'Estudiar 30 minutos al día',
    identidad: 'Soy alguien que aprende todos los días',
    porQue: 'Quiero crecer profesional y personalmente',
    lineaBase: 'Estudio esporádicamente, sin rutina fija',
    friccion1: 'Me distraigo con el celular',
    friccion2: 'No tengo un horario fijo',
    friccion3: 'Me canso rápido si el tema es difícil',
    desencadenantes: 'Después de cenar, en mi escritorio',
    tiempo: '30 minutos',
    restricciones: 'Solo tengo tiempo a la noche',
    entorno: 'Escritorio en mi cuarto, con celular cerca',
    recompensa: 'Ver un capítulo de serie después',
    responsabilidad: 'Ninguna por ahora',
    metricas: ['Sesión iniciada', '30 min completados', 'Repaso rápido hecho'],
  },
  orden: {
    tipo: 'Construir',
    habito: 'Ordenar mi habitación antes de dormir',
    identidad: 'Soy alguien que cuida su entorno',
    porQue: 'Un espacio ordenado me da claridad mental',
    lineaBase: 'Ordeno solo cuando está muy caótico',
    friccion1: 'Me da pereza al final del día',
    friccion2: 'No sé por dónde empezar cuando está desordenado',
    friccion3: 'Lo postergue hasta que se acumula demasiado',
    desencadenantes: 'Antes de lavarme los dientes',
    tiempo: '10 minutos',
    restricciones: 'Energía baja a la noche',
    entorno: 'Habitación compartida a veces',
    recompensa: 'Acostarme en un cuarto ordenado',
    responsabilidad: 'Ninguna',
    metricas: ['Ropa en su lugar', 'Escritorio despejado', 'Cama hecha'],
  },
  running: {
    tipo: 'Construir',
    habito: 'Salir a correr o moverme 20 minutos',
    identidad: 'Soy alguien activo que cuida su cuerpo',
    porQue: 'Quiero más energía y salud a largo plazo',
    lineaBase: 'Me muevo de forma irregular, sin rutina',
    friccion1: 'No tengo ropa lista',
    friccion2: 'Me cuesta salir cuando hace frío',
    friccion3: 'Lo postergo hasta que se hace tarde',
    desencadenantes: 'Al despertar o al volver a casa',
    tiempo: '20-30 minutos',
    restricciones: 'Clima variable, energía irregular',
    entorno: 'Barrio caminable, parque cerca',
    recompensa: 'Ducha larga después',
    responsabilidad: 'Ninguna',
    metricas: ['Zapatillas puestas', 'Salí de casa', '20 min completados'],
  },
  lectura: {
    tipo: 'Construir',
    habito: 'Leer 10 páginas por día',
    identidad: 'Soy alguien que lee todos los días',
    porQue: 'Quiero aprender más y desconectarme de pantallas',
    lineaBase: 'Leo cuando tengo ganas, muy irregular',
    friccion1: 'El celular compite con el libro',
    friccion2: 'Me quedo dormido leyendo en la cama',
    friccion3: 'No tengo un momento fijo para leer',
    desencadenantes: 'Después del desayuno o antes de dormir',
    tiempo: '15-20 minutos',
    restricciones: 'Cansancio a la noche',
    entorno: 'Libro en mesa de noche, celular cerca',
    recompensa: 'Sentir que aprendí algo',
    responsabilidad: 'Ninguna',
    metricas: ['Libro abierto', '10 páginas leídas', 'Nota del aprendizaje'],
  },
};

const SYSTEM_PROMPT = `# ROL
Actúa como coach de "Atomic Habits" y diseñador de sistemas de comportamiento.

# INSTRUCCIÓN CRÍTICA DE FORMATO
Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes ni después. Sin markdown. Sin bloques de código. Solo el JSON puro.

El JSON debe seguir exactamente esta estructura:
{
  "identityPlan": {
    "statement": "string",
    "votes": ["string", "string", "string"],
    "dailyEvidence": "string"
  },
  "onePercent": {
    "minimumViable": "string",
    "twoMinuteStarter": "string",
    "growthPlan": ["string", "string", "string", "string"]
  },
  "fourLaws": [
    {
      "law": "string",
      "action": "string",
      "environmentChange": "string",
      "script": "string",
      "badDayPlan": "string"
    }
  ],
  "habitStacking": ["string", "string", "string", "string", "string"],
  "frictionEngineering": {
    "reduce": ["string", "string", "string", "string", "string"],
    "add": ["string", "string", "string", "string", "string"]
  },
  "makeAttractive": {
    "temptationBundling": "string",
    "socialGravity": "string",
    "identityReinforcement": "string"
  },
  "makeSatisfying": {
    "immediateReward": "string",
    "trackingPlan": "string",
    "celebrationScript": "string"
  },
  "failsafe": {
    "ifThen": ["string", "string", "string"],
    "neverTwiceRule": "string",
    "resetRitual": "string"
  },
  "weeklyReview": {
    "metrics": ["string", "string", "string"],
    "adjustmentQuestions": ["string", "string", "string"],
    "nextWeekChange": "string"
  }
}`;

function buildUserMessage(f) {
  return `Tipo de hábito: ${f.tipo}
Hábito: ${f.habito}
Identidad: ${f.identidad}
Por qué es importante: ${f.porQue}
Línea de base actual: ${f.lineaBase || 'No especificada'}
Mis mayores puntos de fricción:
- ${f.friccion1}
- ${f.friccion2 || 'No especificada'}
- ${f.friccion3 || 'No especificada'}
Desencadenantes actuales: ${f.desencadenantes || 'No especificados'}
Tiempo disponible por día: ${f.tiempo || 'No especificado'}
Restricciones: ${f.restricciones || 'Ninguna'}
Entorno: ${f.entorno || 'No especificado'}
Recompensa preferida: ${f.recompensa || 'No especificada'}
Responsabilidad: ${f.responsabilidad || 'Ninguna'}`;
}

const EMPTY_FORM = {
  tipo: 'Construir',
  habito: '',
  identidad: '',
  porQue: '',
  lineaBase: '',
  friccion1: '',
  friccion2: '',
  friccion3: '',
  desencadenantes: '',
  tiempo: '',
  restricciones: '',
  entorno: '',
  recompensa: '',
  responsabilidad: '',
};

function NuevoTab({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [metricas, setMetricas] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const applyTemplate = (key) => {
    const t = TEMPLATES[key];
    setForm({
      tipo: t.tipo,
      habito: t.habito,
      identidad: t.identidad,
      porQue: t.porQue,
      lineaBase: t.lineaBase,
      friccion1: t.friccion1,
      friccion2: t.friccion2,
      friccion3: t.friccion3,
      desencadenantes: t.desencadenantes,
      tiempo: t.tiempo,
      restricciones: t.restricciones,
      entorno: t.entorno,
      recompensa: t.recompensa,
      responsabilidad: t.responsabilidad,
    });
    setMetricas([...t.metricas]);
    setFieldErrors({});
    setApiError(null);
  };

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: null }));
  };

  const addMetrica = () => {
    if (metricas.length < 5) setMetricas(prev => [...prev, '']);
  };

  const removeMetrica = (i) => {
    setMetricas(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateMetrica = (i, val) => {
    setMetricas(prev => prev.map((m, idx) => idx === i ? val : m));
    if (fieldErrors.metricas) setFieldErrors(prev => ({ ...prev, metricas: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.tipo) errs.tipo = 'Requerido';
    if (!form.habito.trim()) errs.habito = 'Requerido';
    if (!form.identidad.trim()) errs.identidad = 'Requerido';
    if (!form.porQue.trim()) errs.porQue = 'Requerido';
    if (!form.friccion1.trim()) errs.friccion1 = 'Requerido';
    const validMetricas = metricas.filter(m => m.trim());
    if (validMetricas.length === 0) errs.metricas = 'Agregá al menos una métrica';
    return errs;
  };

  const handleGenerate = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setApiError(null);
    setLoading(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: buildUserMessage(form) }] }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
          }),
        }
      );
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      const clean = text.replace(/```json|```/g, '').trim();
      const system = JSON.parse(clean);

      const id = Date.now().toString();
      const validMetricas = metricas.filter(m => m.trim());

      // Guardar hábito
      const habits = JSON.parse(localStorage.getItem('ah_habits') || '[]');
      habits.push({
        id,
        tipo: form.tipo,
        habito: form.habito,
        identidad: form.identidad,
        metricas: validMetricas,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('ah_habits', JSON.stringify(habits));

      // Guardar sistema
      const systems = JSON.parse(localStorage.getItem('ah_systems') || '{}');
      systems[id] = system;
      localStorage.setItem('ah_systems', JSON.stringify(systems));

      // Limpiar y navegar
      setForm(EMPTY_FORM);
      setMetricas(['']);
      setFieldErrors({});
      onSuccess();
    } catch {
      setApiError('No se pudo generar el sistema. Verificá tu API key o intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (errKey) => ({
    width: '100%',
    background: 'var(--surface)',
    border: `1px solid ${fieldErrors[errKey] ? 'var(--danger)' : 'var(--line)'}`,
    borderRadius: '10px',
    padding: '12px',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color .2s',
    boxSizing: 'border-box',
  });

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: '6px',
    letterSpacing: '.04em',
  };

  const fieldWrap = { display: 'flex', flexDirection: 'column', gap: '0' };
  const errStyle = { color: 'var(--danger)', fontSize: '12px', marginTop: '4px' };

  return (
    <div style={{ paddingBottom: '48px' }}>

      {/* Plantillas */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: '18px',
        padding: '20px 24px',
        marginBottom: '20px',
      }}>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Plantillas rápidas
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'estudio', label: '📚 Estudio' },
            { key: 'orden',   label: '🏠 Orden' },
            { key: 'running', label: '🏃 Running' },
            { key: 'lectura', label: '📖 Lectura' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => applyTemplate(key)}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                border: '1px solid var(--line)',
                background: 'var(--pill-bg)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,.18)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--pill-bg)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: '18px',
        padding: '24px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '18px',
        }}
          className="nuevo-form-grid"
        >
          {/* 1. Tipo */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Tipo de hábito</label>
            <select
              value={form.tipo}
              onChange={e => setField('tipo', e.target.value)}
              style={{ ...inputStyle('tipo'), cursor: 'pointer' }}
            >
              <option value="Construir">Construir</option>
              <option value="Romper">Romper</option>
            </select>
            {fieldErrors.tipo && <span style={errStyle}>{fieldErrors.tipo}</span>}
          </div>

          {/* 2. Hábito */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Hábito *</label>
            <input
              type="text"
              value={form.habito}
              onChange={e => setField('habito', e.target.value)}
              placeholder="ej: Estudiar 30 minutos al día"
              style={inputStyle('habito')}
            />
            {fieldErrors.habito && <span style={errStyle}>{fieldErrors.habito}</span>}
          </div>

          {/* 3. Identidad */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Identidad *</label>
            <input
              type="text"
              value={form.identidad}
              onChange={e => setField('identidad', e.target.value)}
              placeholder="ej: Soy alguien que aprende todos los días"
              style={inputStyle('identidad')}
            />
            {fieldErrors.identidad && <span style={errStyle}>{fieldErrors.identidad}</span>}
          </div>

          {/* 4. Por qué */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Por qué es importante *</label>
            <input
              type="text"
              value={form.porQue}
              onChange={e => setField('porQue', e.target.value)}
              placeholder="ej: Quiero crecer profesionalmente"
              style={inputStyle('porQue')}
            />
            {fieldErrors.porQue && <span style={errStyle}>{fieldErrors.porQue}</span>}
          </div>

          {/* 5. Línea de base */}
          <div style={{ ...fieldWrap, gridColumn: 'span 2' }}>
            <label style={labelStyle}>Línea de base actual</label>
            <textarea
              value={form.lineaBase}
              onChange={e => setField('lineaBase', e.target.value)}
              placeholder="ej: Estudio esporádicamente, sin rutina fija"
              rows={2}
              style={{ ...inputStyle('lineaBase'), resize: 'vertical' }}
            />
          </div>

          {/* 6. Fricción 1 */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Fricción 1 *</label>
            <input
              type="text"
              value={form.friccion1}
              onChange={e => setField('friccion1', e.target.value)}
              placeholder="ej: Me distraigo con el celular"
              style={inputStyle('friccion1')}
            />
            {fieldErrors.friccion1 && <span style={errStyle}>{fieldErrors.friccion1}</span>}
          </div>

          {/* 7. Fricción 2 */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Fricción 2</label>
            <input
              type="text"
              value={form.friccion2}
              onChange={e => setField('friccion2', e.target.value)}
              placeholder="ej: No tengo un horario fijo"
              style={inputStyle('friccion2')}
            />
          </div>

          {/* 8. Fricción 3 */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Fricción 3</label>
            <input
              type="text"
              value={form.friccion3}
              onChange={e => setField('friccion3', e.target.value)}
              placeholder="ej: Me canso rápido si el tema es difícil"
              style={inputStyle('friccion3')}
            />
          </div>

          {/* 9. Desencadenantes */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Desencadenantes</label>
            <textarea
              value={form.desencadenantes}
              onChange={e => setField('desencadenantes', e.target.value)}
              placeholder="ej: Después de cenar, en mi escritorio"
              rows={2}
              style={{ ...inputStyle('desencadenantes'), resize: 'vertical' }}
            />
          </div>

          {/* 10. Tiempo */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Tiempo disponible / día</label>
            <input
              type="text"
              value={form.tiempo}
              onChange={e => setField('tiempo', e.target.value)}
              placeholder="ej: 30 minutos"
              style={inputStyle('tiempo')}
            />
          </div>

          {/* 11. Restricciones */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Restricciones</label>
            <textarea
              value={form.restricciones}
              onChange={e => setField('restricciones', e.target.value)}
              placeholder="ej: Solo tengo tiempo a la noche"
              rows={2}
              style={{ ...inputStyle('restricciones'), resize: 'vertical' }}
            />
          </div>

          {/* 12. Entorno */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Entorno</label>
            <textarea
              value={form.entorno}
              onChange={e => setField('entorno', e.target.value)}
              placeholder="ej: Escritorio en mi cuarto, con celular cerca"
              rows={2}
              style={{ ...inputStyle('entorno'), resize: 'vertical' }}
            />
          </div>

          {/* 13. Recompensa */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Recompensa preferida</label>
            <input
              type="text"
              value={form.recompensa}
              onChange={e => setField('recompensa', e.target.value)}
              placeholder="ej: Ver un capítulo de serie después"
              style={inputStyle('recompensa')}
            />
          </div>

          {/* 14. Responsabilidad */}
          <div style={fieldWrap}>
            <label style={labelStyle}>Responsabilidad</label>
            <input
              type="text"
              value={form.responsabilidad}
              onChange={e => setField('responsabilidad', e.target.value)}
              placeholder="ej: Ninguna por ahora"
              style={inputStyle('responsabilidad')}
            />
          </div>
        </div>

        {/* Métricas */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
          <label style={{ ...labelStyle, marginBottom: '4px' }}>Métricas de seguimiento</label>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--muted)' }}>
            Aparecerán en el tracker · mínimo 1, máximo 5
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {metricas.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={m}
                  onChange={e => updateMetrica(i, e.target.value)}
                  placeholder="ej: Celular afuera del cuarto"
                  style={{ ...inputStyle('metricas'), flex: 1 }}
                />
                {metricas.length > 1 && (
                  <button
                    onClick={() => removeMetrica(i)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      border: '1px solid var(--line)', background: 'var(--surface)',
                      color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
          {fieldErrors.metricas && <span style={errStyle}>{fieldErrors.metricas}</span>}
          {metricas.length < 5 && (
            <button
              onClick={addMetrica}
              style={{
                marginTop: '10px',
                padding: '6px 16px',
                borderRadius: '999px',
                border: '1px solid var(--line)',
                background: 'var(--pill-bg)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '13px',
              }}
            >+ Agregar métrica</button>
          )}
        </div>
      </div>

      {/* Botón generar */}
      {apiError && (
        <p style={{ color: 'var(--danger)', fontSize: '14px', margin: '0 0 12px' }}>{apiError}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          width: '100%',
          background: loading ? 'rgba(124,58,237,.4)' : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          border: 'none',
          borderRadius: '12px',
          padding: '16px',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'opacity .2s',
        }}
      >
        {loading ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generando tu sistema...
          </>
        ) : (
          '✨ Generar sistema con IA'
        )}
      </button>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .nuevo-form-grid { grid-template-columns: 1fr !important; }
          .nuevo-form-grid > div[style*="span 2"] { grid-column: span 1 !important; }
        }
        .nuevo-form-grid input:focus,
        .nuevo-form-grid textarea:focus,
        .nuevo-form-grid select:focus {
          border-color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('habit-theme-v2') || 'dark');
  const [weekOffset, setWeekOffset] = useState(0);
  const [checks, setChecks] = useState(() => {
    migrateOldData();
    return loadWeekStateNew(0);
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem('habit-tracker-onboarded'));
  const [importError, setImportError] = useState(null);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('habit-theme-v2', theme);
  }, [theme]);

  useEffect(() => {
    setChecks(loadWeekStateNew(weekOffset));
  }, [weekOffset]);

  const handleCheck = useCallback((habitKey, metricKey, dayIndex, value, dateStr) => {
    saveHabitCheck(habitKey, metricKey, dateStr, value);
    setChecks(prev => {
      const next = ensureStateShape({ ...prev });
      next[habitKey] = { ...next[habitKey] };
      next[habitKey][metricKey] = [...next[habitKey][metricKey]];
      next[habitKey][metricKey][dayIndex] = value;
      return next;
    });
  }, []);

  const handleReset = () => {
    if (window.confirm('Esto borra los checks de la semana actual. ¿Seguimos?')) {
      const monday = getMondayWithOffset(weekOffset);
      for (const habitKey of Object.keys(TRACKER_CONFIG)) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setUTCDate(monday.getUTCDate() + i);
          const dateStr = formatDateStr(d);
          localStorage.removeItem(`habit-check-${habitKey}-${dateStr}`);
        }
      }
      setChecks(loadWeekStateNew(weekOffset));
    }
  };

  const handleExport = () => {
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('habit-check-') || key.startsWith('habit-tracker'))) {
        allData[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitos-backup-${getEffectiveToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Esto va a reemplazar tus datos actuales. ¿Continuás?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
        setChecks(loadWeekStateNew(weekOffset));
        setImportError(null);
      } catch {
        setImportError('El archivo no es válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const dismissBanner = () => {
    localStorage.setItem('habit-tracker-onboarded', 'true');
    setShowBanner(false);
  };

  return (
    <div className="wrap">

      {/* Floating Navbar */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-[90%] max-w-2xl px-6 py-3 nav-pill rounded-full shadow-2xl transition-all">
        <div className="flex items-center">
          <span className="text-sm font-black tracking-[0.2em] uppercase text-on-surface">HABITUS</span>
        </div>
        <div className="flex gap-6 items-center">
          <button 
             onClick={() => setActiveTab('dashboard')} 
             className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'dashboard' ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant hover:text-on-surface'}`}
          >Dashboard</button>
          <button 
             onClick={() => setActiveTab('sistemas')}
             className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'sistemas' ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant hover:text-on-surface'}`}
          >Sistemas</button>
          <button 
             onClick={() => setActiveTab('nuevo')}
             className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'nuevo' ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant hover:text-on-surface'}`}
          >Nuevo</button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="material-symbols-outlined text-on-surface-variant hover:text-on-surface text-lg">dark_mode</button>
          
          <div className="relative group/menu">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-on-surface text-lg">more_vert</button>
            <div className="absolute right-0 mt-2 w-48 bg-surface-variant rounded-xl border border-white/10 shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all flex flex-col overflow-hidden">
               <button className="px-4 py-3 text-left text-xs font-semibold hover:bg-white/5 text-on-surface" onClick={handleExport}>Exportar JSON</button>
               <button className="px-4 py-3 text-left text-xs font-semibold hover:bg-white/5 text-on-surface" onClick={handleReset}>Reiniciar semana</button>
               <label className="px-4 py-3 text-left text-xs font-semibold hover:bg-white/5 text-on-surface cursor-pointer">
                  Importar JSON
                  <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
               </label>
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer for fixed nav */}
      <div className="h-24"></div>

      {/* ── Banner primera visita ── */}
      {showBanner && activeTab === 'dashboard' && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '12px 18px',
          margin: '16px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ flex: 1, fontSize: '14px' }}>
            💾 Tus datos viven en este navegador. Exportalos cada semana para no perderlos.
          </span>
          <button className="btn primary" onClick={() => { handleExport(); dismissBanner(); }}>Exportar ahora</button>
          <button className="btn" onClick={dismissBanner}>Entendido</button>
        </div>
      )}
      {importError && (
        <div style={{ color: 'red', padding: '8px 0', fontSize: '13px' }}>{importError}</div>
      )}

      {/* ── Tab Nuevo ── */}
      {activeTab === 'nuevo' && (
        <NuevoTab onSuccess={() => setActiveTab('dashboard')} />
      )}

      {/* ── Stats row (dashboard only) ── */}
      {activeTab === 'dashboard' && <StatsRow checks={checks} />}

      {/* ── Habit sections ── */}
      {activeTab === 'dashboard' && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', width: '100%', marginBottom: '64px' }} className="habit-cards-grid">
            <MadrugarSection checks={checks} onCheck={handleCheck} activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
            <CocinaSection checks={checks} onCheck={handleCheck} activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
          </section>
          <MonthlyCard />
        </>
      )}
      {activeTab === 'sistemas' && (
        <>
          <MadrugarSection checks={checks} onCheck={handleCheck} activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
          <CocinaSection checks={checks} onCheck={handleCheck} activeTab={activeTab} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
        </>
      )}


    </div>
  );
}
