import { Routes, Route, Navigate, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  Menu,
  Avatar,
  Text,
  Loader,
  Center,
  ActionIcon,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconBuildingCommunity,
  IconChartBar,
  IconSettings,
  IconUsers,
  IconLogout,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { useApp } from "./context";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import HousesPage from "./pages/HousesPage";
import HouseDetailPage from "./pages/HouseDetailPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  const { user, loading, logout, appName } = useApp();
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!user) return <LoginPage />;

  const links = [
    { to: "/", label: "Dashboard", icon: IconHome },
    { to: "/houses", label: "Houses", icon: IconBuildingCommunity },
    { to: "/stats", label: "Statistics", icon: IconChartBar },
    ...(user.isAdmin
      ? [
          { to: "/users", label: "Users", icon: IconUsers },
          { to: "/settings", label: "Settings", icon: IconSettings },
        ]
      : []),
  ];

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>{appName}</Title>
          </Group>
          <Group>
            <ActionIcon variant="subtle" onClick={toggleColorScheme} aria-label="Toggle theme">
              {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <Group gap="xs" style={{ cursor: "pointer" }}>
                  <Avatar radius="xl" size="sm" color="blue">
                    {user.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Text size="sm" visibleFrom="sm">
                    {user.name}
                  </Text>
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.username}</Menu.Label>
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => logout()}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {links.map((l) => (
          <NavLink
            key={l.to}
            component={RouterNavLink}
            to={l.to}
            label={l.label}
            leftSection={<l.icon size={18} />}
            active={
              l.to === "/" ? location.pathname === "/" : location.pathname.startsWith(l.to)
            }
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/houses" element={<HousesPage />} />
          <Route path="/houses/:id" element={<HouseDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          {user.isAdmin && <Route path="/users" element={<UsersPage />} />}
          {user.isAdmin && <Route path="/settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
