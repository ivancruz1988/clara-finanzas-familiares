# Vercel Reader MCP Server

Este servidor MCP integra la API de Vercel Reader para extraer y limpiar contenido de URLs directamente en Claude Code.

## ¿Qué es este servidor?

El servidor MCP (Model Context Protocol) de Vercel Reader permite que Claude acceda a una herramienta para:
- Extraer contenido limpio de cualquier URL
- Convertir HTML a markdown
- Obtener solo el contenido principal ignorando navegación y publicidad

## Herramientas disponibles

### `fetch_content`

Obtiene el contenido limpio de una URL usando Vercel Reader.

**Parámetros:**
- `url` (string, requerido): La URL de la cual extraer el contenido

**Respuesta:**
- Contenido limpio en formato markdown o texto

**Ejemplo de uso:**
```
fetch_content(url: "https://ejemplo.com/articulo")
```

## Cómo funciona

1. El servidor se ejecuta como un proceso Node.js
2. Claude comunica con el servidor mediante JSON-RPC sobre stdio
3. El servidor hace una solicitud POST a `https://reader.vercel.ai/api/content`
4. Vercel Reader procesa la URL y devuelve el contenido limpio
5. El servidor devuelve el resultado a Claude

## Configuración

El servidor está configurado en `.claude/settings.json`:

```json
{
  "mcpServers": {
    "vercel-reader": {
      "command": "node",
      "args": [".claude/mcp-servers/vercel-reader.js"],
      "disabled": false
    }
  }
}
```

## Pruebas

Para probar el servidor manualmente:

```bash
cd /home/user/clara-finanzas-familiares
node .claude/mcp-servers/vercel-reader.js
```

Luego envía un mensaje JSON (y presiona Ctrl+D):

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize"}
{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "fetch_content", "arguments": {"url": "https://ejemplo.com"}}}
```

## Limitaciones

- Requiere conexión a internet
- Depende de la disponibilidad de reader.vercel.ai
- El contenido disponible depende de la estructura de la página

## Mejoras futuras

- Agregar opciones de configuración (timeout, headers personalizados)
- Cachear resultados
- Soportar múltiples formatos de salida
- Agregar validación de URLs
