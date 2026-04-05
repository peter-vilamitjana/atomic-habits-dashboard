import React, { useState, useEffect, useRef } from 'react';

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const DEFAULT_HABITS = [
  {
    id: 'habit-madrugar',
    name: 'Madrugar',
    description: 'Levantarme temprano y dormir temprano',
    metrics: ['Celular afuera del cuarto', 'De pie con la primera alarma', 'En cama a horario'],
    isDefault: true,
  },
  {
    id: 'habit-cocina',
    name: 'Cocina',
    description: 'Limpieza y orden de cocina',
    metrics: ['Cocina lista antes de dormir', 'Desayuno preparado', 'Cierre en 10 min o menos'],
    isDefault: true,
  },
];

const TEMPLATES = {
  study: {
    label: '📚 Estudio',
    tipo: 'Construir',
    habito: 'Estudiar 30 minutos al día',
    identidad: 'Soy alguien que aprende todos los días',
    porQue: 'Quiero crecer profesional y personalmente',
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
    metrics: ['Sesión iniciada', '30 min completados', 'Repaso rápido hecho'],
  },
  room: {
    label: '🏠 Orden de habitación',
    tipo: 'Construir',
    habito: 'Ordenar mi habitación antes de dormir',
    identidad: 'Soy alguien que cuida su entorno',
    porQue: 'Un espacio ordenado me da claridad mental',
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
    metrics: ['Ropa en su lugar', 'Escritorio despejado', 'Cama hecha'],
  },
  running: {
    label: '🏃 Running / Movimiento',
    tipo: 'Construir',
    habito: 'Salir a correr o moverme 20 minutos',
    identidad: 'Soy alguien activo que cuida su cuerpo',
    porQue: 'Quiero más energía y salud a largo plazo',
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
    metrics: ['Zapatillas puestas', 'Salí de casa', '20 min completados'],
  },
  reading: {
    label: '📖 Lectura',
    tipo: 'Construir',
    habito: 'Leer 10 páginas por día',
    identidad: 'Soy alguien que lee todos los días',
    porQue: 'Quiero aprender más y desconectarme de pantallas',
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
    metrics: ['Libro abierto', '10 páginas leídas', 'Nota mental del aprendizaje'],
  },
};

