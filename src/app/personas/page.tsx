import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma, unidadActiva } from "@/lib/db";
import { ROLES } from "@/lib/workflow";
import { initials } from "@/components/rail";
import { createUser } from "../actions";

const field =
  "w-full rounded-[4px] border border-line bg-surface px-3 py-2 text-[13.5px] placeholder:text-mute focus:border-stamp focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";

const ROLE_HINT: Record<string, string> = {
  SA: "Administra todo el sistema",
  SUP: "Aprueba, asigna y da el visto bueno",
  DEP: "Ejecuta lo que se le asigna",
  OBS: "Solo consulta",
};

export default async function Users({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const user = await requireUser();
  if (user.role !== "SA" && user.role !== "SUP") redirect("/");
  const esSA = user.role === "SA";
  const { unidad } = await unidadActiva(user);
  const { e } = await searchParams;
  const [users, unidades] = await Promise.all([
    prisma.user.findMany({
      where: esSA
        ? undefined
        : {
            OR: [
              { manager_id: user.id },
              ...(unidad ? [{ unidades: { some: { unidad_id: unidad.id } } }] : []),
            ],
          },
      include: {
        manager: { select: { name: true } },
        unidades: { include: { unidad: { select: { nombre: true } } } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    esSA
      ? prisma.unidad.findMany({ orderBy: { nombre: "asc" } })
      : unidad
        ? [unidad]
        : [],
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        <p className={label}>Personas</p>
        <h1 className="mt-2 font-display text-[27px] leading-[1.15] font-extrabold tracking-[-0.025em]">
          Quién hace qué
        </h1>
        <p className="mt-2 text-[13.5px] text-mute">
          Cada persona ve las actividades de su línea de reporte hacia abajo.
        </p>

        <ul className="mt-5 divide-y divide-line border-y border-line">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-oncolor"
                style={{ background: u.role === "OBS" ? "var(--color-mute)" : "var(--color-stamp)" }}
                aria-hidden
              >
                {initials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{u.name}</p>
                <p className="truncate text-[11.5px] text-mute">
                  {u.email}
                  {u.manager && ` · reporta a ${u.manager.name}`}
                  {u.unidades.length > 0 &&
                    ` · ${u.unidades.map((x) => x.unidad.nombre).join(", ")}`}
                </p>
              </div>
              <span
                className="shrink-0 rounded-[3px] border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-wider"
                title={ROLES[u.role]}
              >
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form action={createUser} className="h-fit space-y-3 rounded-[7px] border border-line bg-surface p-4">
        <h2 className="font-display text-[16px] font-extrabold tracking-[-0.02em]">Agregar persona</h2>
        {!esSA && (
          <p className="text-[12px] text-mute">
            {unidad
              ? `Se da de alta como dependiente en ${unidad.nombre}, bajo tu cargo.`
              : "Necesitas pertenecer a una unidad para dar de alta personal."}
          </p>
        )}
        {e && (
          <p className="rounded-[4px] border border-flag/40 px-2.5 py-1.5 text-[12.5px] text-flag">
            {e === "rol-invalido"
              ? "Elige un rol de la lista."
              : e === "solo-dependientes"
                ? "Como superior solo puedes dar de alta dependientes."
                : e === "sin-unidad"
                  ? "Necesitas pertenecer a una unidad para dar de alta personal."
              : e === "correo-duplicado"
                ? "Ya hay una persona con ese correo."
                : "Revisa el nombre, el correo y una contraseña de 6 o más caracteres."}
          </p>
        )}
        <input name="name" required placeholder="Nombre y apellido" className={field} />
        <input name="email" type="email" required placeholder="Correo" className={field} />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Contraseña inicial"
          className={field}
        />
        {esSA ? (
          <div className="space-y-1.5">
            <label htmlFor="role" className={label}>
              Rol
            </label>
            <select id="role" name="role" defaultValue="DEP" className={field}>
              {Object.entries(ROLES).map(([k, name]) => (
                <option key={k} value={k}>
                  {name} — {ROLE_HINT[k]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="role" value="DEP" />
        )}
        {esSA && (
        <div className="space-y-1.5">
          <label htmlFor="unidad_id" className={label}>
            Unidad (opcional)
          </label>
          <select id="unidad_id" name="unidad_id" defaultValue="" className={field}>
            <option value="">Sin unidad</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        )}
        {esSA && (
        <div className="space-y-1.5">
          <label htmlFor="manager_id" className={label}>
            Superior inmediato
          </label>
          <select id="manager_id" name="manager_id" defaultValue="" className={field}>
            <option value="">Sin superior</option>
            {users
              .filter((u) => u.role === "SUP" || u.role === "SA")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </div>
        )}
        <button className="w-full rounded-[4px] bg-stamp px-3 py-2.5 text-[13.5px] font-semibold text-oncolor transition-opacity hover:opacity-90">
          Agregar
        </button>
      </form>
    </div>
  );
}
