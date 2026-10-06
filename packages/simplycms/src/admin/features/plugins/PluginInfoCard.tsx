import { Fragment } from 'react';
import type { PluginRow } from 'simplycms/admin-server';
import { useLocale, useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Separator } from 'simplycms/ui/separator';

/** Довідка про плагін: системна назва, версія, автор, дата оновлення рядка. */
export function PluginInfoCard({ plugin }: { plugin: PluginRow }) {
  const t = useT();
  const locale = useLocale();
  const rows: [string, string][] = [
    [t('common.name'), plugin.name],
    [t('admin.plugins.version'), plugin.version],
    ...(plugin.author
      ? [[t('common.author'), plugin.author] as [string, string]]
      : []),
    ...(plugin.updatedAt
      ? [
          [
            t('admin.plugins.updatedAt'),
            plugin.updatedAt.toLocaleDateString(locale),
          ] as [string, string],
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.information')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map(([label, value], index) => (
          <Fragment key={label}>
            {index > 0 && <Separator />}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono text-right">{value}</span>
            </div>
          </Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
