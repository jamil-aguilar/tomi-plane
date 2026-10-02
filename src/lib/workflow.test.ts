import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ROLES,
  SITUACIONES,
  STATES,
  avanceAtrasado,
  avanceError,
  esParteDelProyecto,
  isBoss,
  proximoAvance,
  nextState,
  prevState,
  rangoError,
  resolverError,
  solicitarError,
  subtree,
  vistoBuenoError,
} from "./workflow.ts";

const SA = { id: 9, role: "SA" };
const SUP = { id: 1, role: "SUP" };
const OTRO_SUP = { id: 7, role: "SUP" };
const DEP = { id: 2, role: "DEP" };
const OBS = { id: 8, role: "OBS" };

/** Etapa en curso: la abrió el SUP 1, la ejecuta el DEP 2 que depende de 1. */
const etapa = (situacion = "EN_CURSO", responsable_id: number | null = 2) => ({
  situacion,
  responsable_id,
  responsable_manager_id: responsable_id === 2 ? 1 : null,
  autor_id: 1,
  autor_manager_id: null,
});
const todo = (total: number, aprobadas: number) => ({ total, aprobadas });

test("superior de la etapa", () => {
  assert.equal(isBoss(etapa(), SA), true, "el SA manda siempre");
  assert.equal(isBoss(etapa(), SUP), true, "el SUP que abrió el proyecto");
  assert.equal(isBoss(etapa(), OTRO_SUP), false, "un SUP ajeno no manda");
  assert.equal(isBoss(etapa(), DEP), false, "el DEP nunca manda");
  assert.equal(
    isBoss({ ...etapa(), autor_id: 5, responsable_manager_id: 7 }, OTRO_SUP),
    true,
    "el SUP jefe directo de quien ejecuta",
  );
});

test("ser parte del proyecto", () => {
  // Proyecto abierto por el SUP 1, con el DEP 2 de responsable en alguna etapa.
  const proy = { autor_id: 1, responsables: [2, null, null] };
  const AJENO = { id: 4, role: "DEP" };
  assert.equal(esParteDelProyecto(proy, etapa(), DEP), true, "quien ejecuta una etapa");
  assert.equal(esParteDelProyecto(proy, etapa(), SUP), true, "quien lo abrió");
  assert.equal(esParteDelProyecto(proy, etapa(), SA), true, "el SA siempre");
  assert.equal(esParteDelProyecto(proy, etapa(), AJENO), false, "un dependiente de la misma unidad, no");
  assert.equal(esParteDelProyecto(proy, etapa(), OTRO_SUP), false, "un superior ajeno, no");
  assert.equal(
    esParteDelProyecto({ autor_id: 8, responsables: [8] }, etapa(), OBS),
    false,
    "el observador nunca, ni figurando",
  );
});

test("solicitar el cierre: solo el responsable y con todo visado", () => {
  assert.equal(solicitarError(etapa(), DEP, todo(3, 3)), null, "responsable con todo aprobado");
  assert.match(solicitarError(etapa(), DEP, todo(3, 1))!, /Faltan 2 actividades/);
  assert.match(solicitarError(etapa(), DEP, todo(3, 2))!, /Falta 1 actividad sin/, "singular");
  assert.match(solicitarError(etapa(), OBS, todo(0, 0))!, /observadores/);
  assert.match(solicitarError(etapa(), OTRO_SUP, todo(0, 0))!, /Solo el responsable/);
  assert.equal(solicitarError(etapa(), SUP, todo(0, 0)), null, "el superior puede en su lugar");
  assert.match(solicitarError(etapa("SOLICITADA"), DEP, todo(0, 0))!, /ya está solicitado/);
  assert.match(solicitarError(etapa("PENDIENTE"), DEP, todo(0, 0))!, /no está en curso/);
  assert.match(solicitarError(etapa("CERRADA"), DEP, todo(0, 0))!, /no está en curso/);
});

test("aprobar o devolver: solo el superior y solo si fue solicitado", () => {
  assert.equal(resolverError(etapa("SOLICITADA"), SUP), null);
  assert.equal(resolverError(etapa("SOLICITADA"), SA), null);
  assert.match(resolverError(etapa("SOLICITADA"), DEP)!, /Solo el superior/);
  assert.match(resolverError(etapa("SOLICITADA"), OBS)!, /observadores/);
  assert.match(resolverError(etapa("EN_CURSO"), SUP)!, /Nadie ha solicitado/);
});

test("visto bueno de una actividad: solo el superior, y no sobre etapa cerrada", () => {
  assert.equal(vistoBuenoError(etapa(), SUP), null);
  assert.match(vistoBuenoError(etapa(), DEP)!, /Solo el superior/);
  assert.match(vistoBuenoError(etapa(), OBS)!, /observadores/);
  assert.match(vistoBuenoError(etapa("CERRADA"), SUP)!, /ya está cerrada/);
});

