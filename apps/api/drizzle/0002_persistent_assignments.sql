-- Refuse to reinterpret legacy daily assignments. This guard also prevents inserts
-- between the empty-table check and the structural change. Apply with API writes stopped.
ALTER TABLE `asignaciones` ADD CONSTRAINT `asignaciones_0002_empty_guard` CHECK (1 = 0);
--> statement-breakpoint
ALTER TABLE `asignaciones`
  DROP CHECK `asignaciones_0002_empty_guard`,
  DROP INDEX `asignaciones_activa_unique`,
  DROP INDEX `asignaciones_observador_fecha_idx`,
  DROP INDEX `asignaciones_modulo_fecha_idx`,
  DROP COLUMN `fecha`,
  ADD COLUMN `vigente_desde` date NOT NULL,
  ADD COLUMN `vigente_hasta` date NOT NULL,
  ADD COLUMN `version_bloqueo` int unsigned NOT NULL DEFAULT 1,
  ADD CONSTRAINT `asignaciones_vigencia_check` CHECK (`vigente_desde` <= `vigente_hasta`),
  ADD CONSTRAINT `asignaciones_version_check` CHECK (`version_bloqueo` > 0),
  ADD UNIQUE INDEX `asignaciones_activa_unique` (`operativo_id`,`observador_id`,`modulo_id`,`vigente_desde`,`vigente_hasta`,`hora_inicio`,`hora_fin`,`activa`),
  ADD INDEX `asignaciones_observador_vigencia_idx` (`observador_id`,`vigente_desde`,`vigente_hasta`),
  ADD INDEX `asignaciones_modulo_vigencia_idx` (`modulo_id`,`vigente_desde`,`vigente_hasta`);
