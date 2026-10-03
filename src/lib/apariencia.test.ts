import assert from "node:assert/strict";
import { test } from "node:test";
import { ES_HEX, SUGERIDOS, marca, recorta } from "./apariencia.ts";

test("solo se aceptan colores en #rrggbb", () => {
  for (const c of SUGERIDOS) assert.ok(ES_HEX.test(c.hex), c.nombre);
  for (const malo of ["5b2ee5", "#abc", "#gggggg", "red", "", "#5b2ee5; background:url(x)"])
    assert.equal(ES_HEX.test(malo), false, `rechaza ${malo}`);
});

test("los deslizadores se recortan a un rango usable", () => {
  assert.equal(recorta(150), 100, "no pasa de 100");
  assert.equal(recorta(0), 20, "no baja de 20: se volvería invisible");
  assert.equal(recorta(-40), 20);
  assert.equal(recorta(72.6), 73, "redondea");
  assert.equal(recorta(Number.NaN), 100, "un valor roto cae en el máximo");
});

test("el color se arma con su intensidad y su opacidad", () => {
  assert.equal(marca("#5b2ee5", 100, 100).stamp, "rgb(91 46 229)", "a full, el color tal cual");
  assert.equal(marca("#5b2ee5", 100, 50).stamp, "rgb(91 46 229 / 0.5)", "con opacidad");
  const flojo = marca("#5b2ee5", 50, 100).stamp;
  assert.match(flojo, /^rgb\(/);
  assert.notEqual(flojo, "rgb(91 46 229)", "menos intensidad acerca al gris");
});

test("el texto sobre el color siempre se lee", () => {
  assert.equal(marca("#141529", 100, 100).oncolor, "#ffffff", "sobre tinta, texto claro");
  assert.equal(marca("#ffe066", 100, 100).oncolor, "#141529", "sobre amarillo, texto oscuro");
  assert.equal(marca("#0f7a52", 100, 100).oncolor, "#ffffff", "sobre verde oscuro, texto claro");
  assert.equal(
    marca("#141529", 100, 25).oncolor,
    "#141529",
    "muy transparente: el fondo claro gana y el texto se oscurece",
  );
});
