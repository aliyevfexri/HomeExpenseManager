import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Group,
  SimpleGrid,
  Text,
  Title,
  Modal,
  TextInput,
  Stack,
  ActionIcon,
  Menu,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconMapPin,
  IconBuildingCommunity,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { api, House } from "../api";

export default function HousesPage() {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<House | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { houses } = await api.listHouses();
      setHouses(houses);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setName("");
    setLocation("");
    setModalOpen(true);
  }

  function openEdit(h: House) {
    setEditing(h);
    setName(h.name);
    setLocation(h.location || "");
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim()) return notifications.show({ color: "red", message: "Name is required" });
    setSaving(true);
    try {
      if (editing) await api.updateHouse(editing.id, { name, location });
      else await api.createHouse({ name, location });
      setModalOpen(false);
      await load();
      notifications.show({ color: "green", message: "Saved" });
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(h: House) {
    modals.openConfirmModal({
      title: `Delete ${h.name}?`,
      children: (
        <Text size="sm">
          This permanently deletes the house and all of its payments and attachments. This cannot
          be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteHouse(h.id);
          await load();
          notifications.show({ color: "green", message: "House deleted" });
        } catch (err: any) {
          notifications.show({ color: "red", message: err.message });
        }
      },
    });
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Houses</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add house
        </Button>
      </Group>

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : houses.length === 0 ? (
        <Card withBorder p="xl">
          <Center>
            <Stack align="center" gap="xs">
              <IconBuildingCommunity size={40} opacity={0.5} />
              <Text c="dimmed">No houses yet. Add your first one.</Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {houses.map((h) => (
            <Card key={h.id} withBorder shadow="sm" padding="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={600} size="lg" component={Link} to={`/houses/${h.id}`}>
                    {h.name}
                  </Text>
                  {h.location && (
                    <Group gap={4} mt={4}>
                      <IconMapPin size={14} opacity={0.6} />
                      <Text size="sm" c="dimmed">
                        {h.location}
                      </Text>
                    </Group>
                  )}
                </div>
                <Menu position="bottom-end" withArrow>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEdit(h)}>
                      Edit
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => confirmDelete(h)}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
              <Group justify="space-between" mt="md">
                <Text size="sm" c="dimmed">
                  {h.paymentCount ?? 0} payments
                </Text>
                <Button variant="light" size="xs" component={Link} to={`/houses/${h.id}`}>
                  Open
                </Button>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit house" : "Add house"}>
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput
            label="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
