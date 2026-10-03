import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUTH_SECRET = "secreto-de-prueba";
process.env.SESION_MINUTOS = "60";
const { emitir, leer, MINUTOS } = await import("./sesion.ts");

const MIN = 60_000;

test("una cookie recién emitida se lee", () => {
  const ahora = Date.now();
  assert.deepEqual(leer(emitir(7, ahora), ahora), { id: 7, emitido: ahora });
  assert.equal(MINUTOS, 60);
});

test("la ventana de inactividad cierra la sesión", () => {
  const emitida = Date.now();
  const c = emitir(7, emitida);
  assert.ok(leer(c, emitida + 59 * MIN), "a los 59 minutos sigue viva");
  assert.equal(leer(c, emitida + 61 * MIN), null, "a los 61 ya no");
});

test("no se acepta nada sin firma válida", () => {
  const ahora = Date.now();
  const c = emitir(7, ahora);
  assert.equal(leer(`${c.split(".").slice(0, 2).join(".")}.inventada`, ahora), null, "firma falsa");
  assert.equal(leer(`9.${ahora}.${c.split(".")[2]}`, ahora), null, "otro id con firma ajena");
  assert.equal(leer(`7.${ahora + 1}.${c.split(".")[2]}`, ahora), null, "fecha retocada");
  assert.equal(leer(undefined, ahora), null);
  assert.equal(leer("", ahora), null);
  assert.equal(leer("7", ahora), null, "sin partes");
  assert.equal(leer("7.x.y", ahora), null, "fecha que no es número");
});

test("un id que no es un entero positivo no entra", () => {
  const ahora = Date.now();
  for (const id of [0, -3]) assert.equal(leer(emitir(id, ahora), ahora), null, `id ${id}`);
});
