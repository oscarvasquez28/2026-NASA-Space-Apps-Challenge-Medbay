# MECHAVIS — Blueprint de concepto y diseño

Documento de referencia para replicar/adaptar este proyecto a otro dominio
(ej.: monitoreo de salud de astronautas). Describe el concepto, la arquitectura,
el sistema visual y el modelo de datos tal como están implementados.

---

## 1. Concepto

MECHAVIS es un **"laboratorio digital" interactivo**: mitad software de
ingeniería serio, mitad interfaz de ciencia ficción. La premisa central:

> Un catálogo de entidades técnicas (componentes mecánicos) que se exploran en
> 3D en tiempo real. Cada entidad tiene **regiones clickeables (hotspots)** que
> revelan datos técnicos, y un **asistente contextual** que explica lo que
> estás viendo y *mueve la cámara* hacia la región que describe.

Pilares de la experiencia:

1. **Observar** — modelo 3D procedural manipulable (orbit, pan, zoom, presets).
2. **Inspeccionar** — click en una parte → tooltip con especificaciones de la
   región + panel inspector con fichas de datos tabuladas.
3. **Analizar** — overlays conceptuales de color sobre la geometría
   (estrés, térmico, desgaste, zonas críticas) + gráficas.
4. **Preguntar** — chat con asistente (simulado/local) con acciones rápidas;
   sus respuestas incluyen referencias que enfocan el modelo.
5. **Desarmar/medir/cortar** — vista explotada con slider, plano de corte,
   medición punto a punto, wireframe, aristas.

Regla transversal: **todos los datos son ilustrativos**. Hay un disclaimer
constante (`ILLUSTRATIVE_DISCLAIMER`) que recuerda que nada son specs
certificadas. Mantener esta honestidad en el nuevo dominio (datos de salud
simulados, no diagnóstico).

---

## 2. Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Three.js + React Three Fiber + drei** — toda la geometría es procedural
  (cero assets externos: ni GLTF ni texturas).
- **Tailwind CSS 4** (`@theme inline` en globals.css) + CSS plano organizado
  por clases semánticas + CSS modules por feature.
- **Zustand** — dos stores: estado efímero del visor (por instancia, vía
  Context) y preferencias persistidas de app.
- **Motion** (motion/react) — animaciones de entrada, `MotionConfig` con
  `reducedMotion`.
- **Recharts** — gráficas de análisis/comparación.
- **Lucide React** — iconografía única en toda la app.
- **Radix Dialog** — modales (paleta de comandos, paneles, drawer del chat).
- Fuentes vía `@fontsource`: **Inter** (UI) + **IBM Plex Mono** (datos).
- **Vitest** (unit) + **Playwright** (e2e). Sin backend.

---

## 3. Arquitectura y rutas

```
src/
  app/            rutas + layout + globals.css
  components/
    layout/       app-shell, command-palette, tool-panels
    ui/           primitives (Eyebrow, Modal, TechnicalValue, Disclaimer…)
    three/        canvas-scene, model-viewport, preview-gallery, shared-gallery
      models/     primitives (Part/Solid/…) + 1 archivo por modelo
  data/           components, materials, manufacturing, analysis (datasets curados)
  features/       lab, explorer, viewer, analysis, assistant, comparison, manufacturing
  lib/            geometría procedural + helpers de ingeniería
  services/       component-repository + mock-assistant (interfaz reemplazable)
  stores/         viewer-store (Zustand vanilla + Context), app-store (persist)
  types/          contratos del dominio
```

Rutas (todas "server-light"; el 3D carga con `dynamic(..., { ssr:false })`):

| Ruta | Feature | Contenido |
|---|---|---|
| `/` | `lab-home` | Hero con modelo 3D auto-rotando, boot sequence, strip de specs, galería preview, sección filosófica, journey de manufactura |
| `/components` | `component-explorer` | Biblioteca: búsqueda + filtros laterales + grid de tarjetas con previews 3D |
| `/components/[id]` | `engineering-workspace` | **Página principal**: visor 3D grande + inspector de datos + drawer de chat |
| `/analysis` | `analysis-workspace` | Modos de overlay (stress/thermal/wear/critical) + métricas + gráficas Recharts |
| `/compare` | `comparison-workspace` | Radar/barras normalizadas + tabla de specs + recomendación |
| `/ai` | `ai-workspace` | Modelo + chat lado a lado, con lista de regiones mapeadas |

