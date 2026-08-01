# Cómo colaborar

## Preparación

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Antes de subir cambios

```bash
npm run build
git diff --check
```

Usar una rama por etapa y no subir información financiera real, archivos `.env` ni credenciales.

## Pull requests

Cada pull request debe indicar:

- qué problema resuelve;
- cómo fue probado;
- capturas si cambia la interfaz;
- cambios de base de datos;
- riesgos o tareas pendientes.
