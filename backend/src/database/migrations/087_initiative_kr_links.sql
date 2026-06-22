-- Migration 087: Link initiatives to their related Key Results
-- Based on thematic alignment of initiative scope and KR content

INSERT INTO initiative_key_results (initiative_id, kr_id) VALUES

-- INI-4: Programa Brasilia — Transformación Digital Institucional
('40a33fea-0898-44cc-b1cc-fb43a6535aa0', '8e1aa74d-8cb2-4779-bab6-0c10832f0a2f'),  -- KR-4  % componentes Brasilia
('40a33fea-0898-44cc-b1cc-fb43a6535aa0', '94ad9aa1-7844-4348-8f1c-b639a8ddcc86'),  -- KR-5  adopción digital accionista
('40a33fea-0898-44cc-b1cc-fb43a6535aa0', '97e665a7-2369-4c02-b14a-3b6b531a2b52'),  -- KR-49 % procesos digitalizados PEI
('40a33fea-0898-44cc-b1cc-fb43a6535aa0', '856c1024-6b81-4d63-a030-858d081151c1'),  -- KR-50 madurez tecnológica PEI

-- INI-5: Brasilia M — Modernización Tecnológica
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', '578ce80c-46ea-41e1-9deb-e905db3f2412'),  -- KR-6  % procesos automatizados
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', '9e044f82-98bf-4424-88c3-2a99a1a629cf'),  -- KR-7  nivel madurez tecnológica
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', '40b8ac1a-e4f7-4a44-bb00-e7fc8b4118a9'),  -- KR-8  disponibilidad plataformas
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', 'ea34d78e-f501-4223-a450-d4aebe5c5796'),  -- KR-34 % módulos Brasilia Q2
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', '9c8ec926-eaa5-4382-ab3d-2f1a26aed286'),  -- KR-35 incidentes críticos Q2
('f5e211cd-e108-4001-9c2c-8ba2d8f96363', '33851de2-aa50-47a6-89c8-14f5e99c82e9'),  -- KR-36 disponibilidad plataformas Q2

-- INI-6: Brasilia N — Nuevos Canales y Servicios Digitales
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', 'b9d722e5-59ec-4663-943a-68a0f6ac1115'),  -- KR-26 % accionistas acceso digital
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', '203b3732-bebc-42e7-a89d-3c9b58e092c6'),  -- KR-43 tiempo espera sucursales
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', '499fecff-5ce9-4964-8733-f6ed496c8a54'),  -- KR-44 NPS canal digital
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', 'e4483213-847b-4072-8e54-ad78a4ce5278'),  -- KR-45 transacciones digitales
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', '9349f359-3826-483f-9861-6aa137ae3a21'),  -- KR-51 % transacciones digitales PEI
('2a0c56f0-79d4-4e8e-ba9d-3f05d71bc075', 'eb64ef82-5cc9-4bdc-8174-9304c23614d4'),  -- KR-67 % accionistas digital PEI

-- INI-7: Brasilia C — Cumplimiento Regulatorio SUGEF
('a68541ba-5dc0-4a10-8cf0-3dde68838f45', 'b24eec5a-0740-45d3-a0eb-a46adb721ad7'),  -- KR-14 % hallazgos SGF cerrados
('a68541ba-5dc0-4a10-8cf0-3dde68838f45', '1db7bea6-94eb-4308-b29b-da8131f870ed'),  -- KR-15 suficiencia patrimonial
('a68541ba-5dc0-4a10-8cf0-3dde68838f45', 'a58b7c63-b2b3-407e-b6e3-fd2f7c69bd13'),  -- KR-37 hallazgos SGF Q2
('a68541ba-5dc0-4a10-8cf0-3dde68838f45', '064fbd6a-fe93-4fe5-b570-f6a73dcfd569'),  -- KR-38 suficiencia patrimonial Q2
('a68541ba-5dc0-4a10-8cf0-3dde68838f45', '8523abed-cec0-4953-822b-46d89a8203b7'),  -- KR-39 LCR Q2

