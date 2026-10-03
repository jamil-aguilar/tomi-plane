import Link from "next/link";
import { pedirRecuperacion } from "../actions";

const field =
  "w-full rounded-[6px] border border-line bg-surface px-3 py-2.5 text-[14px] placeholder:text-mute focus:border-stamp focus:outline-none";

export default async function Olvide({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; ok?: string }>;
}) {
  const { e, ok } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <p className="font-mono text-[10px] tracking-[0.18em] text-mute uppercase">Recuperar acceso</p>
      <h1 className="mt-2 font-display text-[28px] leading-[1.1] font-black tracking-[-0.03em]">
        Te enviamos un enlace.
      </h1>

      {ok ? (
        <>
          <p className="mt-4 rounded-[6px] border border-line bg-surface px-3 py-3 text-[13.5px] leading-relaxed">
            Si esa cuenta existe, el correo ya salió. Revisa tu bandeja: el enlace vence en 30
            minutos y sirve una sola vez.
          </p>
          <Link href="/login" className="mt-4 text-[13.5px] text-stamp hover:underline">
            Volver a ingresar
          </Link>
        </>
      ) : (
        <form action={pedirRecuperacion} className="mt-5 space-y-2.5">
          {e && (
            <p className="rounded-[6px] border border-flag/40 px-2.5 py-1.5 text-[12.5px] text-flag">
              {e}
            </p>
          )}
          <p className="text-[13.5px] text-mute">
            Escribe tu usuario o tu correo y te mandamos un enlace para elegir una contraseña nueva.
          </p>
          <input
            name="email"
            required
            autoFocus
            placeholder="usuario o correo"
            autoComplete="username"
            className={field}
          />
          <button className="w-full rounded-[6px] bg-stamp px-3 py-2.5 text-[14px] font-semibold text-oncolor transition-opacity hover:opacity-90">
            Enviar el enlace
          </button>
          <Link href="/login" className="block pt-1 text-[13px] text-mute hover:text-fg">
            Volver
          </Link>
        </form>
      )}
    </div>
  );
}
