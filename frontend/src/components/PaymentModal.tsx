import { useEffect, useState } from "react";
import {
  Modal,
  Select,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
  Chip,
  Badge,
  Text,
  SegmentedControl,
  FileInput,
  Divider,
  Autocomplete,
  ActionIcon,
  Anchor,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash, IconPaperclip, IconFile } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api, House, Payment, Period } from "../api";
import { MONTHS } from "../context";

const CATEGORY_SUGGESTIONS = [
  "Rent",
  "Mortgage",
  "Electricity",
  "Water",
  "Gas",
  "Internet",
  "Maintenance",
  "Insurance",
  "Taxes",
  "Other",
];

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  houses: House[];
  fixedHouseId?: number;
  editing?: Payment | null;
}

export default function PaymentModal({
  opened,
  onClose,
  onSaved,
  houses,
  fixedHouseId,
  editing,
}: Props) {
  const now = new Date();
  const [houseId, setHouseId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>("");
  const [paidOn, setPaidOn] = useState<Date | null>(now);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear());
  const [periods, setPeriods] = useState<Period[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (editing) {
      setHouseId(String(editing.houseId));
      setAmount(editing.amount);
      setPaidOn(new Date(editing.paidOn));
      setNote(editing.note || "");
      setCategory(editing.category || "");
      setStatus(editing.status);
      setPeriods(editing.periods.map((p) => ({ year: p.year, month: p.month })));
      setPeriodYear(editing.periods[0]?.year ?? now.getFullYear());
    } else {
      setHouseId(fixedHouseId ? String(fixedHouseId) : null);
      setAmount("");
      setPaidOn(new Date());
      setNote("");
      setCategory("");
      setStatus("PAID");
      setPeriods([]);
      setPeriodYear(new Date().getFullYear());
    }
    setFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing, fixedHouseId]);

  function toggleMonth(month: number) {
    setPeriods((prev) => {
      const exists = prev.some((p) => p.year === periodYear && p.month === month);
      if (exists) return prev.filter((p) => !(p.year === periodYear && p.month === month));
      return [...prev, { year: periodYear, month }];
    });
  }

  function removePeriod(p: Period) {
    setPeriods((prev) => prev.filter((x) => !(x.year === p.year && x.month === p.month)));
  }

  const selectedThisYear = periods.filter((p) => p.year === periodYear).map((p) => String(p.month));

  async function save() {
    if (!houseId) return notifications.show({ color: "red", message: "Pick a house" });
    if (amount === "" || Number(amount) < 0)
      return notifications.show({ color: "red", message: "Enter a valid amount" });
    if (!paidOn) return notifications.show({ color: "red", message: "Pick a payment date" });
    if (periods.length === 0)
      return notifications.show({ color: "red", message: "Select at least one month" });

    setSaving(true);
    try {
      if (editing) {
        await api.updatePayment(editing.id, {
          houseId: Number(houseId),
          amount: Number(amount),
          paidOn: paidOn.toISOString(),
          note,
          category,
          status,
          periods,
        });
        if (files.length) {
          const fd = new FormData();
          files.forEach((f) => fd.append("attachments", f));
          await api.addAttachments(editing.id, fd);
        }
      } else {
        const fd = new FormData();
        fd.append("houseId", houseId);
        fd.append("amount", String(amount));
        fd.append("paidOn", paidOn.toISOString());
        fd.append("note", note);
        fd.append("category", category);
        fd.append("status", status);
        fd.append("periods", JSON.stringify(periods));
        files.forEach((f) => fd.append("attachments", f));
        await api.createPayment(fd);
      }
      notifications.show({ color: "green", message: "Payment saved" });
      onSaved();
      onClose();
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function removeExistingAttachment(attId: number) {
    try {
      await api.deleteAttachment(attId);
      notifications.show({ color: "green", message: "Attachment removed" });
      onSaved();
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    }
  }

  const sortedPeriods = [...periods].sort((a, b) => a.year - b.year || a.month - b.month);

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? "Edit payment" : "Add payment"} size="lg">
      <Stack>
        <Select
          label="House"
          placeholder="Select a house"
          data={houses.map((h) => ({ value: String(h.id), label: h.name }))}
          value={houseId}
          onChange={setHouseId}
          disabled={!!fixedHouseId}
          searchable
          required
        />

        <Group grow align="flex-start">
          <NumberInput
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
            min={0}
            decimalScale={2}
            thousandSeparator=","
            required
          />
          <DateInput label="Payment date" value={paidOn} onChange={setPaidOn} required />
        </Group>

        <Group grow align="flex-start">
          <Autocomplete
            label="Category"
            placeholder="e.g. Rent"
            data={CATEGORY_SUGGESTIONS}
            value={category}
            onChange={setCategory}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Status
            </Text>
            <SegmentedControl
              fullWidth
              value={status}
              onChange={(v) => setStatus(v as "PAID" | "UNPAID")}
              data={[
                { label: "Paid", value: "PAID" },
                { label: "Unpaid", value: "UNPAID" },
              ]}
            />
          </div>
        </Group>

        <Divider label="Months this payment covers" labelPosition="center" />

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Tick every month this single payment is for.
          </Text>
          <NumberInput
            w={110}
            value={periodYear}
            onChange={(v) => setPeriodYear(Number(v) || new Date().getFullYear())}
            min={1970}
            max={3000}
            aria-label="Year"
          />
        </Group>

        <Chip.Group multiple value={selectedThisYear} onChange={() => {}}>
          <Group gap="xs">
            {MONTHS.map((m, i) => (
              <Chip
                key={m}
                value={String(i + 1)}
                checked={selectedThisYear.includes(String(i + 1))}
                onClick={() => toggleMonth(i + 1)}
                size="sm"
              >
                {m.slice(0, 3)}
              </Chip>
            ))}
          </Group>
        </Chip.Group>

        {sortedPeriods.length > 0 && (
          <Group gap="xs">
            {sortedPeriods.map((p) => (
              <Badge
                key={`${p.year}-${p.month}`}
                variant="light"
                rightSection={
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    color="gray"
                    onClick={() => removePeriod(p)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                }
              >
                {MONTHS[p.month - 1].slice(0, 3)} {p.year}
              </Badge>
            ))}
          </Group>
        )}

        {amount !== "" && sortedPeriods.length > 1 && (
          <Text size="xs" c="dimmed">
            Splits to {(Number(amount) / sortedPeriods.length).toFixed(2)} per month in statistics.
          </Text>
        )}

        <Textarea
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          autosize
          minRows={2}
        />

        <Divider label="Attachments" labelPosition="center" />

        {editing && editing.attachments.length > 0 && (
          <Stack gap={4}>
            {editing.attachments.map((a) => (
              <Group key={a.id} justify="space-between">
                <Anchor href={api.attachmentUrl(a.id)} target="_blank" size="sm">
                  <Group gap={6}>
                    <IconFile size={14} />
                    {a.filename}
                  </Group>
                </Anchor>
                <ActionIcon color="red" variant="subtle" onClick={() => removeExistingAttachment(a.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}

        <FileInput
          label={editing ? "Add more files" : "Attach files (receipts, checks)"}
          placeholder="Choose files"
          leftSection={<IconPaperclip size={16} />}
          multiple
          value={files}
          onChange={setFiles}
          clearable
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {editing ? "Save changes" : "Add payment"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