Query params: `?component=<id>` (analysis/ai) y `?tool=wireframe|explode|measure|reset`
(el viewer-store lo consume al montar como si fuera un evento de comando).

---

## 4. Sistema visual (design language)

Estética "instrumento de laboratorio / sci-fi sobrio". Poco color, mucha
tipografía mono, ornamentación técnica.

**Paleta** (`:root` + `@theme`):

```css
--bg:      #101113   /* fondo app, casi negro azulado */
--panel:   #141517   /* paneles */
--line:    #292b30   /* bordes hairline 1px en todas partes */
--text:    #e8eaee   /* texto principal */
--muted:   #858a94   /* texto secundario */
--dim:     #565c66   /* texto terciario / micro-labels */
--accent:  #8badfa   /* azul-lavanda, único acento */
```

- `color-scheme: dark`; selección `#6386ca66`; focus-visible con outline accent.
- Acento de estado "ok": verde tenue `#9ebaa3` solo en `status-dot`.
- Criticidad alta: tono ámbar apagado `#b4a38d` (`.criticality.high i`).

**Tipografía** — dos familias con roles estrictos:

- **Inter**: títulos (peso 400–500, `letter-spacing` negativo agresivo,
  ej. h1 de 63px con `-3.7px`), párrafos (11–13px, `line-height` 1.75–1.95).
- **IBM Plex Mono**: TODA metadata — labels en mayúsculas de 6–10px con
  `letter-spacing` de 0.5–1.7px (part numbers, coordenadas, unidades, kbd,
  contadores `01/10`, badges).

**Motifs recurrentes** (esto es lo que le da el "look"):

- `.eyebrow`: label mono minúsculo precedido de un cuadradito accent de 4px
  (`.tiny-square`). Se usa para encabezar cada bloque.
- `.status-dot`: puntito verde de 5px con glow sutil → "system online".
- Crosshair `+` decorativos en esquinas de previews y empty states.
- Líneas de acotación estilo plano técnico: callouts con línea horizontal
  punteada + circulito (`.callout-line:before`), dimension lines en el SVG
  de fallback.
- `viewport-axis`: mini indicador de ejes X/Y/Z fijo en una esquina del canvas.
- `scanner-line`: línea de escaneo que barre el hero cada 12s.
- Contadores con padding (`01`, `02`…), separadores `·`, labels tipo
  `REV. 01`, `LAB.001 / EXPLORE MODE`, `LOCAL ENVIRONMENT`.
- Bordes `1px solid var(--line)`, radios pequeños (3–5px), sombras casi nulas.
- Tooltips/indicadores mono en minúsculas o MAYÚSCULAS con tracking amplio.
- Grid técnico de fondo en la escena 3D (drei `Grid` con cell/section colors).

**App shell** (layout fijo):

- Sidebar izquierdo de 212px: brand (logo SVG + nombre + tagline mono),
  "workspace label", grupo `LAB` (nav), grupo `TOOLS` (Measurements,
  Materials, Manufacturing → abren modales o comandos del visor), grupo
  `SYSTEM` (Settings), al fondo: status + footer mono.
- En páginas de detalle (`/components/[id]`) el shell pasa a `focused-shell`:
  sidebar colapsado a 70px con solo iconos.
- Topbar 60px: breadcrumb a la izquierda; a la derecha indicador
  `● LOCAL ENVIRONMENT`, trigger de búsqueda con `kbd ⌘K`, avatar.
- Footer app: 32px, mono 6–7px, "MECHAVIS GEOMETRY ENGINE / CONCEPTUAL…".
- Mobile: sidebar se oculta, nav inferior con iconos.

---

## 5. Modelo de datos (el corazón reutilizable)

Todo el contenido vive en datasets curados TypeScript
(`src/data/*.ts`) tras tipos estrictos (`src/types/engineering.ts`).
**El patrón clave: la entidad ≠ el modelo 3D.** La entidad declara
`modelKind` + `hotspots[]` con `partId` que enlaza datos ↔ geometría.

