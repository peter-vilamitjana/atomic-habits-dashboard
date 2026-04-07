# Informe Definitivo de Arquitectura
## Habit Tracker Personal — Debate Resuelto

*Generado por el equipo habit-tracker-arch: backend-architect · qa-ux-engineer · productivity-strategist*

---

## PASO 1: TRANSCRIPCIÓN DEL DEBATE

### Ronda 1 — Posiciones iniciales

**[BACKEND-ARCHITECT]:** La opción correcta es API JSON + DB ligera (SQLite/Turso). No PostgreSQL —eso sería sobreingeniería. Una sola query con funciones de ventana SQL calcula rachas históricas en <1ms, algo imposible con el loop en memoria que tiene el código actual. LocalStorage no tiene garantías de persistencia y no escala para analíticas serias.

**[PRODUCTIVITY-STRATEGIST]:** Google Calendar es un **anti-patrón de productividad**. El calendario es territorio sagrado para el Deep Work. Inyectar "Desayuno preparado" entre reuniones críticas es pegar post-its en tu agenda. Falla las 4 leyes: no es obvio (los hábitos se pierden entre eventos), no es fácil (OAuth, tokens, latencia), y no es satisfactorio (un evento en Google Calendar no da dopamina). **Descartada. No negociable.**

**[QA-UX-ENGINEER]:** El Happy Path actual dura 3 segundos desde abrir la app hasta marcar un hábito. Eso es excepcional. Cualquier opción que lo degrade (OAuth, latencia de red) es una regresión de UX. Recomiendo resolver los bugs funcionales urgentes antes de hablar de migración de arquitectura.

### Ronda 2 — Debate cruzado

**[BACKEND-ARCHITECT]** *(concediendo al Estratega):* Reconozco que para el estado actual del proyecto agregar un backend es un salto de complejidad. Si el argumento de "cero fricción" es prioritario, acepto un enfoque híbrido: IndexedDB como storage primario con sync opcional. **Lo que no negocio:** para rachas históricas reales, una DB relacional es objetivamente superior.

**[QA-UX-ENGINEER]** *(señalando el bug crítico que ambos ignoran):* Ninguno de ustedes está hablando del problema más urgente. **La racha no cruza semanas.** `calcHabitWeekStreak` solo cuenta días dentro de la semana actual —se resetea a 0 cada lunes. El usuario que lleva 15 días seguidos ve "racha: 1" el lunes. Eso destruye la motivación antes que cualquier decisión de arquitectura.

**[PRODUCTIVITY-STRATEGIST]** *(contundente):* El QA tiene razón. Y añado: el código actual **ya hace bien la parte más difícil** —cero fricción, cero login, marcado instantáneo. LocalStorage + IndexedDB es la única opción que respeta las 4 leyes al 100%. La API + DB introduce 200-500ms de latencia en el acto más importante de la app: marcar el checkbox. Ese momento de dopamina no puede esperar a un servidor.

### Veredicto del debate

Los tres agentes convergen: **Opción 3 (LocalStorage/IndexedDB + Exportación JSON)** con mejoras quirúrgicas. El Arquitecto Backend acepta el enfoque híbrido con sync opcional. El debate no era realmente sobre "cuál elegir" sino sobre "qué arreglar primero."

---

## PASO 2: INFORME DEFINITIVO

---

### I. Análisis de Flujos (QA)

#### Happy Path — Step by Step

| # | Acción | Estado del sistema | Tiempo |
|---|---|---|---|
| 1 | Usuario abre la app | SPA carga desde Vite, sin login | 0s |
| 2 | Ve Dashboard con stats (Volumen, Racha, Completitud) | Datos leídos de localStorage | ~100ms |
| 3 | Identifica visualmente qué hábitos faltan hoy | Día actual con highlight visual | <1s |
| 4 | Click/tap en el checkbox del hábito | `toggleCell()` actualiza estado React | 0ms |
| 5 | Estado se persiste automáticamente | `saveState()` → localStorage | ~5ms |
| 6 | Stats cards y barras de progreso se actualizan | Re-render reactivo | ~16ms |
| 7 | Usuario cierra la app | Datos seguros en localStorage | — |
| 8 | Usuario reabre al día siguiente | Estado restaurado, día anterior intacto | ~100ms |

**Tiempo total: ~3 segundos. Fricción: prácticamente cero. No tocar esta arquitectura de interacción.**

---

#### Edge Cases Críticos

**Edge Case 1: Pérdida de datos**

> El usuario limpia el navegador, cambia de dispositivo, o usa modo incógnito. Pierde una racha de 30 días.

