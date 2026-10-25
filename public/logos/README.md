# Deliora — identidad visual

Generada a partir de la imagen de referencia `public/images/portada.jpeg` (logo «Deliora» con una campana de servicio sobre una mano).

- `deliora-logo.png`: logo completo (nombre + campana + mano) recortado y con fondo transparente. Pensado para fondos claros.
- `deliora-icon-master.png`: símbolo (la campana con el vapor) sobre fondo crema, 1024 × 1024. Es el maestro de todos los iconos.
- `favicon.ico` (16, 32 y 48 px) e `icon-16.png`, `icon-32.png`, `icon-48.png`: iconos del navegador.
- `icon-180.png`: Apple Touch Icon.
- `icon-192.png` e `icon-512.png`: iconos para aplicaciones y accesos directos.

`public/favicon.ico` es una copia de `favicon.ico`. `index.html` referencia los iconos de esta carpeta; el componente `BrandMark` usa `icon-192.png` como logo por defecto.

Paleta del logo: marrón café `#2E1507`, cobre `#A8672A`, oro `#E0A850` y crema `#FFF6EC` (fondo de los iconos).

## Cómo se generaron

Son PNG rasterizados, no vectores. Se procesaron con un script que quita el fondo blanco del logo conservando los degradados (cada píxel se convierte a transparencia sobre blanco, sin halos), recorta el logo completo y extrae la campana para el símbolo. Los tamaños pequeños se reescalan desde esa misma campana con un margen algo menor para que se lea a 16 px. Si más adelante tienes el logo en SVG o con fondo transparente, sustituye `deliora-logo.png` y `deliora-icon-master.png` y vuelve a generar los tamaños.
