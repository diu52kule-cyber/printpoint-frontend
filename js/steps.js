/** js/steps.js */

async function gotoStep(n) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('succ').classList.remove('active');
  if (n >= 1 && n <= 3) document.getElementById('p' + n).classList.add('active');
  updProg(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (n === 2) { await buildPreview(); updatePrice(); }
  if (n === 3) updatePaySummary();
}

function updProg(a) {
  for (let i = 1; i <= 3; i++) {
    const sc = document.getElementById('sc' + i);
    const sl = document.getElementById('sl' + i);
    sc.className = 'sc'; sl.className = 'sl';
    if      (i < a)  { sc.classList.add('done');   sl.classList.add('done');   sc.innerHTML = '✓'; }
    else if (i === a) { sc.classList.add('active'); sl.classList.add('active'); sc.innerHTML = i;   }
    else               sc.innerHTML = i;
  }
  document.getElementById('ln1').className = 'sline' + (a > 1 ? ' done' : '');
  document.getElementById('ln2').className = 'sline' + (a > 2 ? ' done' : '');
}
