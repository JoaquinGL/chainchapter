/** Inspección de sólo lectura de controles accesibles; nunca se usa para decidir un salto. */
export class PlayerDiagnostics {
  /** Distingue duración desconocida (NaN) de duración infinita. */
  static seconds(value: number): string {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return String(value);
    return value.toFixed(1);
  }

  /** Describe rangos sin tratar el final del búfer como el final del capítulo. */
  static ranges(ranges: TimeRanges): string {
    const items: string[] = [];
    for (let i = 0; i < Math.min(ranges.length, 4); i++) {
      items.push(`${this.seconds(ranges.start(i))}–${this.seconds(ranges.end(i))}`);
    }
    return items.join(', ') || 'vacío';
  }

  /** Recoge valores de sliders y textos de tiempo, sin copiar URLs ni datos de la cuenta. */
  static controls(root: Document | ShadowRoot): string {
    const controls: string[] = [];
    const visited = new Set<Document | ShadowRoot>();
    const visit = (node: Document | ShadowRoot): void => {
      if (visited.has(node) || controls.length >= 16) return;
      visited.add(node);
      for (const element of node.querySelectorAll('*')) {
        if (controls.length >= 16) return;
        const tag = element.tagName.toLowerCase();
        if (element.getAttribute('role') === 'slider' || tag.includes('slider')
          || element.hasAttribute('aria-valuemax') || (tag === 'input' && element.getAttribute('type') === 'range')) {
          const values = ['aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'min', 'max', 'value']
            .map(name => element.hasAttribute(name) ? `${name}=${element.getAttribute(name)?.slice(0, 180)}` : '')
            .filter(Boolean);
          controls.push(`${tag}: ${values.join('; ') || '(sin valores ARIA)'}`);
        } else if (element.children.length === 0) {
          const text = element.textContent?.trim() ?? '';
          if (/^-?\d{1,3}:\d{2}(?::\d{2})?(?:\s*(?:\/|de|of)\s*\d{1,3}:\d{2}(?::\d{2})?)?$/.test(text)) {
            controls.push(`Tiempo visible: ${text}`);
          }
        }
        if (element.shadowRoot) visit(element.shadowRoot);
        if (tag === 'iframe') {
          try {
            const doc = (element as HTMLIFrameElement).contentDocument;
            if (doc) visit(doc);
          } catch { /* Los marcos ajenos ya se contabilizan en VideoLocator. */ }
        }
      }
    };
    visit(root);
    return controls.length ? controls.join(' | ') : 'No se encontraron tiempos ni barras accesibles.';
  }
}
