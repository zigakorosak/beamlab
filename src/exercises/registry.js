// Every exam exercise, grouped as on the topic menu. To add one: write a
// module (see kit.js for its shape), import it here and list it in ENTRIES.
// `slot` places it in a mock exam (poskusni izpit), which, like the recent
// exams, has 1 statics problem, 1 N-T-M problem and 1 strength problem.

import { answerOk } from "../core/grading.js";
import { sileF4, sileVozlisce } from "./statika/concurrent.js";
import { redukcija2d, redukcija3d } from "./statika/reduction.js";
import { vrvParabola } from "./statika/cables.js";
import { beamNtm } from "./nosilec/beamNtm.js";
import { okvirL } from "./okvir/okvirL.js";
import { okvirKonzola } from "./okvir/okvirKonzola.js";
import { okvirPosevni } from "./okvir/okvirPosevni.js";
import { trenjeKlanec } from "./trenje/klanec.js";
import { trenjeBloka } from "./trenje/bloka.js";
import { trenjeLestev } from "./trenje/lestev.js";
import { trenjeVrvi } from "./trenje/vrvi.js";
import { trenjePrag } from "./trenje/prag.js";
import { palicaPolvalj, nosilecValj, kroglaVrv } from "./telo/kontakt.js";
import { palicaVrv, dvePalici, dvePaliciNapetost } from "./telo/palice.js";
import { tezisce, pappus } from "./telo/tezisce.js";
import { torzija } from "./trdnost2/torzija.js";
import { tankostenski } from "./trdnost2/tankostenski.js";
import { uklon } from "./trdnost2/uklon.js";
import { strig } from "./trdnost2/strig.js";
import { posoda } from "./trdnost2/posoda.js";
import { kombinirana } from "./trdnost2/kombinirana.js";
import { prerezKarakteristike } from "./prerez/karakteristike.js";
import { upogibNapetost, upogibDimenzioniranje } from "./prerez/upogib.js";
import { mohr, mohrInverzna } from "./napetosti/mohr.js";
import { posevniPrerez } from "./napetosti/posevni.js";
import { deformacijeNapetosti } from "./napetosti/deformacije.js";
import { hookePalice } from "./napetosti/hooke.js";
import { hipoteze } from "./napetosti/hipoteze.js";

export const GROUPS = [
  { id: "statika", title: "Statika" },
  { id: "trdnost", title: "Trdnost" },
];

/** [exercise, slot] — slot 1: statics, 2: N-T-M, 3: strength. */
export const ENTRIES = [
  // Statika, in the course's order: forces, reduction, reactions and
  // contacts, friction, cables, centroids, internal forces.
  [sileF4, 1],
  [sileVozlisce, 1],
  [redukcija2d, 1],
  [redukcija3d, 1],
  [palicaPolvalj, 1],
  [nosilecValj, 1],
  [kroglaVrv, 1],
  [palicaVrv, 1],
  [dvePalici, 1],
  [trenjeKlanec, 1],
  [trenjeBloka, 1],
  [trenjeLestev, 1],
  [trenjePrag, 1],
  [trenjeVrvi, 1],
  [vrvParabola, 1],
  [tezisce, 1],
  [pappus, 1],
  [beamNtm, 2],
  [okvirL, 2],
  [okvirKonzola, 2],
  [okvirPosevni, 2],
  // Trdnost: sections, stress and strain, axial bars, bending, shear,
  // torsion, buckling, vessels, combined.
  [prerezKarakteristike, 3],
  [mohr, 3],
  [mohrInverzna, 3],
  [posevniPrerez, 3],
  [deformacijeNapetosti, 3],
  [hookePalice, 3],
  [dvePaliciNapetost, 3],
  [hipoteze, 3],
  [upogibNapetost, 3],
  [upogibDimenzioniranje, 3],
  [strig, 3],
  [torzija, 3],
  [tankostenski, 3],
  [uklon, 3],
  [posoda, 3],
  [kombinirana, 3],
];

/**
 * An answer is either exactly 0 or clearly not: floating-point dust
 * (1e-15) becomes 0, and a draw whose nonzero answer would still be graded
 * right 20 % off (so 0 and the opposite sign too) is drawn again. Otherwise
 * a near-zero `scale` could pass a forgotten term, a wrong sign, or
 * σ_2 = −0,2 for −1,1 MPa. Answers with an absolute `tol` (angles,
 * positions x ± 0,1 m, a count n) are exempt: their tolerance is meant.
 */
const tidy = (task) => {
  for (const a of task.answers) if (Math.abs(a.value) < 1e-9) a.value = 0;
  return task;
};
const clearOfZero = (task) =>
  task.answers.every((a) => a.value === 0 || a.tol !== undefined || !answerOk(a.value * 0.8, a));

export const EXERCISES = ENTRIES.map(([e, slot]) => ({
  ...e,
  slot,
  generate(r) {
    for (;;) {
      const params = e.generate(r);
      if (clearOfZero(tidy(e.build(params)))) return params;
    }
  },
  build: (params) => tidy(e.build(params)),
}));
export const byId = (id) => EXERCISES.find((e) => e.id === id);
