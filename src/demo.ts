import path from 'path';
import fs from 'fs/promises';
import { contratos_leer_buzon } from './tools/contratos_leer_buzon';
import { contratos_extraer_variables } from './tools/contratos_extraer_variables';
import { contratos_buscar_similares } from './tools/contratos_buscar_similares';
import { contratos_registrar_actualizar, registrar_evento_historial } from './tools/contratos_registrar_actualizar';
import { contratos_generar_alertas } from './tools/contratos_generar_alertas';
import { RegistroContrato } from './types';

async function runDemo() {
  console.log('=== INICIANDO DEMO REGISTRO DE CONTRATOS VIGENTES (RETO 02) ===\n');

  const rutaBuzon = path.join(process.cwd(), 'fixtures/buzones/contratos');
  const rutaCsv = path.join(process.cwd(), 'fixtures/maestro-contratos.csv');
  
  await fs.mkdir('out', { recursive: true });

  const mensajes = await contratos_leer_buzon(rutaBuzon);
  console.log(`[1] Correos leídos del buzón: ${mensajes.length}`);

  const contratosActuales: RegistroContrato[] = [];

  for (const msg of mensajes) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Procesando Correo: ${msg.id} | Asunto: "${msg.asunto}"`);

    const extraccion = await contratos_extraer_variables(msg, rutaBuzon);
    console.log(` -> Confianza de extracción: ${extraccion.confianza}`);

    // CASO 1: Confianza baja (< 0.8)
    if (extraccion.confianza < 0.8) {
      console.log(` ⚠️ ATENCIÓN: Confianza baja (${extraccion.confianza}). Retenido para revisión humana.`);
      
      // REGISTRO EN HISTORIAL (Intermedio / Retenido)
      await registrar_evento_historial(msg.id, 'retenido_baja_confianza', {
        confianza: extraccion.confianza,
        campos_dudosos: extraccion.campos_dudosos,
        cliente_detectado: extraccion.cliente
      });
      console.log(` 📝 Trazabilidad registrada en out/historial.jsonl [retenido_baja_confianza]`);

    } else {
      const busqueda = contratos_buscar_similares(extraccion, contratosActuales);

      // CASO 2: Es un Otrosí válido
      if (busqueda.accionSugerida === 'actualizacion_otrosi') {
        console.log(` 🔄 OTROSÍ DETECTADO: Actualizando contrato existente ID: ${busqueda.contratoExistente?.id_contrato}`);
        const actualizado: RegistroContrato = {
          ...busqueda.contratoExistente!,
          valor: busqueda.contratoExistente!.valor + extraccion.valor,
          fecha_fin: extraccion.fecha_fin || busqueda.contratoExistente!.fecha_fin,
          origen_msg_id: msg.id,
          fecha_registro: new Date().toISOString()
        };
        
        await contratos_registrar_actualizar(rutaCsv, contratosActuales, actualizado, 'actualizacion_otrosi');
        console.log(` ✅ OTROSÍ REGISTRADO en CSV e Historial auditado.`);

      // CASO 3: Es un Otrosí pero NO existe el contrato principal
      } else if (busqueda.accionSugerida === 'contrato_padre_no_encontrado') {
        console.log(` ⚠️ ALERTA DE GOBIERNO: Se recibió un Otrosí para ${extraccion.cliente}, pero el contrato principal NO existe.`);
        
        // REGISTRO EN HISTORIAL (Alerta de Gobierno)
        await registrar_evento_historial(msg.id, 'alerta_padre_no_encontrado', {
          cliente: extraccion.cliente,
          asunto: msg.asunto,
          valor_otrosi: extraccion.valor
        });
        console.log(` 📝 Trazabilidad registrada en out/historial.jsonl [alerta_padre_no_encontrado]`);

      // CASO 4: Es un duplicado exacto
      } else if (busqueda.accionSugerida === 'duplicado') {
        console.log(` ℹ️ Mensaje duplicado detectado. Se omite el registro en CSV.`);
        
        await registrar_evento_historial(msg.id, 'duplicado_omitido', {
          contrato_existente_id: busqueda.contratoExistente?.id_contrato
        });
        console.log(` 📝 Trazabilidad registrada en out/historial.jsonl [duplicado_omitido]`);

      // CASO 5: Contrato nuevo
      } else {
        const nuevoContrato: RegistroContrato = {
          id_contrato: `CTR-${extraccion.cliente.substring(0, 3)}-2026`,
          cliente: extraccion.cliente,
          objeto: extraccion.objeto,
          valor: extraccion.valor,
          moneda: extraccion.moneda,
          fecha_inicio: extraccion.fecha_inicio,
          fecha_fin: extraccion.fecha_fin,
          renovacion_automatica: extraccion.renovacion_automatica,
          requiere_poliza: extraccion.requiere_poliza,
          polizas_cumplidas: extraccion.polizas_cumplidas,
          estado: 'vigente',
          origen_msg_id: msg.id,
          fecha_registro: new Date().toISOString()
        };

        await contratos_registrar_actualizar(rutaCsv, contratosActuales, nuevoContrato, 'registro_nuevo');
        console.log(` ✅ NUEVO CONTRATO REGISTRADO en CSV e Historial auditado.`);
      }
    }
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`[3] Generando Reporte Directivo de Alertas...`);
  await contratos_generar_alertas(contratosActuales, '2026-09-03');
  console.log(` ✅ Reporte generado en 'out/alertas.md'`);
  
  console.log('\n=== PROCESO DE VERIFICACIÓN COMPLETADO CON ÉXITO ===');
}

runDemo().catch(console.error);