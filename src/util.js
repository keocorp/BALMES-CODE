export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const money = n => `${n < 0 ? '-' : ''}S/ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
