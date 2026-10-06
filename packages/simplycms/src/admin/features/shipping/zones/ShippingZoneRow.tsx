import { useNavigate } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { ShippingZone } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Globe, Star, Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';

interface Props {
  readonly zone: ShippingZone;
  readonly onToggle: (isActive: boolean) => void;
  readonly onMakeDefault: () => void;
  readonly onDelete: () => void;
}

const CITIES_SHOWN = 3;

/**
 * Рядок списку зон. Дефолтна зона (Е6а-20) завжди активна й невидалювана:
 * кнопка видалення вимкнена; «Зробити дефолтною» вимкнена для неактивної —
 * сервер однаково відмовив би `shipping_zone_inactive`.
 */
export function ShippingZoneRow({
  zone,
  onToggle,
  onMakeDefault,
  onDelete,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const cities = zone.cities ?? [];
  const stop = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: adminPath(`shipping/zones/${zone.id}`) })}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{zone.name}</span>
          {zone.isDefault && (
            <Badge variant="secondary">{t('common.byDefault')}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
        {cities.length > 0
          ? cities.slice(0, CITIES_SHOWN).join(', ') +
            (cities.length > CITIES_SHOWN
              ? ` +${cities.length - CITIES_SHOWN}`
              : '')
          : '—'}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={zone.isActive}
          aria-label={t('common.activeF')}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="text-right">
        {!zone.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            disabled={!zone.isActive}
            title={
              zone.isActive ? undefined : t('admin.shipping.zones.inactiveHint')
            }
            onClick={stop(onMakeDefault)}
          >
            <Star className="mr-1 h-4 w-4" />
            {t('admin.shipping.zones.makeDefault')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          disabled={zone.isDefault}
          title={
            zone.isDefault ? t('admin.shipping.zones.defaultLocked') : undefined
          }
          aria-label={t('common.delete')}
          onClick={stop(onDelete)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
