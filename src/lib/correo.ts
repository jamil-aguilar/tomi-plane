import nodemailer from "nodemailer";

const transporte = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  // Mailpit y otros servidores de desarrollo no usan TLS ni autenticación.
  secure: false,
  ignoreTLS: !process.env.SMTP_USER,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
    : undefined,
});

export async function enviar(a: string, asunto: string, texto: string, html: string) {
  await transporte.sendMail({
    from: process.env.SMTP_DESDE ?? "TOMY <no-responder@tomy.local>",
    to: a,
    subject: asunto,
    text: texto,
    html,
  });
}

export function correoDeRecuperacion(nombre: string, enlace: string, minutos: number) {
  const texto = [
    `Hola ${nombre},`,
    "",
    "Pediste restablecer tu contraseña de TOMY. Abre este enlace:",
    enlace,
    "",
    `El enlace vence en ${minutos} minutos y sirve una sola vez.`,
    "Si no fuiste tú, ignora este correo: tu contraseña no cambia.",
  ].join("\n");

  const html = `<div style="font-family:Roboto,Arial,sans-serif;max-width:480px;color:#141529">
  <p style="font-size:20px;font-weight:800;letter-spacing:-.5px;margin:0 0 18px">TOMY</p>
  <p>Hola ${nombre},</p>
  <p>Pediste restablecer tu contraseña.</p>
  <p style="margin:24px 0">
    <a href="${enlace}" style="background:#5b2ee5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:600;display:inline-block">Elegir una contraseña nueva</a>
  </p>
  <p style="color:#646a85;font-size:13px">El enlace vence en ${minutos} minutos y sirve una sola vez.
  Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
</div>`;

  return { texto, html };
}
