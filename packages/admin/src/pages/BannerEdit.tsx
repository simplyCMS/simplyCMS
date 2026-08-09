import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import { Slider } from '@simplycms/ui/slider';
import { Checkbox } from '@simplycms/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { ImageUpload } from '../components/ImageUpload';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import type { Json } from '@simplycms/supabase';
import { adminPath } from '../lib/adminLinks';
import { useT, type MessageKey } from '@simplycms/i18n';

interface BannerButton {
  text: string;
  url: string;
  target: '_self' | '_blank';
  variant: 'primary' | 'secondary' | 'outline';
}

interface BannerForm {
  title: string;
  subtitle: string;
  image_url: string;
  desktop_image_url: string;
  mobile_image_url: string;
  placement: string;
  section_id: string;
  buttons: BannerButton[];
  date_from: string;
  date_to: string;
  schedule_days: number[];
  schedule_time_from: string;
  schedule_time_to: string;
  slide_duration: number;
  animation_type: string;
  animation_duration: number;
  overlay_color: string;
  text_position: string;
  sort_order: number;
  is_active: boolean;
}

// Мапа КЛЮЧІВ: номер дня тижня фіксований, підпис резолвиться в рендері.
const DAYS: { value: number; labelKey: MessageKey }[] = [
  { value: 1, labelKey: 'admin.banners.weekday.mon' },
  { value: 2, labelKey: 'admin.banners.weekday.tue' },
  { value: 3, labelKey: 'admin.banners.weekday.wed' },
  { value: 4, labelKey: 'admin.banners.weekday.thu' },
  { value: 5, labelKey: 'admin.banners.weekday.fri' },
  { value: 6, labelKey: 'admin.banners.weekday.sat' },
  { value: 0, labelKey: 'admin.banners.weekday.sun' },
];

const defaultForm: BannerForm = {
  title: '',
  subtitle: '',
  image_url: '',
  desktop_image_url: '',
  mobile_image_url: '',
  placement: 'home',
  section_id: '',
  buttons: [],
  date_from: '',
  date_to: '',
  schedule_days: [],
  schedule_time_from: '',
  schedule_time_to: '',
  slide_duration: 5000,
  animation_type: 'slide',
  animation_duration: 500,
  overlay_color: 'rgba(0,0,0,0.4)',
  text_position: 'left',
  sort_order: 0,
  is_active: true,
};