**Solución UX:** Botón "Exportar datos" que descarga un JSON con todas las claves `habit-tracker-v2-*` + botón "Importar" que las restaura. Añadir un banner no intrusivo: *"Tus datos viven en este navegador. Exporta cada semana para no perderlos."* Aparece una vez, no vuelve a molestar.

---

**Edge Case 2: Días olvidados — semana anterior inaccesible**

> El usuario hizo el hábito el viernes pero es lunes. `weekKey()` ya cambió. No puede registrar el día pasado.

**Solución UX:** Flechas `< semana anterior | semana actual >` junto al título del tracker. Retrocede máximo 4 semanas. La semana actual es siempre el default. Los días más antiguos de 30 días pueden mostrarse como "read-only" para consulta pero no edición.

---

**Edge Case 3: Zona horaria y corte de día ambiguo**

> El usuario marca hábitos a las 23:58. `new Date()` está a 2 minutos del siguiente día. La marca cae en el día equivocado.

**Solución UX:** Implementar un **día de corte configurable** (default: 4:00 AM). Antes de las 4am, la app considera que sigue siendo "ayer". Es el estándar de industria (Streaks, Habitica, Duolingo). Implementación: `const effectiveNow = new Date(Date.now() - 4 * 60 * 60 * 1000)`.

---

### II. Evaluación de Almacenamiento

| Criterio | Google Calendar | API JSON + DB | LocalStorage + JSON |
|---|---|---|---|
| Fricción inicial | Alta (OAuth) | Media (deploy) | **Cero** |
| Latencia por check | 200-500ms | 50-200ms | **0ms** |
| Funcionamiento offline | No | No | **Sí** |
| Make it Obvious | Falla | Neutral | **Excelente** |
| Make it Easy | Pésimo | Regular | **Perfecto** |
| Make it Satisfying | Falla | Neutral | **Excelente** |
| Analíticas históricas | Imposible | Excelente | Limitado* |
| Respeta el calendario | **NO** | Sí | Sí |
| Complejidad de mantener | Alta | Media | **Mínima** |
| Soberanía del dato | No (Google) | Parcial | **Total** |

*Mitigable con exportación JSON estructurada.

#### Pros y Contras

**Google Calendar:** Cero pros para este caso de uso. El modelo mental de "evento temporal" es incompatible con "boolean diario". Contamina el entorno de Deep Work. Dependencia de OAuth y rate limits de Google. Vetada por unanimidad.

**API JSON + DB ligera:** Pro: datos persistentes garantizados, analíticas SQL potentes, sync multi-dispositivo. Contra: infraestructura que mantener, latencia que degrada el momento de marcado, punto de falla único (servidor caído = no puedo marcar). Correcta para v2.0, prematura para ahora.

**LocalStorage + Exportación JSON:** Pro: cero fricción, cero latencia, offline-first, soberanía total del dato, sin infraestructura. Contra: datos atados al navegador (mitigable con export), sin sync nativo entre dispositivos, analíticas históricas requieren cargar todo en memoria.

#### Veredicto Final

**Opción 3 (LocalStorage/IndexedDB + JSON Export) es el camino correcto HOY.**

No porque sea "la más simple" sino porque es la única que respeta las 4 leyes del cambio de comportamiento al 100%. El acto de marcar un hábito debe ser instantáneo y satisfactorio —cualquier latencia de red en ese momento específico es una regresión conductual, no solo técnica.

**Arquitectura futura (v2.0):** cuando el usuario quiera sincronizar entre dispositivos, migrar a un híbrido offline-first: IndexedDB como fuente de verdad local + sync en segundo plano a SQLite/Turso. El usuario nunca espera por la red; la red se actualiza silenciosamente.

---

### III. El Modelo de Datos

El bug más urgente no es de almacenamiento —es que **la racha no cruza semanas**. La estructura actual pierde el historial entre `weekKey` distintos. El nuevo modelo debe resolver esto.

#### Estructura recomendada en localStorage (migración a IndexedDB-ready)

```typescript
// Clave maestra del índice
localStorage.setItem('habit-tracker-index', JSON.stringify({
  version: 3,
  habits: ['madrugar', 'cocina'],
  createdAt: '2026-01-01'
}))

// Claves de checks diarios (una por día, no por semana)
// Formato: habit-check-{habitKey}-{YYYY-MM-DD}
localStorage.setItem('habit-check-madrugar-2026-04-06', JSON.stringify({
  date: '2026-04-06',
  habitKey: 'madrugar',
  rows: {
    phone:   true,
    up:      true,
    bed:     false,
    nap:     true,
    journal: false
  },
  completedCount: 3,
  totalCount: 5,
  updatedAt: '2026-04-06T08:23:00Z'
}))
```

