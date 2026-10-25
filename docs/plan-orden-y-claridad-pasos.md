# Plan: reordenar los pasos (Portada antes que Carta) y hacerlos más intuitivos para quien no es técnico

Estado: implementado y verificado con tests y build; sin subir a GitHub (pendiente de que el usuario lo pida).
## Context
El asistente y la lista numerada ya funcionan, pero el usuario pide dos cosas: (1) **intercambiar los pasos 3 y 4** (hoy «Tu carta» es el 3 y «Portada» el 4; deben quedar Portada = 3 y Carta = 4) y dejar el resto igual; (2) que cada paso se **entienda sin saber de páginas web**: hoy los nombres son técnicos («Portada», «Ambiente», «Pie de página», «Datos básicos», «Cifras», «Espacios y promociones», «Zona horaria»…) y falta una aclaración práctica al lado. Es un cambio **solo de frontend** (textos, orden y presentación); el backend, la API y los identificadores internos de los pasos (`basics`, `brand`, `hero`, `menu`, …) no cambian, así que los enlaces con `?paso=` siguen funcionando.

## 1. Nuevo orden
`basics → brand → hero → menu → about → ambience → booking → contact → publish`
- `admin/setup/setup-steps.ts`: reordenar `STEPS` (hero pasa a la posición 3 con `number: 3`; menu a la 4 con `number: 4`). El asistente (`setup.page.ts`: Atrás/Omitir/Continuar usan `STEPS[number ± 1]`), la lista (`site.page.ts`), el resumen de publicación (`publish-panel.ts`) y la tarjeta del resumen (`dashboard.page.ts`) se calculan a partir de `STEPS`, así que se reordenan solos.
- «Siguiente paso recomendado» (`nextPendingStep`) seguirá el nuevo orden.

## 2. Lenguaje claro: título amigable + «qué haces aquí» + ejemplo + «dónde lo ve tu cliente»
`StepDef` gana dos campos (`short`: lo que haces, en una línea; `example`: ejemplo concreto) y se reescriben `title`, `why` y `where` en tono cotidiano. Las etiquetas de obligatoriedad también: «Obligatorio» → **«Necesario para publicar»**, «Recomendado» → **«Muy recomendable»**, «Opcional» → **«Puedes hacerlo después»**.

| # | Antes | **Título nuevo** | Qué haces aquí (`short`) | Ejemplo | Lo verá tu cliente en |
|---|---|---|---|---|---|
| 1 | Datos básicos | **Tu negocio** | Dile al mundo cómo te llamas y a qué WhatsApp te escriben | «Café Aurora · Bar y cocina» | El nombre arriba de tu página y el botón «Reservar» |
| 2 | Logo y colores | **Tu marca** | Sube tu logo y elige los colores de tu página | Logo cuadrado + color de tu local | El logo arriba, y los botones y detalles con tus colores |
| 3 | Portada | **Tu portada** | La primera pantalla: foto grande, título y frase de bienvenida | «Donde la noche sabe mejor» | Lo primero que ve al entrar a tu página |
| 4 | Tu carta | **Tu carta** | Tus platos y bebidas con precio y foto | «Mojito — $180» | La sección «La carta» |
| 5 | Nosotros | **Tu historia** | Cuenta quién eres: un texto, fotos y números que dan confianza | «Desde 2012 · 120 destilados» | La sección «Nosotros» |
| 6 | Ambiente | **Fotos de tu local** | Muestra cómo es tu lugar y tus promos | Terraza, barra, «Happy hour» | La sección «El ambiente» |
| 7 | Reservas | **Reservas por WhatsApp** | Elige dónde pueden sentarse y para cuántas personas | Zonas: Terraza, Salón · Grupos de 2 a 10 | El formulario de reserva |
| 8 | Contacto y pie de página | **Contacto y horarios** | Teléfono, dirección y horarios para que te encuentren | «Lun a Vie 18-02» | Al final de la página |
| 9 | Publicar | **Publicar tu página** | Revisa que todo esté listo y haz visible tu página | — | Todo tu sitio, para cualquiera con el enlace |

