import { useState, useEffect, useCallback } from 'react';

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

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit' }).format(date);
}

function formatDateRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' });
  return `Semana ${fmt.format(start)} – ${fmt.format(end)}`;
}

function weekKey() {
  const monday = getMonday();
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey() {
  return `habit-tracker-v2-${weekKey()}`;
}

// ─────────────────────────────────────────────
// STATE PERSISTENCE
// ─────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey())) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
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
// STREAK & STATS UTILITIES
// ─────────────────────────────────────────────

function calcHabitWeekStreak(habitKey, checks) {
  const state = ensureStateShape(checks);
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // 0=Mon…6=Sun
  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) {
    const rows = TRACKER_CONFIG[habitKey].rows;
    const anyChecked = rows.some(row => state[habitKey]?.[row.key]?.[i]);
    if (anyChecked) streak++;
    else break;
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
  const bestStreak = Math.max(
    calcHabitWeekStreak('madrugar', checks),
    calcHabitWeekStreak('cocina', checks)
  );
  return { done, possible, pct, bestStreak };
}

// ─────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────

function StatsRow({ checks }) {
  const { done, possible, pct, bestStreak } = calcWeekStats(checks);
  return (
    <div className="stat-section">
      <div className="stat-card">
        <div className="stat-card-top">
          <div>
            <span className="stat-card-label">Volumen</span>
            <span className="stat-card-title">Checks esta semana</span>
          </div>
          <div className="stat-card-icon" style={{ color: '#a78bfa' }}>📊</div>
        </div>
        <div>
          <div className="stat-card-value">
            <span className="stat-card-number">{done}</span>
            <span className="stat-card-unit">/ {possible}</span>
          </div>
          {done > 0 && <div className="stat-card-trend">↑ {pct}% de completitud</div>}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-top">
          <div>
            <span className="stat-card-label">Consistencia</span>
            <span className="stat-card-title">Racha actual</span>
          </div>
          <div className="stat-card-icon" style={{ color: '#fbbf24' }}>⚡</div>
        </div>
        <div>
          <div className="stat-card-value">
            <span className="stat-card-number">{bestStreak}</span>
            <span className="stat-card-unit">días</span>
          </div>
          {bestStreak > 0 && <div className="stat-card-trend">↑ Sin cortar la racha</div>}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card-top">
          <div>
            <span className="stat-card-label">Eficiencia</span>
            <span className="stat-card-title">Completitud semanal</span>
          </div>
          <div className="stat-card-icon" style={{ color: '#38bdf8' }}>🎯</div>
        </div>
        <div>
          <div className="stat-card-value">
            <span className="stat-card-number">{pct}</span>
            <span className="stat-card-unit">%</span>
          </div>
          {pct >= 50 && <div className="stat-card-trend">↑ Por encima del 50%</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRESS CARD
// ─────────────────────────────────────────────

function ProgressCard({ title, done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="progress-card">
      <div className="progress-top">
        <div className="title">{title}</div>
        <div className="val">{done}/{total} · {pct}%</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WEEKLY TRACKER
// ─────────────────────────────────────────────

function WeeklyTracker({ habitKey, checks, onCheck }) {
  const monday = getMonday();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const cfg = TRACKER_CONFIG[habitKey];
  const state = ensureStateShape(checks);

  const rows = cfg.rows;
  let doneTotal = 0;
  rows.forEach(row => {
    (state[habitKey][row.key] || []).forEach(v => { if (v) doneTotal++; });
  });

  const rowCounts = {};
  rows.forEach(row => {
    rowCounts[row.key] = (state[habitKey][row.key] || []).filter(Boolean).length;
  });

  const progressCards = habitKey === 'madrugar'
    ? [
        { title: 'Progreso total de la semana', done: doneTotal, total: rows.length * 7 },
        { title: 'Celular afuera a horario', done: rowCounts.phone || 0, total: 7 },
        { title: 'De pie con la primera alarma', done: rowCounts.up || 0, total: 7 },
      ]
    : [
        { title: 'Progreso total de la semana', done: doneTotal, total: rows.length * 7 },
        { title: 'Cocina lista', done: rowCounts.ready || 0, total: 7 },
        { title: 'Desayuno preparado', done: rowCounts.breakfast || 0, total: 7 },
      ];

  const tipText = habitKey === 'madrugar'
    ? 'Meta mínima: celular afuera + de pie con la primera alarma'
    : 'Zona mínima: bacha + mesada + desayuno';

  return (
    <>
      <div className="status-row">
        <span className="status-chip">{formatDateRange(monday)}</span>
        <span className="status-chip">{tipText}</span>
      </div>

      {/* Header row */}
      <div className="tracker-grid">
        <div className="tracker-head">
          <strong>Acción</strong>
          Semana actual
        </div>
        {days.map((date, i) => (
          <div key={i} className="tracker-head">
            <strong>{formatDay(date).replace('.', '')}</strong>
            {String(date.getDate()).padStart(2, '0')}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {cfg.rows.map(row => (
        <div key={row.key} className="tracker-row tracker-grid">
          <div className="tracker-label">
            {row.label}
            <span>{row.sub}</span>
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="tracker-cell">
              <input
                type="checkbox"
                checked={Boolean(state[habitKey]?.[row.key]?.[i])}
                onChange={e => onCheck(habitKey, row.key, i, e.target.checked)}
                aria-label={`${row.label} día ${i + 1}`}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Progress bars */}
      <div className="progress-wrap">
        {progressCards.map((pc, i) => (
          <ProgressCard key={i} title={pc.title} done={pc.done} total={pc.total} />
        ))}
      </div>

      <p className="print-tip">
        Para el PDF: tocá <strong>Exportar PDF</strong> y en la ventana del navegador elegí <strong>Guardar como PDF</strong>.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────
// MADRUGAR SECTION
// ─────────────────────────────────────────────

function MadrugarSection({ checks, onCheck, activeTab }) {
  const streak = calcHabitWeekStreak('madrugar', checks);
  return (
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
        <span className="streak-badge">RACHA: {String(streak).padStart(2, '0')}</span>
      </div>

      <div className="grid">

        {/* Tracker */}
        <div style={{ display: activeTab === 'dashboard' ? 'contents' : 'none' }}>
          <article className="card cols-12">
            <h3><span className="icon">✓</span>Tracker semanal interactivo</h3>
            <p className="muted">Tildá sólo lo que realmente hiciste. El progreso se actualiza solo y queda guardado en este navegador.</p>
            <WeeklyTracker habitKey="madrugar" checks={checks} onCheck={onCheck} />
          </article>
        </div>

        {/* Sistemas Cards */}
        <div style={{ display: activeTab === 'sistemas' ? 'contents' : 'none' }}>
          {/* Plan de identidad */}
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

      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// COCINA SECTION
// ─────────────────────────────────────────────

function CocinaSection({ checks, onCheck, activeTab }) {
  const streak = calcHabitWeekStreak('cocina', checks);
  return (
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
        <span className="streak-badge">RACHA: {String(streak).padStart(2, '0')}</span>
      </div>

      <div className="grid">

        {/* Tracker */}
        <div style={{ display: activeTab === 'dashboard' ? 'contents' : 'none' }}>
          <article className="card cols-12">
            <h3><span className="icon">✓</span>Tracker semanal interactivo</h3>
            <p className="muted">Acá tenés el cierre de cocina convertido en acciones medibles. Lo ideal es no hacerlo perfecto; lo ideal es hacerlo.</p>
            <WeeklyTracker habitKey="cocina" checks={checks} onCheck={onCheck} />
          </article>
        </div>

        {/* Sistemas Cards */}
        <div style={{ display: activeTab === 'sistemas' ? 'contents' : 'none' }}>
          {/* Plan de identidad */}
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

      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('habit-theme-v2') || 'dark');
  const [checks, setChecks] = useState(() => ensureStateShape(loadState()));
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('habit-theme-v2', theme);
  }, [theme]);

  const handleCheck = useCallback((habitKey, metricKey, dayIndex, value) => {
    setChecks(prev => {
      const next = ensureStateShape({ ...prev });
      next[habitKey] = { ...next[habitKey] };
      next[habitKey][metricKey] = [...next[habitKey][metricKey]];
      next[habitKey][metricKey][dayIndex] = value;
      saveState(next);
      return next;
    });
  }, []);

  const handleReset = () => {
    if (window.confirm('Esto borra los checks de la semana actual. ¿Seguimos?')) {
      localStorage.removeItem(storageKey());
      setChecks(ensureStateShape({}));
    }
  };

  return (
    <div className="wrap">

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <nav className="topnav">
          <span style={{ fontWeight: 'bold', padding: '10px 14px', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>🌿 ATOMIC</span>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >Dashboard</button>
          <button 
            className={`tab-btn ${activeTab === 'sistemas' ? 'active' : ''}`}
            onClick={() => setActiveTab('sistemas')}
          >Sistemas</button>
        </nav>
        <div className="toolbar-actions">
          <button className="btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'light' ? '🌙 Modo oscuro' : '☀ Modo claro'}
          </button>
          <button className="btn success" onClick={handleReset}>↺ Reiniciar semana</button>
          <button className="btn primary" onClick={() => window.print()}>⬇ Exportar PDF</button>
        </div>
      </div>

      {/* ── Stats row (dashboard only) ── */}
      {activeTab === 'dashboard' && <StatsRow checks={checks} />}

      {/* ── Habit sections ── */}
      <MadrugarSection checks={checks} onCheck={handleCheck} activeTab={activeTab} />
      <CocinaSection checks={checks} onCheck={handleCheck} activeTab={activeTab} />

      {/* ── Cómo usarlo ── */}
      <section id="como" className="hero" style={{ marginTop: '22px', display: activeTab === 'dashboard' ? 'block' : 'none' }}>
        <span className="eyebrow">Cómo usarlo</span>
        <h2 style={{ margin: '16px 0 10px', fontSize: '32px' }}>Qué hace esta versión 2</h2>
        <div className="grid" style={{ padding: 0, marginTop: '10px' }}>
          <div className="card cols-4">
            <h3><span className="icon">✓</span>Checkboxes reales</h3>
            <p className="muted">Cada semana tiene checks por día y por acción. Se guardan automáticamente en el navegador.</p>
          </div>
          <div className="card cols-4">
            <h3><span className="icon">⏰</span>Barras de progreso</h3>
            <p className="muted">Hay progreso total y progreso por métrica clave para que veas rápido si vas bien o te estás chamuyando solo.</p>
          </div>
          <div className="card cols-4">
            <h3><span className="icon">✨</span>Claro / Oscuro + PDF</h3>
            <p className="muted">Podés alternar entre temas. Y para exportar, el botón abre la impresión del navegador lista para guardar PDF.</p>
          </div>
        </div>
        <div className="footer-note">
          Si querés una versión 3, el salto lógico sería: <strong>estadísticas mensuales, racha automática, notas por día y plantillas para más hábitos</strong>.
        </div>
      </section>

    </div>
  );
}