**¿Por qué una clave por día en lugar de por semana?**
- El cálculo de racha se reduce a: iterar fechas hacia atrás desde hoy hasta encontrar un día sin checks.
- No hay que cargar semanas enteras para saber si el jueves anterior estaba completo.
- La migración a IndexedDB o SQLite es trivial: misma estructura, diferente storage engine.

#### Algoritmo de racha inter-semanas (solución al bug crítico)

```typescript
function calcCurrentStreak(habitKey: string): number {
  const today = getEffectiveToday() // aplica corte de 4am
  let streak = 0
  let date = today

  while (true) {
    const key = `habit-check-${habitKey}-${formatDate(date)}`
    const data = localStorage.getItem(key)

    if (!data) break  // día sin registro = racha rota

    const parsed = JSON.parse(data)
    if (parsed.completedCount === 0) break  // día con 0 checks = racha rota

    streak++
    date = subtractDay(date)

    // Límite de seguridad: no buscar más allá de 365 días
    if (streak > 365) break
  }

  return streak
}
```

Esta función cruza semanas, meses y años. Con un índice en IndexedDB sobre `(habitKey, date)`, la consulta es O(streak_length), no O(total_days).

#### Schema equivalente para IndexedDB (o SQLite cuando llegue el momento)

```typescript
// Store: habit_checks
interface HabitCheck {
  id: string              // `${habitKey}-${date}` como keyPath
  habitKey: string        // 'madrugar' | 'cocina'
  date: string            // 'YYYY-MM-DD' (fecha efectiva con corte 4am)
  rows: Record<string, boolean>
  completedCount: number
  totalCount: number
  updatedAt: string
}

// Índices necesarios:
// - [habitKey, date]  → para calcular rachas (único índice crítico)
// - [date]            → para vista de "¿qué hice hoy en todos los hábitos?"
```

---

### IV. Plan de Acción

Los primeros 3 pasos técnicos para implementar HOY en el proyecto actual (Vite + React):

---

**Paso 1 — Migrar estructura de datos a clave-por-día y arreglar el bug de racha**

```
Archivo: src/utils/storage.ts (nuevo)
```

Crear un módulo de storage con:
- `saveHabitCheck(habitKey, rowKey, date, checked)` → escribe la clave `habit-check-{habitKey}-{YYYY-MM-DD}`
- `getHabitCheck(habitKey, date)` → lee y parsea
- `calcCurrentStreak(habitKey)` → implementación con corte de 4am y cruce inter-semanas
- `exportAllData()` → serializa todas las claves `habit-check-*` a JSON descargable
- `importData(json)` → restaura desde un archivo exportado

Esto desacopla la lógica de persistencia del componente React y hace la migración a IndexedDB transparente en el futuro.

---

**Paso 2 — Añadir navegación temporal y protección de datos en la UI**

```
Archivo: src/components/WeekNavigator.tsx (nuevo)
Archivo: src/components/ExportButton.tsx (nuevo)
```

- Flechas `< >` junto al título del tracker. Estado: `const [weekOffset, setWeekOffset] = useState(0)`. Límite: -4 semanas.
- Botón "Exportar datos" en el navbar/footer que llama a `exportAllData()` y dispara un `<a download>`.
- Banner de primera visita: *"Tus datos viven en este navegador"* con botón de exportar. Se guarda como `habit-tracker-onboarded: true` para no volver a mostrarse.

---

**Paso 3 — Hacer la racha prominente y añadir feedback visual al marcar**

```
Archivo: src/components/StreakBadge.tsx (nuevo)
Archivo: src/App.jsx → modificar toggleCell handler
```

- Componente `<StreakBadge>` que muestra el contador de días consecutivos en grande y en posición destacada (arriba del tracker, no enterrado en stats cards).
- Al hacer click en un checkbox: micro-animación CSS (`scale(1.2) → scale(1)` + cambio de color en 150ms).
- Al completar todos los checks del día: celebración ligera con `canvas-confetti` (3kb gzip) o animación CSS de pulso en el StreakBadge.


Estos 3 pasos no requieren backend, no rompen nada existente, y resuelven el 80% de los problemas identificados por los tres agentes.

Informe generado por el equipo habit-tracker-arch: backend-architect · qa-ux-engineer · productivity-strategist