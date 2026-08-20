import { NavLink } from '@simplycms/core/components/NavLink';
import { adminPath } from '../lib/adminLinks';
import { useSidebar } from '@simplycms/ui/sidebar';
import { useT, type MessageKey } from 'simplycms/i18n';

interface SidebarItem {
  titleKey: MessageKey;
  url: string;
  icon: LucideIcon;
}

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FolderTree,
  Package,
  Settings,
  Users,
  ShoppingCart,
  FileText,
  Wrench,
  Globe,
  Tags,
  ListChecks,
  Puzzle,
  Truck,
  Map,
  Building,
  Palette,
  DollarSign,
  Percent,
  Calculator,
  ImageIcon,
  MessageSquare,
} from 'lucide-react';
import { PluginSlot } from '@simplycms/plugins/PluginSlot';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@simplycms/ui/sidebar';

// Пункти меню тримають КЛЮЧІ, не тексти: масив лишається на рівні модуля
// (він статичний), а підпис резолвиться під час рендера через `t()`.
const catalogItems = [
  {
    titleKey: 'admin.nav.sections',
    url: adminPath('sections'),
    icon: FolderTree,
  },
  {
    titleKey: 'admin.nav.properties',
    url: adminPath('properties'),
    icon: ListChecks,
  },
  { titleKey: 'admin.nav.products', url: adminPath('products'), icon: Package },
  {
    titleKey: 'admin.nav.priceTypes',
    url: adminPath('price-types'),
    icon: DollarSign,
  },
  {
    titleKey: 'admin.nav.discounts',
    url: adminPath('discounts'),
    icon: Percent,
  },
  {
    titleKey: 'admin.nav.priceValidator',
    url: adminPath('price-validator'),
    icon: Calculator,
  },
] satisfies SidebarItem[];

const ordersItems = [
  {
    titleKey: 'admin.nav.orders',
    url: adminPath('orders'),
    icon: ShoppingCart,
  },
  {
    titleKey: 'admin.nav.orderStatuses',
    url: adminPath('order-statuses'),
    icon: Tags,
  },
] satisfies SidebarItem[];

const servicesItems = [
  { titleKey: 'admin.nav.services', url: adminPath('services'), icon: Wrench },
  {
    titleKey: 'admin.nav.serviceRequests',
    url: adminPath('service-requests'),
    icon: FileText,
  },
] satisfies SidebarItem[];

const shippingItems = [
  {
    titleKey: 'admin.nav.shippingMethods',
    url: adminPath('shipping/methods'),
    icon: Truck,
  },
  {
    titleKey: 'admin.nav.shippingZones',
    url: adminPath('shipping/zones'),
    icon: Map,
  },
  {
    titleKey: 'admin.nav.pickupPoints',
    url: adminPath('shipping/pickup-points'),
    icon: Building,
  },
] satisfies SidebarItem[];

const contentItems = [
  { titleKey: 'admin.nav.banners', url: adminPath('banners'), icon: ImageIcon },
  {
    titleKey: 'admin.nav.reviews',
    url: adminPath('reviews'),
    icon: MessageSquare,
  },
] satisfies SidebarItem[];

const settingsItems = [
  { titleKey: 'admin.nav.plugins', url: adminPath('plugins'), icon: Puzzle },
  { titleKey: 'admin.nav.themes', url: adminPath('themes'), icon: Palette },
  { titleKey: 'admin.nav.users', url: adminPath('users'), icon: Users },
  {
    titleKey: 'admin.nav.userCategories',
    url: adminPath('user-categories'),
    icon: Tags,
  },
  { titleKey: 'admin.nav.languages', url: adminPath('languages'), icon: Globe },
  {
    titleKey: 'admin.nav.settings',
    url: adminPath('settings'),
    icon: Settings,
  },
] satisfies SidebarItem[];

export function AdminSidebar() {
  const t = useT();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent className="pt-4">
        {/* Logo */}
        <div className="px-4 mb-4">
          <NavLink to="/admin" className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            {!collapsed && <span className="font-bold text-lg">CMS</span>}
          </NavLink>
        </div>

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/admin"
                    exact
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>{t('admin.nav.dashboard')}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Catalog */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.catalog')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Orders */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.orders')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ordersItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Services */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.services')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {servicesItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Shipping */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.shipping')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shippingItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Content */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.content')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Plugin slot: sidebar items from plugins */}
        <PluginSlot
          name="admin.sidebar.items"
          context={{ collapsed }}
          wrapper={(children) => (
            <SidebarGroup>
              <SidebarGroupLabel>
                {!collapsed && t('admin.nav.group.plugins')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {children.map((child, index) => (
                    <SidebarMenuItem key={`plugin-item-${index}`}>
                      {child}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && t('admin.nav.group.settings')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
