import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { restablecer } from "../../actions";

const field =
  "w-full rounded-[6px] border border-line bg-surface px-3 py-2.5 text-[14px] placeholder:text-mute focus:border-stamp focus:outline-none";

export default async function Restablecer({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;
  const pedido = await prisma.passwordReset.findUnique({
    where: { token_hash: createHash("sha256").update(token).digest("hex") },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!pedido || pedido.usado_at || pedido.expira < new Date())
    redirect("/olvide?e=Ese enlace ya venció o fue usado. Pide uno nuevo.");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <p className="font-mono text-[10px] tracking-[0.18em] text-mute uppercase">
        {pedido!.user.email}
      </p>
      <h1 className="mt-2 font-display text-[28px] leading-[1.1] font-black tracking-[-0.03em]">
        Elige tu contraseña
      </h1>
      <form action={restablecer} className="mt-5 space-y-2.5">
        <input type="hidden" name="token" value={token} />
        {e && (
          <p className="rounded-[6px] border border-flag/40 px-2.5 py-1.5 text-[12.5px] text-flag">{e}</p>
        )}
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoFocus
          placeholder="Contraseña nueva (6 o más)"
          autoComplete="new-password"
          className={field}
        />
        <input
          name="password2"
          type="password"
          required
          minLength={6}
          placeholder="Repítela"
          autoComplete="new-password"
          className={field}
        />
        <button className="w-full rounded-[6px] bg-stamp px-3 py-2.5 text-[14px] font-semibold text-oncolor transition-opacity hover:opacity-90">
          Guardar y entrar
        </button>
      </form>
    </div>
  );
}