export default function BannerEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { bannerId } = useParams({ strict: false }) as { bannerId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = !bannerId || bannerId === 'new';

  const [form, setForm] = useState<BannerForm>(defaultForm);

  const { data: banner, isLoading } = useQuery({
    queryKey: ['admin-banner', bannerId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('id', bannerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: sections } = useQuery({
    queryKey: ['admin-sections-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sections')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });

  // Ініціалізація форми при завантаженні даних (adjust state during render)
  const [prevBannerId, setPrevBannerId] = useState<string | null>(null);
  if (banner && banner.id !== prevBannerId) {
    setPrevBannerId(banner.id);
    setForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      desktop_image_url: banner.desktop_image_url || '',
      mobile_image_url: banner.mobile_image_url || '',
      placement: banner.placement || 'home',
      section_id: banner.section_id || '',
      buttons: (Array.isArray(banner.buttons)
        ? banner.buttons
        : []) as unknown as BannerButton[],
      date_from: banner.date_from ? banner.date_from.slice(0, 16) : '',
      date_to: banner.date_to ? banner.date_to.slice(0, 16) : '',
      schedule_days: (banner.schedule_days as number[]) || [],
      schedule_time_from: banner.schedule_time_from || '',
      schedule_time_to: banner.schedule_time_to || '',
      slide_duration: banner.slide_duration || 5000,
      animation_type: banner.animation_type || 'slide',
      animation_duration: banner.animation_duration || 500,
      overlay_color: banner.overlay_color || 'rgba(0,0,0,0.4)',
      text_position: banner.text_position || 'left',
      sort_order: banner.sort_order || 0,
      is_active: banner.is_active ?? true,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || null,
        image_url: form.image_url,
        desktop_image_url: form.desktop_image_url || null,
        mobile_image_url: form.mobile_image_url || null,
        placement: form.placement,
        section_id: form.section_id || null,
        buttons: form.buttons as unknown as Json,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
        schedule_days:
          form.schedule_days.length > 0 ? form.schedule_days : null,
        schedule_time_from: form.schedule_time_from || null,
        schedule_time_to: form.schedule_time_to || null,
        slide_duration: form.slide_duration,
        animation_type: form.animation_type,
        animation_duration: form.animation_duration,
        overlay_color: form.overlay_color || null,
        text_position: form.text_position,
        sort_order: form.sort_order,
        is_active: form.is_active,
      };

      if (isNew) {
        const { error } = await supabase.from('banners').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('banners')
          .update(payload)
          .eq('id', bannerId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      toast({ title: t('admin.banners.saved') });
      navigate({ to: adminPath('banners') });
    },
    onError: () => {
      toast({ variant: 'destructive', title: t('common.saveError') });
    },
  });

  const update = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addButton = () => {
    update('buttons', [
      ...form.buttons,
      { text: '', url: '', target: '_self', variant: 'primary' },
    ]);
  };

  const updateButton = (
    index: number,
    field: keyof BannerButton,
    value: string,
  ) => {
    const updated = [...form.buttons];
    updated[index] = { ...updated[index], [field]: value };
    update('buttons', updated);
  };

  const removeButton = (index: number) => {
    update(
      'buttons',
      form.buttons.filter((_, i) => i !== index),
    );
  };

  const toggleDay = (day: number) => {
    const days = form.schedule_days.includes(day)
      ? form.schedule_days.filter((d) => d !== day)
      : [...form.schedule_days, day];
    update('schedule_days', days);
  };

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: adminPath('banners') })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isNew ? t('admin.banners.new') : t('admin.banners.editTitle')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.banners.main')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('admin.banners.titleField')}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.banners.subtitle')}</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => update('subtitle', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.banners.imageField')}</Label>
                <ImageUpload
                  images={form.image_url ? [form.image_url] : []}
                  onImagesChange={(imgs) => update('image_url', imgs[0] || '')}
                  bucket="banner-images"
                  folder="banners"
                  maxImages={1}
                />
              </div>
              <div>
                <Label>{t('admin.banners.imageDesktop')}</Label>
                <ImageUpload
                  images={
                    form.desktop_image_url ? [form.desktop_image_url] : []
                  }
                  onImagesChange={(imgs) =>
                    update('desktop_image_url', imgs[0] || '')
                  }
                  bucket="banner-images"
                  folder="banners/desktop"
                  maxImages={1}
                />
              </div>
              <div>
                <Label>{t('admin.banners.imageMobile')}</Label>
                <ImageUpload
                  images={form.mobile_image_url ? [form.mobile_image_url] : []}
                  onImagesChange={(imgs) =>
                    update('mobile_image_url', imgs[0] || '')
                  }
                  bucket="banner-images"
                  folder="banners/mobile"
                  maxImages={1}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin.banners.textPosition')}</Label>
                  <Select
                    value={form.text_position}
                    onValueChange={(v) => update('text_position', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">
                        {t('admin.banners.align.left')}
                      </SelectItem>
                      <SelectItem value="center">
                        {t('admin.banners.align.center')}
                      </SelectItem>
                      <SelectItem value="right">
                        {t('admin.banners.align.right')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.banners.overlayColor')}</Label>
                  <Input
                    value={form.overlay_color}
                    onChange={(e) => update('overlay_color', e.target.value)}
                    placeholder="rgba(0,0,0,0.4)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('admin.banners.buttons')}</CardTitle>
                <Button variant="outline" size="sm" onClick={addButton}>
                  <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.buttons.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('admin.banners.buttonsEmpty')}
                </p>
              )}
              {form.buttons.map((btn, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t('admin.banners.button')} {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeButton(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('common.text')}</Label>
                      <Input
                        value={btn.text}
                        onChange={(e) =>
                          updateButton(i, 'text', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={btn.url}
                        onChange={(e) => updateButton(i, 'url', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t('admin.banners.buttonVariant')}</Label>
                      <Select
                        value={btn.variant}
                        onValueChange={(v) => updateButton(i, 'variant', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('admin.banners.buttonTarget')}</Label>
                      <Select
                        value={btn.target}
                        onValueChange={(v) => updateButton(i, 'target', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_self">
                            {t('admin.banners.targetSelf')}
                          </SelectItem>
                          <SelectItem value="_blank">
                            {t('admin.banners.targetBlank')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.banners.schedule')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('common.dateFrom')}</Label>
                  <Input
                    type="datetime-local"
                    value={form.date_from}
                    onChange={(e) => update('date_from', e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('common.dateTo')}</Label>
                  <Input
                    type="datetime-local"
                    value={form.date_to}
                    onChange={(e) => update('date_to', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">
                  {t('admin.banners.weekdays')}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.schedule_days.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span className="text-sm">{t(day.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin.banners.timeFrom')}</Label>
                  <Input
                    type="time"
                    value={form.schedule_time_from}
                    onChange={(e) =>
                      update('schedule_time_from', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t('admin.banners.timeTo')}</Label>
                  <Input
                    type="time"
                    value={form.schedule_time_to}
                    onChange={(e) => update('schedule_time_to', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Placement */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.banners.placement')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('admin.banners.placementLabel')}</Label>
                <Select
                  value={form.placement}
                  onValueChange={(v) => update('placement', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">
                      {t('admin.banners.placement.home')}
                    </SelectItem>
                    <SelectItem value="catalog">
                      {t('admin.banners.placement.catalog')}
                    </SelectItem>
                    <SelectItem value="section">
                      {t('admin.banners.specificSection')}
                    </SelectItem>
                    <SelectItem value="blog">
                      {t('admin.banners.placement.blog')}
                    </SelectItem>
                    <SelectItem value="global">
                      {t('admin.banners.placement.global')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.placement === 'section' && (
                <div>
                  <Label>{t('admin.banners.placement.section')}</Label>
                  <Select
                    value={form.section_id}
                    onValueChange={(v) => update('section_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('admin.banners.pickSection')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sections?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Animation */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.banners.animation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('admin.banners.animationType')}</Label>
                <Select
                  value={form.animation_type}
                  onValueChange={(v) => update('animation_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slide">
                      {t('admin.banners.anim.slide')}
                    </SelectItem>
                    <SelectItem value="fade">
                      {t('admin.banners.anim.fade')}
                    </SelectItem>
                    <SelectItem value="zoom">
                      {t('admin.banners.anim.zoom')}
                    </SelectItem>
                    <SelectItem value="none">
                      {t('admin.banners.anim.none')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {t('admin.banners.animationDuration')}{' '}
                  {form.animation_duration} {t('admin.banners.ms')}
                </Label>
                <Slider
                  value={[form.animation_duration]}
                  onValueChange={([v]) => update('animation_duration', v)}
                  min={100}
                  max={2000}
                  step={50}
                />
              </div>
              <div>
                <Label>
                  {t('admin.banners.slideDuration')}{' '}
                  {(form.slide_duration / 1000).toFixed(1)}{' '}
                  {t('admin.banners.sec')}
                </Label>
                <Slider
                  value={[form.slide_duration]}
                  onValueChange={([v]) => update('slide_duration', v)}
                  min={1000}
                  max={15000}
                  step={500}
                />
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('common.status')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('common.activeM')}</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => update('is_active', v)}
                />
              </div>
              <div>
                <Label>{t('common.sortOrder')}</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    update('sort_order', parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={!form.title || !form.image_url || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" /> {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
