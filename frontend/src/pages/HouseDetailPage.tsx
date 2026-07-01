import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Title,
  Group,
  Button,
  Stack,
  Text,
  Anchor,
  Center,
  Loader,
  Breadcrumbs,
  Card,
} from "@mantine/core";
import { IconPlus, IconMapPin, IconReceipt } from "@tabler/icons-react";
import { api, House, PaymentType } from "../api";
import PaymentTypeModal from "../components/PaymentTypeModal";
import PaymentTypeSection from "../components/PaymentTypeSection";

export default function HouseDetailPage() {
  const { id } = useParams();
  const houseId = Number(id);

  const [house, setHouse] = useState<House | null>(null);
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentType | null>(null);

  async function loadHouse() {
    const { house } = await api.getHouse(houseId);
    setHouse(house);
  }

  async function loadTypes() {
    const { paymentTypes } = await api.listTypes(houseId);
    setTypes(paymentTypes);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadHouse(), loadTypes()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: PaymentType) {
    setEditing(t);
    setModalOpen(true);
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
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add payment type
        </Button>
      </Group>

      {types.length === 0 ? (
        <Card withBorder p="xl">
          <Center>
            <Stack align="center" gap="xs">
              <IconReceipt size={40} opacity={0.5} />
              <Text c="dimmed" ta="center">
                No payment types yet. Create one (e.g. Electricity, monthly) and start ticking
                the months you've paid.
              </Text>
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAdd}>
                Add payment type
              </Button>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Stack>
          {types.map((t) => (
            <PaymentTypeSection
              key={t.id}
              type={t}
              onEditType={openEdit}
              onDeleted={loadTypes}
              onDataChanged={() => {}}
            />
          ))}
        </Stack>
      )}

      <PaymentTypeModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadTypes}
        houseId={houseId}
        editing={editing}
      />
    </Stack>
  );
}
