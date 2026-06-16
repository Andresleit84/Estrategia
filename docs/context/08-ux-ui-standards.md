# Estándares UX/UI — Sistema OKR

## Filosofía de diseño
**"La información correcta, para la persona correcta, en el momento correcto."**
Un OKR bien implementado se olvida de sí mismo. La plataforma debe ser tan fluida que el usuario piensa en sus objetivos, no en cómo usar la herramienta.

## Principios de diseño

### 1. Claridad radical
- Cada pantalla tiene un único propósito principal
- El estado del progreso siempre visible sin hacer clic
- Los números importantes son grandes; los secundarios son pequeños
- Sin jargon: "Confianza" en lugar de "confidence score", "Avance" en lugar de "progress"

### 2. Densidad progresiva
- Vista de resumen → vista de detalle → vista de edición
- No mostrar todos los campos de golpe
- El usuario elige profundizar, no filtrar ruido

### 3. Acción contextual
- Las acciones disponibles aparecen donde se necesitan
- "Hacer check-in" está en la card del KR, no en un menú global
- La IA sugiere en el momento oportuno, no interrumpe

### 4. Feedback inmediato
- Actualización optimista: el UI cambia antes de que el servidor confirme
- Progreso visual en cada acción que tarda > 300ms
- Error states claros con qué hacer para resolverlos

### 5. Consistencia sin rigidez
- Mismo patrón de interacción para todos los KRs, en todos los niveles
- Variación visual según el estado (ON_TRACK = verde, AT_RISK = amarillo, BEHIND = rojo)

---

## Design Tokens

### Colores (base — modo claro)
```css
/* Semáforo OKR */
--color-on-track: #22c55e;      /* verde — progreso normal */
--color-at-risk: #f59e0b;       /* amarillo — atención requerida */
--color-behind: #ef4444;        /* rojo — fuera de curso */
--color-completed: #3b82f6;     /* azul — completado */
--color-cancelled: #94a3b8;     /* gris — cancelado */

/* Confianza (gradiente) */
--color-confidence-high: #22c55e;   /* 0.7–1.0 */
--color-confidence-mid: #f59e0b;    /* 0.4–0.69 */
--color-confidence-low: #ef4444;    /* 0.0–0.39 */

/* Neutrales */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f8fafc;
--color-bg-card: #ffffff;
--color-border: #e2e8f0;
--color-text-primary: #0f172a;
--color-text-secondary: #64748b;
--color-text-muted: #94a3b8;

/* Marca */
--color-brand-primary: #6366f1;   /* indigo */
--color-brand-secondary: #8b5cf6; /* violet */
```

### Tipografía
```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace; /* para métricas y números */

/* Escala */
--text-xs: 0.75rem;    /* 12px — metadata, labels */
--text-sm: 0.875rem;   /* 14px — body secundario */
--text-base: 1rem;     /* 16px — body principal */
--text-lg: 1.125rem;   /* 18px — subtítulos */
--text-xl: 1.25rem;    /* 20px — títulos de sección */
--text-2xl: 1.5rem;    /* 24px — títulos de página */
--text-4xl: 2.25rem;   /* 36px — KPIs / números grandes */
```

### Espaciado
Sistema de 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

---

## Componentes clave

### Progress Ring
Círculo SVG animado para el progreso de un Objective (0-100%).
- Diámetro grande (80px) en cards de objetivo
- Con número en el centro (porcentaje)
- Color según estado del objetivo

### Confidence Meter
Barra horizontal con gradiente verde→amarillo→rojo.
- Siempre acompañado del número decimal (0.7)
- Tooltip explica qué significa la confianza

### Cascade Tree
Árbol vertical que muestra Company → Area → Team → Individual OKRs.
- Colapsable por nivel
- Cada nodo muestra: título, progreso, responsable, estado
- Líneas de conexión con color según alineación

### KR Card
Tarjeta de Key Result. Elementos:
- Título del KR
- Barra de progreso horizontal con valor actual / target
- Chip de estado (semáforo)
- Confidence meter
- Fecha del último check-in ("hace 3 días")
- Botón "Check-in" siempre visible
- Hover: aparecen acciones secundarias (editar, ver historial, invocar AI)

