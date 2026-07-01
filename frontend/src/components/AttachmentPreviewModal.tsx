import { Modal, Stack, Group, Text, Button } from "@mantine/core";
import { IconFile, IconDownload } from "@tabler/icons-react";
import { api, Attachment } from "../api";

interface Props {
  attachment: Attachment | null;
  onClose: () => void;
}

// Shows an attachment right on screen instead of opening a new browser tab.
export default function AttachmentPreviewModal({ attachment, onClose }: Props) {
  if (!attachment) return null;

  const url = api.attachmentUrl(attachment.id);
  const isImage = attachment.mime.startsWith("image/");
  const isPdf = attachment.mime === "application/pdf";

  return (
    <Modal
      opened={!!attachment}
      onClose={onClose}
      title={attachment.filename}
      size={isImage || isPdf ? "xl" : "sm"}
      centered
    >
      <Stack>
        {isImage && (
          <img
            src={url}
            alt={attachment.filename}
            style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }}
          />
        )}

        {isPdf && (
          <iframe
            src={url}
            title={attachment.filename}
            style={{ width: "100%", height: "75vh", border: "none", borderRadius: 8 }}
          />
        )}

        {!isImage && !isPdf && (
          <Stack align="center" py="xl" gap="sm">
            <IconFile size={40} opacity={0.5} />
            <Text c="dimmed" ta="center">
              This file type can't be previewed here.
            </Text>
          </Stack>
        )}

        <Group justify="flex-end">
          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noopener"
            variant="light"
            leftSection={<IconDownload size={16} />}
          >
            Open / download
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
