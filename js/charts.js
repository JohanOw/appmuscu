// Courbe simple en SVG, sans bibliothèque.
import { fmtKg } from './stats.js';

const W = 320, H = 150, PL = 36, PR = 12, PT = 14, PB = 24;
const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

export function lineChart(points, { unit = 'kg' } = {}) {
  if (points.length === 0) return '<p class="muted">Pas encore de données.</p>';
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min = Math.max(0, min - 5); max += 5; }
  const pad = (max - min) * 0.1; min = Math.max(0, min - pad); max += pad;
  const n = points.length;
  const x = (i) => (n === 1 ? (PL + W - PR) / 2 : PL + (i * (W - PL - PR)) / (n - 1));
  const y = (v) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const grid = [min, (min + max) / 2, max].map((v) =>
    `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${PL - 4}" y="${y(v) + 4}" text-anchor="end">${fmtKg(max - min < 10 ? Math.round(v * 10) / 10 : Math.round(v))}</text>`).join('');
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="3.5"><title>${fmtDate(p.x)} : ${fmtKg(p.y)} ${unit}</title></circle>`).join('');
  const last = points[n - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe">
    ${grid}<path d="${path}" class="line"/>${dots}
    <text x="${PL}" y="${H - 6}">${fmtDate(points[0].x)}</text>
    <text x="${W - PR}" y="${H - 6}" text-anchor="end">${fmtDate(last.x)}</text>
  </svg>`;
}