### Check-in Drawer
Panel lateral (no modal completo) para hacer check-in.
- Valor actual con input numérico + unidad
- Slider de confianza (0.0 a 1.0) con etiquetas (bajo/medio/alto)
- Campo de notas con AI Assistant inline
- Historial de últimos 3 check-ins visible en el mismo panel

### Executive Dashboard
Vista para CEO/Dirección. Elementos:
- Score del ciclo (número grande, centro)
- Heat map de confianza por área (grid 3×N)
- Lista de KRs en riesgo (top 5 por impacto)
- Trend chart (últimas 4 semanas de progreso del ciclo)
- Próximos milestones (timeline horizontal)

### AI Chat Panel
Panel lateral o página dedicada para el Strategy Advisor.
- Historial de conversación con timestamps
- Mensajes del usuario en burbuja derecha
- Respuestas de IA en burbuja izquierda con fuente de datos referenciada
- Acciones sugeridas como chips clicables ("Ver KRs en riesgo", "Crear check-in")
- Input con soporte para @ menciones de OKRs (@objetivo-empresa-Q1)

---

## Patrones de interacción

### Empty States
Cada pantalla vacía tiene:
1. Ilustración contextual (no genérica)
2. Título que explica el estado (no "No hay datos")
3. Acción primaria para resolver el vacío
4. Explicación de por qué está vacío (si aplica)

Ejemplo: "Aún no hay OKRs de equipo. Alinea tu equipo con los objetivos del área. → Crear primer OKR"

### Loading States
- Skeleton loaders que replican la forma del contenido real
- Sin spinners genéricos
- Máx 200ms antes de mostrar skeleton (evitar flash en conexiones rápidas)

### Error States
- Error específico, nunca "algo salió mal"
- Acción de recuperación clara (reintentar, ir a inicio, contactar soporte)
- Preservar el trabajo no guardado del usuario

### Onboarding
Flow de 4 pasos para nuevas organizaciones:
1. Nombre y modo (ágil / tradicional / híbrido)
2. Crear primer ciclo
3. Crear primer objetivo de empresa
4. Invitar al primer miembro del equipo
Con posibilidad de saltar y completar después.

---

## Accesibilidad (WCAG 2.1 AA)
- Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
- Navegación completa por teclado (Tab, Enter, Escape, flechas)
- ARIA labels en todos los elementos interactivos
- Focus visible siempre (no eliminar outline con CSS)
- Screen reader: anunciar cambios dinámicos con aria-live
- No depender solo del color para comunicar estado (usar ícono + color)

## Responsive
- **Desktop (≥1280px)**: layout de 3 columnas en dashboards, sidebar fija
- **Tablet (768px–1279px)**: sidebar colapsable, 2 columnas
- **Mobile (< 768px)**: navegación bottom bar, layout de 1 columna, check-ins optimizados para touch

## Rendimiento UX
- LCP (Largest Contentful Paint) < 2.5s
- INP (Interaction to Next Paint) < 200ms
- Sin layout shifts (CLS < 0.1)
- Virtualización de listas largas (> 50 items) con @tanstack/virtual
- Prefetch de rutas al hover en la navegación

## Dark Mode
- Soporte completo desde el inicio (no agregado después)
- Detecta preferencia del sistema + toggle manual
- Tokens semánticos (--color-bg-primary) que cambian según el tema
- Gráficos y charts con paleta adaptada al tema

## Modo compacto
- Toggle en settings para usuarios power users con muchos OKRs
- Reduce el padding y tamaño de fuente un nivel
- Las cards muestran solo información crítica

---

## Layout del shell — reglas críticas (2026-04-27)

### Cadena de altura completa
El alto debe propagarse desde `html` hasta cada página:
```
html { height: 100% }
body { height: 100%; overflow: hidden }
Providers > div { height: 100% }   ← debe ser h-full, NO min-h-screen
AppShell > div.flex { height: 100% }
```
**`min-h-screen` rompe esta cadena** — usarlo dentro de un contenedor `h-full` genera desbordamiento vertical.

