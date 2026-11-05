CREATE TABLE `permisos` (
	`id` binary(16) NOT NULL,
	`codigo` varchar(100) NOT NULL,
	`descripcion` varchar(500),
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `permisos_id` PRIMARY KEY(`id`),
	CONSTRAINT `permisos_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `rol_permisos` (
	`rol_id` binary(16) NOT NULL,
	`permiso_id` binary(16) NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `rol_permisos_rol_id_permiso_id_pk` PRIMARY KEY(`rol_id`,`permiso_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` binary(16) NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`nombre` varchar(100) NOT NULL,
	`descripcion` varchar(355),
	`activo` boolean NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_codigo_unique` UNIQUE(`codigo`),
	CONSTRAINT `roles_activo_check` CHECK(`roles`.`activo` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` binary(16) NOT NULL,
	`rol_id` binary(16) NOT NULL,
	`nombre_usuario` varchar(50) NOT NULL,
	`nombre_completo` varchar(150) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`activo` boolean NOT NULL,
	`debe_cambiar_password` boolean NOT NULL,
	`password_cambiada_en` datetime(6),
	`intentos_fallidos` smallint unsigned NOT NULL,
	`bloqueado_hasta` datetime(6),
	`ultimo_acceso_en` datetime(6),
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `usuarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `usuarios_nombre_usuario_unique` UNIQUE(`nombre_usuario`),
	CONSTRAINT `usuarios_activo_check` CHECK(`usuarios`.`activo` IN (0, 1)),
	CONSTRAINT `usuarios_cambiar_password_check` CHECK(`usuarios`.`debe_cambiar_password` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` binary(16) NOT NULL,
	`usuario_id` binary(16) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`ultima_actividad_en` datetime(6) NOT NULL,
	`expira_por_inactividad_en` datetime(6),
	`expira_en_absoluto` datetime(6) NOT NULL,
	`revocada_en` datetime(6),
	`revocada_por` binary(16),
	`motivo_revocacion` varchar(255),
	`ip` varchar(45),
	`user_agent` varchar(500),
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `sesiones_id` PRIMARY KEY(`id`),
	CONSTRAINT `sesiones_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `auditoria` (
	`id` binary(16) NOT NULL,
	`usuario_id` binary(16),
	`sesion_id` binary(16),
	`accion` varchar(100) NOT NULL,
	`tipo_entidad` varchar(100) NOT NULL,
	`entidad_id` binary(16),
	`valores_anteriores` json,
	`valores_nuevos` json,
	`motivo` varchar(500),
	`canal` varchar(20),
	`ip` varchar(45),
	`user_agent` varchar(500),
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `auditoria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observadores` (
	`id` binary(16) NOT NULL,
	`nombres` varchar(100) NOT NULL,
	`apellidos` varchar(100) NOT NULL,
	`telefono` varchar(20),
	`usuario_id` binary(16),
	`activo` boolean NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `observadores_id` PRIMARY KEY(`id`),
	CONSTRAINT `observadores_usuario_id_unique` UNIQUE(`usuario_id`),
	CONSTRAINT `observadores_activo_check` CHECK(`observadores`.`activo` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `conceptos_atencion` (
	`id` binary(16) NOT NULL,
	`clave` varchar(40) NOT NULL,
	`nombre` varchar(150) NOT NULL,
	`orden` smallint NOT NULL,
	`requiere_especificacion` boolean NOT NULL,
	`activo` boolean NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `conceptos_atencion_id` PRIMARY KEY(`id`),
	CONSTRAINT `conceptos_atencion_clave_unique` UNIQUE(`clave`),
	CONSTRAINT `conceptos_especificacion_check` CHECK(`conceptos_atencion`.`requiere_especificacion` IN (0, 1)),
	CONSTRAINT `conceptos_activo_check` CHECK(`conceptos_atencion`.`activo` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `modulos_atencion` (
	`id` binary(16) NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`municipio` varchar(100) NOT NULL,
	`latitud` decimal(9,6),
	`longitud` decimal(9,6),
	`radio_validacion_m` smallint unsigned,
	`activo` boolean NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `modulos_atencion_id` PRIMARY KEY(`id`),
	CONSTRAINT `modulos_coordenadas_pares_check` CHECK((`modulos_atencion`.`latitud` IS NULL AND `modulos_atencion`.`longitud` IS NULL) OR (`modulos_atencion`.`latitud` IS NOT NULL AND `modulos_atencion`.`longitud` IS NOT NULL)),
	CONSTRAINT `modulos_latitud_check` CHECK(`modulos_atencion`.`latitud` BETWEEN -90 AND 90),
	CONSTRAINT `modulos_longitud_check` CHECK(`modulos_atencion`.`longitud` BETWEEN -180 AND 180),
	CONSTRAINT `modulos_activo_check` CHECK(`modulos_atencion`.`activo` IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `operativos` (
	`id` binary(16) NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`fecha_inicio` date NOT NULL,
	`fecha_fin` date NOT NULL,
	`estado` varchar(20) NOT NULL,
	`tolerancia_minutos` smallint unsigned,
	`precision_maxima_m` smallint unsigned,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `operativos_id` PRIMARY KEY(`id`),
	CONSTRAINT `operativos_fechas_check` CHECK(`operativos`.`fecha_inicio` <= `operativos`.`fecha_fin`),
	CONSTRAINT `operativos_estado_check` CHECK(`operativos`.`estado` IN ('borrador', 'activo', 'cerrado'))
);
--> statement-breakpoint
CREATE TABLE `asignaciones` (
	`id` binary(16) NOT NULL,
	`operativo_id` binary(16) NOT NULL,
	`observador_id` binary(16) NOT NULL,
	`modulo_id` binary(16) NOT NULL,
	`fecha` date NOT NULL,
	`hora_inicio` time NOT NULL,
	`hora_fin` time NOT NULL,
	`cancelada_en` datetime(6),
	`activa` tinyint GENERATED ALWAYS AS (CASE WHEN cancelada_en IS NULL THEN 1 ELSE NULL END) STORED,
	`creado_por` binary(16) NOT NULL,
	`creado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	`actualizado_en` datetime(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
	CONSTRAINT `asignaciones_id` PRIMARY KEY(`id`),
	CONSTRAINT `asignaciones_activa_unique` UNIQUE(`operativo_id`,`observador_id`,`modulo_id`,`fecha`,`hora_inicio`,`hora_fin`,`activa`),
	CONSTRAINT `asignaciones_horario_check` CHECK(`asignaciones`.`hora_inicio` >= '00:00:00' AND `asignaciones`.`hora_fin` <= '23:59:59' AND `asignaciones`.`hora_fin` > `asignaciones`.`hora_inicio`)
);
--> statement-breakpoint
ALTER TABLE `rol_permisos` ADD CONSTRAINT `rol_permisos_rol_id_roles_id_fk` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `rol_permisos` ADD CONSTRAINT `rol_permisos_permiso_id_permisos_id_fk` FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_rol_id_roles_id_fk` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_revocada_por_usuarios_id_fk` FOREIGN KEY (`revocada_por`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_sesion_id_sesiones_id_fk` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `observadores` ADD CONSTRAINT `observadores_usuario_id_usuarios_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `asignaciones` ADD CONSTRAINT `asignaciones_operativo_id_operativos_id_fk` FOREIGN KEY (`operativo_id`) REFERENCES `operativos`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `asignaciones` ADD CONSTRAINT `asignaciones_observador_id_observadores_id_fk` FOREIGN KEY (`observador_id`) REFERENCES `observadores`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `asignaciones` ADD CONSTRAINT `asignaciones_modulo_id_modulos_atencion_id_fk` FOREIGN KEY (`modulo_id`) REFERENCES `modulos_atencion`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `asignaciones` ADD CONSTRAINT `asignaciones_creado_por_usuarios_id_fk` FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `usuarios_rol_activo_idx` ON `usuarios` (`rol_id`,`activo`);--> statement-breakpoint
CREATE INDEX `sesiones_usuario_idx` ON `sesiones` (`usuario_id`);--> statement-breakpoint
CREATE INDEX `auditoria_entidad_idx` ON `auditoria` (`tipo_entidad`,`entidad_id`);--> statement-breakpoint
CREATE INDEX `auditoria_usuario_fecha_idx` ON `auditoria` (`usuario_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `asignaciones_observador_fecha_idx` ON `asignaciones` (`observador_id`,`fecha`);--> statement-breakpoint
CREATE INDEX `asignaciones_modulo_fecha_idx` ON `asignaciones` (`modulo_id`,`fecha`);