Se actualizan también `wizard`/`dashboard`/`publish-panel` donde se mencionan títulos («Siguiente: …», «Continuar: …», resumen de publicación).

## 3. Intuitividad en pantalla
- **Lista numerada** (`site/site.page.ts`): cada fila muestra un **icono** del paso, el título nuevo, la línea `short`, y un chip de colores «Se ve en: …»; el estado en lenguaje llano («Listo», «Falta el WhatsApp», «Puedes hacerlo después»).
- **Asistente** (`setup/setup.page.ts`): encabezado «Paso 3 de 9 · Tu portada»; los círculos del selector muestran el título como tooltip y el actual lleva su título debajo (en pantallas anchas).
- **Cuadro «¿Para qué sirve?»** al inicio de cada editor (`setup/step-editor.ts`): qué haces, un ejemplo y «Así lo verá tu cliente» (enlaza con la vista previa: «Mira abajo/arriba cómo queda»). Sustituye al texto técnico actual.
- **Etiquetas de campos en lenguaje cotidiano + ejemplo/placeholder** (`setup/step-forms.ts`), por ejemplo:
  - «Tipo de negocio» → «¿Qué tipo de negocio es?» (ej. Bar y cocina)
  - «Idioma y formato» → «Idioma y formato de precios»; «Zona horaria» → «Zona horaria (para las fechas de reserva)»
  - «Color de acento» → «Color secundario (detalles)»
  - «Frase corta de la portada» → «Frase de bienvenida» (ej. Desde 2012); «Etiqueta sobre la foto» → «Texto pequeño sobre la foto»
  - «Frases que se desplazan bajo la portada» → «Cinta de frases (texto que se mueve bajo la portada)»
  - «Cifras» → «Números destacados» (ej. 12 · años de historia); «Espacios y promociones» → «Lugares y promos» (ej. Terraza · Aire libre y música)
  - «Zonas para reservar» → «¿Dónde pueden sentarse?»; «Opciones de personas» → «¿Para cuántas personas?»
  - «Texto del pie de página» → «Mensaje final de tu página»
- Los mensajes de error y avisos no cambian de significado; solo se ajusta el vocabulario donde nombran un campo renombrado.

## Archivos críticos
`src/app/admin/setup/setup-steps.ts` (orden, títulos, `short`, `example`, etiquetas de obligatoriedad), `step-editor.ts` (cuadro «¿Para qué sirve?»), `step-forms.ts` (etiquetas y ejemplos), `site/site.page.ts` (filas con icono/chip), `setup/setup.page.ts` (encabezado y tooltips), `setup/publish-panel.ts` y `admin/dashboard.page.ts` (textos que citan pasos), `docs/como-funciona.md` (tabla de pasos). Specs a actualizar: `setup-steps.spec.ts` (orden y números), `site.page.spec.ts`, `setup.page.spec.ts` y `admin.spec.ts` (títulos y «N. título»). Reutiliza `Field` (`hint`), la lista y el asistente existentes; no hay cambios de backend.

## Verificación
- `npm test -- --watch=false` y `npm run build`: el orden de `STEPS` y los números 1–9 (Portada = 3, Carta = 4), que «Atrás/Omitir/Continuar» y «Siguiente paso» siguen el nuevo orden, que las rutas `?paso=hero|menu` abren el paso correcto y que todos los textos nuevos aparecen (títulos, `short`, ejemplo, chips, etiquetas de obligatoriedad).
- Chrome real (escritorio y móvil, claro/oscuro): ver la lista y el asistente con el nuevo orden y copy, comprobar que la carta (paso 4) mantiene el ida y vuelta con `?from=setup`, que la vista previa sigue resaltando la sección correcta en cada paso y que no hay desbordes ni errores de consola.
- Actualizar `docs/como-funciona.md` y subir a GitHub si el usuario lo pide.

## Riesgos
- Renombrar títulos rompe varios specs que buscan texto literal: se actualizan en bloque con el nuevo vocabulario.
- Textos más largos en filas y tooltips: se revisa el desborde en 360 px.
- Quien ya completó pasos no pierde nada: el estado depende de los datos guardados, no del número del paso.
