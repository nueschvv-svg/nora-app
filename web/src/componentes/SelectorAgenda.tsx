'use client';

import { useEffect, useState } from 'react';
import { consultarAgenda, etiquetaFechaAgenda, puedeReservar, type FranjaAgenda } from '@/lib/agenda';

export function SelectorAgenda({ fecha, franja, onChange, onValidez, revision = 0 }: {
  fecha: string | null; franja: string | null;
  onChange: (fecha: string, franja: string | null) => void;
  onValidez: (valida: boolean) => void;
  revision?: number;
}) {
  const [filas, setFilas] = useState<FranjaAgenda[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vivo = true;
    const cargar = () => consultarAgenda().then(datos => { if(vivo) {setFilas(datos); setError(null);} })
      .catch(e => {if(vivo) {setFilas([]); setError(e.message);}});
    void cargar();
    const timer = setInterval(cargar, 30000);
    window.addEventListener('focus', cargar);
    return () => {vivo=false; clearInterval(timer); window.removeEventListener('focus',cargar);};
  }, [version, revision]);
  const seleccion = filas.find(f => f.fecha === fecha && f.franja === franja);
  const valida = !!seleccion && puedeReservar(seleccion) && !error;
  useEffect(() => {onValidez(valida);}, [valida,onValidez]);
  const fechas = [...new Set(filas.map(f=>f.fecha))];
  return <div>
    <p className="text-sm text-mute mb-3">Lunes a sábado · {filas[0] ? Number(filas[0].anticipacion_horas) : '…'} horas de anticipación. Horario de Buenos Aires.</p>
    {error ? <div role="alert" className="p-3 rounded-xl bg-warn/10 text-sm">{error} <button type="button" className="underline font-semibold" onClick={()=>setVersion(v=>v+1)}>Reintentar</button></div>
      : !filas.length ? <p role="status">Consultando disponibilidad…</p> : <>
      <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Fechas disponibles">
        {fechas.map(d=>{
          const habilitada=filas.some(f=>f.fecha===d && puedeReservar(f));
          return <button type="button" key={d} disabled={!habilitada} aria-pressed={fecha===d} onClick={()=>onChange(d,null)}
            className={`shrink-0 rounded-xl border px-3 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed ${fecha===d?'bg-brand-600 text-white border-brand-600':'bg-surface border-line text-ink'}`}>
            {etiquetaFechaAgenda(d)}{!habilitada && <span className="block text-xs">Sin turnos</span>}
          </button>;
        })}
      </div>
      {!fecha && <p className="text-sm text-mute py-2">Elegí una fecha para ver los horarios.</p>}
      <div className="grid grid-cols-2 gap-3 mt-2">
        {filas.filter(f=>f.fecha===fecha).map(f=><button type="button" key={f.franja} disabled={!puedeReservar(f)} aria-pressed={franja===f.franja} onClick={()=>onChange(f.fecha,f.franja)}
          className={`rounded-2xl border p-3 text-center disabled:opacity-50 disabled:cursor-not-allowed ${franja===f.franja && valida?'bg-brand-600 text-white border-brand-600':'bg-surface text-ink border-line'}`}>
          <span className="block text-sm font-bold whitespace-nowrap">{f.franja}</span>
          <span className="block text-xs mt-1">{f.estado==='FULL'?'Completo':f.estado==='UNAVAILABLE'?'No disponible':`${f.disponibles} ${f.disponibles===1?'lugar disponible':'lugares disponibles'}`}</span>
          {f.motivo && <span className="block text-xs mt-1">{f.motivo}</span>}
        </button>)}
      </div>
      {franja && !valida && <p role="alert" className="text-sm mt-3 text-urgent">El turno seleccionado ya no está disponible. Elegí otro.</p>}
      <p className="text-xs text-mute mt-3">El lugar queda reservado al confirmar el pedido. La disponibilidad se actualiza automáticamente.</p>
    </>}
  </div>;
}
