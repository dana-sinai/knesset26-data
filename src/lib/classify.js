// Runs the small bill classifiers in the browser. Reproduces scikit-learn's TfidfVectorizer(analyzer="char_wb",
// ngram_range=(2,5), sublinear_tf=True) + LinearSVC exactly as exported by pipeline/11_export_models.py.

export function norm(s) {
  return String(s || '')
    .replace(/,?\s*התש[֐-׿"'״׳]*\s*[-–]?\s*\d{4}/g, '')
    .replace(/\(תיקון מס['׳]?\s*\d+\)/g, '')
    .replace(/\(מס['׳]\s*\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[ ,.]+|[ ,.]+$/g, '');
}

function charWbNgrams(text, minN, maxN) {
  const out = [];
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const w = ` ${word} `;
    for (let n = minN; n <= maxN; n += 1) {
      let off = 0;
      out.push(w.slice(off, off + n));
      while (off + n < w.length) { off += 1; out.push(w.slice(off, off + n)); }
      if (off === 0) break; // a word shorter than n is counted once
    }
  }
  return out;
}

/** Prepares an exported model once (vocabulary lookup). */
export function prepare(model) {
  if (model._index) return model;
  model._index = new Map(model.vocab.map((g, i) => [g, i]));
  return model;
}

/** Returns [{key, label, p}] sorted by probability. */
export function classify(model, rawText) {
  prepare(model);
  const text = norm(rawText);
  const tf = new Map();
  for (const g of charWbNgrams(text, model.ngram[0], model.ngram[1])) {
    const i = model._index.get(g);
    if (i !== undefined) tf.set(i, (tf.get(i) || 0) + 1);
  }
  if (!tf.size) return [];
  const x = [];
  let ss = 0;
  tf.forEach((c, i) => { const v = (1 + Math.log(c)) * model.idf[i]; x.push([i, v]); ss += v * v; });
  const nrm = Math.sqrt(ss) || 1;
  const scores = model.classes.map((_, k) => {
    const row = model.coef[k];
    let s = 0;
    for (const [i, v] of x) s += row[i] * v;
    return (s * model.scale) / nrm + model.intercept[k];
  });
  const z = scores.map((s) => s / model.temperature);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  return model.classes.map((k, j) => ({ key: k, label: model.labels[k] || k, p: e[j] / sum })).sort((a, b) => b.p - a.p);
}
