import React from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { uploadBlogImage, listBlogImages } from "@/api/storage";
import { addToast } from "@/providers/toast";

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
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [customFilename, setCustomFilename] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      await loadImages();
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Pre-populate filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setCustomFilename(nameWithoutExt);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      handleUpload(selectedFile, customFilename.trim() || undefined);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Pre-populate filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setCustomFilename(nameWithoutExt);
    }
  };

  const selectedImageName = React.useMemo(() => {
    if (!value) return undefined;
    const img = images.find((i) => i.url === value);
    return img?.name;
  }, [value, images]);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardBody>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/10"
                : "border-foreground-300"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner size="lg" />
                <p className="text-sm text-foreground-500">
                  Uploading image...
                </p>
              </div>
            ) : selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 justify-center">
                  <Icon
                    icon="lucide:file-image"
                    className="text-2xl text-success"
                  />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                </div>
                <Input
                  label="Custom Filename (optional)"
                  placeholder="e.g., spring-tournament-2024"
                  value={customFilename}
                  onValueChange={setCustomFilename}
                  description="Enter a descriptive name to easily find this image later"
                  startContent={
                    <Icon icon="lucide:tag" className="text-foreground-400" />
                  }
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setSelectedFile(null);
                      setCustomFilename("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={handleConfirmUpload}
                    startContent={<Icon icon="lucide:upload" />}
                  >
                    Upload
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Icon
                  icon="lucide:upload-cloud"
                  className="text-4xl text-foreground-400 mx-auto mb-3"
                />
                <p className="text-sm text-foreground-600 mb-2">
                  Drag and drop an image here, or click to browse
                </p>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => fileInputRef.current?.click()}
                  startContent={<Icon icon="lucide:image-plus" />}
                >
                  Choose Image
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Select from existing images */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : images.length > 0 ? (
        <Select
          label="Or select from previously uploaded images"
          placeholder="Choose an image"
          selectedKeys={selectedImageName ? [selectedImageName] : []}
          onSelectionChange={(keys) => {
            const name = Array.from(keys)[0] as string;
            const img = images.find((i) => i.name === name);
            if (img) {
              onChange(img.url);
            }
          }}
        >
          {images.map((img) => (
            <SelectItem key={img.name} textValue={img.name}>
              <div className="flex items-center gap-2">
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  decoding="async"
                  className="w-10 h-10 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{img.name}</div>
                  <div className="text-xs text-foreground-500">
                    {new Date(img.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </Select>
      ) : (
        <p className="text-sm text-foreground-500 text-center">
          No images uploaded yet. Upload your first image above.
        </p>
      )}

      {/* Preview */}
      {value && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Selected Image:</p>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onPress={() => onChange("")}
              startContent={<Icon icon="lucide:x" />}
            >
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