```ts
type Vec3 = [number, number, number];
type Criticality = "Low" | "Medium" | "High";
type AnalysisMode = "none" | "stress" | "thermal" | "wear" | "critical";

interface Hotspot {
  id: string;            // "shoulder-fillet"
  name: string;          // "Shoulder fillet"
  partId: string;        // → id del <Part> clickeable en el modelo 3D
  position: Vec3;        // coords locales del modelo (se muestran ×50 mm)
  description: string;
  surfaceFinish: string; // dato técnico 1
  tolerance: string;     // dato técnico 2
  criticality: Criticality;
}

interface Component {
  id; name; partNumber; category; subtitle;
  modelKind: ModelKind;          // qué modelo 3D renderizar
  description; material; dimensions[]; mechanicalProperties[];
  applications[]; criticality;
  hotspots: Hotspot[];           // regiones clickeables
  failureModes: { name; cause; prevention; hotspotId }[];
  analysis: { maxStress; criticalArea; stressExplanation;
              maxTemperature; heatingRate; wearRisk; wearExplanation;
              thermalExplanation };
  insights: { category; title; description; hotspotId? }[]; // notas del AI
  inspection[]; tolerance;
}
```

`AssistantResponse` — contrato del asistente (lo que permite "el chat mueve
el 3D"):

```ts
interface AssistantResponse {
  message: string;
  referencedHotspotIds: string[];          // chips clickeables en el mensaje
  insights: AIInsight[];                   // "engineering notes" al final
  actions: { type: "focus"; hotspotId }[]; // → mueven la cámara
  assumptions: string[];                   // colapsable "Assumptions & limits"
}
```

Convenciones: ids de parte fijos por modelo (shaft: `shaft,journal,shoulder,
spline,thread,gear,bearing,spacer,retainer`…), `MODEL_MM_PER_UNIT = 50`
(1 unidad 3D = 50 mm), coordenadas locales con Y axial.

`services/mock-assistant.ts` implementa `EngineeringAssistantProvider` —
**interfaz pensada para cambiar el mock por una API/LLM real** sin tocar la UI.
El mock: `detectIntent(prompt)` con regex → intents (`explain, critical,
manufacturing, alternatives, failure, optimize, diameter, unknown`) → compone
respuesta a partir de los datos de la entidad, adjunta insights relevantes,
ids de hotspots referenciados y acciones `focus`. Latencia simulada ~80ms,
cancelable con AbortController.

---

## 6. Arquitectura 3D

### 6.1 Capas

- `ModelViewport` — wrapper `dynamic ssr:false` + splash "INITIALIZING
  GEOMETRY ENGINE". Es el único punto de entrada al 3D en páginas.
- `CanvasScene` → `<Canvas>` (sombras según calidad, dpr, `frameloop` ligado
  a visibilidad vía IntersectionObserver, `localClippingEnabled`, manejo de
  `webglcontextlost` + `SceneBoundary` error boundary → fallback SVG
  "technical drawing" con botón retry).
- `Scene` — luces de estudio (`StudioLights`: ambient + 2 direccionales +
  `Environment` con `Lightformer`s), `<Grid>` infinito, plano receptor de
  sombra, `CameraControls` (drei) con presets y botones de ratón remapeables
  según herramienta activa.

### 6.2 Modelos procedurales

- `MechanicalModel(kind)` → mapa `Record<ModelKind, ComponentType>` → modelo
  concreto (`ShaftModel`, `BearingModel`, …). Cada modelo es JSX de
  primitivas: `Part`, `Solid`, `Turned` (revolución por perfil
  `[radio, y][]`), `Ring`, `Gear`, `Helix`, `Tube`, `KeyedShaft`, `Ball`,
  `Box`, `Cylinder`, `Bolt`, `MachiningRings`.
- Geometrías custom en `lib/geometry/mechanical.ts` (perfil→lathe, dientes
  de engranaje, hélice, tubo doblado…) registradas con `extend()`.
- Materiales: presets `Metal` (`steel|polished|dark|copper|brass|rubber|
  ceramic|blue`) → `meshPhysicalMaterial` con metalness/roughness + clearcoat.

### 6.3 Selección (clave para "click en partes del cuerpo")

- `<Part id="shoulder">` envuelve meshes; registra `onClick` →
  `state.onSelect(id, point)` con guardas: ignora si un clipping plane corta
  el punto, y si `event.delta > 4` (fue drag, no click).
- `PartContext` da el `partId` a los `Solid` hijos → la parte seleccionada se
  pinta con `emissive` azul + `edgesGeometry` resaltada.
- En `canvas-scene.select()`: si `measure` → añade punto; si no → busca
  `component.hotspots.find(h => h.partId === partId)` y guarda
  `selectedPart` + `selectedHotspot` en el viewer-store.
- El workspace muestra `hotspot-tooltip` flotante sobre el canvas: nombre,
  descripción, dl con finish/tolerance/criticality, coords X/Y/Z en mm, y
  botón "Explain this area" → abre el chat con contexto.
- `viewer.focus(hotspot)` → `focusTarget` → efecto que hace
  `controls.setLookAt(target + offset, target)` animado (o instantáneo si
  `reducedMotion`). El mismo `focus()` lo usan las listas de hotspots, los
  chips del chat y las acciones del asistente.

### 6.4 Modos del visor

- **Explode**: `getPartOffset(kind, partId, explode)` — tabla de offsets por
  parte; `useFrame` interpola posición con `MathUtils.damp` y dibuja una
  línea conectora desde el ancla (efecto "despiece técnico").
- **Section**: `THREE.Plane` por eje + offset; `gl.localClippingEnabled`;
  plano semitransparente de referencia.
- **Measure**: 2 clicks → esferas + `Line` dashed + `<Html>` label con mm
  (distancia × `MODEL_MM_PER_UNIT`).
- **Wireframe / Edges**: flags en el material / `edgesGeometry` por mesh.
- **Analysis overlay**: `applyAnalysisColors(geometry, kind, partId, mode,
  thermalProgress, position)` escribe `vertexColors` (estrés/térmico/etc.)
  y el material pasa a blanco base + vertexColors.

### 6.5 Galería compartida (patrón importante)

`SharedGallery` usa **un solo `<Canvas>`** absoluto + `View`/`View.Port` de
drei: cada tarjeta del grid renderiza su `<View>` (tracking div) con su
`PreviewScene` (rotación al hover). Un canvas WebGL para N previews —
eficiente y con `eventSource` compartido.

---

## 7. Estado

### `viewer-store.tsx` — efímero, por instancia de visor

`createStore` vanilla + Context Provider (cada `ViewerProvider` crea un store
nuevo; permite varios visores independientes). Estado:

```ts
selectedHotspot, selectedPart, focusTarget, focusRevision,
cameraPreset: "iso"|"front"|"top"|"side", resetRevision,
explode: 0..1, section, sectionAxis, sectionOffset,
wireframe, edges, measure, points: Vec3[],
analysis: AnalysisMode, thermalProgress, playing,
interaction: "rotate"|"pan"|"zoom"
```

- `set()` con lógica de exclusión (activar measure resetea explode/section;
  cambiar explode/section/analysis apaga measure).
- `focus(hotspot)`, `reset()`, `addPoint()`.
- Escucha `window` event **`mechavis:command`** (`wireframe|explode|measure|
  reset`) — así la sidebar/paleta controlan el visor sin acoplamiento.
  `?tool=` en la URL dispara el mismo evento al montar.

### `app-store.ts` — preferencias persistidas

`persist` + `skipHydration` (rehydrate manual en `app-shell`):
`quality: high|balanced`, `autoRotate`, `reducedMotion`; más efímeros
`activeComponent`, `commandOpen`, `panel: materials|manufacturing|settings`.

---

## 8. Páginas en detalle

### 8.1 Home (`LabHome`)

- **Boot sequence**: overlay "M/ MECHAVIS — INITIALIZING GEOMETRY ENGINE…
  Loading engineering data… Calibrating visualization…" con barra de progreso
  por fases; una vez por sesión (`sessionStorage`), se cierra cuando el 3D
  reporta `onReady`.
- **Hero** 610px: copy a la izquierda (edición mono, h1 63px + ®, subtítulo,
  párrafo, CTAs, capabilities mono), modelo 3D ocupando el 72% derecho con
  auto-rotación (`useFrame` + `controls.rotate` hasta que el usuario toca),
  2 `hero-callout` con líneas de acotación, `hero-model-label` con link al
  componente, `hero-bottomline` con hints ("DRAG TO ORBIT").
- **hero-data-strip**: 5 specs en columnas con hairlines.
- **Discovery**: 3 tarjetas `component-card` con preview 3D (shared canvas),
  part number, categoría, material, "EXPLORE →".
- **lab-philosophy**: manifiesto en 3 columnas ("Understand. Not just
  observe.") + bullets con iconos.
- **ManufacturingJourney**: track horizontal de pasos (01…N) → detalle.
- Endnote mono: "BUILT FOR CURIOSITY. ENGINEERED FOR UNDERSTANDING."

### 8.2 Explorer (`/components`)

`explorer-layout` = sidebar de filtros (176px) + resultados:
lista de categorías con contadores, selects (material, proceso, aplicación,
criticidad), reset, nota "library". Search field grande + `result-count`.
Tarjetas con preview 3D (2 por fila) + footer "compare". `EmptyState` con
crosshair cuando no hay resultados.

### 8.3 Visor (`/components/[id]` — la pantalla a replicar)

Grid: **stage 3D a la izquierda, inspector a la derecha (~360px)**.

- Stage: header (back-link, `eyebrow` categoría/partNumber, h1 nombre,
  subtitle) + a la derecha `status-label` "● INSPECTED · DEMO" y botón ✨
  que abre el drawer de IA.
- Sobre el canvas: `viewer-scene-meta` (modo de render + preset),
  `hotspot-tooltip` flotante al seleccionar, `viewer-bottom-left` con hints
  de interacción, `ViewerToolbar` inferior centrado.
- `ViewerToolbar`: Rotate/Pan/Zoom | Reset | Explode | Section | Wireframe |
  Edges | Measure + select de cámara ISO/FRONT/SIDE/TOP + fit. Los modos
  activos abren una `mode-adjustment` encima (slider de explode %, eje +
  slider de section, hint de measure).
- Inspector (`EngineeringData`): "ENGINEERING DATA / REV. 01", tabs
  **Overview | Material | Dimensions | Manufacturing | Properties |
  Inspection**, luego lista "POINTS OF INTEREST" numerada (cada ítem hace
  `focus(hotspot)`), link a análisis, callout "Ask MECHAVIS AI", disclaimer.
- El asistente se abre como `Modal className="ai-drawer"` (drawer lateral).

### 8.4 Analysis (`/analysis`)

- Barra de modos: Stress | Thermal | Wear | Critical zones + label
  "CONCEPTUAL SIMULATION".
- Grid: panel modelo (con leyenda de gradiente low→high) + inspector con
  métrica grande (MPa / °C / riesgo / nº zonas), explicación, métricas
  secundarias, lista de hotspots "Focus a region", detalle de región, link
  "Ask about this component".
- Fila inferior: gráfica Recharts (Area de estrés / rampa térmica con play
  + slider / Barras de atención por zona) + panel "Read with context"
  que explica honestamente que es ilustrativo, no FEA.
- Modo térmico: playback animado de `thermalProgress` que tiñe el modelo.

### 8.5 Compare (`/compare`)

Selector de 2–3 componentes → radar chart normalizado + barras + tabla de
specs + "recommendation" por prioridades.

### 8.6 AI (`/ai`)

Selector de componente + grid: modelo (con "CONTEXT LINKED", métricas,
lista "Mapped regions" numerada que enfoca) + `AssistantPanel`.

---

## 9. El asistente (chat) en detalle

`AssistantPanel` — usado tanto en `/ai` como en el drawer del visor.

**Estructura del panel:**

1. Header: eyebrow "MECHAVIS / INTELLIGENCE" + título "Engineering copilot."
   + botones nueva conversación / cerrar.
2. Context bar: componente activo + chip "LOCAL SIMULATION".
3. Si hay hotspot seleccionado: pill "Focused: <nombre>" con X para quitar.
4. Conversación: estado vacío con marca + claim ("From geometry to
   understanding."), grid de **fast actions** (6 preguntas predefinidas con
   icono: Explain geometry / Critical regions / Manufacturing / Material
   choices / Failure modes / Optimize design), mensajes, y al final
   **insights** ("Engineering notes") como tarjetas con categoría + botón
   "Locate on model".
5. Composer: textarea con placeholder contextual ("Ask about <hotspot>…"),
   Enter envía / Shift+Enter newline, contador implícito (maxLength 1600),
   disclaimer "Simulated AI · curated component knowledge…".

**Comportamiento:**

- `ask()`: push mensaje user (con `context: nombre del hotspot seleccionado`)
  → `thinking` con animación de barras + botón Cancel (AbortController +
  request-id guard contra respuestas tardías) → respuesta.
- La respuesta renderiza: texto + **chips de regiones referenciadas**
  (click → `focus(hotspot)`, check si ya está enfocada) + `<details>`
  "Assumptions & limits" + insights.
- Efecto de foco automático: la primera `action: focus` (o referencia) de la
  respuesta mueve la cámara — **el asistente "señala" lo que explica**.
- El hotspot seleccionado se pasa al proveedor como contexto
  (`respond(component, prompt, selectedHotspotId)`): preguntar con una
  región enfocada sesga la respuesta a esa región.

Para el proyecto real: implementar `EngineeringAssistantProvider` contra un
LLM devolviendo el mismo `AssistantResponse` (structured output) conserva
toda la UX sin cambios.

---

## 10. Detalles de UX que completan el look

- **Command palette** `⌘K` (Radix Dialog): input con `kbd ESC`, lista
  filtrable (navegación + "Open <componente>" + toggles del visor +
  settings), flechas ↑↓ + Enter, footer mono.
- **Tool panels**: un `Modal` genérico que hospeda biblioteca de materiales,
  journey de manufactura o settings según `app-store.panel`.
- **Settings**: calidad (shadows/dpr), auto-rotate, reduced motion —
  persistidos; `MotionConfig reducedMotion` global; cámaras saltan sin
  animación.
- Accesibilidad: `aria-pressed` en toggles, `role=log`/`aria-live` en chat,
  `role=img` con descripción textual en gráficas, hints de teclado.
- Robustez 3D: error boundary + fallback SVG + retry, `webglcontextlost`,
  `frameloop` pausado fuera de viewport, DPR según calidad.
- "Datos honestos": disclaimers en inspector, análisis, chat, comparación.

---

## 11. Mapeo MECHAVIS → monitoreo de salud de astronautas

| MECHAVIS | Proyecto astronauta |
|---|---|
| `Component` (componente mecánico) | `CrewMember` / `Astronaut` (o "sistema": cuerpo, traje, hábitat) |
| `modelKind` (shaft, gear…) | `modelKind`: `body` (humano procedural), `suit`, `station`… |
| `Part` / `partId` (journal, spline…) | Regiones del cuerpo: `head, torso, heart, lungs, arm_l, arm_r, leg_l, leg_r, suit_helmet, suit_chestpack…` |
| `Hotspot` (región clickeable con finish/tolerance) | `BodyZone`/sensor: posición 3D, descripción, **vitals** (FC, SpO₂, temp, presión), `status` en vez de `criticality` |
| `Criticality` Low/Med/High | `HealthStatus`: `Nominal | Watch | Warning | Critical` |
| `analysis` (stress/thermal/wear) | Overlays: ** térmico corporal, esfuerzo cardiovascular, fatiga, radiación acumulada** — mismo `AnalysisMode` con vertex colors |
| `thermalProgress` playback | Reproducción de telemetría: scrub temporal de signos vitales |
| `failureModes` | `riskFactors` / condiciones: causa → prevención/mitigación |
| `materials` + alternativas | Protocolos/equipamiento, o biometría de referencia |
| `manufacturingProcess` journey | Timeline de misión: fases (lanzamiento, EVA, reentrada) o protocolo médico |
| `mechanicalProperties`/`dimensions` | Constantes vitales / antropometría (estatura, masa, VO₂ max…) |
| `inspection` | Checks médicos / thresholds de telemetría |
| `AIInsight` categories (Geometry/Material/Thermal…) | Categorías tipo `Cardio | Neuro | Musculoskeletal | Radiation | Environment | Nutrition` |
| `AssistantResponse.focus` | El médico-IA enfoca la región corporal que describe (mismo contrato) |
| Modo `measure` | Medir distancias → tal vez rango de movimiento / antropometría |
| Modo `explode` + `section` | Explode: capas del traje/EVA (casco, mochila PLSS, torso); section: corte anatómico |
| "INSPECTED · DEMO" | "MONITORED · SIM" / "TELEMETRY LIVE" |
| Explorer de componentes | Roster de la tripulación (fichas por astronauta) |
| Compare | Comparar signos vitales entre tripulantes o contra baseline |
| `?tool=` + `mechavis:command` | Renombrar evento (`astro:command`) mismo mecanismo |

**Adaptación del dominio de datos** — mínimo viable:

```ts
interface BodyZone {           // ex-Hotspot
  id; name; partId; position: Vec3;
  description: string;
  vitals: { label; value; unit; status }[];  // antes surfaceFinish/tolerance
  status: "Nominal" | "Watch" | "Warning" | "Critical";
}
interface CrewMember {         // ex-Component
  id; name; role; mission; subtitle;
  modelKind: "body" | "suit" | "station";
  description; biometrics: EngineeringProperty[];
  zones: BodyZone[];           // ex-hotspots
  risks: { name; cause; mitigation; zoneId }[];   // ex-failureModes
  telemetry: { hr; spo2; temp; exertion; explanations… }; // ex-analysis
  insights: AIInsight[];
  checks: EngineeringProperty[];  // ex-inspection
}
```

**Modelo 3D**: construir un `BodyModel` procedural con las mismas
primitivas (`Part`, `Solid` con preset tipo `skin|suit|visor` en vez de
metales): cápsulas/esferas para torso, cabeza, extremidades; cada región en
su `<Part id="heart">` etc. El sistema de selección, foco de cámara,
explode/section y tooltips funciona igual — solo cambian geometría y datos.

---

## 12. Checklist de replicación

1. Scaffold Next.js App Router + TS + Tailwind 4 + deps: `three
   @react-three/fiber @react-three/drei zustand motion recharts
   lucide-react @radix-ui/react-dialog @fontsource/inter
   @fontsource/ibm-plex-mono`.
2. Copiar `globals.css` (design tokens + clases semánticas) — ajustar
   acento si se quiere otro tono (ej. verde telemetría/cian médico).
3. Copiar `app-shell`, `command-palette`, `tool-panels`, `ui/primitives`.
4. Copiar `viewer-store`, `canvas-scene`, `model-viewport`,
   `preview-gallery`/`shared-gallery`, `models/primitives` (Part/Solid/
   contexto) — cambiar `explosion.ts` offsets y `analysis-colors` por
   paletas de salud (nominal→watch→warning→critical).
5. Redefinir `types` + `data` del dominio nuevo manteniendo la estructura
   entidad↔hotspots↔insights↔respuestas.
6. Crear el/los `*Model` procedurales nuevos (cuerpo/traje) con `partId`s
   coherentes con los hotspots.
7. Portar `engineering-workspace` (viewer + inspector + tooltip + drawer
   chat), `engineering-data` (tabs renombrados: Overview | Vitals |
   Biometrics | Mission | Risks | Checks), `viewer-toolbar`.
8. Portar `assistant-panel` + `mock-assistant` (nuevos intents:
   "¿cómo está su corazón?", "riesgo de radiación", "estado del traje"…)
   manteniendo `AssistantResponse`.
9. Renombrar el evento y las keys (`mechavis:*` → propio), `activeComponent`
   → `activeCrew`, labels del shell.
10. Rutas: `/` (hero con astronauta), `/crew`, `/crew/[id]` (monitor),
    `/telemetry` (ex-analysis), `/compare`, `/medic` (ex-ai).
11. Mantener: boot sequence, disclaimers ("telemetría simulada — no es
    diagnóstico médico"), palette ⌘K, settings, reduced motion, fallbacks.
