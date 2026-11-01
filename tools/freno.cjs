const { execFile } = require('child_process');
// Prioridade abaixo do normal + afinação a 2 de 4 threads: deixa 2 threads livres
// para a secretária. Os filhos do Chrome herdam classe de prioridade e afinidade.
function frear(pid, mascara = 3) {
  return new Promise(fim => execFile('powershell.exe', ['-NoProfile', '-Command',
    `if ($p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { $p.PriorityClass = 'BelowNormal'; $p.ProcessorAffinity = ${mascara} }`
  ], e => fim(e)));
}
module.exports = { frear };
