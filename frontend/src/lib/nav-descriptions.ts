export interface PageInfo {
  tagline: string;
  description: string;
  color: "blue" | "rose" | "violet" | "amber" | "gray";
}

export const PAGE_INFO: Record<string, PageInfo> = {
  "/welcome":           { color: "blue",   tagline: "Tu punto de partida",                        description: "Vista general del estado de la organización: ciclos activos, alertas de riesgo y accesos rápidos a las áreas más importantes del sistema." },
  "/traceability":      { color: "blue",   tagline: "El corazón del sistema",                     description: "Muestra la alineación completa de la estrategia a la ejecución en una sola vista: desde las intenciones estratégicas hasta los check-ins más recientes. Aquí se ve si toda la organización está apuntando en la misma dirección." },
  "/sector-assessment": { color: "rose",   tagline: "Entiende el entorno antes de actuar",        description: "Evaluación estructurada de las amenazas y oportunidades del sector. Proporciona el contexto externo que debe guiar la estrategia. Sin diagnóstico sectorial, los objetivos se definen en el vacío." },
  "/problems":          { color: "rose",   tagline: "Identifica lo que frena a la organización",  description: "Mapeo de problemas, brechas y fricciones internas. Convierte síntomas en causas raíz accionables que la estrategia y los OKRs deben resolver." },
  "/strategy":          { color: "blue",   tagline: "El por qué y el hacia dónde",                description: "Define la identidad estratégica de la organización: intenciones estratégicas, visión, categorías de prioridad (crecimiento, eficiencia, cultura…). Es el punto de partida. Sin esto, lo demás no tiene norte." },
  "/program":           { color: "blue",   tagline: "El qué a gran escala",                       description: "Traduce el mapa estratégico en programas de transformación concretos: grandes iniciativas multi-año, hitos clave y dependencias entre áreas. Es el puente entre la visión y los objetivos medibles." },
  "/strategic":         { color: "blue",   tagline: "El qué medir este ciclo",                    description: "Convierte la hoja de ruta en objetivos con resultados clave para el ciclo actual. Aquí aparece el progreso real: porcentaje de avance, confianza y estado de cada objetivo estratégico." },
  "/tactical":          { color: "violet", tagline: "La estrategia aterrizada al equipo",         description: "Objetivos de equipo que traducen los OKRs estratégicos a compromisos concretos. Cada objetivo táctico debe poder rastrearse hasta un objetivo estratégico padre." },
  "/checkins":          { color: "violet", tagline: "El pulso de la organización",                description: "Actualizaciones periódicas de progreso y confianza sobre los OKRs activos. Los check-ins revelan si el equipo avanza, si hay bloqueos y si la confianza en alcanzar los resultados sube o baja." },
  "/initiatives":       { color: "violet", tagline: "Las acciones que mueven los números",        description: "Proyectos, programas y acciones concretas que impulsan directamente los key results. Una iniciativa sin OKR asociado es trabajo sin propósito; un OKR sin iniciativas es un deseo sin plan." },
  "/delivery":          { color: "violet", tagline: "Control de lo que se entrega",               description: "Seguimiento de entregables por iniciativa: qué debe salir, cuándo y en qué estado. Da visibilidad al ritmo de ejecución del equipo." },
  "/backlog":           { color: "violet", tagline: "Todo lo que espera ser trabajado",           description: "Lista priorizada de trabajo pendiente organizada por valor e impacto. Lo que no está en el backlog no existe para el equipo." },
  "/sprints":           { color: "violet", tagline: "Ejecución en ciclos cortos",                 description: "Organización del trabajo en sprints para mantener el enfoque, medir la velocidad del equipo y hacer ajustes frecuentes sin perder de vista los objetivos." },
  "/reports":           { color: "amber",  tagline: "Datos que guían decisiones",                 description: "Dashboards consolidados de progreso, confianza y resultados por ciclo, área y equipo. Convierte los datos del sistema en información accionable para líderes y directivos." },
  "/reports/governance":{ color: "amber",  tagline: "Compromisos que se cumplen o se explican",  description: "Seguimiento formal de acuerdos, compromisos y decisiones estratégicas. La gobernanza OKR asegura que lo que se promete en cada ciclo tenga un responsable visible y un estado actualizado." },
  "/reports/consejo":   { color: "amber",  tagline: "La voz ejecutiva hacia la junta",           description: "Informes ejecutivos estructurados para presentar ante la junta directiva o el consejo de administración: estado estratégico, riesgos clave y decisiones pendientes." },
  "/portfolio":         { color: "amber",  tagline: "Vista consolidada de todo",                  description: "Visión agregada de todas las organizaciones gestionadas. Permite comparar el desempeño estratégico entre empresas y detectar patrones comunes desde un solo lugar." },
  "/ai-assistant":      { color: "gray",   tagline: "Tu analista estratégico siempre disponible", description: "Agente de IA entrenado en los datos de tu organización. Analiza riesgos, sugiere alineaciones, detecta inconsistencias en los OKRs y responde preguntas estratégicas en lenguaje natural." },
  "/getting-started":   { color: "gray",   tagline: "De cero a operativo en minutos",             description: "Guía paso a paso para configurar la organización, invitar al equipo y lanzar el primer ciclo OKR. Diseñada para que cualquier persona pueda avanzar sin necesidad de formación previa." },
  "/docs":              { color: "gray",   tagline: "El conocimiento que necesitas cuando lo necesitas", description: "Documentación completa de la plataforma: metodología OKR, referencia de funcionalidades, guías de roles y mejores prácticas. Consulta técnica y conceptual en un solo lugar." },
};

export function getPageInfo(pathname: string): PageInfo | null {
  if (PAGE_INFO[pathname]) return PAGE_INFO[pathname];
  // Match prefix for nested routes (e.g. /reports/governance)
  const match = Object.keys(PAGE_INFO)
    .filter(k => pathname.startsWith(k) && k !== "/")
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_INFO[match] : null;
}
