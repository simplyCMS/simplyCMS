import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
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
} from "lucide-react";
import { PluginSlot } from "@/components/plugins/PluginSlot";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const catalogItems = [
  { title: "Розділи", url: "/admin/sections", icon: FolderTree },
  { title: "Властивості", url: "/admin/properties", icon: ListChecks },
  { title: "Товари", url: "/admin/products", icon: Package },
  { title: "Види цін", url: "/admin/price-types", icon: DollarSign },
  { title: "Скидки", url: "/admin/discounts", icon: Percent },
  { title: "Валідатор цін", url: "/admin/price-validator", icon: Calculator },
];

const ordersItems = [
  { title: "Замовлення", url: "/admin/orders", icon: ShoppingCart },
  { title: "Статуси", url: "/admin/order-statuses", icon: Tags },
];

const servicesItems = [
  { title: "Послуги", url: "/admin/services", icon: Wrench },
  { title: "Заявки", url: "/admin/service-requests", icon: FileText },
];

const shippingItems = [
  { title: "Служби доставки", url: "/admin/shipping/methods", icon: Truck },
  { title: "Зони доставки", url: "/admin/shipping/zones", icon: Map },
  { title: "Точки самовивозу", url: "/admin/shipping/pickup-points", icon: Building },
];

const contentItems = [
  { title: "Банери", url: "/admin/banners", icon: ImageIcon },
  { title: "Відгуки", url: "/admin/reviews", icon: MessageSquare },
];

const settingsItems = [
  { title: "Розширення", url: "/admin/plugins", icon: Puzzle },
  { title: "Теми", url: "/admin/themes", icon: Palette },
  { title: "Користувачі", url: "/admin/users", icon: Users },
  { title: "Категорії користувачів", url: "/admin/user-categories", icon: Tags },
  { title: "Мови", url: "/admin/languages", icon: Globe },
  { title: "Налаштування", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
                    end
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
          <SidebarGroupLabel>{!collapsed && "Каталог"}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{!collapsed && "Замовлення"}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{!collapsed && "Послуги"}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{!collapsed && "Доставка"}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{!collapsed && "Контент"}</SidebarGroupLabel>
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
              <SidebarGroupLabel>{!collapsed && "Розширення"}</SidebarGroupLabel>
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
          <SidebarGroupLabel>{!collapsed && "Налаштування"}</SidebarGroupLabel>
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
