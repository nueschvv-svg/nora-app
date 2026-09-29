'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { consultarAgenda, etiquetaFechaAgenda, type FranjaAgenda } from '@/lib/agenda';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { ETIQUETA_FRANJA } from '@/lib/tipos';

type Trabajo = {id:string;numero_orden:number;descripcion:string;franja_preferida:string|null;agenda_cupo:number|null;estado:string};
export function AgendaDia({revision}:{revision:number}) {
 const [dia,setDia]=useState<string|null>(null);
 const [hoy,setHoy]=useState('');
 const [franjas,setFranjas]=useState<FranjaAgenda[]>([]);
 const [trabajos,setTrabajos]=useState<Trabajo[]>([]);
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
   }catch(e){if(vivo)setError(e instanceof Error?e.message:'Error al consultar la agenda.');}
  };
  void cargar();const timer=setInterval(cargar,30000);
  return()=>{vivo=false;clearInterval(timer);};
 },[dia,revision]);
 const fecha=dia??hoy;
 const mover=(base:string,n:number)=>{const d=new Date(`${base}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);setDia(d.toISOString().slice(0,10));};
 const tarjeta=(t:Trabajo)=><Link key={t.id} href={`/operaciones/${t.id}`} className="block rounded-xl bg-sand p-3 mt-2 text-sm"><strong>#{t.numero_orden}</strong> · {t.descripcion.split('\n')[0].slice(0,100)}<span className="block text-xs text-mute mt-1">{t.estado}{t.agenda_cupo===null && ` · ${ETIQUETA_FRANJA[t.franja_preferida??'']??t.franja_preferida??'Sin horario'}`}</span></Link>;
 return <section className="mx-5 mt-5 rounded-2xl border border-line bg-surface p-4 min-w-0">
  <h2 className="font-bold text-lg">Agenda del día</h2>
  <div className="flex flex-wrap gap-2 my-3 text-sm">
   <button className="border border-line rounded-lg px-2 py-2" onClick={()=>setDia(null)}>Hoy</button>
   <button className="border border-line rounded-lg px-2 py-2" disabled={!hoy} onClick={()=>mover(hoy,1)}>Mañana</button>
   <button className="border border-line rounded-lg px-2 py-2" disabled={!fecha} onClick={()=>mover(fecha,1)}>Siguiente día</button>
   <input className="min-w-0 w-full border border-line rounded-lg p-2" aria-label="Día de agenda" type="date" value={fecha} onChange={e=>setDia(e.target.value||null)}/>
  </div>
  {fecha && <p className="text-sm font-medium mb-2">{etiquetaFechaAgenda(fecha)}</p>}
  {error ? <p role="alert" className="text-sm text-urgent">{error}</p> : franjas.map(f=><div key={f.franja} className="border-t border-line py-3">
   <h3 className="font-semibold text-sm">{f.franja}</h3>
   {trabajos.filter(t=>t.agenda_cupo!==null&&t.franja_preferida===f.franja).map(tarjeta)}
   <p className="text-xs text-mute mt-2">{f.estado==='UNAVAILABLE'?f.motivo:f.disponibles?`${f.disponibles} lugar(es) libre(s)`:'Completo'}</p>
  </div>)}
  {trabajos.some(t=>t.agenda_cupo===null)&&<div className="border-t border-line pt-3"><h3 className="text-sm font-semibold">Turnos anteriores · revisar horario</h3>{trabajos.filter(t=>t.agenda_cupo===null).map(tarjeta)}</div>}
 </section>;
}