const SYSTEM_PROMPT = `# ROL
Actúa como mi coach de "Atomic Habits" y diseñador de sistemas de comportamiento. Eres experto en hábitos basados en identidad, diseño del entorno, reducción de fricción, consistencia diaria y cambio conductual sostenible.

# MISIÓN
Tu trabajo es ayudarme a construir un hábito o romper uno diseñando un sistema repetible, realista y de baja fricción usando:
- hábitos basados en la identidad;
- las Cuatro Leyes del Cambio de Comportamiento:
  1. Hazlo Obvio
  2. Hazlo Atractivo
  3. Hazlo Fácil
  4. Hazlo Satisfactorio

Prioriza: pequeñas mejoras; claridad conductual; diseño del entorno; ejecución en días de baja energía; consistencia por encima de intensidad; sistemas simples por encima de planes perfectos.

Evita: consejos vagos; motivación vacía; sistemas demasiado ambiciosos; rutinas que dependan de fuerza de voluntad alta; hábitos "ideales" que no encajen con el contexto real.

# REGLAS DE DECISIÓN
1. Si falta información crítica haz supuestos conservadores y continúa.
2. Si el hábito es "romper uno", aplica las leyes inversas: Invisible, Poco Atractivo, Difícil, Insatisfactorio.
3. Diseña el sistema para que funcione también en "días malos".
4. Si el hábito es demasiado grande, redúcelo antes de escalar.
5. Prioriza siempre el cambio de mayor apalancamiento con menor fricción.

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

// No longer using internal COLORS object as we use Tailwind classes and CSS variables in index.css


// ============================================================
// UTILITIES
// ============================================================

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getWeekKey(date = new Date()) {
  const week = getISOWeekNumber(date);
  const year = date.getFullYear();
  if (date.getMonth() === 11 && week === 1) return `${year + 1}-01`;
  if (date.getMonth() === 0 && week > 50) return `${year - 1}-${String(week).padStart(2, '0')}`;
  return `${year}-${String(week).padStart(2, '0')}`;
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
}

function getWeekDatesFromKey(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function loadLS(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : JSON.parse(v);
  } catch { return def; }
}

function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function calcStreak(habitId, habits, checks) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit || habit.metrics.length === 0) return 0;
  const total = habit.metrics.length;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1); // start from yesterday
  for (let i = 0; i < 365; i++) {
    const wk = getWeekKey(d);
    const di = getDayIndex(d);
    const dayChecks = checks[wk]?.[habitId]?.[di] || {};
    const count = Object.values(dayChecks).filter(Boolean).length;
    if (count >= total) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function calcMonthlyStats(habitId, habits, checks, notes) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return { completeDays: 0, pct: 0, streak: 0, bestStreak: 0, notesCount: 0 };
  const total = habit.metrics.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysPassed = today.getDate();

  let completeDays = 0, tempStreak = 0, bestStreak = 0, notesCount = 0;
  for (let d = 1; d <= daysPassed; d++) {
    const date = new Date(year, month, d);
    const wk = getWeekKey(date);
    const di = getDayIndex(date);
    const dayChecks = checks[wk]?.[habitId]?.[di] || {};
    const count = Object.values(dayChecks).filter(Boolean).length;
    const complete = total > 0 && count >= total;
    if (complete) { completeDays++; tempStreak++; bestStreak = Math.max(bestStreak, tempStreak); }
    else tempStreak = 0;
    const dk = getDateKey(date);
    if (notes[dk]?.[habitId]) notesCount++;
  }
  // current streak
  let streak = 0;
  const sd = new Date(today);
  sd.setDate(sd.getDate() - 1);
  for (let i = 0; i < daysPassed; i++) {
    if (sd.getMonth() !== month) break;
    const wk = getWeekKey(sd);
    const di = getDayIndex(sd);
    const dayChecks = checks[wk]?.[habitId]?.[di] || {};
    const count = Object.values(dayChecks).filter(Boolean).length;
    if (total > 0 && count >= total) { streak++; sd.setDate(sd.getDate() - 1); }
    else break;
  }
  const pct = daysPassed > 0 ? Math.round((completeDays / daysPassed) * 100) : 0;
  return { completeDays, pct, streak, bestStreak, notesCount };
}

// ============================================================
// MODAL
// ============================================================

function Modal({ title, message, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="glass-card max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-brand-muted text-sm leading-relaxed mb-8">{message}</p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel} 
            className="px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              danger ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white text-brand-bg hover:bg-brand-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data }) {
  return (
    <div className="flex items-end gap-1 h-8">
      {data.map((active, i) => (
        <div 
          key={i} 
          className={`w-1.5 rounded-full transition-all duration-300 ${
            active 
              ? 'h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' 
              : 'h-[40%] bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, colorClass, trend }) {
  return (
    <div className="glass-card p-6 relative overflow-hidden group">
      <div className="relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1">{label}</span>
        <div className="text-6xl font-bold tracking-tight mb-2">{value}</div>
        {trend && <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">trending_up</span> {trend}
        </div>}
      </div>
      <div className={`absolute top-6 right-6 w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${colorClass}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
    </div>
  );
}


// ============================================================
// PROGRESS BAR
// ============================================================

function ProgressBar({ value, label, showLabel = true }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
          <span className="text-xs font-bold">{pct}%</span>
        </div>
      )}
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}


// ============================================================
// HEADER
// ============================================================

function Header({ theme, setTheme, activeTab, setActiveTab, onResetWeek, onExportPDF }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-6 no-print pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-sky-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="material-symbols-outlined text-white font-bold">bolt</span>
          </div>
          <span className="text-xl font-black tracking-tighter text-white hidden md:block">ATOMIC</span>
        </div>

        {/* Central Nav Pill */}
        <nav className="nav-pill px-2 py-1.5 flex gap-1 items-center">
          {['Dashboard', 'Sistemas', 'Nuevo'].map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === i 
                  ? 'bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/20' 
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full nav-pill flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button 
            onClick={onResetWeek}
            className="w-10 h-10 rounded-full nav-pill flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Reiniciar semana"
          >
            <span className="material-symbols-outlined text-xl text-amber-400">restart_alt</span>
          </button>
          <button 
            onClick={onExportPDF}
            className="px-5 py-2 rounded-full bg-white text-brand-bg text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Exportar
          </button>
        </div>
      </div>
    </header>
  );
}


// ============================================================
// TAB NAV
// ============================================================

// TabNav is now integrated into the Header


// ============================================================
// HABIT CARD
// ============================================================

function HabitCard({ habit, checks, notes, weekDates, currentWeekKey, todayKey, c, onToggleCheck, onUpdateNote, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const streak = calcStreak(habit.id, [habit], checks);
  const todayNote = notes[todayKey]?.[habit.id] || '';
  const weekChecks = checks[currentWeekKey]?.[habit.id] || {};

  // Sparkline data: check if all metrics were done for each day of the current week
  const sparklineData = weekDates.map((_, di) => {
    const dayChecks = weekChecks[di] || {};
    const count = Object.values(dayChecks).filter(Boolean).length;
    return habit.metrics.length > 0 && count >= habit.metrics.length;
  });

  // Calculate progress
  const totalPossibleChecks = habit.metrics.length * 7;
  const actualChecks = habit.metrics.reduce((acc, _, mi) => 
    acc + weekDates.filter((_, di) => weekChecks[di]?.[mi]).length, 0);
  const weeklyProgress = totalPossibleChecks > 0 ? actualChecks / totalPossibleChecks : 0;

  // Monthly progress (simplified for card)
  const monthlyStats = calcMonthlyStats(habit.id, [habit], checks, notes);

  const headerGradients = {
    'habit-madrugar': 'from-[#7c3aed]/80 to-[#a78bfa]/40', // Violet reference
    'habit-cocina': 'from-[#059669]/80 to-[#34d399]/40',   // Emerald/Green reference
    'default': 'from-[#f59e0b]/80 to-[#fbbf24]/40'        // Amber reference for new habits
  };

  const gradientClass = headerGradients[habit.id] || headerGradients['default'];

  return (
    <div className="glass-card overflow-hidden mb-6 flex flex-col group transition-all duration-300 hover:translate-y-[-2px] hover:shadow-2xl">
      {/* Card Header */}
      <div className={`p-6 bg-gradient-to-r ${gradientClass} flex justify-between items-start`}>
        <div>
          <h3 className="text-3xl font-extrabold tracking-tight text-white mb-1 uppercase">{habit.name}</h3>
          <p className="text-white/70 text-xs font-medium max-w-[240px] leading-tight">{habit.description}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Sparkline data={sparklineData} />
          <div className="flex gap-2">
            {!habit.isDefault && (
              <button 
                onClick={() => onDelete(habit.id)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Days & Metrics */}
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-brand-muted pb-2">Métrica</th>
                {weekDates.map((d, di) => (
                  <th key={di} className={`pb-2 text-center`}>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${getDateKey(d) === todayKey ? 'text-white scale-110' : 'text-brand-muted'}`}>
                      {DAYS[di]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habit.metrics.map((metric, mi) => (
                <tr key={mi}>
                  <td className="text-sm font-medium text-brand-primary pr-4 py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
                    {metric}
                  </td>
                  {weekDates.map((d, di) => {
                    const checked = !!weekChecks[di]?.[mi];
                    const isToday = getDateKey(d) === todayKey;
                    const isFuture = d > new Date();
                    return (
                      <td key={di} className="text-center px-1">
                        <div 
                          onClick={() => !isFuture && onToggleCheck(habit.id, di, mi)}
                          className={`mx-auto checkbox-custom ${checked ? 'checked' : ''} ${isToday ? ' ring-1 ring-white/30 scale-105' : ''} ${isFuture ? 'opacity-20 cursor-default' : 'hover:scale-110 active:scale-95'}`}
                        >
                          {checked && <span className="material-symbols-outlined text-sm font-bold text-white">check</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Progress Bars Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProgressBar value={weeklyProgress} label="Progreso Semanal" />
          <ProgressBar value={monthlyStats.pct / 100} label="Progreso Mensual" />
        </div>
      </div>

      {/* Footer Actions & Streak */}
      <div className="mt-auto px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">notes</span>
            Session Notes
          </button>
          {streak > 0 && (
            <div className="px-3 py-1 rounded-full liquid-glass flex items-center gap-1 text-[10px] font-bold text-white tracking-widest uppercase">
              <span className="material-symbols-outlined text-sm text-amber-400">local_fire_department</span>
              {streak} Day Streak
            </div>
          )}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 bg-black/20 animate-in slide-in-from-top-4 duration-300">
          <textarea
            value={todayNote}
            onChange={e => onUpdateNote(habit.id, todayKey, e.target.value)}
            placeholder="Escribe tus notas de hoy aquí..."
            className="w-full bg-transparent border-none text-sm text-brand-primary focus:ring-0 placeholder:text-brand-muted/30 min-h-[80px] resize-none"
          />
        </div>
      )}
    </div>
  );
}


// ============================================================
// MONTHLY STATS
// ============================================================

function MonthlyStats({ habits, checks, notes, open, onToggle }) {
  const today = new Date();
  const monthName = today.toLocaleString('es', { month: 'long', year: 'numeric' });

  return (
    <div className="glass-card overflow-hidden">
      <button 
        onClick={onToggle} 
        className="w-full p-6 text-left flex justify-between items-center hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Detailed Report / {monthName}
        </span>
        <span className={`material-symbols-outlined transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      
      {open && (
        <div className="p-6 border-t border-white/5 space-y-6 animate-in slide-in-from-top-4 duration-300">
          {habits.map(habit => {
            const stats = calcMonthlyStats(habit.id, [habit], checks, notes);
            return (
              <div key={habit.id} className="liquid-glass p-4 rounded-2xl flex flex-wrap gap-8 items-center">
                <div className="min-w-[140px]">
                  <div className="text-xs font-bold text-white uppercase tracking-tight">{habit.name}</div>
                  <div className="text-[10px] text-brand-muted uppercase tracking-widest font-bold">Monthly Focus</div>
                </div>
                <div className="flex flex-wrap gap-8">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black">{stats.pct}%</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-brand-muted">Accuracy</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black">{stats.streak}d</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-brand-muted">Current</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black">{stats.bestStreak}d</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-brand-muted">Best</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ============================================================
// DASHBOARD TAB
// ============================================================

function DashboardTab({ habits, checks, notes, weekDates, currentWeekKey, todayKey, toggleCheck, updateNote, statsOpen, setStatsOpen, onDeleteHabit }) {
  if (habits.length === 0) {
    return (
      <div className="text-center py-24 glass-card p-12">
        <div className="text-6xl mb-6 grayscale group-hover:grayscale-0 transition-all">🌱</div>
        <h3 className="text-2xl font-bold mb-2">No hay hábitos todavía</h3>
        <p className="text-brand-muted text-sm max-w-sm mx-auto mb-8">
          Comienza tu viaje hacia la identidad que deseas construyendo tu primer sistema.
        </p>
      </div>
    );
  }

  // Calculate global stats for the StatCards
  const totalPossibleChecks = habits.reduce((acc, h) => acc + h.metrics.length * 7, 0);
  const totalActualChecks = habits.reduce((acc, h) => {
    const wc = checks[currentWeekKey]?.[h.id] || {};
    return acc + h.metrics.reduce((ma, _, mi) => ma + weekDates.filter((_, di) => wc[di]?.[mi]).length, 0);
  }, 0);
  const globalWeeklyPct = totalPossibleChecks > 0 ? (totalActualChecks / totalPossibleChecks) * 100 : 0;
  
  const activeStreaks = habits.map(h => calcStreak(h.id, [h], checks));
  const maxStreak = activeStreaks.length > 0 ? Math.max(...activeStreaks) : 0;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 3-Column Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Weekly Completion" 
          value={`${Math.round(globalWeeklyPct)}%`} 
          icon="show_chart" 
          colorClass="text-violet-400"
          trend="+5%"
        />
        <StatCard 
          label="Active Streaks" 
          value={maxStreak} 
          icon="local_fire_department" 
          colorClass="text-amber-400"
        />
        <StatCard 
          label="Habits Tracked" 
          value={habits.length} 
          icon="grid_view" 
          colorClass="text-sky-400"
        />
      </section>

      {/* Week Grid Navigator */}
      <section className="flex justify-between items-center bg-white/5 p-4 rounded-[32px] border border-white/5 overflow-x-auto gap-4">
        {weekDates.map((d, di) => {
          const isToday = getDateKey(d) === todayKey;
          return (
            <div 
              key={di} 
              className={`flex-1 min-w-[60px] p-3 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${isToday ? 'bg-white text-brand-bg scale-105 shadow-xl shadow-white/10' : 'hover:bg-white/5 text-brand-muted hover:translate-y-[-2px]'}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">{DAYS[di]}</span>
              <span className="text-lg font-black">{d.getDate()}</span>
            </div>
          );
        })}
      </section>

      {/* Habits List */}
      <section className="space-y-8">
        {habits.map(habit => (
          <HabitCard
            key={habit.id}
            habit={habit}
            checks={checks}
            notes={notes}
            weekDates={weekDates}
            currentWeekKey={currentWeekKey}
            todayKey={todayKey}
            onToggleCheck={toggleCheck}
            onUpdateNote={updateNote}
            onDelete={onDeleteHabit}
          />
        ))}
      </section>

      <MonthlyStats
        habits={habits}
        checks={checks}
        notes={notes}
        open={statsOpen}
        onToggle={() => setStatsOpen(o => !o)}
      />
    </div>
  );
}


// ============================================================
// SYSTEM ACCORDION
// ============================================================

function AccordionSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full py-4 px-6 flex justify-between items-center hover:bg-white/2 transition-colors text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{title}</span>
        <span className={`material-symbols-outlined text-sm transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function SystemCard({ habit, system }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-card overflow-hidden mb-6">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full p-6 text-left flex justify-between items-center hover:bg-white/5 transition-colors"
      >
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{habit.name} Architecture</h3>
          <p className="text-xs text-brand-muted uppercase tracking-widest font-bold">Generated AI System</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full liquid-glass text-[10px] font-bold text-sky-400 tracking-widest uppercase">Verified</div>
          <span className={`material-symbols-outlined transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 animate-in fade-in duration-300">
          <AccordionSection title="Identity & Beliefs">
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border-l-2 border-violet-500 italic text-brand-primary">
                "{system.identityPlan?.statement}"
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Identity Votes</label>
                  <ul className="space-y-1">
                    {system.identityPlan?.votes?.map((v, i) => (
                      <li key={i} className="text-xs flex gap-2"><span className="text-violet-500">•</span> {v}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Daily Evidence</label>
                  <p className="text-xs text-brand-primary">{system.identityPlan?.dailyEvidence}</p>
                </div>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Core Infrastructure (The Four Laws)">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {system.fourLaws?.map((law, i) => (
                 <div key={i} className="liquid-glass p-4 rounded-xl">
                   <div className="text-[8px] font-bold uppercase tracking-widest text-sky-400 mb-2">{law.law}</div>
                   <div className="text-sm font-bold mb-1">{law.action}</div>
                   <div className="text-[10px] text-brand-muted leading-tight">{law.environmentChange}</div>
                 </div>
               ))}
             </div>
          </AccordionSection>

          <AccordionSection title="Friction Engineering">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[8px] font-bold uppercase tracking-widest text-emerald-400 block">Reduce (Building)</label>
                 {system.frictionEngineering?.reduce?.map((r, i) => (
                   <div key={i} className="text-xs p-2 bg-emerald-500/5 rounded border border-emerald-500/10 flex items-center gap-2">
                     <span className="material-symbols-outlined text-xs text-emerald-400">arrow_downward</span> {r}
                   </div>
                 ))}
              </div>
              <div className="space-y-2">
                 <label className="text-[8px] font-bold uppercase tracking-widest text-red-400 block">Increase (Breaking)</label>
                 {system.frictionEngineering?.add?.map((a, i) => (
                   <div key={i} className="text-xs p-2 bg-red-500/5 rounded border border-red-500/10 flex items-center gap-2">
                     <span className="material-symbols-outlined text-xs text-red-400">arrow_upward</span> {a}
                   </div>
                 ))}
              </div>
            </div>
          </AccordionSection>
        </div>
      )}
    </div>
  );
}

