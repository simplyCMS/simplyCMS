import { NavLink } from '@simplycms/core/components/NavLink';
import { adminPath } from '../lib/adminLinks';
import { useSidebar } from '@simplycms/ui/sidebar';
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

const catalogItems = [
  { title: 'Розділи', url: adminPath('sections'), icon: FolderTree },
  { title: 'Властивості', url: adminPath('properties'), icon: ListChecks },
  { title: 'Товари', url: adminPath('products'), icon: Package },
  { title: 'Види цін', url: adminPath('price-types'), icon: DollarSign },
  { title: 'Скидки', url: adminPath('discounts'), icon: Percent },
  {
    title: 'Валідатор цін',
    url: adminPath('price-validator'),
    icon: Calculator,
  },
];

const ordersItems = [
  { title: 'Замовлення', url: adminPath('orders'), icon: ShoppingCart },
  { title: 'Статуси', url: adminPath('order-statuses'), icon: Tags },
];

const servicesItems = [
  { title: 'Послуги', url: adminPath('services'), icon: Wrench },
  { title: 'Заявки', url: adminPath('service-requests'), icon: FileText },
];

const shippingItems = [
  { title: 'Служби доставки', url: adminPath('shipping/methods'), icon: Truck },
  { title: 'Зони доставки', url: adminPath('shipping/zones'), icon: Map },
  {
    title: 'Точки самовивозу',
    url: adminPath('shipping/pickup-points'),
    icon: Building,
  },
];

const contentItems = [
  { title: 'Банери', url: adminPath('banners'), icon: ImageIcon },
  { title: 'Відгуки', url: adminPath('reviews'), icon: MessageSquare },
];

const settingsItems = [
  { title: 'Розширення', url: adminPath('plugins'), icon: Puzzle },
  { title: 'Теми', url: adminPath('themes'), icon: Palette },
  { title: 'Користувачі', url: adminPath('users'), icon: Users },
  {
    title: 'Категорії користувачів',
    url: adminPath('user-categories'),
    icon: Tags,
  },
  { title: 'Мови', url: adminPath('languages'), icon: Globe },
  { title: 'Налаштування', url: adminPath('settings'), icon: Settings },
];

export function AdminSidebar() {
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
                    {!collapsed && <span>Дашборд</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Catalog */}
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Каталог'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Orders */}
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Замовлення'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ordersItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Services */}
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Послуги'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {servicesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Shipping */}
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Доставка'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shippingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Content */}
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && 'Контент'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
                {!collapsed && 'Розширення'}
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
          <SidebarGroupLabel>{!collapsed && 'Налаштування'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
