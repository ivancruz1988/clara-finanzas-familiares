# Configuración del MCP Server de Vercel Reader

## 📋 Descripción General

Se ha implementado un servidor MCP (Model Context Protocol) que integra la API de Vercel Reader en Claude Code. Esto permite que Claude acceda automáticamente a una herramienta para extraer contenido limpio de URLs.

## 🎯 ¿Qué se ha implementado?

### 1. **MCP Server** (`.claude/mcp-servers/vercel-reader.js`)
   - Servidor Node.js que implementa el protocolo MCP
   - Se comunica con Vercel Reader API (`https://reader.vercel.ai/api/content`)
   - Herramienta: `fetch_content` - Extrae contenido limpio de URLs

### 2. **Configuración de Claude** (`.claude/settings.json`)
   - Registra el servidor MCP en Claude Code
   - El servidor se inicia automáticamente cuando abres el proyecto

### 3. **Librería TypeScript** (`lib/vercel-reader.ts`)
   - Cliente para usar Vercel Reader directamente desde código
   - Funciones de utilidad (metadata, validación, formato)
   - Retry automático con backoff exponencial

### 4. **API Route** (`app/api/reader/route.ts`)
   - Endpoint POST para usar desde la aplicación Next.js
   - Integración segura con validación de entrada
   - Retorna contenido y metadatos

### 5. **Componente React** (`components/VercelReaderExample.tsx`)
   - Ejemplo funcional de cómo usar la API
   - Interfaz para ingresar URLs y ver contenido
   - Muestra metadatos como tiempo de lectura estimado

### 6. **Tipos TypeScript** (`lib/mcp-types.ts`)
   - Definiciones de tipos para MCP
   - Tipos específicos para Vercel Reader

## 🚀 Cómo usar

### Opción 1: Desde Claude Code (Recomendado)

Una vez que abras el proyecto en Claude Code, Claude tendrá automáticamente acceso a la herramienta `fetch_content` de Vercel Reader. Puedes pedirle a Claude que:

```
"Extrae el contenido de https://example.com y cuéntame el resumen"
"Fetch content from https://blog.example.com/article"
```

### Opción 2: Desde la Aplicación Next.js

**En la aplicación web:**

1. Importa el componente:
```tsx
import VercelReaderExample from '@/components/VercelReaderExample';

export default function Page() {
  return <VercelReaderExample />;
}
```

**En código TypeScript/JavaScript:**

```typescript
import { fetchContentFromURL } from '@/lib/vercel-reader';

const content = await fetchContentFromURL('https://example.com');
console.log(content);
```

**Via API HTTP:**

```bash
curl -X POST http://localhost:3000/api/reader \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Opción 3: Directamente desde el Servidor MCP

```bash
node .claude/mcp-servers/vercel-reader.js
```

Luego envía mensajes JSON-RPC:

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize"}
{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "fetch_content", "arguments": {"url": "https://example.com"}}}
```

## 📁 Estructura de Archivos

```
proyecto/
├── .claude/
│   ├── settings.json                    # Configuración del MCP
│   ├── MCP_SETUP.md                    # Este archivo
│   └── mcp-servers/
│       ├── vercel-reader.js            # Servidor MCP principal
│       ├── test.mjs                    # Script de pruebas
│       └── README.md                   # Documentación del servidor
├── lib/
│   ├── mcp-types.ts                    # Tipos para MCP
│   └── vercel-reader.ts                # Cliente Vercel Reader
├── app/
│   └── api/reader/
│       └── route.ts                    # API endpoint
└── components/
    └── VercelReaderExample.tsx         # Componente de ejemplo
```

## 🧪 Pruebas

Ejecuta el script de prueba:

```bash
node .claude/mcp-servers/test.mjs
```

Pruebas que se ejecutan:
- ✅ Inicio del servidor
- ✅ Mensaje de inicialización
- ✅ Endpoint tools/list

## ⚙️ Configuración Personalizada

### Modificar timeout o reintentos

En `lib/vercel-reader.ts`:

```typescript
const content = await fetchContentFromURL(url, {
  timeout: 60000,  // 60 segundos
  retries: 5,      // 5 intentos
});
```

### Cambiar el endpoint de Vercel Reader

Si usas un servidor Vercel Reader diferente, edita:
- `.claude/mcp-servers/vercel-reader.js` - líneas 110-112
- `lib/vercel-reader.ts` - línea 39

## 🔒 Consideraciones de Seguridad

1. **Validación de URLs**: El cliente TypeScript valida URLs antes de hacer requests
2. **HTTPS obligatorio**: Solo acepta URLs HTTP/HTTPS válidas
3. **Timeout**: Todas las peticiones tienen timeout para evitar cuelgues
4. **Error handling**: Errores se reportan de forma segura sin exponer detalles internos

## 📊 Respuesta de Ejemplo

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "content": "Lorem ipsum dolor sit amet...",
    "metadata": {
      "wordCount": 1234,
      "estimatedReadTime": 6,
      "preview": "Lorem ipsum dolor sit amet, consectetur adipiscing elit..."
    }
  }
}
```

## ⚠️ Limitaciones

1. **Dependencia externa**: Requiere conexión a `reader.vercel.ai`
2. **Rate limiting**: Vercel Reader puede tener límites de uso
3. **Disponibilidad de contenido**: Depende de la estructura HTML de la página
4. **CORS**: Solo disponible desde el servidor, no desde el navegador directamente

## 🐛 Solución de Problemas

### El servidor no inicia
- Verifica que Node.js esté instalado: `node --version`
- Comprueba que el archivo tiene permisos de ejecución: `chmod +x .claude/mcp-servers/vercel-reader.js`

### No se conecta a Vercel Reader
- Verifica la conexión a internet
- Comprueba que `reader.vercel.ai` esté disponible
- Revisa los logs del servidor para mensajes de error

### Claude no usa la herramienta
- Asegúrate de que `.claude/settings.json` esté correctamente configurado
- Reinicia Claude Code
- Verifica que el servidor se inició sin errores

## 📚 Referencias

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Vercel Reader API](https://reader.vercel.ai/)
- [Claude Code Documentation](https://claude.ai/code)

## 🔄 Próximos Pasos

Posibles mejoras futuras:

1. **Cacheo de contenido**: Guardar contenido fetched para reducir requests
2. **Soporte para diferentes formatos**: HTML, XML, PDF, etc.
3. **Extracción de metadatos**: Title, description, autor, fecha
4. **Integración con base de datos**: Guardar artículos fetched
5. **Rate limiting local**: Para manejar límites de Vercel Reader
6. **Configuración avanzada**: Headers personalizados, autenticación, proxies

## 💡 Casos de Uso

1. **Research y Análisis**: Claude puede leer artículos y hacer análisis
2. **Resúmenes**: Crear resúmenes automáticos de contenido web
3. **Extracción de datos**: Obtener información específica de páginas
4. **Integración con IA**: Usar contenido como contexto para prompts
5. **Procesamiento de noticias**: Leer y procesar artículos de noticias

---

**Última actualización**: 2026-08-21
**Versión**: 1.0.0
**Estado**: ✅ Implementado y funcional
