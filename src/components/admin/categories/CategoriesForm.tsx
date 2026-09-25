"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Folder } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Category } from "@/types/category";
import { uploadImage } from "@/lib/queries/admin";

const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
  description: z.string().optional(),
  image: z.string().optional().nullable(),
  display_order: z.number().min(0, "Display order must be 0 or greater"),
  is_active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  onSave?: (data: CategoryFormValues) => Promise<boolean> | boolean;
}

export default function CategoryForm({
  open,
  onOpenChange,
  category,
  onSave,
}: CategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      image: "",
      display_order: 1,
      is_active: true,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (category) {
      reset({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
        image: category.image || "",
        display_order: category.display_order ?? 1,
        is_active: category.is_active ?? true,
      });
      setImagePreview(category.image || null);
    } else {
      reset({
        name: "",
        slug: "",
        description: "",
        image: "",
        display_order: 1,
        is_active: true,
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [category, open, reset]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nameValue = e.target.value;
    setValue("name", nameValue);
    if (!category) {
      const generatedSlug = nameValue
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setValue("slug", generatedSlug);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmitForm = async (data: CategoryFormValues) => {
    if (onSave) {
      setIsSubmitting(true);
      try {
        let finalImage = imagePreview;
        if (imageFile) {
          const uploaded = await uploadImage(imageFile, "categories");
          if (uploaded) {
            finalImage = uploaded;
          }
        }

        const payload = {
          ...data,
          image: finalImage && !finalImage.startsWith("blob:") ? finalImage : data.image || null,
        };

        const success = await onSave(payload);
        if (success) {
          onOpenChange(false);
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-leaf-navy font-bold">
            {category ? "Edit Category" : "Add Category"}
          </DialogTitle>
          <DialogDescription className="text-leaf-muted text-sm">
            {category
              ? "Update the category details below."
              : "Enter the details to create a new category."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
              Category Name
            </label>
            <Input
              {...register("name")}
              onChange={handleNameChange}
              placeholder="e.g. Web Development"
              className="border-leaf-border focus-visible:ring-leaf-green"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
              Slug
            </label>
            <Input
              {...register("slug")}
              placeholder="e.g. web-development"
              className="border-leaf-border focus-visible:ring-leaf-green"
            />
            {errors.slug && (
              <p className="text-xs text-red-500">{errors.slug.message}</p>
            )}
          </div>

          {/* Photo / Image */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
              Category Photo / Image
            </label>
            <div className="flex items-center gap-3">
              {imagePreview ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-leaf-border">
                  <Image
                    src={imagePreview}
                    alt="Category preview"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-leaf-border bg-leaf-bg text-leaf-muted text-xs">
                  <Folder className="size-5 text-leaf-muted" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="h-9 text-xs border-leaf-border file:mr-2 file:h-7 file:rounded file:border-0 file:bg-leaf-soft file:px-2.5 file:text-xs file:font-semibold file:text-leaf-green-dark"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
              Description
            </label>
            <Textarea
              {...register("description")}
              placeholder="Short description of this category..."
              rows={3}
              className="border-leaf-border focus-visible:ring-leaf-green"
            />
            {errors.description && (
              <p className="text-xs text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
                Display Order
              </label>
              <Input
                type="number"
                {...register("display_order", { valueAsNumber: true })}
                placeholder="1"
                className="border-leaf-border focus-visible:ring-leaf-green"
              />
              {errors.display_order && (
                <p className="text-xs text-red-500">
                  {errors.display_order.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 flex flex-col justify-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-leaf-muted">
                Status
              </label>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
                <span className="text-sm font-medium text-leaf-navy">
                  {isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-leaf-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-leaf-green-dark text-white hover:bg-leaf-green"
            >
              {isSubmitting
                ? "Saving…"
                : category
                ? "Save Changes"
                : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}