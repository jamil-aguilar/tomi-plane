import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma, unidadesDe } from "@/lib/db";
import { ROLES } from "@/lib/workflow";
import { initials } from "@/components/rail";
import { alternarMiembro, crearUnidad, renombrarUnidad } from "../actions";

const field =
  "w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-[13.5px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";
const btn =
  "shrink-0 rounded-[6px] border border-line px-3 py-2 text-[12.5px] font-medium transition-colors hover:border-stamp hover:text-stamp";

export default async function Unidades({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const user = await requireUser();
  if (user.role !== "SA" && user.role !== "SUP") redirect("/");
  const esSA = user.role === "SA";
  const { e } = await searchParams;

  const mias = await unidadesDe(user);
  const unidades = await prisma.unidad.findMany({
    where: esSA ? undefined : { id: { in: mias.map((u) => u.id) } },
    include: {
      miembros: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      _count: { select: { proyectos: true } },
    },
    orderBy: { nombre: "asc" },
  });
  // El superior solo mueve a su propia gente: su equipo y quienes ya están en sus unidades.
  const personas = await prisma.user.findMany({
    where: esSA
      ? undefined
      : {
          OR: [
            { manager_id: user.id },
            { unidades: { some: { unidad_id: { in: unidades.map((u) => u.id) } } } },
          ],
        },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section>
        <p className={label}>Unidades</p>
        <h1 className="mt-2 font-display text-[27px] leading-[1.15] font-black tracking-[-0.03em]">
          Oficinas y su gente
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] text-mute">
          Cada unidad tiene sus proyectos, y solo los ve quien pertenece a ella y la tiene
          seleccionada arriba.
          {!esSA && " Solo el Super Administrador crea y renombra unidades."}
        </p>
      </section>

      {e && (
        <p className="rounded-[6px] border border-flag/40 px-3 py-2 text-[13px] text-flag">{e}</p>
      )}

      {esSA && (
        <form action={crearUnidad} className="flex max-w-lg gap-2">
          <input
            name="nombre"
            required
            placeholder="Nueva unidad, p. ej. Desarrollo de Sistemas"
            className={field}
          />
          <button className="shrink-0 rounded-[6px] bg-stamp px-4 text-[13.5px] font-semibold text-oncolor transition-opacity hover:opacity-90">
            Crear unidad
          </button>
        </form>
      )}

      {unidades.length === 0 ? (
        <p className="text-[13.5px] text-mute">
          {esSA ? "Todavía no hay unidades. Crea la primera arriba." : "No perteneces a ninguna unidad."}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {unidades.map((u) => {
            const fuera = personas.filter((p) => !u.miembros.some((m) => m.user_id === p.id));
            return (
              <section key={u.id} className="rounded-[9px] border border-line bg-surface p-4">
                {esSA ? (
                  <form action={renombrarUnidad} className="flex gap-2">
                    <input type="hidden" name="unidad_id" value={u.id} />
                    <input
                      name="nombre"
                      defaultValue={u.nombre}
                      required
                      aria-label={`Nombre de la unidad ${u.nombre}`}
                      className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 py-1 font-display text-[17px] font-bold tracking-[-0.02em] hover:border-line focus:border-stamp focus:bg-bg focus:outline-none"
                    />
                    <button className={btn}>Renombrar</button>
                  </form>
                ) : (
                  <h2 className="px-2 py-1 font-display text-[17px] font-bold tracking-[-0.02em]">
                    {u.nombre}
                  </h2>
                )}

                <p className="mt-1 px-2 font-mono text-[10.5px] tracking-wide text-mute">
                  {u._count.proyectos} proyecto{u._count.proyectos === 1 ? "" : "s"} ·{" "}
                  {u.miembros.length} persona{u.miembros.length === 1 ? "" : "s"}
                </p>

                <ul className="mt-3 space-y-1">
                  {u.miembros.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-sunken"
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-oncolor"
                        style={{
                          background:
                            m.user.role === "OBS" ? "var(--color-mute)" : "var(--color-stamp)",
                        }}
                        aria-hidden
                      >
                        {initials(m.user.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">
                          {m.user.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-mute">
                          {ROLES[m.user.role]} · {m.user.email}
                        </span>
                      </span>
                      <form action={alternarMiembro} className="shrink-0">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <input type="hidden" name="unidad_id" value={u.id} />
                        <button
                          className="rounded-[5px] px-2 py-1 font-mono text-[10px] tracking-wide text-mute uppercase transition-colors hover:bg-flag/10 hover:text-flag"
                          title={`Quitar a ${m.user.name} de ${u.nombre}`}
                        >
                          quitar
                        </button>
                      </form>
                    </li>
                  ))}
                  {u.miembros.length === 0 && (
                    <li className="px-2 py-2 text-[12.5px] text-mute">
                      Nadie pertenece a esta unidad todavía.
                    </li>
                  )}
                </ul>

                {fuera.length > 0 && (
                  <form action={alternarMiembro} className="mt-3 flex gap-2 border-t border-line pt-3">
                    <input type="hidden" name="unidad_id" value={u.id} />
                    <select
                      name="user_id"
                      required
                      defaultValue=""
                      aria-label={`Agregar una persona a ${u.nombre}`}
                      className={field}
                    >
                      <option value="" disabled>
                        Agregar una persona…
                      </option>
                      {fuera.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {ROLES[p.role]}
                        </option>
                      ))}
                    </select>
                    <button className={btn}>Agregar</button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
