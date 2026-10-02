import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { STATES } from "@/lib/workflow";
import { login } from "../actions";

const field =
  "w-full rounded-[4px] border border-line bg-surface px-3 py-2.5 text-[14px] placeholder:text-mute focus:border-stamp focus:outline-none";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentUser()) redirect("/");
  const { e } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <p className="font-mono text-[10px] tracking-[0.18em] text-mute uppercase">Tomi Plane</p>
      <h1 className="mt-2 font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em]">
        De la propuesta
        <br />a producción.
      </h1>

      <ol aria-hidden className="mt-5 flex gap-1">
        {STATES.map((s) => (
          <li
            key={s}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: `var(--st-${s})`, opacity: 0.85 }}
          />
        ))}
      </ol>

      <form action={login} className="mt-7 space-y-2.5">
        {e && (
          <p className="rounded-[4px] border border-flag/40 px-2.5 py-1.5 text-[12.5px] text-flag">
            Ese correo y contraseña no coinciden. Intenta de nuevo.
          </p>
        )}
        <input name="email" type="email" required placeholder="Correo" autoComplete="email" className={field} />
        <input
          name="password"
          type="password"
          required
          placeholder="Contraseña"
          autoComplete="current-password"
          className={field}
        />
        <button className="w-full rounded-[4px] bg-stamp px-3 py-2.5 text-[14px] font-semibold text-oncolor transition-opacity hover:opacity-90">
          Entrar
        </button>
      </form>
    </div>
  );
}
