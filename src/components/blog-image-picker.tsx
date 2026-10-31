import React from "react";
import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { DropZone } from "@heroui-pro/react/drop-zone";
import { uploadBlogImage, listBlogImages } from "@/api/storage";
import { addToast } from "@/providers/toast";
import { EmptyStateMessage } from "@/components/empty-state-message";

type DropEvent = Parameters<
  NonNullable<React.ComponentProps<typeof DropZone.Area>["onDrop"]>
>[0];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string) {
  return name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "IMG";
}

interface BlogImagePickerProps {
  value?: string;
  onChange: (url: string) => void;
}

export const BlogImagePicker: React.FC<BlogImagePickerProps> = ({
  value,
  onChange,
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [images, setImages] = React.useState<
    Array<{ name: string; url: string; uploadedAt: number }>
  >([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [customFilename, setCustomFilename] = React.useState("");

  // Load existing images
  React.useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const blogImages = await listBlogImages();
      setImages(blogImages);
    } catch (error) {
      console.error("Failed to load images", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File, filename?: string) => {
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file",
        description: "Please select an image file",
        color: "warning",
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadBlogImage(file, filename);
      onChange(url);
      addToast({
        title: "Success",
        description: "Image uploaded successfully",
        color: "success",
      });
      // Clear the selected file and custom filename
      setSelectedFile(null);
      setCustomFilename("");
      // Reload images list
      try {
        await loadImages();
      } catch (error) {
        console.error("Failed to refresh image list after upload", error);
        addToast({
          title: "Warning",
          description: "Image uploaded, but failed to refresh image list.",
          color: "warning",
        });
      }
    } catch (error) {
      console.error("Upload failed", error);
      addToast({
        title: "Error",
        description: "Failed to upload image",
        color: "danger",
      });
    } finally {
      setUploading(false);
    }
  };

  const selectFile = (file: File) => {
    setSelectedFile(file);
    // Pre-populate filename without extension
    setCustomFilename(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      handleUpload(selectedFile, customFilename.trim() || undefined);
    }
  };

  const handleDrop = async (e: DropEvent) => {
    const item = e.items.find((i) => i.kind === "file");
    if (item?.kind === "file") selectFile(await item.getFile());
  };

  const selectedImageName = React.useMemo(() => {
    if (!value) return undefined;
    const img = images.find((i) => i.url === value);
    return img?.name;
  }, [value, images]);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <DropZone className="space-y-3">
        {!selectedFile && !uploading && (
          <DropZone.Area onDrop={handleDrop}>
            <DropZone.Icon />
            <DropZone.Label>
              Drag and drop an image here, or click to browse
            </DropZone.Label>
            <DropZone.Description>PNG, JPG, GIF or WebP</DropZone.Description>
            <DropZone.Trigger>
              <Icon icon="lucide:image-plus" />
              Choose Image
            </DropZone.Trigger>
          </DropZone.Area>
        )}
        <DropZone.Input
          accept="image/*"
          aria-label="Choose image file"
          onSelect={(files) => selectFile(files[0])}
        />

        {selectedFile && (
          <>
            <DropZone.FileList>
              <DropZone.FileItem status={uploading ? "uploading" : undefined}>
                <DropZone.FileFormatIcon
                  format={fileExtension(selectedFile.name)}
                  color="blue"
                />
                <DropZone.FileInfo>
                  <DropZone.FileName>{selectedFile.name}</DropZone.FileName>
                  <DropZone.FileMeta>
                    {uploading
                      ? "Uploading image..."
                      : formatFileSize(selectedFile.size)}
                  </DropZone.FileMeta>
                  {uploading && (
                    <DropZone.FileProgress
                      isIndeterminate
                      aria-label="Uploading image"
                    >
                      <DropZone.FileProgressTrack>
                        <DropZone.FileProgressFill />
                      </DropZone.FileProgressTrack>
                    </DropZone.FileProgress>
                  )}
                </DropZone.FileInfo>
                {!uploading && (
                  <DropZone.FileRemoveTrigger
                    aria-label={`Remove ${selectedFile.name}`}
                    onPress={() => {
                      setSelectedFile(null);
                      setCustomFilename("");
                    }}
                  />
                )}
              </DropZone.FileItem>
            </DropZone.FileList>

            {!uploading && (
              <Card>
                <Card.Content className="space-y-4">
                  <TextField
                    value={customFilename}
                    onChange={(v) => setCustomFilename(v)}
                  >
                    <Label>Custom Filename (optional)</Label>
                    <Input placeholder="e.g., spring-tournament-2024" />
                    <p className="text-xs text-muted mt-1">
                      Enter a descriptive name to easily find this image later
                    </p>
                  </TextField>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        setSelectedFile(null);
                        setCustomFilename("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onPress={handleConfirmUpload}>
                      <Icon icon="lucide:upload" />
                      Upload
                    </Button>
                  </div>
                </Card.Content>
              </Card>
            )}
          </>
        )}
      </DropZone>

      {/* Select from existing images */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : images.length > 0 ? (
        <Select
          value={selectedImageName}
          onChange={(key) => {
            if (key) {
              const name = String(key);
              const img = images.find((i) => i.name === name);
              if (img) {
                onChange(img.url);
              }
            }
          }}
        >
          <Label>Or select from previously uploaded images</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {images.map((img) => (
                <ListBox.Item key={img.name} id={img.name} textValue={img.name}>
                  <div className="flex items-center gap-2">
                    <img
                      src={img.url}
                      alt={img.name}
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{img.name}</div>
                      <div className="text-xs text-muted">
                        {new Date(img.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : (
        <EmptyStateMessage
          size="sm"
          icon="lucide:images"
          title="No images uploaded yet"
          description="Upload your first image above."
        />
      )}

      {/* Preview */}
      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Selected Image:</p>
            <Button size="sm" variant="tertiary" onPress={() => onChange("")}>
              <Icon icon="lucide:x" />
              Remove
            </Button>
          </div>
          <img
            src={value}
            alt="Featured"
            loading="eager"
            decoding="async"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
