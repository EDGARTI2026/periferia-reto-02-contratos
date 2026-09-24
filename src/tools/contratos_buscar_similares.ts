import { RegistroContrato, ResultadoExtraccion } from '../types';

export interface ResultadoBusqueda {
  esOtrosí: boolean;
  contratoExistente?: RegistroContrato;
  accionSugerida: 'nuevo' | 'actualizacion_otrosi' | 'duplicado' | 'contrato_padre_no_encontrado';
}

export function contratos_buscar_similares(
  extraccion: ResultadoExtraccion,
  contratosMaestros: RegistroContrato[]
): ResultadoBusqueda {
  
  const textoAnalizar = `${extraccion.objeto}`.toLowerCase();
  const esOtrosí = /otros[íi]|otro\s+si|adici[oó]n|pr[oó]rroga|modificaci[oó]n|anexo/.test(textoAnalizar);

  const contratoCoincidente = contratosMaestros.find(
    c => c.cliente.toUpperCase() === extraccion.cliente.toUpperCase()
  );

  if (esOtrosí) {
    if (contratoCoincidente) {
      return {
        esOtrosí: true,
        contratoExistente: contratoCoincidente,
        accionSugerida: 'actualizacion_otrosi'
      };
    } else {
      return {
        esOtrosí: true,
        accionSugerida: 'contrato_padre_no_encontrado'
      };
    }
  }

  if (contratoCoincidente && contratoCoincidente.valor === extraccion.valor && contratoCoincidente.fecha_fin === extraccion.fecha_fin) {
    return {
      esOtrosí: false,
      contratoExistente: contratoCoincidente,
      accionSugerida: 'duplicado'
    };
  }

  return {
    esOtrosí: false,
    accionSugerida: 'nuevo'
  };
}