function KeyVal({ label, value }) {
  if (!value) return null;
  return (
    <div className="mb-4 last:mb-0">
      <label className="text-[8px] font-bold uppercase tracking-widest text-brand-muted block mb-1">{label}</label>
      <p className="text-sm text-brand-primary">{value}</p>
    </div>
  );
}


// ============================================================
// SYSTEMS TAB
// ============================================================

function SystemsTab({ habits, systems, onGoToAdd }) {
  const habitsWithSystems = habits.filter(h => systems[h.id]);

  if (habitsWithSystems.length === 0) {
    return (
      <div className="text-center py-24 glass-card p-12">
        <div className="text-6xl mb-6 grayscale opacity-20">🤖</div>
        <h3 className="text-2xl font-bold mb-2 text-white">No hay sistemas generados</h3>
        <p className="text-brand-muted text-sm max-w-sm mx-auto mb-8">
          Utiliza la IA para diseñar una arquitectura de comportamiento personalizada para tus nuevos hábitos.
        </p>
        <button 
          onClick={onGoToAdd} 
          className="px-8 py-3 bg-white text-brand-bg rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
        >
          Architect New Habit
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tighter text-white uppercase">Behavior Systems</h2>
        <p className="text-brand-muted text-sm uppercase tracking-widest font-bold mt-1">
          {habitsWithSystems.length} Active Architectures
        </p>
      </div>
      <div className="space-y-6">
        {habitsWithSystems.map(habit => (
          <SystemCard key={habit.id} habit={habit} system={systems[habit.id]} />
        ))}
      </div>
    </div>
  );
}


// ============================================================
// ADD HABIT TAB
// ============================================================

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
  metrics: [''],
};

