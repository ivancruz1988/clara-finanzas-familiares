# Sistema visual — Emerald Zenith

Referencia: proyecto de Google Stitch proporcionado por el propietario.

La referencia se utiliza solamente para el lenguaje visual. La arquitectura de información, módulos, navegación y modelo de datos de Clara no cambian.

## Paleta

| Uso | Color |
|---|---|
| Fondo principal | `#07110D` |
| Superficie | `#0D1D16` |
| Superficie elevada | `#12261D` |
| Bordes | `#294239` |
| Texto principal | `#F0F7F3` |
| Texto secundario | `#8FA69A` |
| Acción principal | `#20E88F` |
| Acción prioritaria | `#DFFF00` |
| Advertencia | `#F2AE59` |
| Error o exceso | `#FF7269` |

## Principios

- Contraste alto sobre fondo oscuro verdoso.
- Tarjetas con bordes discretos y profundidad suave.
- Esmeralda para acciones, progreso y estados saludables.
- Ámbar para compromisos o atención.
- Coral para egresos, excesos y errores.
- Lima reservado para una llamada prioritaria; no debe competir con el esmeralda.
- Espacios, jerarquía y estructura funcional permanecen sin cambios.

## Implementación

`app/theme.css` contiene únicamente sobrescrituras visuales y se carga después de `app/globals.css`. Esta separación permite modificar o retirar el tema sin afectar el layout.
