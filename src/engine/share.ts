/**
 * Share a result. Renders a 1200x630 card, tries the Web Share API with the
 * image, and falls back to copying plain text. No server, no upload.
 */
export async function shareResult(opts: {
  title: string;
  text: string;
  url: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}): Promise<'shared' | 'copied' | 'failed'> {
  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (canShareFiles) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        opts.draw(ctx, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        if (blob) {
          const file = new File([blob], 'arcadefork.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title: opts.title, text: opts.text, files: [file] });
            return 'shared';
          }
        }
      }
    } catch {
      /* fall through to text share */
    }
  }

  try {
    await navigator.clipboard.writeText(`${opts.text}\n${opts.url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
