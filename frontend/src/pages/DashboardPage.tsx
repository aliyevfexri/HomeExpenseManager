import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Title,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Group,
  Badge,
  Loader,
  Center,
  Paper,
  Anchor,
  ThemeIcon,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { IconCash, IconBuildingCommunity, IconCalendar } from "@tabler/icons-react";
import { api, Summary, RecentEntry } from "../api";
import { MONTHS, useMoney } from "../context";

export default function DashboardPage() {
  const money = useMoney();
  const year = new Date().getFullYear();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [summary, { recent }] = await Promise.all([
          api.summary({ year }),
          api.recent(),
        ]);
        setSummary(summary);
        setRecent(recent);
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  if (loading || !summary)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );

  const chartData = summary.byMonth.map((m) => ({
    month: MONTHS[m.month - 1].slice(0, 3),
    Total: m.total,
  }));

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard
          icon={<IconCash size={20} />}
          color="blue"
          label={`Total in ${year}`}
          value={money(summary.yearTotal)}
        />
        <StatCard
          icon={<IconBuildingCommunity size={20} />}
          color="grape"
          label="Houses"
          value={String(summary.byHouse.length)}
        />
        <StatCard
          icon={<IconCalendar size={20} />}
          color="teal"
          label="All-time total"
          value={money(summary.grandTotal)}
        />
      </SimpleGrid>

      <Card withBorder>
        <Text fw={500} mb="md">
          Monthly spending in {year}
        </Text>
        {summary.yearTotal > 0 ? (
          <BarChart
            h={260}
            data={chartData}
            dataKey="month"
            series={[{ name: "Total", color: "blue.6" }]}
            valueFormatter={(v) => money(v)}
          />
        ) : (
          <Text c="dimmed">No data for {year} yet.</Text>
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder>
          <Text fw={500} mb="sm">
            By house ({year})
          </Text>
          {summary.byHouse.length === 0 ? (
            <Text c="dimmed">No payments yet.</Text>
          ) : (
            <Stack gap="xs">
              {summary.byHouse.map((h) => (
                <Group key={h.id} justify="space-between">
                  <Anchor component={Link} to={`/houses/${h.id}`}>
                    {h.name}
                  </Anchor>
                  <Text fw={600}>{money(h.total)}</Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>

        <Card withBorder>
          <Text fw={500} mb="sm">
            Recent activity
          </Text>
          {recent.length === 0 ? (
            <Text c="dimmed">Nothing recorded yet.</Text>
          ) : (
            <Stack gap="xs">
              {recent.map((r) => {
                const d = new Date(r.periodDate);
                return (
                  <Group key={r.id} justify="space-between" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" truncate>
                        {r.houseName} · {r.typeName}
                      </Text>
                      <Group gap={4}>
                        <Badge size="xs" variant="light">
                          {MONTHS[d.getUTCMonth()].slice(0, 3)} {d.getUTCFullYear()}
                        </Badge>
                        {r.status === "PARTIAL" && (
                          <Badge size="xs" variant="light" color="orange">
                            partial
                          </Badge>
                        )}
                      </Group>
                    </div>
                    <Text fw={600}>{r.amount != null ? money(r.amount) : "—"}</Text>
                  </Group>
                );
              })}
            </Stack>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group>
        <ThemeIcon size={42} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}
