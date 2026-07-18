import JSZip from 'jszip';

interface GuideForExport {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function exportGMGuides(guides: GuideForExport[], label: string): Promise<void> {
  if (!guides || guides.length === 0) {
    throw new Error('No GM guides to export.');
  }

  const lines: string[] = [];
  lines.push(`# ${label || 'Campaign'} — GM Guides`);
  lines.push('');
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push(`Total guides: ${guides.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const g of guides) {
    lines.push(`## ${g.name || 'Untitled Guide'}${g.enabled === false ? '  (disabled)' : ''}`);
    lines.push('');
    lines.push((g.content || '').trim());
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const markdown = lines.join('\n');
  const rawJson = JSON.stringify(guides, null, 2);

  const zip = new JSZip();
  const safeLabel = (label || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'campaign';
  zip.file(`${safeLabel}-gm-guides.md`, markdown);
  zip.file(`${safeLabel}-gm-guides.json`, rawJson);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeLabel}-gm-guides.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
