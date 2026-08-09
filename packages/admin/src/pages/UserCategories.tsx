import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from '@tanstack/react-router';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Badge } from '@simplycms/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import { ArrowLeft, Plus, Settings, Star } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';

export default function UserCategories() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['user-categories-with-counts'],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from('user_categories')
        .select('*, price_types:price_type_id(name)')
        .order('name');
      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('category_id');
      const counts = new Map<string, number>();
      profiles?.forEach((p) => {
        if (p.category_id)
          counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
      });

      return cats.map((cat) => ({
        ...cat,
        user_count: counts.get(cat.id) || 0,
        price_type_name:
          (cat.price_types as { name: string } | null)?.name || null,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath()}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {t('admin.nav.userCategories')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.users.categories.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={adminPath('user-categories/rules')}>
              <Settings className="h-4 w-4 mr-2" />
              {t('admin.users.categories.rules')}
            </Link>
          </Button>
          <Button asChild>
            <Link
              to={adminPath('user-categories/$categoryId')}
              params={{ categoryId: 'new' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.users.categories.add')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.code')}</TableHead>
              <TableHead>{t('admin.users.priceType')}</TableHead>
              <TableHead className="text-center">
                {t('admin.users.categories.usersCount')}
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            ) : categories?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  {t('admin.users.categories.empty')}
                </TableCell>
              </TableRow>
            ) : (
              categories?.map((cat) => (
                <TableRow
                  key={cat.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: adminPath(`user-categories/${cat.id}`) })
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cat.name}</span>
                      {cat.is_default && (
                        <Star className="h-4 w-4 text-warning fill-warning" />
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-sm text-muted-foreground">
                        {cat.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {cat.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    {cat.price_type_name ? (
                      <Badge variant="outline">{cat.price_type_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t('common.byDefaultShort')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{cat.user_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      {t('common.edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
