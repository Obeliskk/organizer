# Mi agenda

Organizador semanal y mensual, sin dependencias ni cuentas.

## Funciones

- Bandeja lateral para tareas pendientes sin día.
- Asignación mediante arrastrar y soltar o con el menú de cada tarea.
- Vistas de semana y mes con navegación entre periodos.
- Selección de un día haciendo clic en su tarjeta.
- Feriados públicos de Chile con su motivo, datos regionales y caché local.
- Filtros, progreso, tema claro/oscuro y almacenamiento en el navegador.

## Ejecutar

Abre `index.html` directamente en tu navegador, o desde esta carpeta ejecuta:

```powershell
python -m http.server 8000
```

Luego visita <http://localhost:8000>.

Las tareas, la vista, los feriados consultados y el tema se guardan localmente en el navegador. La consulta de feriados utiliza la API pública de Nager.Date para Chile y conserva una copia para cargas posteriores.
