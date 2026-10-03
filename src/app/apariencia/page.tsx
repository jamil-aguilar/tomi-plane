import { requireUser } from "@/lib/auth";
import { SUGERIDOS, marca } from "@/lib/apariencia";
import { guardarApariencia } from "../actions";

const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-mute";
const TEMAS = [
  { v: "SYSTEM", t: "Como el sistema", d: "Sigue la preferencia del equipo" },
  { v: "LIGHT", t: "Claro", d: "Siempre en claro" },
  { v: "DARK", t: "Oscuro", d: "Siempre en oscuro" },
] as const;

export default async function Apariencia({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  const { ok } = await searchParams;
  const actual = user.color ?? "#5b2ee5";
  const vista = marca(actual, user.color_intensidad, user.color_alpha);

  return (
    <form action={guardarApariencia} className="max-w-xl space-y-7">
      <section>
        <p className={label}>Apariencia</p>
        <h1 className="mt-2 font-display text-[27px] leading-[1.15] font-black tracking-[-0.03em]">
          A tu gusto
        </h1>
        <p className="mt-2 text-[13.5px] text-mute">
          Se guarda en tu perfil, así que te acompaña en cualquier equipo donde entres.
        </p>
        {ok && (
          <p className="mt-3 rounded-[6px] border border-line px-3 py-2 text-[13px]">
            Listo, ya está aplicado.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className={label}>Tema</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMAS.map((o) => (
            <label
              key={o.v}
              className="flex cursor-pointer gap-2.5 rounded-[7px] border border-line bg-surface p-3 has-checked:border-stamp"
            >
              <input type="radio" name="theme" value={o.v} defaultChecked={user.theme === o.v} className="mt-0.5" />
              <span>
                <span className="block text-[13.5px] font-medium">{o.t}</span>
                <span className="block text-[11.5px] text-mute">{o.d}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className={label}>Color predominante</p>
        <div className="flex flex-wrap gap-2">
          {SUGERIDOS.map((c) => (
            <label key={c.hex} className="cursor-pointer" title={c.nombre}>
              <input
                type="radio"
                name="sugerido"
                value={c.hex}
                defaultChecked={actual.toLowerCase() === c.hex.toLowerCase()}
                className="peer sr-only"
              />
              <span
                className="block h-9 w-9 rounded-[8px] ring-offset-2 ring-offset-bg peer-checked:ring-2 peer-checked:ring-fg"
                style={{ background: c.hex }}
                aria-label={c.nombre}
              />
            </label>
          ))}
        </div>
        <p className="text-[12px] text-mute">
          O elige cualquier otro. El color de la rueda manda sobre las muestras de arriba si lo
          cambias.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={label}>Color</span>
            <input
              type="color"
              name="color"
              defaultValue={actual}
              className="h-10 w-20 cursor-pointer rounded-[6px] border border-line bg-surface p-1"
            />
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1">
            <span className={label}>Intensidad · {user.color_intensidad}%</span>
            <input
              type="range"
              name="intensidad"
              min={20}
              max={100}
              step={5}
              defaultValue={user.color_intensidad}
              className="accent-stamp"
            />
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1">
            <span className={label}>Opacidad · {user.color_alpha}%</span>
            <input
              type="range"
              name="alpha"
              min={20}
              max={100}
              step={5}
              defaultValue={user.color_alpha}
              className="accent-stamp"
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <p className={label}>Así se ve ahora</p>
        <div className="flex flex-wrap items-center gap-3 rounded-[7px] border border-line bg-surface p-4">
          <span
            className="rounded-[6px] px-3.5 py-2 text-[13px] font-semibold"
            style={{ background: vista.stamp, color: vista.oncolor }}
          >
            Un botón
          </span>
          <span className="h-7 w-7 rounded-full" style={{ background: vista.stamp }} aria-hidden />
          <span style={{ color: vista.stamp }} className="text-[13.5px] font-semibold">
            Un enlace
          </span>
          <span className="font-mono text-[11px] text-mute">{vista.stamp}</span>
        </div>
        <p className="text-[12px] text-mute">
          El color del texto sobre el botón se elige solo, para que siempre se lea.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-[6px] bg-stamp px-4 py-2.5 text-[14px] font-semibold text-oncolor transition-opacity hover:opacity-90">
          Guardar apariencia
        </button>
        <button
          name="restablecer"
          value="si"
          className="rounded-[6px] border border-line px-4 py-2.5 text-[14px] font-medium transition-colors hover:border-stamp hover:text-stamp"
        >
          Volver al color de la aplicación
        </button>
      </div>
    </form>
  );
}