-- INI-8: Diseño de Nuevos Productos Financieros 2026
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', '9ebd5334-cc6d-4dec-ba8b-cf11ea9d4fad'),  -- KR-19 nuevos productos lanzados
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', '008bfa0d-ae34-40e6-923d-fd336a70d5ff'),  -- KR-20 crecimiento accionistas
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', 'db3c4020-1def-4363-aef8-a71b08a479e0'),  -- KR-40 educadores en piloto
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', 'f9ee0914-1ba6-4ec4-8aeb-fd01d7fc6d31'),  -- KR-41 NPS piloto
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', '29a871b4-c56f-4b4f-8999-9cf26161483c'),  -- KR-42 tasa conversión piloto
('5819d7d0-3924-4c4c-b65f-a224fd0d55b1', '5af760c6-c9af-476d-b948-af3e320ca184'),  -- KR-62 nuevos productos PEI

-- INI-9: Modernización del Core Bancario
('cd709a8d-c80d-477f-adb6-9feaf3c69664', '40b8ac1a-e4f7-4a44-bb00-e7fc8b4118a9'),  -- KR-8  disponibilidad plataformas
('cd709a8d-c80d-477f-adb6-9feaf3c69664', '33851de2-aa50-47a6-89c8-14f5e99c82e9'),  -- KR-36 disponibilidad plataformas Q2
('cd709a8d-c80d-477f-adb6-9feaf3c69664', 'd3334236-cfbf-4206-94ae-bd928f9400b8'),  -- KR-52 disponibilidad anual PEI
('cd709a8d-c80d-477f-adb6-9feaf3c69664', '9c8ec926-eaa5-4382-ab3d-2f1a26aed286'),  -- KR-35 incidentes críticos Q2

-- INI-10: Primer Reporte ASG Institucional
('35a0613f-e99c-49c0-9184-7ed4967472e8', '66e50450-303d-4f93-b651-bd1144efc46a'),  -- KR-31 reporte ASG
('35a0613f-e99c-49c0-9184-7ed4967472e8', '422ed555-a408-4b12-bb03-ed6429bf7f4d'),  -- KR-32 certificaciones ambientales
('35a0613f-e99c-49c0-9184-7ed4967472e8', 'd4ada7e5-fca8-4641-b9b1-6c80768400f8'),  -- KR-70 reporte ASG PEI
('35a0613f-e99c-49c0-9184-7ed4967472e8', '2f2b8c5c-782c-47c2-8b58-ea1731bf648a'),  -- KR-72 transparencia PEI

-- INI-11: BMR 2026 — Business Model Review
('d3a35baf-7952-47d6-929a-69c663472e9e', '0941dee4-f2c5-4beb-a81e-65ac739cd7b3'),  -- KR-21 participación mercado
('d3a35baf-7952-47d6-929a-69c663472e9e', '40c761c5-d22c-43c1-9dc2-559f581bbc21'),  -- KR-22 % ingresos canales digitales
('d3a35baf-7952-47d6-929a-69c663472e9e', '10b3db02-0062-4b86-8e77-aacd2cc7aa48'),  -- KR-61 participación mercado PEI
('d3a35baf-7952-47d6-929a-69c663472e9e', '5af760c6-c9af-476d-b948-af3e320ca184'),  -- KR-62 nuevos productos PEI
('d3a35baf-7952-47d6-929a-69c663472e9e', '992cb822-d808-4195-ae43-1de114b2d6b4'),  -- KR-63 % ingresos nuevos productos
('d3a35baf-7952-47d6-929a-69c663472e9e', '6eee592b-491b-48c3-8382-49693e1c88ac'),  -- KR-64 crecimiento accionistas PEI

-- INI-12: Estrategia de Inclusión Financiera del Magisterio
('edbaee1b-23dd-47ba-b8d2-936160b63c7b', '008bfa0d-ae34-40e6-923d-fd336a70d5ff'),  -- KR-20 crecimiento accionistas
('edbaee1b-23dd-47ba-b8d2-936160b63c7b', '10b3db02-0062-4b86-8e77-aacd2cc7aa48'),  -- KR-61 participación mercado educador
('edbaee1b-23dd-47ba-b8d2-936160b63c7b', '6eee592b-491b-48c3-8382-49693e1c88ac'),  -- KR-64 crecimiento accionistas PEI
('edbaee1b-23dd-47ba-b8d2-936160b63c7b', '7b455dd0-f26e-446b-83d6-1114e3e076d7'),  -- KR-23 NPS productos y servicios

