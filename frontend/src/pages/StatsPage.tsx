import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Group,
  Select,
  Card,
  Text,
  SimpleGrid,
  Table,
  Loader,
  Center,
} from "@mantine/core";
import { BarChart, LineChart } from "@mantine/charts";
import { api, House, Summary } from "../api";
import { MONTHS, useMoney } from "../context";

export default function StatsPage() {
  const money = useMoney();
  const [houses, setHouses] = useState<House[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [houseId, setHouseId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ houses }, { years }] = await Promise.all([api.listHouses(), api.years()]);
      setHouses(houses);
      const yrs = years.length ? years : [new Date().getFullYear()];
      setYears(yrs);
      if (!yrs.includes(Number(year))) setYear(String(yrs[0]));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .summary({ year: Number(year), houseId: houseId ? Number(houseId) : undefined })
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [year, houseId]);

  const monthData =
    summary?.byMonth.map((m) => ({ month: MONTHS[m.month - 1].slice(0, 3), Total: m.total })) ?? [];
  const yearData = summary?.byYear.map((y) => ({ year: String(y.year), Total: y.total })) ?? [];

  return (
    <Stack>
      <Title order={2}>Statistics</Title>

      <Group>
        <Select
          label="Year"
          w={140}
          data={years.map((y) => String(y))}
          value={year}
          onChange={(v) => v && setYear(v)}
        />
        <Select
          label="House"
          w={220}
          placeholder="All houses"
          clearable
          data={houses.map((h) => ({ value: String(h.id), label: h.name }))}
          value={houseId}
          onChange={setHouseId}
        />
      </Group>

      {loading || !summary ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder>
              <Text size="xs" c="dimmed">
                Total in {year}
              </Text>
              <Text fw={700} size="xl">
                {money(summary.yearTotal)}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed">
                All-time total {houseId ? "(this house)" : ""}
              </Text>
              <Text fw={700} size="xl">
                {money(summary.grandTotal)}
              </Text>
            </Card>
          </SimpleGrid>

          <Card withBorder>
            <Text fw={500} mb="md">
              Monthly breakdown — {year}
            </Text>
            <BarChart
              h={260}
              data={monthData}
              dataKey="month"
              series={[{ name: "Total", color: "blue.6" }]}
              valueFormatter={(v) => money(v)}
            />
          </Card>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder>
              <Text fw={500} mb="md">
                Year-over-year trend
              </Text>
              {yearData.length > 0 ? (
                <LineChart
                  h={240}
                  data={yearData}
                  dataKey="year"
                  series={[{ name: "Total", color: "teal.6" }]}
                  valueFormatter={(v) => money(v)}
                  curveType="linear"
                />
              ) : (
                <Text c="dimmed">No data.</Text>
              )}
            </Card>

            <Card withBorder>
              <Text fw={500} mb="md">
                Monthly table — {year}
              </Text>
              <Table>
                <Table.Tbody>
                  {summary.byMonth.map((m) => (
                    <Table.Tr key={m.month}>
                      <Table.Td>{MONTHS[m.month - 1]}</Table.Td>
                      <Table.Td ta="right">{m.total > 0 ? money(m.total) : "—"}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td fw={700}>Total</Table.Td>
                    <Table.Td ta="right" fw={700}>
                      {money(summary.yearTotal)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Card>
          </SimpleGrid>

          {!houseId && summary.byHouse.length > 0 && (
            <Card withBorder>
              <Text fw={500} mb="md">
                By house — {year}
              </Text>
              <Table>
                <Table.Tbody>
                  {summary.byHouse.map((h) => (
                    <Table.Tr key={h.id}>
                      <Table.Td>{h.name}</Table.Td>
                      <Table.Td ta="right">{money(h.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
