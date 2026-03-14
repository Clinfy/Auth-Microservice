# AGENTS.md

Guía operativa para agentes en este repositorio (`/extra/IdeaProjects/Auth-Microservice`).

## 1) Contexto del proyecto

- Servicio de autenticacion/autorizacion y gestion de usuarios.
- Stack principal: NestJS 11, TypeScript, PostgreSQL (TypeORM), Redis y RabbitMQ.
- Objetivo al trabajar aquí: cambios pequeños, seguros, trazables y alineados con los patrones existentes.
- Comandos importantes:
  - `npm run start:dev` - iniciar en modo desarrollo.
  -  `npm run start` - Inicia en modo de producción
  - `npm run format` - formatea el código según configuración del archivo `.prettierrc`.
  - `npm run test` - ejecuta pruebas unitarias encontradas en cada service como también tests de integración.
  - `npm run build` - compilar el proyecto.

## 2) Flujo de trabajo recomendado

1. Entender la tarea y revisar el contexto mínimo necesario.
2. Si la solicitud implica implementar, crear un archivo `.md` en `.agent/tasks` con un nombre alusivo a la implementación.
3. Debatir con la persona usuaria y fundamentar claramente qué se debe hacer antes de codificar.
4. Dejar esa planificación detallada en el archivo de `.agent/tasks`.
5. Una vez que ambas partes estén satisfechas con la planificación, leer siempre ese archivo desde disco (no desde memoria) antes de implementar, porque puede haber sido editado manualmente.
6. Implementar el cambio de forma puntual, evitando refactors amplios no solicitados.
7. Validar localmente con pruebas/lint/build según impacto.
8. Entregar resultado con:
   - qué se cambió,
   - por qué,
   - archivos tocados,
   - pasos de verificación ejecutados.

## 3) Convenciones de implementación

- Mantener consistencia con la arquitectura modular de NestJS ya presente.
- Reutilizar utilidades, patrones y nombres existentes antes de crear nuevos.
- No introducir dependencias nuevas sin justificación técnica clara.
- Priorizar cambios mínimos y enfocados al requerimiento.
- Respetar configuraciones del proyecto (lint, tests, tsconfig, estructura de carpetas).

## 4) Restricciones de seguridad y operación

- No exponer secretos en código, logs, pruebas ni documentación.
- No modificar `.env` real para forzar ejecuciones; usar `example.env` como referencia.
- Evitar acciones destructivas (borrados masivos, resets forzados, cambios irreversibles) salvo instrucción explícita.
- Verificar funcionamiento de los cambios antes de entregarlos ejecutando los tests y realizando una compilación.

## 5) Political Git NO NEGOCIABLE

Motivo: la persona usuaria revisa y ejecuta manualmente todas las acciones de Git.

- **NUNCA ejecutar `git add`**.
- **NUNCA crear commits** (incluye `git commit` y variantes).
- **NUNCA hacer push** (`git push` o equivalentes).
- **NUNCA crear Pull Requests** (CLI, API o UI).
- Se permite inspección de estado/diffs solo si la tarea lo requiere y sin alterar historial.

## 6) Preferencias de respuesta

- Responder en español, de forma breve, clara y accionable.
- Explicar primero el resultado y luego detalles clave.
- Incluir rutas de archivos modificados y comandos de verificación ejecutados.
- Si falta información crítica, hacer una única pregunta concreta con una recomendación por defecto.