function AddHabitTab({ onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setFieldErrors(e => ({ ...e, [key]: '' }));
  };

  const applyTemplate = (tpl) => {
    setForm({
      ...EMPTY_FORM,
      ...tpl,
      metrics: tpl.metrics.length > 0 ? tpl.metrics : [''],
    });
    setFieldErrors({});
    setError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.habito.trim()) errors.habito = 'Requerido';
    if (!form.identidad.trim()) errors.identidad = 'Requerido';
    if (!form.porQue.trim()) errors.porQue = 'Requerido';
    if (!form.friccion1.trim()) errors.friccion1 = 'Requerido';
    if (form.metrics.filter(m => m.trim()).length === 0) errors.metrics = 'Agregá al menos una métrica';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generate = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');

    const userMessage = `Tipo de hábito: ${form.tipo}
Hábito: ${form.habito}
Identidad: ${form.identidad}
Por qué es importante: ${form.porQue}
Línea de base actual: ${form.lineaBase || 'No especificada'}
Mis mayores puntos de fricción:
- ${form.friccion1}
- ${form.friccion2 || 'No especificado'}
- ${form.friccion3 || 'No especificado'}
Desencadenantes actuales: ${form.desencadenantes || 'No especificados'}
Tiempo disponible por día: ${form.tiempo || 'No especificado'}
Restricciones: ${form.restricciones || 'Ninguna'}
Entorno: ${form.entorno || 'No especificado'}
Recompensa preferida: ${form.recompensa || 'No especificada'}
Responsabilidad: ${form.responsabilidad || 'No especificada'}`;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

    if (!apiKey) {
      setError('API key no encontrada. Definí VITE_GEMINI_API_KEY en tu archivo .env');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Error ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates[0].content.parts[0].text;

      let system;
      try {
        const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        system = JSON.parse(clean);
      } catch {
        throw new Error('La respuesta de la IA no es JSON válido. Intentá de nuevo.');
      }

      const habitId = `habit-${Date.now()}`;
      const newHabit = {
        id: habitId,
        name: form.habito,
        description: form.identidad,
        metrics: form.metrics.filter(m => m.trim()),
        isDefault: false,
        tipo: form.tipo,
      };

      onAdd(newHabit, system);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || 'Error inesperado. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const addMetric = () => {
    if (form.metrics.length < 5) setForm(f => ({ ...f, metrics: [...f.metrics, ''] }));
  };

  const removeMetric = (i) => {
    if (form.metrics.length > 1) {
      setForm(f => ({ ...f, metrics: f.metrics.filter((_, idx) => idx !== i) }));
    }
  };

  const setMetric = (i, val) => {
    setForm(f => {
      const metrics = [...f.metrics];
      metrics[i] = val;
      return { ...f, metrics };
    });
  };

  const inputClass = (hasError = false) => `w-full px-4 py-3 bg-white/5 border ${hasError ? 'border-red-500' : 'border-white/10'} rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-brand-muted/30`;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-8">
        <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">New Habit Discovery</h2>
        <p className="text-brand-muted text-sm mb-8">Architect your character by adding a new intentional system.</p>

        {/* Templates */}
        <div className="mb-10">
          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-4">Jumpstart Templates</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <button 
                key={key} 
                onClick={() => applyTemplate(tpl)}
                className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 text-xs font-bold transition-all text-brand-primary"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Hábito (Acción Específica) *</label>
            <input 
              value={form.habito} 
              onChange={e => setField('habito', e.target.value)}
              placeholder="Ej: Estudiar 30 minutos al día" 
              className={inputClass(!!fieldErrors.habito)}
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Identidad Basada *</label>
            <input 
              value={form.identidad} 
              onChange={e => setField('identidad', e.target.value)}
              placeholder="Ej: Soy alguien que aprende siempre" 
              className={inputClass(!!fieldErrors.identidad)}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Gran "Por Qué" *</label>
            <input 
              value={form.porQue} 
              onChange={e => setField('porQue', e.target.value)}
              placeholder="Ej: Libertad profesional" 
              className={inputClass(!!fieldErrors.porQue)}
            />
          </div>

          <div className="col-span-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Critical Friction Pt *</label>
            <input 
              value={form.friccion1} 
              onChange={e => setField('friccion1', e.target.value)}
              placeholder="Ej: El teléfono junto a la cama" 
              className={inputClass(!!fieldErrors.friccion1)}
            />
          </div>

          <div className="col-span-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-2">Metrics to Track (1-5) *</label>
            <div className="space-y-3">
              {form.metrics.map((m, i) => (
                <div key={i} className="flex gap-3">
                  <input
                    value={m}
                    onChange={e => setMetric(i, e.target.value)}
                    placeholder="Métrica de éxito..."
                    className={inputClass()}
                  />
                  {form.metrics.length > 1 && (
                    <button onClick={() => removeMetric(i)} className="p-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              ))}
              {form.metrics.length < 5 && (
                <button onClick={addMetric} className="w-full p-3 rounded-2xl border border-dashed border-white/20 text-[10px] font-bold uppercase tracking-widest text-brand-muted hover:border-white/40 transition-colors">
                  + Add Metric Layer
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs">{error}</div>}

        <button 
          onClick={generate} 
          disabled={loading}
          className="w-full mt-10 py-4 bg-white text-brand-bg rounded-full font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined">magic_button</span>
          )}
          {loading ? 'Analyzing Behavior Patterns...' : 'Architect System with AI'}
        </button>
      </div>
    </div>
  );
}


function Spinner() {
  return (
    <div style={{
      width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
      borderTop: '2px solid #fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ============================================================
// APP (main export)
// ============================================================

export default function App() {
  const [theme, setTheme] = useState(() => loadLS('ah_theme', 'dark'));
  const [activeTab, setActiveTab] = useState(0);
  const [habits, setHabits] = useState(() => {
    const saved = loadLS('ah_habits', null);
    return saved === null ? DEFAULT_HABITS : saved;
  });
  const [checks, setChecks] = useState(() => loadLS('ah_checks', {}));
  const [notes, setNotes] = useState(() => loadLS('ah_notes', {}));
  const [systems, setSystems] = useState(() => loadLS('ah_systems', {}));
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);

  // Persist
  useEffect(() => { saveLS('ah_theme', theme); }, [theme]);
  useEffect(() => { saveLS('ah_habits', habits); }, [habits]);
  useEffect(() => { saveLS('ah_checks', checks); }, [checks]);
  useEffect(() => { saveLS('ah_notes', notes); }, [notes]);
  useEffect(() => { saveLS('ah_systems', systems); }, [systems]);

  const currentWeekKey = getWeekKey();
  const weekDates = getWeekDatesFromKey(currentWeekKey);
  const todayKey = getDateKey();

  const toggleCheck = (habitId, dayIdx, metricIdx) => {
    setChecks(prev => {
      const next = { ...prev };
      if (!next[currentWeekKey]) next[currentWeekKey] = {};
      if (!next[currentWeekKey][habitId]) next[currentWeekKey][habitId] = {};
      if (!next[currentWeekKey][habitId][dayIdx]) next[currentWeekKey][habitId][dayIdx] = {};
      next[currentWeekKey][habitId][dayIdx][metricIdx] = !next[currentWeekKey][habitId][dayIdx][metricIdx];
      return next;
    });
  };

  const updateNote = (habitId, dateKey, value) => {
    setNotes(prev => {
      const next = { ...prev };
      if (!next[dateKey]) next[dateKey] = {};
      next[dateKey][habitId] = value;
      return next;
    });
  };

  const resetWeek = () => {
    setChecks(prev => {
      const next = { ...prev };
      delete next[currentWeekKey];
      return next;
    });
    setNotes(prev => {
      const next = { ...prev };
      weekDates.forEach(d => { delete next[getDateKey(d)]; });
      return next;
    });
    setShowResetModal(false);
  };

  const deleteHabit = (habitId) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    setSystems(prev => {
      const next = { ...prev };
      delete next[habitId];
      return next;
    });
    setShowDeleteModal(null);
  };

  const addHabit = (habit, system) => {
    setHabits(prev => [...prev, habit]);
    if (system) setSystems(prev => ({ ...prev, [habit.id]: system }));
    setActiveTab(0);
  };

  return (
    <div className={`${theme} min-h-screen transition-colors duration-500`}>
      <Header
        theme={theme}
        setTheme={setTheme}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetWeek={() => setShowResetModal(true)}
        onExportPDF={() => window.print()}
      />

      <main className="max-w-7xl mx-auto pt-32 pb-24 px-6 relative z-10">
        {activeTab === 0 && (
          <DashboardTab
            habits={habits}
            checks={checks}
            notes={notes}
            weekDates={weekDates}
            currentWeekKey={currentWeekKey}
            todayKey={todayKey}
            toggleCheck={toggleCheck}
            updateNote={updateNote}
            statsOpen={statsOpen}
            setStatsOpen={setStatsOpen}
            onDeleteHabit={(id) => setShowDeleteModal(id)}
          />
        )}
        {activeTab === 1 && (
          <SystemsTab
            habits={habits}
            systems={systems}
            onGoToAdd={() => setActiveTab(2)}
          />
        )}
        {activeTab === 2 && (
          <AddHabitTab onAdd={addHabit} />
        )}
      </main>

      {showResetModal && (
        <Modal
          title="Reset Architecture?"
          message="This will dissolve all current weekly progress. The core systems will remain intact."
          confirmLabel="Dissolve"
          onConfirm={resetWeek}
          onCancel={() => setShowResetModal(false)}
          danger
        />
      )}

      {showDeleteModal && (
        <Modal
          title="Deconstruct System?"
          message="This will permanently delete this habit architecture. This action is irreversible."
          confirmLabel="Deconstruct"
          onConfirm={() => deleteHabit(showDeleteModal)}
          onCancel={() => setShowDeleteModal(null)}
          danger
        />
      )}

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] select-none z-0" 
           style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
  );
}

