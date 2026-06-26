import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  PasswordInput,
  Switch,
  Text,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconKey,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { api, User } from "../api";
import { useApp } from "../context";

export default function UsersPage() {
  const { user: me } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { users } = await api.listUsers();
      setUsers(users);
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
    setUsername("");
    setPassword("");
    setIsAdmin(false);
    setFormOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setName(u.name);
    setUsername(u.username);
    setIsAdmin(u.isAdmin);
    setFormOpen(true);
  }

  async function save() {
    if (!name.trim() || !username.trim())
      return notifications.show({ color: "red", message: "Name and username are required" });
    setSaving(true);
    try {
      if (editing) {
        await api.updateUser(editing.id, { name, username, isAdmin });
      } else {
        if (password.length < 4)
          return notifications.show({ color: "red", message: "Password must be at least 4 chars" });
        await api.createUser({ name, username, password, isAdmin });
      }
      setFormOpen(false);
      await load();
      notifications.show({ color: "green", message: "Saved" });
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  function openReset(u: User) {
    setPwTarget(u);
    setNewPw("");
    setPwOpen(true);
  }

  async function resetPassword() {
    if (!pwTarget) return;
    if (newPw.length < 4)
      return notifications.show({ color: "red", message: "Password must be at least 4 chars" });
    try {
      await api.resetPassword(pwTarget.id, newPw);
      setPwOpen(false);
      notifications.show({ color: "green", message: "Password reset" });
    } catch (err: any) {
      notifications.show({ color: "red", message: err.message });
    }
  }

  function confirmDelete(u: User) {
    modals.openConfirmModal({
      title: `Delete ${u.name}?`,
      children: <Text size="sm">This removes the user account. This cannot be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.deleteUser(u.id);
          await load();
          notifications.show({ color: "green", message: "User deleted" });
        } catch (err: any) {
          notifications.show({ color: "red", message: err.message });
        }
      },
    });
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Users</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Add user
        </Button>
      </Group>

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Username</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td>
                  {u.name}
                  {me?.id === u.id && (
                    <Badge ml="xs" size="xs" variant="light">
                      you
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{u.username}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={u.isAdmin ? "blue" : "gray"}>
                    {u.isAdmin ? "Admin" : "User"}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Menu position="bottom-end" withArrow>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEdit(u)}>
                        Edit
                      </Menu.Item>
                      <Menu.Item leftSection={<IconKey size={16} />} onClick={() => openReset(u)}>
                        Reset password
                      </Menu.Item>
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        disabled={me?.id === u.id}
                        onClick={() => confirmDelete(u)}
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
      )}

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit user" : "Add user"}>
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />
          {!editing && (
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
          )}
          <Switch
            label="Administrator"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={pwOpen} onClose={() => setPwOpen(false)} title={`Reset password — ${pwTarget?.name}`}>
        <Stack>
          <PasswordInput
            label="New password"
            value={newPw}
            onChange={(e) => setNewPw(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPwOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resetPassword}>Reset</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
