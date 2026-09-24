import fs from 'fs/promises';
import path from 'path';
import { RegistroContrato } from '../types';

export async function contratos_generar_alertas(
  contratos: RegistroContrato[],
  fechaCorteStr: string = '2026-09-03'
): Promise<string> {
  const fechaCorte = new Date(fechaCorteStr);

  const vencidos = contratos.filter(c => new Date(c.fecha_fin) < fechaCorte);
  const porVencer = contratos.filter(c => {
    const fFin = new Date(c.fecha_fin);
    const diffDias = (fFin.getTime() - fechaCorte.getTime()) / (1000 * 3600 * 24);
    return diffDias >= 0 && diffDias <= 30;
  });
  const sinPoliza = contratos.filter(c => c.requiere_poliza && !c.polizas_cumplidas);

  let markdown = `# REPORTE DIRECTIVO DE ALERTAS DE CONTRATOS\n`;
  markdown += `**Fecha de Corte:** ${fechaCorteStr}\n\n`;

  markdown += `## 1. Contratos Vencidos (${vencidos.length})\n`;
  if (vencidos.length === 0) markdown += `_No se registran contratos vencidos._\n`;
  else vencidos.forEach(c => markdown += `* **${c.id_contrato}** - ${c.cliente} (Venció: ${c.fecha_fin})\n`);

  markdown += `\n## 2. Contratos Próximos a Vencer (< 30 días) (${porVencer.length})\n`;
  if (porVencer.length === 0) markdown += `_No hay contratos próximos a vencer._\n`;
  else porVencer.forEach(c => markdown += `* **${c.id_contrato}** - ${c.cliente} (Vence: ${c.fecha_fin})\n`);

  markdown += `\n## 3. Riesgo de Garantías / Pólizas Incumplidas (${sinPoliza.length})\n`;
  if (sinPoliza.length === 0) markdown += `_Todos los contratos con póliza requerida están al día._\n`;
  else sinPoliza.forEach(c => markdown += `* **${c.id_contrato}** - ${c.cliente} (Póliza Pendiente)\n`);

  await fs.mkdir('out', { recursive: true });
  await fs.writeFile(path.join('out', 'alertas.md'), markdown, 'utf-8');

  return markdown;
}