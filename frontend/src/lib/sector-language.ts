export type SectorMode = 'GENERIC' | 'COOPERATIVE_FINANCIAL' | 'BANKING' | 'INSURANCE' | 'OTHER';

export interface SectorVocabulary {
  organization: string;
  team: string;
  member: string;
  cycle: string;
  board: string;
  executive: string;
  objective: string;
  keyResult: string;
  initiative: string;
  diagnostic: string;
  support: string;
  strategicPageTitle: string;
}

const VOCABULARIES: Record<SectorMode, SectorVocabulary> = {
  GENERIC: {
    organization: "Organización",
    team: "Equipo",
    member: "Miembro",
    cycle: "Ciclo",
    board: "Consejo",
    executive: "Gerencia",
    objective: "Objetivo",
    keyResult: "Resultado Clave",
    initiative: "Iniciativa",
    diagnostic: "Diagnóstico",
    support: "Soporte",
    strategicPageTitle: "Objetivos Estratégicos",
  },
  COOPERATIVE_FINANCIAL: {
    organization: "Institución",
    team: "Área",
    member: "Socio",
    cycle: "Plan Estratégico",
    board: "Consejo de Administración",
    executive: "Gerencia General",
    objective: "Objetivo Estratégico",
    keyResult: "Indicador Clave",
    initiative: "Proyecto Estratégico",
    diagnostic: "Diagnóstico Institucional",
    support: "Mesa de Ayuda",
    strategicPageTitle: "Objetivos Estratégicos",
  },
  BANKING: {
    organization: "Entidad",
    team: "Área",
    member: "Cliente",
    cycle: "Ejercicio Estratégico",
    board: "Directorio",
    executive: "Dirección General",
    objective: "Objetivo Estratégico",
    keyResult: "Indicador de Gestión",
    initiative: "Proyecto",
    diagnostic: "Diagnóstico",
    support: "Soporte",
    strategicPageTitle: "Objetivos Estratégicos",
  },
  INSURANCE: {
    organization: "Compañía",
    team: "Área",
    member: "Asegurado",
    cycle: "Plan de Negocios",
    board: "Junta Directiva",
    executive: "Dirección Ejecutiva",
    objective: "Objetivo",
    keyResult: "Indicador Clave",
    initiative: "Iniciativa",
    diagnostic: "Diagnóstico",
    support: "Soporte",
    strategicPageTitle: "Objetivos Estratégicos",
  },
  OTHER: {
    organization: "Organización",
    team: "Equipo",
    member: "Miembro",
    cycle: "Ciclo",
    board: "Consejo",
    executive: "Gerencia",
    objective: "Objetivo",
    keyResult: "Resultado Clave",
    initiative: "Iniciativa",
    diagnostic: "Diagnóstico",
    support: "Soporte",
    strategicPageTitle: "Objetivos Estratégicos",
  },
};

export function getSectorVocabulary(sector?: string): SectorVocabulary {
  return VOCABULARIES[(sector as SectorMode) ?? 'GENERIC'] ?? VOCABULARIES.GENERIC;
}
