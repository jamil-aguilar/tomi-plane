import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { asignables, unidadesDe } from "@/lib/db";
import { canWrite } from "@/lib/workflow";
import { nuevoProyecto } from "../../actions";

const field =
  "w-full rounded-[4px] border border-line bg-surface px-3 py-2.5 text-[14px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";

export default async function NuevoProyecto({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const user = await requireUser();
  if (!canWrite(user)) redirect("/");
  const { e } = await searchParams;
  const [unidades, gente] = await Promise.all([unidadesDe(user), asignables(user)]);

  if (unidades.length === 0)
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-[27px] font-extrabold tracking-[-0.025em]">
          Falta una unidad
        </h1>
        <p className="mt-2 text-[13.5px] text-mute">
          Todo proyecto pertenece a una unidad y no perteneces a ninguna. Pídele al Super
          Administrador que te agregue a una.
        </p>
      </div>
    );

  return (
    <div className="max-w-xl">
      <p className={label}>Parada 01 · Propuesta</p>
      <h1 className="mt-2 font-display text-[27px] leading-[1.15] font-extrabold tracking-[-0.025em]">
        Nuevo proyecto
      </h1>
      <p className="mt-2 text-[13.5px] text-mute">
        Nace con sus ocho etapas. La primera, PROPUESTA, arranca ahora mismo; las demás esperan su
        turno.
      </p>

      <form action={nuevoProyecto} className="mt-6 space-y-4">
        {e && (
          <p className="rounded-[4px] border border-flag/40 px-2.5 py-1.5 text-[12.5px] text-flag">
            {e === "unidad" ? "No perteneces a esa unidad." : "Escribe un nombre y elige la unidad."}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="nombre" className={label}>
            Nombre del proyecto
          </label>
          <input id="nombre" name="nombre" required placeholder="Qué se va a atender" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="detalle" className={label}>
            Detalle
          </label>
          <textarea id="detalle" name="detalle" rows={5} placeholder="Alcance y contexto" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="unidad_id" className={label}>
            Unidad
          </label>
          <select id="unidad_id" name="unidad_id" required defaultValue="" className={field}>
            <option value="" disabled>
              Elige una unidad
            </option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <span className={label}>Visibilidad</span>
          <label className="flex items-start gap-2.5 rounded-[4px] border border-line p-3 text-[13.5px]">
            <input type="checkbox" name="publico" value="si" defaultChecked className="mt-0.5" />
            <span>
              Público en la unidad
              <span className="block text-[12px] text-mute">
                Si lo desmarcas queda reservado: solo lo verán los superiores, no los dependientes.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="responsable_id" className={label}>
            Responsable de la primera etapa (opcional)
          </label>
          <select id="responsable_id" name="responsable_id" defaultValue="" className={field}>
            <option value="">Se define después</option>
            {gente.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-[4px] bg-stamp px-4 py-2.5 text-[14px] font-semibold text-oncolor transition-opacity hover:opacity-90">
          Abrir proyecto
        </button>
      </form>
    </div>
  );
}
