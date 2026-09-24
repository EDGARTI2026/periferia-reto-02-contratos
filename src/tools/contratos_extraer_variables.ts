import fs from 'fs/promises';
import path from 'path';
import { MensajeBuzon, ResultadoExtraccion } from '../types';

export async function contratos_extraer_variables(
  msg: MensajeBuzon,
  directorioBuzon: string
): Promise<ResultadoExtraccion> {

  let textoAdjunto = '';
  const rutaCarpetaMsg = path.join(directorioBuzon, msg.id);

  // 1. Lectura del archivo adjunto contrato.txt o declarado
  const nombreAdjunto = (msg.adjuntos && msg.adjuntos.length > 0)
    ? msg.adjuntos[0]
    : 'contrato.txt';

  const rutaAdjunto = path.join(rutaCarpetaMsg, nombreAdjunto);

  try {
    textoAdjunto = await fs.readFile(rutaAdjunto, 'utf-8');
  } catch (error) {
    try {
      const rutaFallback = path.join(rutaCarpetaMsg, 'contrato.txt');
      textoAdjunto = await fs.readFile(rutaFallback, 'utf-8');
    } catch (e) {
      // Continuar con el cuerpo si no hay adjunto
    }
  }

  const asunto = msg.asunto || '';
  const cuerpo = msg.cuerpo || msg.contenido || '';
  const fechaMsg = msg.fecha || msg.fecha_envio || new Date().toISOString();

  // Texto completo sin distinción de mayúsculas/minúsculas
  const textoCompleto = `${asunto}\n${cuerpo}\n${textoAdjunto}`;
  const textoMin = textoCompleto.toLowerCase();

  const camposDudosos: string[] = [];
  let factoresValidos = 0;
  const totalFactores = 5;

  // --- FACTOR 1: CLIENTE ---
  let cliente = '';
  const matchClienteExplicit = textoCompleto.match(/(?:cliente|contratante|empresa|raz[oó]n social):\s*([^\n\r]+)/i);
  
  if (matchClienteExplicit) {
    cliente = matchClienteExplicit[1].trim();
  } else {
    // Extracción de respaldo desde el Asunto
    const matchAsunto = asunto.match(/(?:contrato|otros[íi]|firma|rv:)?\s*([a-záéíóúñ0-9\s\.-]+?)(?:-|\$|fábrica|mesa|implementación|ampliación|cotización|$)/i);
    if (matchAsunto && matchAsunto[1].trim().length > 3) {
      cliente = matchAsunto[1].trim();
    }
  }

  // Limpieza del nombre del cliente
  cliente = cliente.replace(/^(contrato|rv:|firmado|marco)\s+/gi, '').trim().toUpperCase();

  if (cliente && cliente.length >= 3 && !cliente.includes('COTIZACIÓN')) {
    factoresValidos += 1;
  } else {
    camposDudosos.push('cliente');
  }

  // --- FACTOR 2: VALOR Y MONEDA ---
  let valor = 0;
  let moneda = 'COP';

  // Buscar patrones como: $150.000.000, USD 50,000, 150.000.000 COP, valor: 20000000
  const matchMoneda = textoCompleto.match(/(USD|COP|\$)/i);
  if (matchMoneda && matchMoneda[1].toUpperCase() === 'USD') {
    moneda = 'USD';
  }

  const matchValorNum = textoCompleto.match(/(?:valor|monto|cuant[ií]a|total|precio|por|suma de)?\s*(?:\$|usd|cop)?\s*([\d\.\,]{4,15})/i) ||
                        textoCompleto.match(/\$\s*([\d\.\,]+)/);

  if (matchValorNum) {
    let rawNum = matchValorNum[1].replace(/\./g, '').replace(',', '.');
    // Eliminar punto final si quedó de fin de oración
    if (rawNum.endsWith('.')) rawNum = rawNum.slice(0, -1);
    valor = parseFloat(rawNum) || 0;
  }

  if (valor > 0) {
    factoresValidos += 1;
  } else {
    camposDudosos.push('valor');
  }

  // --- FACTOR 3: FECHAS (INICIO Y FIN) ---
  const fechasEncontradas = textoCompleto.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  let fecha_inicio = fechaMsg.split('T')[0];
  let fecha_fin = '';

  if (fechasEncontradas.length >= 2) {
    fecha_inicio = fechasEncontradas[0];
    fecha_fin = fechasEncontradas[1];
    factoresValidos += 1;
  } else if (fechasEncontradas.length === 1) {
    fecha_inicio = fechasEncontradas[0];
    // Calcular 1 año después si solo hay inicio
    const dt = new Date(fecha_inicio);
    dt.setFullYear(dt.getFullYear() + 1);
    fecha_fin = dt.toISOString().split('T')[0];
    factoresValidos += 1;
  } else {
    // Buscar mención de vigencia en meses (ej: 12 meses)
    const matchMeses = textoMin.match(/vigencia:\s*(\d+)\s*meses/) || textoMin.match(/(\d+)\s*meses/);
    const meses = matchMeses ? parseInt(matchMeses[1], 10) : 12;

    const dtInicio = new Date(fecha_inicio);
    const dtFin = new Date(dtInicio);
    dtFin.setMonth(dtFin.getMonth() + meses);

    fecha_fin = dtFin.toISOString().split('T')[0];
    factoresValidos += 1; // Asignación válida por cálculo de vigencia
  }

  // --- FACTOR 4: RENOVACIÓN AUTOMÁTICA ---
  const renovacion_automatica = /renovaci[oó]n autom[aá]tica|pr[oó]rroga autom[aá]tica|renovable/.test(textoMin);
  factoresValidos += 1;

  // --- FACTOR 5: PÓLIZAS Y GARANTÍAS ---
  const requiere_poliza = /p[oó]liza|garant[ií]a|amparo|seguro/.test(textoMin);
  const polizas_cumplidas = /p[oó]liza adjunta|p[oó]liza verificada|p[oó]liza vigente|garant[ií]a emitida|cumplida/.test(textoMin);
  factoresValidos += 1;

  // Cálculo final de la puntuación de confianza (0.0 a 1.0)
  const confianza = parseFloat((factoresValidos / totalFactores).toFixed(2));

  return {
    msg_id: msg.id,
    cliente,
    objeto: asunto,
    valor,
    moneda,
    fecha_inicio,
    fecha_fin,
    renovacion_automatica,
    requiere_poliza,
    polizas_cumplidas,
    confianza,
    campos_dudosos: camposDudosos
  };
}