test("las actividades caen dentro del rango de su etapa", () => {
  const e = { fecha_inicio: new Date(2026, 9, 10), fecha_fin: new Date(2026, 9, 20) };
  assert.equal(rangoError(e, new Date(2026, 9, 12), new Date(2026, 9, 18)), null, "dentro");
  assert.equal(rangoError(e, new Date(2026, 9, 10), new Date(2026, 9, 20)), null, "en los bordes");
  assert.match(rangoError(e, new Date(2026, 9, 9), null)!, /no puede empezar antes/);
  assert.match(rangoError(e, new Date(2026, 9, 12), new Date(2026, 9, 21))!, /no puede terminar después/);
  assert.match(rangoError(e, new Date(2026, 9, 15), new Date(2026, 9, 12))!, /anterior a la de inicio/);
  assert.match(rangoError(e, new Date("no es fecha"), null)!, /no es válida/);
  assert.equal(
    rangoError({ fecha_inicio: null, fecha_fin: null }, new Date(2020, 0, 1), null),
    null,
    "sin plazos fijados, cualquier fecha vale",
  );
});

test("la línea de reportes baja hasta el último nivel", () => {
  const gente = [
    { id: 1, manager_id: null },
    { id: 2, manager_id: 1 },
    { id: 3, manager_id: 2 },
    { id: 4, manager_id: 3 },
    { id: 5, manager_id: null },
  ];
  assert.deepEqual(subtree(gente, 2).sort(), [2, 3, 4], "incluye nietos, excluye ajenos");
  assert.deepEqual(subtree(gente, 4), [4], "una hoja es solo ella misma");
  assert.deepEqual(subtree([{ id: 7, manager_id: 7 }], 7), [7], "un ciclo no cuelga");
});

test("bordes del recorrido", () => {
  assert.equal(nextState("PRODUCCION"), null, "la última etapa no tiene siguiente");
  assert.equal(prevState("PROPUESTA"), null);
  assert.equal(nextState("ANALISIS"), "ASIGNACION");
});

test("el esquema de Prisma declara lo mismo que el código", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const values = (name: string) =>
    schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))![1].trim().split(/\s+/);
  assert.deepEqual(values("State"), [...STATES], "estados");
  assert.deepEqual(values("Role"), Object.keys(ROLES), "roles");
  assert.deepEqual(values("Situacion"), Object.keys(SITUACIONES), "situaciones de etapa");
});

const H = 3_600_000;
const actividad = (cadencia = "DIARIA", aprobada_at: Date | null = null) => ({
  cadencia,
  fecha_inicio: new Date(2026, 9, 10),
  fecha_fin: new Date(2026, 9, 20),
  aprobada_at,
});

test("el próximo reporte se cuenta desde el último avance", () => {
  const a = actividad("DIARIA");
  assert.deepEqual(proximoAvance(a, null), new Date(2026, 9, 11), "sin avances, desde el inicio");
  const ultimo = new Date(2026, 9, 15, 9, 0);
  assert.deepEqual(proximoAvance(a, ultimo), new Date(2026, 9, 16, 9, 0));
  assert.deepEqual(
    proximoAvance(actividad("HORARIA"), ultimo),
    new Date(ultimo.getTime() + H),
    "cadencia horaria",
  );
  assert.deepEqual(
    proximoAvance(actividad("SEMANAL"), ultimo),
    new Date(ultimo.getTime() + 7 * 24 * H),
    "cadencia semanal",
  );
  assert.equal(proximoAvance(actividad("DIARIA", new Date()), null), null, "cerrada no reporta");
});

test("el reporte se atrasa cuando vence su cadencia", () => {
  const a = actividad("HORARIA");
  const ultimo = new Date(2026, 9, 15, 9, 0);
  assert.equal(avanceAtrasado(a, ultimo, new Date(2026, 9, 15, 9, 30)), false, "dentro de la hora");
  assert.equal(avanceAtrasado(a, ultimo, new Date(2026, 9, 15, 10, 30)), true, "pasada la hora");
  assert.equal(
    avanceAtrasado(actividad("DIARIA", new Date()), null, new Date(2030, 0, 1)),
    false,
    "una actividad cerrada nunca está atrasada",
  );
});

test("los avances caen dentro de la programación de la actividad", () => {
  const a = actividad();
  assert.equal(avanceError(a, new Date(2026, 9, 12), 40), null, "dentro del rango");
  assert.equal(avanceError(a, new Date(2026, 9, 10), 0), null, "el primer día vale");
  assert.equal(avanceError(a, new Date(2026, 9, 20, 18), 100), null, "el último día vale entero");
  assert.match(avanceError(a, new Date(2026, 9, 9), 10)!, /no se puede reportar antes/);
  assert.match(avanceError(a, new Date(2026, 9, 21), 10)!, /no se puede reportar después/);
  assert.match(avanceError(a, new Date(2026, 9, 12), 101)!, /de 0 a 100/);
  assert.match(avanceError(a, new Date(2026, 9, 12), -1)!, /de 0 a 100/);
  assert.match(avanceError(a, new Date(2026, 9, 12), 33.5)!, /de 0 a 100/);
  assert.match(
    avanceError(actividad("DIARIA", new Date()), new Date(2026, 9, 12), 50)!,
    /ya tiene el visto bueno/,
  );
});
