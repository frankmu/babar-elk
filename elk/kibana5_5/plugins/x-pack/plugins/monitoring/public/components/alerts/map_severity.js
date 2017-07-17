export function mapSeverity(severity) {
  const floor = Math.floor((severity + 1) / 1000);
  switch (floor) {
    case -1: return 'ok';
    case 0: return 'low';
    case 1: return 'medium';
    default: return 'high';
  }
}
