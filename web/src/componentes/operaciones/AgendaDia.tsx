'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { consultarAgenda, etiquetaFechaAgenda, type FranjaAgenda } from '@/lib/agenda';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { ETIQUETA_ESTADO, type EstadoServicio, ETIQUETA_FRANJA } from '@/lib/tipos';

type Trabajo = {id:string;numero_orden:number;descripcion:string;franja_preferida:string|null;agenda_cupo:number|null;estado:string};
export function AgendaDia({revision}:{revision:number}) {
 const [dia,setDia]=useState<string|null>(null);
 const [hoy,setHoy]=useState('');
 const [franjas,setFranjas]=useState<FranjaAgenda[]>([]);
 const [trabajos,setTrabajos]=useState<Trabajo[]>([]);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  let vivo=true;
  const cargar=async()=>{
   try{
    const slots=await consultarAgenda(dia,1); const fecha=slots[0]?.fecha;
    if(!fecha) throw new Error('No hay configuración de agenda.');
    const {data,error}=await supabaseNavegador().from('servicios')
      .select('id,numero_orden,descripcion,franja_preferida,agenda_cupo,estado').eq('fecha_preferida',fecha)
      .neq('estado','cancelado').order('creado_el',{ascending:true}).order('id',{ascending:true});
    if(error) throw new Error('No pudimos cargar los trabajos del día.');
    if(vivo){setFranjas(slots);setTrabajos(data??[]);setError(null);if(!dia)setHoy(fecha);}
   }catch(e){if(vivo)setError(e instanceof Error?e.message:'Error al consultar la agenda.');}finally{if(vivo)setCargando(false);}
  };
  void cargar();const timer=setInterval(cargar,30000);
  return()=>{vivo=false;clearInterval(timer);};
 },[dia,revision]);
 const fecha=dia??hoy;
 const mover=(base:string,n:number)=>{const d=new Date(`${base}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);setDia(d.toISOString().slice(0,10));};
 const tarjeta=(t:Trabajo)=><Link key={t.id} href={`/operaciones/${t.id}`} className="group mt-3 block rounded-xl border border-line bg-sand p-3 text-sm transition-colors hover:border-brand-300">
  <span className="flex items-center justify-between gap-2"><strong className="font-semibold text-brand-700 num">#{t.numero_orden}</strong><ChevronRight aria-hidden="true" className="h-4 w-4 text-mute" /></span>
  <span className="mt-1 block break-words text-ink leading-relaxed">{t.descripcion.split('\n')[0].slice(0,100)}</span>
  <span className="block text-xs text-mute mt-2">{ETIQUETA_ESTADO[t.estado as EstadoServicio] ?? t.estado}{t.agenda_cupo===null && ` · ${ETIQUETA_FRANJA[t.franja_preferida??'']??t.franja_preferida??'Sin horario'}`}</span>
 </Link>;
 return <section className="nora-panel mx-5 mt-5 p-4 min-w-0">
  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><CalendarDays aria-hidden="true" className="h-5 w-5" /></span><div><p className="nora-eyebrow">Planificación</p><h2 className="font-display font-semibold text-lg text-ink">Agenda del día</h2></div></div>
  <div className="flex flex-wrap gap-2 my-4 text-xs">
   <button className="nora-button-secondary min-h-11 px-3" onClick={()=>setDia(null)}>Hoy</button>
   <button className="nora-button-secondary min-h-11 px-3" disabled={!hoy} onClick={()=>mover(hoy,1)}>Mañana</button>
   <button className="nora-button-secondary min-h-11 px-3" disabled={!fecha} onClick={()=>mover(fecha,1)}>Siguiente día</button>
   <label className="mt-1 block w-full text-xs font-medium text-mute">Consultar otra fecha
    <input className="mt-2 min-h-11 min-w-0 w-full border border-line bg-sand rounded-xl px-3 text-base text-ink" type="date" value={fecha} onChange={e=>setDia(e.target.value||null)}/>
   </label>
  </div>
  {fecha && <p className="text-sm font-semibold text-ink mb-4">{etiquetaFechaAgenda(fecha)}</p>}
  {error ? <p role="alert" className="rounded-xl bg-urgent/10 p-3 text-sm text-urgent">{error}</p> : cargando ? <p role="status" className="py-5 text-sm text-mute">Consultando disponibilidad…</p> : franjas.map(f=><div key={f.franja} className="border-t border-line py-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-sm text-ink">{ETIQUETA_FRANJA[f.franja] ?? f.franja}</h3><span className={`rounded-lg px-2 py-1 text-xs font-medium ${f.estado==='UNAVAILABLE' || !f.disponibles ? 'bg-sand text-mute' : 'bg-brand-50 text-brand-700'}`}>{f.estado==='UNAVAILABLE'?'No disponible':f.disponibles?`${f.disponibles} libres`:'Completo'}</span></div>
   {trabajos.filter(t=>t.agenda_cupo!==null&&t.franja_preferida===f.franja).map(tarjeta)}
   {f.estado==='UNAVAILABLE' && <p className="text-xs text-mute mt-2">{f.motivo}</p>}
   {!trabajos.some(t=>t.agenda_cupo!==null&&t.franja_preferida===f.franja) && <p className="mt-3 text-xs text-mute">Sin pedidos en esta franja.</p>}
  </div>)}
  {trabajos.some(t=>t.agenda_cupo===null)&&<div className="border-t border-line pt-4"><h3 className="text-sm font-semibold text-ink">Turnos anteriores</h3><p className="mt-1 text-xs text-mute">Revisá el horario de estos pedidos.</p>{trabajos.filter(t=>t.agenda_cupo===null).map(tarjeta)}</div>}
 </section>;
}