-- INI-13: Fortalecimiento del Sistema Integral de Gestión de Riesgos
('f8f58f10-890f-4b02-b023-454760de4ae6', 'f69cede2-909e-4ec9-98f2-768c7a5617e7'),  -- KR-16 ROA
('f8f58f10-890f-4b02-b023-454760de4ae6', '94c0f580-39ab-4715-afbc-d9bcd9f2fa5c'),  -- KR-17 índice morosidad
('f8f58f10-890f-4b02-b023-454760de4ae6', '6d34fad0-3f3c-44c8-a6dc-f92eaa8f05a7'),  -- KR-18 LCR
('f8f58f10-890f-4b02-b023-454760de4ae6', '598ac5d1-a83b-4405-9ec4-8ead320f29ed'),  -- KR-57 ISP PEI
('f8f58f10-890f-4b02-b023-454760de4ae6', 'f4f60474-8acb-455f-8d0a-f535cfc11387'),  -- KR-58 ROA PEI
('f8f58f10-890f-4b02-b023-454760de4ae6', '0d5e514a-7260-48fa-888b-baa3b6e0637a'),  -- KR-59 morosidad PEI
('f8f58f10-890f-4b02-b023-454760de4ae6', 'a4fa4475-b707-423a-ab3c-01dc4abd8398'),  -- KR-60 hallazgos SUGEF sin cerrar

-- INI-14: Implementación Sistema de Medición IEA/IADE
('a0adf4ba-0154-4915-aacd-896c975fd039', '894d1598-0909-4491-839e-b2585c2eaf85'),  -- KR-24 IEA
('a0adf4ba-0154-4915-aacd-896c975fd039', '4ba947c8-d219-4de7-98c1-ea5d95b50096'),  -- KR-25 NPS institucional
('a0adf4ba-0154-4915-aacd-896c975fd039', 'b29f329b-008b-4fb2-b0b7-391217e49ff4'),  -- KR-27 tiempo resolución solicitudes
('a0adf4ba-0154-4915-aacd-896c975fd039', '3a54fc80-601c-4509-9c47-aad2dc52f08c'),  -- KR-28 IADE
('a0adf4ba-0154-4915-aacd-896c975fd039', '6211775e-d751-4862-a97b-b4caf57032b4'),  -- KR-65 NPS PEI
('a0adf4ba-0154-4915-aacd-896c975fd039', 'ba12ff6b-87d7-4501-a558-23dc404ad8d0'),  -- KR-66 IEA PEI
('a0adf4ba-0154-4915-aacd-896c975fd039', 'cc3e0343-d69e-45ad-9294-c81a4c65aa61'),  -- KR-68 tiempo resolución PEI

-- INI-15: Proyecto Canal Digital 2.0 — App y Banca en Línea
('f173b94f-4c5f-419a-8ade-91ce940da41c', '94ad9aa1-7844-4348-8f1c-b639a8ddcc86'),  -- KR-5  adopción digital accionista
('f173b94f-4c5f-419a-8ade-91ce940da41c', 'b9d722e5-59ec-4663-943a-68a0f6ac1115'),  -- KR-26 % accionistas acceso digital
('f173b94f-4c5f-419a-8ade-91ce940da41c', '499fecff-5ce9-4964-8733-f6ed496c8a54'),  -- KR-44 NPS canal digital
('f173b94f-4c5f-419a-8ade-91ce940da41c', 'e4483213-847b-4072-8e54-ad78a4ce5278'),  -- KR-45 transacciones digitales Q2
('f173b94f-4c5f-419a-8ade-91ce940da41c', '9349f359-3826-483f-9861-6aa137ae3a21'),  -- KR-51 % transacciones digitales PEI
('f173b94f-4c5f-419a-8ade-91ce940da41c', 'eb64ef82-5cc9-4bdc-8174-9304c23614d4'),  -- KR-67 % accionistas digital PEI

