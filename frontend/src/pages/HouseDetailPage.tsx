import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Title,
  Group,
  Button,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Table,
  ActionIcon,
  Menu,
  NumberInput,
  Anchor,
  Center,
  Loader,
  Breadcrumbs,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconPaperclip,
  IconMapPin,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { api, House, Payment } from "../api";
import { MONTHS, useMoney } from "../context";
import PaymentModal from "../components/PaymentModal";

export default function HouseDetailPage() {
  const { id } = useParams();
  const houseId = Number(id);
  const money = useMoney();

  const [house, setHouse] = useState<House | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ house }, { houses }, { payments }] = await Promise.all([
        api.getHouse(houseId),
        api.listHouses(),
        api.listPayments({ houseId }),
      ]);
      setHouse(house);
      setHouses(houses);
      setPayments(payments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Allocate each payment evenly across covered months for the selected year.
  const monthTotals = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const p of payments) {
      const per = p.amount / (p.periods.length || 1);
      for (const period of p.periods) {
        if (period.year === year) totals[period.month - 1] += per;
      }
    }
    return totals;
  }, [payments, year]);

  const yearTotal = monthTotals.reduce((a, b) => a + b, 0);

  const paymentsForYear = useMemo(
    () => payments.filter((p) => p.periods.some((pp) => pp.year === year)),
    [payments, year]
  );

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Payment) {
    setEditing(p);
    setModalOpen(true);
  }

  function confirmDelete(p: Payment) {
    modals.openConfirmModal({
      title: "Delete payment?",
      children: <Text size="sm">This permanently deletes the payment and its attachments.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deletePayment(p.id);
          await load();
          notifications.show({ color: "green", message: "Deleted" });
        } catch (err: any) {
          notifications.show({ color: "red", message: err.message });
        }
      },
    });
  }

  if (loading)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );

  if (!house) return <Text>House not found.</Text>;

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} to="/houses">
          Houses
        </Anchor>
        <Text>{house.name}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{house.name}</Title>
          {house.location && (
            <Group gap={4} mt={4}>
              <IconMapPin size={14} opacity={0.6} />
              <Text c="dimmed" size="sm">
                {house.location}
              </Text>
            </Group>
          )}
        </div>
        <Group>
          <NumberInput
            w={110}
            value={year}
            onChange={(v) => setYear(Number(v) || new Date().getFullYear())}
            min={1970}
            max={3000}
            aria-label="Year"
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
            Add payment
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        <Group justify="space-between">
          <Text fw={500}>Total for {year}</Text>
          <Text fw={700} size="lg">
            {money(yearTotal)}
          </Text>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }}>
        {MONTHS.map((m, i) => (
          <Card key={m} withBorder padding="sm" bg={monthTotals[i] > 0 ? undefined : "transparent"}>
            <Text size="xs" c="dimmed">
              {m}
            </Text>
            <Text fw={600}>{monthTotals[i] > 0 ? money(monthTotals[i]) : "—"}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Title order={4} mt="md">
        Payments in {year}
      </Title>

      {paymentsForYear.length === 0 ? (
        <Text c="dimmed">No payments recorded for {year}.</Text>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Months covered</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paymentsForYear.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{new Date(p.paidOn).toLocaleDateString()}</Table.Td>
                  <Table.Td>{p.category || "—"}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {p.periods.map((pp) => (
                        <Badge key={`${pp.year}-${pp.month}`} variant="light" size="sm">
                          {MONTHS[pp.month - 1].slice(0, 3)} {pp.year}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={p.status === "PAID" ? "green" : "orange"} variant="light">
                      {p.status === "PAID" ? "Paid" : "Unpaid"}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={6} justify="flex-end">
                      {p.attachments.length > 0 && (
                        <Tooltip label={`${p.attachments.length} attachment(s)`}>
                          <Group gap={2}>
                            <IconPaperclip size={14} />
                            <Text size="xs">{p.attachments.length}</Text>
                          </Group>
                        </Tooltip>
                      )}
                      <Text fw={600}>{money(p.amount)}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDotsVertical size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEdit(p)}>
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => confirmDelete(p)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <PaymentModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        houses={houses}
        fixedHouseId={houseId}
        editing={editing}
      />
    </Stack>
  );
}
