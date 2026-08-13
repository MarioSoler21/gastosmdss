# Gastos MDSS

App web (PWA, instalable en móvil) para registrar gastos e ingresos, conectada directamente a un Google Sheet mediante una Service Account (sin login de usuario).

## Estructura de datos

**Hoja "Gastos"** (columnas A→L): Fecha, CUENTA, CATEGORIA, DESCRIPCION, MONEDA, MONTO, Monto Real L, Monto $, MES, Semana, Hormiga, Hormiga_flag

**Hoja "Ingresos"** (columnas A→I): Fecha, Medio, Cliente, Moneda, Monto, Monto Real, Monto $, Mes, Semana

La app calcula automáticamente al guardar: **MES**, **Semana**, **Monto Real L** y **Monto $** (usando el tipo de cambio configurado en la pestaña Config), y **Hormiga / Hormiga_flag** a partir del checkbox "¿Es un gasto hormiga?".

### Suposiciones hechas (avísame si alguna no es correcta y la ajusto)
- **MONEDA** solo admite `L` (Lempiras) o `$` (Dólares).
- **Semana** = semana dentro del mes (Semana 1 a 5), no semana del año.
- **Hormiga_flag** = `TRUE`/`FALSE` según el checkbox; **Hormiga** = `Sí`/`No`.
- El tipo de cambio es un valor manual editable en la pestaña **Config** de la app (no se consulta en línea).

## Configuración inicial

1. **Instalar dependencias**
   ```
   npm install
   ```

2. **Credenciales de Google**
   - Copia tu archivo de Service Account a `credentials/service-account.json`.
   - Comparte el Google Sheet (con permiso de Editor) con el email de esa Service Account.

3. **Variables de entorno**
   - Copia `.env.example` a `.env`.
   - Rellena `SPREADSHEET_ID` con el ID de tu Google Sheet.
   - Ajusta `GASTOS_SHEET_NAME` / `INGRESOS_SHEET_NAME` si tus pestañas tienen otro nombre.

4. **Ejecutar**
   ```
   npm start
   ```
   Abre http://localhost:3000

5. **Instalar como app en el celular**
   - Abre la URL en Chrome/Safari desde el móvil (misma red o mediante túnel como ngrok).
   - Menú del navegador → "Agregar a pantalla de inicio" / "Instalar app".
