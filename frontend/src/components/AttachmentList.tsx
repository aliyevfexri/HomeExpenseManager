import { useState } from "react";
import { Stack, Group, Text, ActionIcon, UnstyledButton } from "@mantine/core";
import { IconFile, IconTrash } from "@tabler/icons-react";
import { Attachment } from "../api";
import AttachmentPreviewModal from "./AttachmentPreviewModal";

interface Props {
  attachments: Attachment[];
  onDelete?: (attachmentId: number) => void;
}

// Clicking a file previews it right in the app; no attachment ever opens a
// separate browser tab unless the user explicitly chooses "Open / download".
export default function AttachmentList({ attachments, onDelete }: Props) {
  const [preview, setPreview] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <Stack gap={4}>
        {attachments.map((a) => (
          <Group key={a.id} justify="space-between" wrap="nowrap">
            <UnstyledButton onClick={() => setPreview(a)} style={{ minWidth: 0, flex: 1 }}>
              <Group gap={6} wrap="nowrap">
                <IconFile size={14} style={{ flexShrink: 0 }} />
                <Text size="sm" truncate>
                  {a.filename}
                </Text>
              </Group>
            </UnstyledButton>
            {onDelete && (
              <ActionIcon color="red" variant="subtle" onClick={() => onDelete(a.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        ))}
      </Stack>

      <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} />
    </>
  );
}
