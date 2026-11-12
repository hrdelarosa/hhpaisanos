CREATE TABLE `recibos_asistencia` (
	`id` binary(16) NOT NULL,
	`usuario_id` binary(16) NOT NULL,
	`sesion_id` binary(16) NOT NULL,
	`operacion` varchar(40) NOT NULL,
	`clave` varchar(128) COLLATE utf8mb4_0900_bin NOT NULL,
	`recibido_en` datetime(6) NOT NULL,
	`fecha_local` date NOT NULL,
	`contenido` json NOT NULL,
	`estado` varchar(12) NOT NULL DEFAULT 'pending',
	`resultado` json,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `recibos_asistencia_id` PRIMARY KEY(`id`),
	CONSTRAINT `recibos_scope_unique` UNIQUE(`usuario_id`,`operacion`,`clave`),
	CONSTRAINT `recibos_resultado_check` CHECK((`recibos_asistencia`.`estado` = 'pending' AND `recibos_asistencia`.`resultado` IS NULL) OR (`recibos_asistencia`.`estado` IN ('completed', 'rejected') AND `recibos_asistencia`.`resultado` IS NOT NULL AND JSON_TYPE(`recibos_asistencia`.`resultado`) = 'OBJECT'))
);
--> statement-breakpoint
CREATE TABLE `registros_asistencia` (
	`id` binary(16) NOT NULL,
	`asignacion_id` binary(16) NOT NULL,
	`fecha_asistencia` date NOT NULL,
	`tipo` varchar(10) NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`vigente` tinyint DEFAULT 1,
	`registrado_en` datetime(6) NOT NULL,
	`registrado_por` binary(16) NOT NULL,
	`canal` varchar(20) NOT NULL,
	`recibo_id` binary(16),
	`anterior_id` binary(16),
	`latitud` decimal(9,6),
	`longitud` decimal(9,6),
	`precision_m` decimal(13,6),
	`motivo_sin_ubicacion` varchar(30),
	`estado` varchar(24) NOT NULL,
	`llegada_tardia` tinyint NOT NULL DEFAULT 0,
	`salida_temprana` tinyint NOT NULL DEFAULT 0,
	`politica_version` varchar(40) NOT NULL,
	`motivo_captura_manual` varchar(500),
	`motivo_correccion` varchar(500),
	`revisado_por` binary(16),
	`revisado_en` datetime(6),
	`motivo_decision` varchar(500),
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `registros_asistencia_id` PRIMARY KEY(`id`),
	CONSTRAINT `asistencia_version_unique` UNIQUE(`asignacion_id`,`fecha_asistencia`,`tipo`,`version`),
	CONSTRAINT `asistencia_vigente_unique` UNIQUE(`asignacion_id`,`fecha_asistencia`,`tipo`,`vigente`),
	CONSTRAINT `asistencia_recibo_unique` UNIQUE(`recibo_id`),
	CONSTRAINT `asistencia_anterior_unique` UNIQUE(`anterior_id`),
	CONSTRAINT `asistencia_tipo_check` CHECK(`registros_asistencia`.`tipo` IN ('entrada', 'salida')),
	CONSTRAINT `asistencia_version_check` CHECK(`registros_asistencia`.`version` > 0 AND (`registros_asistencia`.`vigente` IS NULL OR `registros_asistencia`.`vigente` = 1) AND (`registros_asistencia`.`version` = 1 OR `registros_asistencia`.`estado` <> 'accepted_automatic')),
	CONSTRAINT `asistencia_procedencia_check` CHECK((`registros_asistencia`.`version` = 1 AND `registros_asistencia`.`anterior_id` IS NULL AND `registros_asistencia`.`motivo_correccion` IS NULL) OR (`registros_asistencia`.`version` > 1 AND `registros_asistencia`.`anterior_id` IS NOT NULL AND `registros_asistencia`.`motivo_correccion` IS NOT NULL AND CHAR_LENGTH(TRIM(`registros_asistencia`.`motivo_correccion`)) > 0 AND `registros_asistencia`.`recibo_id` IS NULL)),
	CONSTRAINT `asistencia_canal_check` CHECK(`registros_asistencia`.`canal` IN ('web', 'manual') AND (`registros_asistencia`.`canal` <> 'manual' OR (`registros_asistencia`.`motivo_captura_manual` IS NOT NULL AND CHAR_LENGTH(TRIM(`registros_asistencia`.`motivo_captura_manual`)) > 0 AND `registros_asistencia`.`recibo_id` IS NULL)) AND (`registros_asistencia`.`version` <> 1 OR `registros_asistencia`.`canal` <> 'web' OR `registros_asistencia`.`recibo_id` IS NOT NULL)),
	CONSTRAINT `asistencia_ubicacion_check` CHECK((`registros_asistencia`.`latitud` IS NOT NULL AND `registros_asistencia`.`longitud` IS NOT NULL AND `registros_asistencia`.`precision_m` IS NOT NULL AND `registros_asistencia`.`latitud` BETWEEN -90 AND 90 AND `registros_asistencia`.`longitud` BETWEEN -180 AND 180 AND `registros_asistencia`.`precision_m` >= 0 AND `registros_asistencia`.`motivo_sin_ubicacion` IS NULL) OR (`registros_asistencia`.`latitud` IS NULL AND `registros_asistencia`.`longitud` IS NULL AND `registros_asistencia`.`precision_m` IS NULL AND `registros_asistencia`.`motivo_sin_ubicacion` IS NOT NULL AND `registros_asistencia`.`motivo_sin_ubicacion` IN ('permission_denied', 'position_unavailable', 'timeout', 'unsupported', 'insecure_context', 'unexpected_error'))),
	CONSTRAINT `asistencia_estado_check` CHECK(`registros_asistencia`.`estado` IN ('accepted_automatic', 'pending_review', 'accepted_administrative', 'rejected', 'annulled')),
	CONSTRAINT `asistencia_alertas_check` CHECK(`registros_asistencia`.`llegada_tardia` IN (0, 1) AND `registros_asistencia`.`salida_temprana` IN (0, 1) AND (`registros_asistencia`.`estado` <> 'accepted_automatic' OR (`registros_asistencia`.`llegada_tardia` = 0 AND `registros_asistencia`.`salida_temprana` = 0 AND `registros_asistencia`.`motivo_sin_ubicacion` IS NULL))),
	CONSTRAINT `asistencia_decision_check` CHECK((`registros_asistencia`.`revisado_por` IS NULL AND `registros_asistencia`.`revisado_en` IS NULL AND `registros_asistencia`.`motivo_decision` IS NULL AND `registros_asistencia`.`estado` IN ('accepted_automatic', 'pending_review')) OR (`registros_asistencia`.`revisado_por` IS NOT NULL AND `registros_asistencia`.`revisado_en` IS NOT NULL AND `registros_asistencia`.`motivo_decision` IS NOT NULL AND CHAR_LENGTH(TRIM(`registros_asistencia`.`motivo_decision`)) > 0 AND `registros_asistencia`.`estado` IN ('accepted_administrative', 'rejected', 'annulled')))
);
--> statement-breakpoint
ALTER TABLE `recibos_asistencia` ADD CONSTRAINT `recibos_asistencia_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `recibos_asistencia` ADD CONSTRAINT `recibos_asistencia_sesion_id_sesiones_id_fk` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `registros_asistencia` ADD CONSTRAINT `registros_asistencia_asignacion_id_asignaciones_id_fk` FOREIGN KEY (`asignacion_id`) REFERENCES `asignaciones`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `registros_asistencia` ADD CONSTRAINT `registros_asistencia_registrado_por_usuarios_id_fk` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `registros_asistencia` ADD CONSTRAINT `registros_asistencia_recibo_id_recibos_asistencia_id_fk` FOREIGN KEY (`recibo_id`) REFERENCES `recibos_asistencia`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `registros_asistencia` ADD CONSTRAINT `registros_asistencia_anterior_id_registros_asistencia_id_fk` FOREIGN KEY (`anterior_id`) REFERENCES `registros_asistencia`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `registros_asistencia` ADD CONSTRAINT `registros_asistencia_revisado_por_usuarios_id_fk` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;
