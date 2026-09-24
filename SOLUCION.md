### Solución Reto 02 — Agente conversacional "Registro de Contratos Vigentes"

### 1. Resumen Ejecutivo
Esta solución implementa un agente conversacional para la gestión, clasificación y registro de contratos vigentes en Periferia IT Group. Resuelve la problemática del proceso operativo congelado tras la salida del gestor del área, garantizando trazabilidad, validación por nivel de confianza y reportes de alertas para la Alta Dirección.

### 2. Arquitectura de la Solución
* **Arquitectura Orientada a Herramientas (Tool Use):** Bucle de razonamiento decoupled donde las herramientas (`src/tools/`) ejecutan operaciones deterministas sobre archivos locales.
* **Manejo de Errores y Confianza:** Lógica de evaluación de confianza (< 0.8) que detiene automáticamente registros dudosos para validación del operador.
* **Persistencia y Auditoría:** Actualización atómica en `fixtures/contratos.csv` y log append-only en `out/historial.jsonl`.

### 3. Comandos de Ejecución y Pruebas
```bash
# Instalación
npm install -D tsx

# Ejecución de la prueba determinista de verificación
run tsx src/demo.ts

### REGLAS DE NEGOCIO Y GOBERNANZA OBLIGATORIAS (RN1 - RN5)
1. **Validación de Confianza (RN1):** Si el nivel de confianza de extracción es menor a 0.8 (< 0.8) o faltan campos obligatorios (`cliente`, `fecha_fin`, `valor`), el mensaje se clasifica como `requiere_revision`. NUNCA registres un contrato dudoso en el CSV maestro sin solicitar confirmación explícita al usuario en la sesión de chat.
2. **Deduplicación (RN2):** Busca coincidencias exactas o altas similitudes de `cliente` y `objeto`. Si ya existe en el maestro con los mismos datos, marca como `duplicado`. Si es un otrosí o extensión, marca como `actualización`.
3. **Confirmación Humana (RN3):** Cuando un registro quede retenido en `requiere_revision`, presenta los campos extraídos vs. los dudosos y pregunta al usuario: *"¿Deseas confirmar manualmente estos datos para proceder con el registro en el maestro?"*.
4. **Trazabilidad (RN4):** Cada actualización debe generar un registro en `out/historial.jsonl` con marca de tiempo y origen (`msg_id`).
5. **Alertas Directivas (RN5):** Al finalizar el procesamiento, genera el reporte de control `out/alertas.md` clasificando contratos por vencer en ≤ 60 días y pólizas faltantes.
