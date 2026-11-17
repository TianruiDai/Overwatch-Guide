function line(value) {
  return value == null ? '' : String(value);
}

function noteLabel(notes, id) {
  const card = (notes || []).find(n => n && n.id === id);
  if (!card) return line(id);
  const author = line(card.author).trim();
  const title = line(card.title).trim();
  if (author && title) return `${author} · ${title}`;
  return title || author || line(id);
}

export function reportMarkdown(report) {
  if (!report || typeof report !== 'object') return '';
  const ctx = report.context || {};
  const coach = report.coach || {};
  const title = line(coach.title).trim() ||
    [ctx.map, ctx.hero].filter(Boolean).join(' · ') ||
  '对局复盘';

  const contextBits = [
    ctx.map && `地图 ${ctx.map}`,
    ctx.hero && `英雄 ${ctx.hero}`,
    ctx.role && `职责 ${ctx.role}`,
    ctx.side && ctx.side !== '未指定' && `攻防 ${ctx.side}`,
    Array.isArray(ctx.allies) && ctx.allies.length && `己方 ${ctx.allies.join('、')}`,
    Array.isArray(ctx.enemies) && ctx.enemies.length && `敌方 ${ctx.enemies.join('、')}`
  ].filter(Boolean);

  let md = `# ${title}\n\n`;
  if (contextBits.length) md += contextBits.join(' · ') + '\n\n';

  for (const section of coach.sections || []) {
    const heading = line(section?.heading).trim();
    const body = line(section?.body).trim();
    if (heading) md += `## ${heading}\n\n`;
    if (body) md += body + '\n\n';
  }

  const closing = line(coach.closing).trim();
  if (closing) md += closing + '\n\n';

  for (const wave of report.waves || []) {
    if (wave?.light) continue;
    const waveTitle = line(wave?.title).trim() || '团战';
    md += `### 逐波 · ${waveTitle}\n\n`;
    if (wave?.verdict) md += `**结论** ${line(wave.verdict)}\n\n`;
    if (wave?.nextTime) md += `**下一手** ${line(wave.nextTime)}\n\n`;
    const sources = [...new Set((wave?.sources || []).map(id => noteLabel(report.notes, id)).filter(Boolean))];
    if (sources.length) md += `**依据** ${sources.join('；')}\n\n`;
  }

  return md.trimEnd() + (md ? '\n' : '');
}