-- INI-16: Programa de Desarrollo de Liderazgo Estratégico
('388d84e1-3fe0-4ec0-ba44-30b8eaf8ea40', '9d99854c-e996-4260-b6a8-07836d16fc0e'),  -- KR-10 % líderes competencias transformación
('388d84e1-3fe0-4ec0-ba44-30b8eaf8ea40', '97bec5ae-9573-443e-a24e-6936df03db58'),  -- KR-11 adopción prácticas colaborativas
('388d84e1-3fe0-4ec0-ba44-30b8eaf8ea40', 'ef1418d4-75c6-4bd8-a1f9-4dced2d38e6f'),  -- KR-53 clima organizacional PEI
('388d84e1-3fe0-4ec0-ba44-30b8eaf8ea40', '5c03f751-cdd8-44ac-94cd-ace2d67c0424'),  -- KR-54 % líderes certificados
('388d84e1-3fe0-4ec0-ba44-30b8eaf8ea40', '45fc957c-9533-4d51-af8f-c1315c1b089a'),  -- KR-55 rotación no deseada

-- INI-17: Plan de Acción SGF-2095-2025 — Cumplimiento SUGEF
('2c6ddfef-b05c-4133-b217-506d171d0d0b', 'b24eec5a-0740-45d3-a0eb-a46adb721ad7'),  -- KR-14 % hallazgos SGF cerrados
('2c6ddfef-b05c-4133-b217-506d171d0d0b', 'd679b8cf-59d6-4751-9757-e9983635faa7'),  -- KR-29 % hallazgos GC cerrados
('2c6ddfef-b05c-4133-b217-506d171d0d0b', 'a58b7c63-b2b3-407e-b6e3-fd2f7c69bd13'),  -- KR-37 hallazgos SGF Q2
('2c6ddfef-b05c-4133-b217-506d171d0d0b', 'a4fa4475-b707-423a-ab3c-01dc4abd8398'),  -- KR-60 hallazgos críticos PEI
('2c6ddfef-b05c-4133-b217-506d171d0d0b', '39065206-3cc2-4489-abe5-fd2916152e0b'),  -- KR-71 % hallazgos GC PEI

-- INI-18: Actualización del Manual de Gobierno Corporativo
('ae61f594-7ece-4f0f-aeea-5ce774e99291', 'd679b8cf-59d6-4751-9757-e9983635faa7'),  -- KR-29 % hallazgos GC cerrados
('ae61f594-7ece-4f0f-aeea-5ce774e99291', '9246a34d-e807-45b8-b7af-af604bac205e'),  -- KR-30 score GC SUGEF
('ae61f594-7ece-4f0f-aeea-5ce774e99291', '3b19a603-95af-4512-9fe0-e8fa076dd30a'),  -- KR-33 transparencia institucional
('ae61f594-7ece-4f0f-aeea-5ce774e99291', 'c74378ad-30db-4817-9094-b56df7c020c2'),  -- KR-69 score GC PEI
('ae61f594-7ece-4f0f-aeea-5ce774e99291', '2f2b8c5c-782c-47c2-8b58-ea1731bf648a'),  -- KR-72 transparencia PEI

-- INI-19: Programa de Gestión del Cambio — Transformación PEI
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', '9f9161b1-690d-452b-b111-4d718cfa21a9'),  -- KR-9  índice clima organizacional
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', '9d99854c-e996-4260-b6a8-07836d16fc0e'),  -- KR-10 % líderes competencias
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', '97bec5ae-9573-443e-a24e-6936df03db58'),  -- KR-11 adopción prácticas colaborativas
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', 'd9b13b54-d680-44bf-b1a9-13e4ae4ade25'),  -- KR-12 rotación no deseada
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', 'c819daea-d63e-4373-be72-bc9f16ccc6a2'),  -- KR-13 NPS interno
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', 'ef1418d4-75c6-4bd8-a1f9-4dced2d38e6f'),  -- KR-53 clima organizacional PEI
('5cde77e2-4b66-43c8-8fcb-8de30d5c2497', 'd561dd0e-93d4-4276-9817-f6503bb152fc')   -- KR-56 NPS interno PEI

ON CONFLICT DO NOTHING;