### AppShell — estructura obligatoria
`frontend/src/components/layout/AppShell.tsx`:
```tsx
<div className="flex h-full overflow-hidden bg-background">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden min-w-0">   {/* min-w-0 crítico */}
    <TopBar />
    <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
      <div className="max-w-5xl w-full min-h-full">               {/* min-h-full, NO mx-auto */}
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </main>
  </div>
</div>
```
- `max-w-5xl w-full` — limita el ancho de todas las cards de una sola vez (no por página)
- `min-h-full` — permite que páginas con scroll interno (`h-full` propio) funcionen; `h-full` rompería el scroll de páginas largas
- **Sin `mx-auto`** — el contenido se alinea a la izquierda, no centrado
- `min-w-0` en el `flex-1` — impide que el contenedor se expanda más allá del viewport

### Sidebar — scroll obligatorio
`frontend/src/components/layout/Sidebar.tsx`:
```tsx
<nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-0.5">
```
**`min-h-0` es imprescindible.** En un flex-column, `flex: 1` sin `min-height: 0` no permite scroll — el contenedor se expande indefinidamente y los ítems del fondo quedan ocultos.

### Auth layout — `h-full` no `min-h-screen`
`frontend/src/app/auth/layout.tsx`:
```tsx
<div className="h-full flex overflow-x-hidden">
  <div className="hidden lg:flex lg:flex-col lg:w-[52%] ... shrink-0">  {/* shrink-0 */}
    ...
  </div>
  <div className="flex-1 min-w-0 flex flex-col items-center justify-center ...">  {/* min-w-0 */}
    ...
  </div>
</div>
```
- Stats row: `flex gap-2 flex-wrap` con `flex-1 min-w-[80px]` por ítem — evita desbordamiento en pantallas estrechas

### SetupGuide — visibilidad garantizada
`frontend/src/components/shared/SetupGuide.tsx`:
- Inicializar `dismissed=false` (no `true`) — leer localStorage solo en `useEffect` post-mount
- Usar `mounted` separado para evitar flash SSR
- El botón flotante siempre renderiza mientras `!dismissed`, independiente de si la API carga o falla

### Layouts de páginas con columnas fijas
Grids con columnas fijas deben ser responsive:
```tsx
// MAL — se rompe en pantallas < 1280px
<div className="grid grid-cols-[280px_1fr]">

// BIEN
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
```

---

## Navegación — Sidebar (2026-05-11)

El sidebar tiene **5 grupos** con indicador de punto de color en el separador:

| Grupo key | Label | Color dot | Contenido |
|-----------|-------|-----------|-----------|
| `strategy` | Estrategia | `bg-blue-500` | Diagnóstico, Estrategia, Ciclos, OKRs, Trazabilidad |
| `tactical` | Táctico | `bg-violet-500` | OKRs Tácticos, Check-ins, Iniciativas |
| `operational` | Operativo | `bg-green-500` | Entregables, Backlog, Sprints |
| `analysis` | Análisis | `bg-amber-500` | Reportes, Gobierno OKR |
| `system` | Sistema | `bg-gray-400` | IA Asistente, Configuración |

El grupo `home` (Inicio) no tiene separador ni dot — aparece solo al principio.

En modo colapsado el separador muestra solo una línea horizontal (`h-px bg-sidebar-border`), sin dot ni label.

---

## Búsqueda global — Command Palette (2026-05-11)

El TopBar tiene un trigger de búsqueda (no un input funcional) que abre un **Command Palette** estilo Mac:

- Trigger: clic en el botón del TopBar **o** `Ctrl+K` / `Cmd+K` desde cualquier pantalla
- Componente: `components/layout/GlobalSearchDialog.tsx` — renderizado con `createPortal` al `document.body`
- Al abrir sin query: grid de 8 **accesos rápidos** con iconos de color (Quick Links)
- Al escribir ≥2 chars: búsqueda debounced 280ms → `GET /api/v1/search?q=` → resultados agrupados por categoría
- Navegación por teclado: `↑↓` mover, `Enter` navegar, `Esc` cerrar
- Ítem activo muestra `↵` a la derecha
- Footer permanente con hints de teclado
- Skeleton loader (4 filas) mientras carga

**Regla**: Para cualquier búsqueda global o launcher de acciones en el futuro, usar este patrón (overlay backdrop-blur, panel centrado, teclado completo). NO inputs inline muertos.
