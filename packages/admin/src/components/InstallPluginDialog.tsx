import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Textarea } from '@simplycms/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@simplycms/ui/dialog';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import { getRegisteredPluginModules } from '@simplycms/plugins';
import { Badge } from '@simplycms/ui/badge';

interface InstallPluginDialogProps {
  trigger?: React.ReactNode;
}

export function InstallPluginDialog({ trigger }: InstallPluginDialogProps) {
  const t = useT();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    version: '1.0.0',
    description: '',
    author: '',
  });

  const registeredModules = getRegisteredPluginModules();
  const availableModules = Array.from(registeredModules.keys());

  const installMutation = useMutation({
    mutationFn: async () => {
      // Check if module exists
      const moduleExists = registeredModules.has(formData.name);

      // Get hooks from module if it exists
      let hooks: { name: string; priority?: number }[] = [];
      if (moduleExists) {
        const pluginModule = registeredModules.get(formData.name);
        if (pluginModule?.manifest?.hooks) {
          hooks = pluginModule.manifest.hooks;
        }
      }

      const { data, error } = await supabase
        .from('plugins')
        .insert({
          name: formData.name,
          display_name: formData.displayName,
          version: formData.version,
          description: formData.description || null,
          author: formData.author || null,
          is_active: false,
          config: {},
          hooks: hooks,
          migrations_applied: [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: t('admin.plugins.installed'),
        description: t('admin.plugins.installedHint', {
          name: formData.displayName,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setOpen(false);
      setFormData({
        name: '',
        displayName: '',
        version: '1.0.0',
        description: '',
        author: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('admin.plugins.installFailed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.displayName) {
      toast({
        title: t('admin.plugins.requiredFields'),
        description: t('admin.plugins.requiredFieldsHint'),
        variant: 'destructive',
      });
      return;
    }
    installMutation.mutate();
  };

  const handleModuleSelect = (moduleName: string) => {
    const pluginModule = registeredModules.get(moduleName);
    setFormData((prev) => ({
      ...prev,
      name: moduleName,
      displayName: pluginModule?.manifest?.displayName || moduleName,
      version: pluginModule?.manifest?.version || '1.0.0',
      description: pluginModule?.manifest?.description || '',
      author: pluginModule?.manifest?.author || '',
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('admin.plugins.install')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('admin.plugins.installTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.plugins.installHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Available modules */}
            {availableModules.length > 0 && (
              <div className="space-y-2">
                <Label>{t('admin.plugins.modules')}</Label>
                <div className="flex flex-wrap gap-2">
                  {availableModules.map((name) => (
                    <Badge
                      key={name}
                      variant={formData.name === name ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleModuleSelect(name)}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.plugins.pickModuleHint')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('admin.plugins.systemName')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="my-plugin"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.plugins.systemNameHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">
                  {t('admin.plugins.displayName')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="displayName"
                  placeholder={t('admin.plugins.namePlaceholder')}
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">{t('admin.plugins.version')}</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      version: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">{t('common.author')}</Label>
                <Input
                  id="author"
                  placeholder={t('admin.plugins.authorPlaceholder')}
                  value={formData.author}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, author: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('admin.plugins.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {formData.name && !registeredModules.has(formData.name) && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('admin.plugins.unknownModuleWarning', {
                    name: formData.name,
                  })}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={installMutation.isPending}>
              {installMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t('admin.plugins.installAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
