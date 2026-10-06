import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import type { ShippingRate } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DeleteConfirmDialog } from '../../catalog-dictionaries/DeleteConfirmDialog';
import { RATE_CALC_LABEL } from './rate-calculation-types';
import { ShippingRateDialog } from './ShippingRateDialog';
import { useShippingRates } from './useShippingRates';

/** Блок «Тарифи» картки способу (Е6а-1): рядки «зона → тариф» + діалог правки. */
export function ShippingRatesTable({
  methodId,
}: {
  readonly methodId: string;
}) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const { rows, zones, save, remove } = useShippingRates(methodId);
  // `undefined` — діалог закритий, `null` — новий тариф, рядок — правка.
  const [editing, setEditing] = useState<ShippingRate | null | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? '—';

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('admin.shipping.rates.title')}</CardTitle>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.shipping.rates.add')}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.shipping.points.zone')}</TableHead>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('admin.shipping.rates.calcType')}</TableHead>
              <TableHead>{t('admin.shipping.rates.baseCost')}</TableHead>
              <TableHead>{t('admin.shipping.rates.freeFrom')}</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{zoneName(r.zoneId)}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{t(RATE_CALC_LABEL[r.calculationType])}</TableCell>
                <TableCell>{formatPrice(Number(r.baseCost))}</TableCell>
                <TableCell>
                  {r.freeFromAmount === null
                    ? '—'
                    : formatPrice(Number(r.freeFromAmount))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {t('admin.shipping.rates.emptyMethod')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      {editing !== undefined && (
        <ShippingRateDialog
          rate={editing}
          zones={zones}
          onClose={() => setEditing(undefined)}
          onSave={(v) => save(editing ?? undefined, v)}
        />
      )}
      <DeleteConfirmDialog
        title={t('admin.shipping.rates.confirmDelete')}
        warning={t('admin.shipping.rates.deleteWarning')}
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove(deleteId);
          setDeleteId(null);
        }}
      />
    </Card>
  );
}
