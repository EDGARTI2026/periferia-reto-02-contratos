import fs from 'fs/promises';
import path from 'path';
import { RegistroContrato } from '../types';

/**
 * Escribe una línea de trazabilidad de forma append-only en out/historial.jsonl
 */
export async function registrar_evento_historial(
  msgId: string,
  accion: 'registro_nuevo' | 'actualizacion_otrosi' | 'retenido_baja_confianza' | 'alerta_padre_no_encontrado' | 'duplicado_omitido',
  detalle: any
): Promise<void> {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    msg_id: msgId,
    accion,
    detalle
  }) + '\n';

  await fs.mkdir('out', { recursive: true });
  await fs.appendFile(path.join('out', 'historial.jsonl'), logEntry, 'utf-8');
}

/**
 * Actualiza o inserta el contrato en maestro-contratos.csv y registra el historial
 */
export async function contratos_registrar_actualizar(
  rutaCsv: string,
  contratosActuales: RegistroContrato[],
  nuevoRegistro: RegistroContrato,
  accionHistorial: 'registro_nuevo' | 'actualizacion_otrosi' = 'registro_nuevo'
): Promise<void> {
  // 1. Actualizar el arreglo en memoria
  const index = contratosActuales.findIndex(c => c.id_contrato === nuevoRegistro.id_contrato);
  if (index >= 0) {
    contratosActuales[index] = nuevoRegistro;
  } else {
    contratosActuales.push(nuevoRegistro);
  }

  // 2. Reescribir el CSV maestro
  const header = 'id_contrato,cliente,objeto,valor,moneda,fecha_inicio,fecha_fin,renovacion_automatica,requiere_poliza,polizas_cumplidas,estado,origen_msg_id,fecha_registro\n';
  const filas = contratosActuales.map(c => 
    `${c.id_contrato},"${c.cliente}","${c.objeto}",${c.valor},${c.moneda},${c.fecha_inicio},${c.fecha_fin},${c.renovacion_automatica},${c.requiere_poliza},${c.polizas_cumplidas},${c.estado},${c.origen_msg_id},${c.fecha_registro}`
  ).join('\n');

  await fs.writeFile(rutaCsv, header + filas, 'utf-8');

  // 3. Guardar evento exitoso en out/historial.jsonl
  await registrar_evento_historial(nuevoRegistro.origen_msg_id, accionHistorial, nuevoRegistro);
}