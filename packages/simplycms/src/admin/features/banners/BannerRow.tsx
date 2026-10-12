import { useNavigate } from '@tanstack/react-router';
import { isBannerScheduled } from './banner-schedule';
import { useT } from 'simplycms/i18n';
import type { Banner } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../lib/adminLinks';
import { MediaThumb } from '../catalog-dictionaries/MediaThumb';
import { PLACEMENT_LIST_KEYS } from './banner-options';

interface Props {
  readonly banner: Banner;
  readonly onToggle: (isActive: boolean) => void;
  readonly onDelete: () => void;
}

/** Рядок списку банерів: мініатюра, назва, розміщення, розклад, перемикач. */
export function BannerRow({ banner, onToggle, onDelete }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const placementKey =
    PLACEMENT_LIST_KEYS[banner.placement as keyof typeof PLACEMENT_LIST_KEYS];
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: adminPath(`banners/${banner.id}`) })}
    >
      <TableCell className="w-14">
        <MediaThumb reference={banner.imageUrl} alt={banner.title} size={40} />
      </TableCell>
      <TableCell className="font-medium">{banner.title}</TableCell>
      <TableCell>
        <Badge variant="outline">
          {placementKey ? t(placementKey) : banner.placement}
        </Badge>
      </TableCell>
      <TableCell>
        {isBannerScheduled(banner) && (
          <Badge variant="secondary">{t('admin.banners.scheduled')}</Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={banner.isActive}
          aria-label={t('common.activeM')}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
