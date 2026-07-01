import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Group,
  Text,
  Badge,
  NumberInput,
  Select,
  SimpleGrid,
  ActionIcon,
  Menu,
  Tooltip,
  UnstyledButton,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCheck,
  IconPaperclip,
  IconPencil,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { api, PaymentEntry, PaymentType } from "../api";
import { MONTHS, useMoney } from "../context";
import {
  FREQUENCY_LABELS,
  generatePeriods,
  needsMonthNav,
  needsYearNav,
  PeriodCell,
} from "../periods";
import EntryModal from "./EntryModal";

interface Props {
  type: PaymentType;
  onEditType: (t: PaymentType) => void;
  onDeleted: () => void;
  onDataChanged: () => void;
}

const GRID_COLS: Record<string, any> = {
  MONTHLY: { base: 3, xs: 4, sm: 6 },
  YEARLY: { base: 3, xs: 6 },
  WEEKLY: { base: 4, xs: 6, sm: 8 },
  DAILY: { base: 5, xs: 7, sm: 10 },
};

export default function PaymentTypeSection({ type, onEditType, onDeleted, onDataChanged }: Props) {
  const money = useMoney();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<Record<string, PaymentEntry>>({});
  const [loading, setLoading] = useState(true);
  const [modalCell, setModalCell] = useState<PeriodCell | null>(null);
  const [modalEntry, setModalEntry] = useState<PaymentEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { entries } = await api.listEntries(type.id, year);
      const map: Record<string, PaymentEntry> = {};
      for (const e of entries) map[e.periodKey] = e;
      setEntries(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type.id, year]);

  const cells = useMemo(
    () => generatePeriods(type.frequency, { year, month }),
    [type.frequency, year, month]
  );

  // For daily we fetch the whole year; only show the selected month's cells.
  const visibleCells = cells;

  const rangeTotal = useMemo(() => {
    let sum = 0;
    for (const c of visibleCells) {
      const e = entries[c.key];
      if (e?.amount) sum += e.amount;
    }
    return sum;
  }, [visibleCells, entries]);

  function periodLabel(c: PeriodCell) {
    const d = new Date(c.dateISO);
    switch (type.frequency) {
      case "MONTHLY":
        return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      case "YEARLY":
        return `${d.getUTCFullYear()}`;
      case "DAILY":
        return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
      default:
        return `${c.label} · ${d.getUTCFullYear()}`;
    }
  }

  async function quickPaid(c: PeriodCell) {
    try {
      const fd = new FormData();
      fd.append("paymentTypeId", String(type.id));
      fd.append("periodKey", c.key);
      fd.append("periodDate", c.dateISO);
      fd.append("status", "PAID");
      await api.upsertEntry(fd);
      await load();
      onDataChanged();
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    }
  }

  function openDetails(c: PeriodCell, entry: PaymentEntry | null) {
    setModalCell(c);
    setModalEntry(entry);
    setModalOpen(true);
  }

  function confirmDeleteType() {
    modals.openConfirmModal({
      title: `Delete "${type.name}"?`,
      children: (
        <Text size="sm">
          This deletes the payment type and all of its recorded periods and attachments.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteType(type.id);
          notifications.show({ color: "green", message: "Deleted" });
          onDeleted();
        } catch (err: any) {
          notifications.show({ color: "red", message: err.message });
        }
      },
    });
  }

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600}>{type.name}</Text>
          <Badge variant="light" size="sm">
            {FREQUENCY_LABELS[type.frequency]}
          </Badge>
          {type.defaultAmount != null && (
            <Badge variant="light" color="gray" size="sm">
              default {money(type.defaultAmount)}
            </Badge>
          )}
        </Group>
        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDotsVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEditType(type)}>
              Edit type
            </Menu.Item>
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={confirmDeleteType}>
              Delete type
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          {needsYearNav(type.frequency) && (
            <NumberInput
              w={110}
              size="xs"
              value={year}
              onChange={(v) => setYear(Number(v) || now.getFullYear())}
              min={1970}
              max={3000}
              aria-label="Year"
            />
          )}
          {needsMonthNav(type.frequency) && (
            <Select
              w={130}
              size="xs"
              data={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              value={String(month)}
              onChange={(v) => v && setMonth(Number(v))}
              allowDeselect={false}
              aria-label="Month"
            />
          )}
        </Group>
        <Text size="sm" c="dimmed">
          Total: <b>{money(rangeTotal)}</b>
        </Text>
      </Group>

      {loading ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : (
        <SimpleGrid cols={GRID_COLS[type.frequency]} spacing="xs">
          {visibleCells.map((c) => {
            const entry = entries[c.key] || null;
            const paid = entry?.status === "PAID";
            const partial = entry?.status === "PARTIAL";
            return (
              <div key={c.key} style={{ position: "relative" }}>
                <UnstyledButton
                  onClick={() => (entry ? openDetails(c, entry) : quickPaid(c))}
                  style={{ width: "100%" }}
                >
                  <Card
                    withBorder
                    padding="xs"
                    style={{
                      textAlign: "center",
                      borderColor: paid
                        ? "var(--mantine-color-green-6)"
                        : partial
                        ? "var(--mantine-color-orange-5)"
                        : undefined,
                      backgroundColor: paid
                        ? "var(--mantine-color-green-light)"
                        : partial
                        ? "var(--mantine-color-orange-light)"
                        : undefined,
                    }}
                  >
                    <Group justify="center" gap={4}>
                      <Text size="sm" fw={500}>
                        {c.label}
                      </Text>
                      {paid && <IconCheck size={14} color="var(--mantine-color-green-7)" />}
                      {partial && (
                        <Text size="xs" c="orange.7" fw={700}>
                          ½
                        </Text>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" style={{ minHeight: 16 }}>
                      {entry
                        ? entry.amount != null
                          ? money(entry.amount)
                          : partial
                          ? "partial"
                          : "paid"
                        : "—"}
                    </Text>
                    {entry && entry.attachments.length > 0 && (
                      <Center>
                        <IconPaperclip size={12} />
                      </Center>
                    )}
                  </Card>
                </UnstyledButton>
                {!entry && (
                  <Tooltip label="Add with amount / attachment" withArrow>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      style={{ position: "absolute", top: 2, right: 2 }}
                      onClick={() => openDetails(c, null)}
                    >
                      <IconPencil size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </SimpleGrid>
      )}

      <EntryModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          load();
          onDataChanged();
        }}
        type={type}
        cell={modalCell}
        entry={modalEntry}
        periodLabel={modalCell ? periodLabel(modalCell) : ""}
      />
    </Card>
  );
}
