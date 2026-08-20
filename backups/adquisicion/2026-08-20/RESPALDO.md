# Respaldo previo a integración — Adquisición 2026

Fecha de corte: 2026-08-20

## Portal PRIME MX
- Repositorio: `LordSnow1980/prime`
- Rama de rollback: `backup-pre-adquisicion-20260820`
- Commit de corte: `e7e686871eb0235984bef9355d4edf568d65123b`
- Estado preservado: Portal + Biométricos + HUB + Auditoría IT antes de integrar Adquisición.

## Aplicación original de Adquisición
- Repositorio fuente: `lalzagaprime80-crypto/primemx-dashboard-equipos`
- Rama: `main`
- Commit fuente exacto: `0961d137d7f47c521463c2ccf901425da854f1aa`
- Archivo: `adquisicion_equipo_computo_2026.html`
- Blob Git exacto: `f0822a20f1cf12e2ba91eddd5897dda70e4b886c`
- Tamaño: `154323` bytes
- Título: `Adquisición equipo de cómputo 2026 · PrimeMX`

El repositorio fuente permanece intacto y es de solo lectura para esta integración. El commit y el blob anteriores permiten recuperar exactamente el código original.

## Backend legado identificado
- AUTH_API: `https://primemx-auth.luisalzaga1980.workers.dev`
- REPORT_ID: `adquisicion-2026`
- Reporte compartido: `/api/report`
- Historial: `/api/audit`

## Respaldo de datos vivos
Usar `exportar-respaldo.html` desde un navegador donde la aplicación legado ya tenga sesión iniciada. El exportador solo ejecuta lecturas GET y descarga localmente:
- JSON con reporte completo + historial.
- SHA-256 para comprobar integridad.

No publicar el JSON de datos vivos en este repositorio público. Conservarlo localmente y/o migrarlo después al backend privado central.