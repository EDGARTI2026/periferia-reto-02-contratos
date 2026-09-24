import fs from 'fs/promises';
import path from 'path';
import { MensajeBuzon } from '../types';

export async function contratos_leer_buzon(directorioBuzon: string): Promise<MensajeBuzon[]> {
  try {
    const entradas = await fs.readdir(directorioBuzon, { withFileTypes: true });
    const mensajes: MensajeBuzon[] = [];

    for (const entrada of entradas) {
      if (entrada.isDirectory()) {
        const idMensaje = entrada.name;
        const rutaCorreoJson = path.join(directorioBuzon, idMensaje, 'correo.json');

        try {
          const contenidoRaw = await fs.readFile(rutaCorreoJson, 'utf-8');
          const mensaje: MensajeBuzon = JSON.parse(contenidoRaw);
          mensaje.id = idMensaje;
          mensajes.push(mensaje);
        } catch (err) {
          console.warn(` ⚠️ No se encontró 'correo.json' en la carpeta ${idMensaje}`);
        }
      }
    }

    return mensajes.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    console.error(`Error al leer el buzón desde ${directorioBuzon}:`, error);
    throw error;
  }
}