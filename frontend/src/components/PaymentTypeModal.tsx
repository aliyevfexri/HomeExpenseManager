import { useEffect, useState } from "react";
import { Modal, TextInput, Select, NumberInput, Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, Frequency, PaymentType } from "../api";
import { FREQUENCY_LABELS } from "../periods";

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  houseId: number;
  editing?: PaymentType | null;
}

export default function PaymentTypeModal({ opened, onClose, onSaved, houseId, editing }: Props) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY");
  const [defaultAmount, setDefaultAmount] = useState<number | string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    if (editing) {
      setName(editing.name);
      setFrequency(editing.frequency);
      setDefaultAmount(editing.defaultAmount ?? "");
    } else {
      setName("");
      setFrequency("MONTHLY");
      setDefaultAmount("");
    }
  }, [opened, editing]);

  async function save() {
    if (!name.trim()) return notifications.show({ color: "red", message: "Enter a name" });
    setSaving(true);
    const amount = defaultAmount === "" ? null : Number(defaultAmount);
    try {
      if (editing) {
        await api.updateType(editing.id, { name, frequency, defaultAmount: amount });
      } else {
        await api.createType({ houseId, name, frequency, defaultAmount: amount });
      }
      notifications.show({ color: "green", message: "Saved" });
      onSaved();
      onClose();
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? "Edit payment type" : "New payment type"}>
      <Stack>
        <TextInput
          label="Name"
          placeholder="e.g. Electricity, Water, Rent"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          autoFocus
        />
        <Select
          label="Billing frequency"
          description="Controls which period cells are shown (days, weeks, months or years)."
          data={(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as Frequency[]).map((f) => ({
            value: f,
            label: FREQUENCY_LABELS[f],
          }))}
          value={frequency}
          onChange={(v) => v && setFrequency(v as Frequency)}
          allowDeselect={false}
        />
        <NumberInput
          label="Default amount (optional)"
          description="Used automatically when you tick a period paid. Leave empty to just track paid/unpaid."
          placeholder="0.00"
          value={defaultAmount}
          onChange={setDefaultAmount}
          min={0}
          decimalScale={2}
          thousandSeparator=","
        />
        {editing && editing.frequency !== frequency && (
          <Text size="xs" c="orange">
            Changing frequency keeps existing entries but they may not line up with the new
            period cells.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
