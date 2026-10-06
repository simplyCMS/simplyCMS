import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ImageUpload } from '../../components/ImageUpload';

type Props = {
  /** Референс логотипа (не URL) або `null`. */
  readonly logo: string | null;
  readonly onChange: (logo: string | null) => void;
};

/**
 * Блок «Логотип». 🔴 `eraseOnRemove={false}` (Е6б-14): стирає файл лише
 * `saveStoreProfile` після успішного запису — скасована форма не лишає
 * профіль із посиланням на вже стертий файл.
 */
export function LogoCard({ logo, onChange }: Props) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.settings.logo.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('admin.settings.logo.hint')}
        </p>
      </CardHeader>
      <CardContent>
        <ImageUpload
          images={logo ? [logo] : []}
          onImagesChange={(next) => onChange(next[0] ?? null)}
          entityType="store_logo"
          maxImages={1}
          eraseOnRemove={false}
        />
      </CardContent>
    </Card>
  );
}
