import { Button } from '@/components/ui/button';

const HREF = '/icamcds-2026-manuscript-template.zip';
const DOWNLOAD_NAME = 'ICAMCDS-2026 Manuscript Template.zip';

export function ManuscriptTemplateButton({
  size = 'default',
  variant = 'outline',
}: {
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline' | 'ghost';
}) {
  return (
    <Button asChild size={size} variant={variant}>
      <a href={HREF} download={DOWNLOAD_NAME}>
        Download manuscript format
      </a>
    </Button>
  );
}
