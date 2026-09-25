"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { getCategories, getCourseById, saveCourse, uploadImage } from "@/lib/queries/admin";
import type { Category } from "@/types/category";

const courseSchema = z.object({
  title: z.string().min(3, "Course title must be at least 3 characters"),

  short_description: z
    .string()
    .min(10, "Short description must be at least 10 characters"),

  description: z
    .string()
    .min(20, "Description must be at least 20 characters"),

  category_id: z
    .string()
    .min(1, "Please select a category"),

  preview_video_url: z
    .string()
    .transform((val) => {
      let v = val.trim();
      if (!v) return "";
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      return v;
    })
    .pipe(z.string().url("Please enter a valid URL").or(z.literal(""))),

  price: z.coerce
    .number()
    .min(0, "Price cannot be negative"),

  discount_price: z.coerce
    .number()
    .min(0, "Discount price cannot be negative")
    .optional(),

  level: z.enum(["beginner", "intermediate", "advanced"], {
    message: "Please select a level",
  }),

  duration: z
    .string()
    .min(1, "Duration is required"),

  language: z
    .string()
    .min(1, "Language is required"),

  status: z.enum(["draft", "published", "archived"], {
    message: "Please select a status",
  }),

  featured: z.boolean(),

  popular: z.boolean(),
});

type CourseFormValues = z.input<typeof courseSchema>;

interface CourseFormProps {
  courseId?: string;
}

export default function CourseForm({
  courseId,
}: CourseFormProps) {
  const router = useRouter();
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),

    defaultValues: {
      title: "",
      short_description: "",
      description: "",
      category_id: "",
      preview_video_url: "",
      price: 0,
      discount_price: undefined,
      level: "beginner",
      duration: "",
      language: "English",
      status: "draft",
      featured: false,
      popular: false,
    },
  });

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      if (!courseId && cats.length > 0) {
        setValue("category_id", cats[0].id, { shouldValidate: true });
      }
    });
  }, [courseId, setValue]);

  useEffect(() => {
    if (!courseId) return;

    getCourseById(courseId).then((course) => {
      if (!course) return;

      reset({
        title: course.title,
        short_description: course.short_description || "",
        description: course.description || "",
        category_id: course.category_id || "",
        preview_video_url: course.preview_video_url || "",
        price: course.price || 0,
        discount_price: course.discount_price ?? undefined,
        level: course.level,
        duration: course.duration || "",
        language: course.language || "English",
        status: course.status,
        featured: course.featured ?? false,
        popular: course.popular ?? false,
      });
      setThumbnail(course.thumbnail || null);
    });
  }, [courseId, reset]);

  const handleThumbnailChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setThumbnailFile(file);
    setThumbnail(URL.createObjectURL(file));
  };

  const onSubmit = async (data: CourseFormValues) => {
    setIsSaving(true);
    setErrorMessage(null);

    let finalThumbnail = thumbnail;
    if (thumbnailFile) {
      const uploaded = await uploadImage(thumbnailFile, "thumbnails");
      if (uploaded) {
        finalThumbnail = uploaded;
      }
    }

    const { data: saved, error } = await saveCourse({
      id: courseId,
      title: data.title,
      short_description: data.short_description,
      description: data.description,
      category_id: data.category_id,
      preview_video_url: data.preview_video_url || null,
      price: Number(data.price) || 0,
      discount_price: data.discount_price ? Number(data.discount_price) : null,
      level: data.level,
      duration: data.duration,
      language: data.language,
      status: data.status,
      featured: data.featured,
      popular: data.popular,
      thumbnail:
        finalThumbnail && !finalThumbnail.startsWith("blob:") ? finalThumbnail : undefined,
    });

    setIsSaving(false);

    if (!saved) {
      setErrorMessage(error || "Failed to save course. Please try again.");
      return;
    }

    router.push("/admin/courses");
    router.refresh();
  };

  return (
    <Card className="bg-white shadow-xl">
      <CardHeader>
        <CardTitle>Course Information</CardTitle>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {errorMessage && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          {/* Title */}

          <div className="space-y-2">
            <label className="text-sm font-medium text-leaf-navy">
              Course Title
            </label>

            <Input
              placeholder="Enter course title"
              {...register("title")}
            />

            {errors.title && (
              <p className="text-sm text-red-500">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Short Description */}

          <div className="space-y-2">
            <label className="text-sm font-medium text-leaf-navy">
              Short Description
            </label>

            <Textarea
              placeholder="Enter a short description"
              {...register("short_description")}
            />

            {errors.short_description && (
              <p className="text-sm text-red-500">
                {errors.short_description.message}
              </p>
            )}
          </div>

          {/* Description */}

          <div className="space-y-2">
            <label className="text-sm font-medium text-leaf-navy">
              Description
            </label>

            <Textarea
              placeholder="Enter course description"
              className="min-h-32"
              {...register("description")}
            />

            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Course Details */}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Category */}

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Category
              </label>

              <Select
                value={watch("category_id")}
                onValueChange={(value) => {
                  if (!value) return;

                  setValue("category_id", value, {
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category">
                    {categories.find(
                      (category) => category.id === watch("category_id"),
                    )?.name || "Select category"}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {errors.category_id && (
                <p className="text-sm text-red-500">
                  {errors.category_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Preview Video URL
              </label>

              <Input
                placeholder="https://youtube.com/..."
                {...register("preview_video_url")}
              />

              {errors.preview_video_url && (
                <p className="text-sm text-red-500">
                  {errors.preview_video_url.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Price
              </label>

              <Input
                type="number"
                placeholder="15000"
                {...register("price")}
              />

              {errors.price && (
                <p className="text-sm text-red-500">
                  {errors.price.message}
                </p>
              )}
            </div>

            {/* Discount Price */}

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Discount Price
              </label>

              <Input
                type="number"
                placeholder="12000"
                {...register("discount_price")}
              />

              {errors.discount_price && (
                <p className="text-sm text-red-500">
                  {errors.discount_price.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Level
              </label>

              <Select
                value={watch("level")}
                onValueChange={(value) => {
                  if (!value) return;

                  setValue(
                    "level",
                    value as CourseFormValues["level"],
                    {
                      shouldValidate: true,
                    },
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="beginner">
                    Beginner
                  </SelectItem>

                  <SelectItem value="intermediate">
                    Intermediate
                  </SelectItem>

                  <SelectItem value="advanced">
                    Advanced
                  </SelectItem>
                </SelectContent>
              </Select>

              {errors.level && (
                <p className="text-sm text-red-500">
                  {errors.level.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Duration
              </label>

              <Input
                placeholder="3 Months"
                {...register("duration")}
              />

              {errors.duration && (
                <p className="text-sm text-red-500">
                  {errors.duration.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Language
              </label>

              <Input
                placeholder="English"
                {...register("language")}
              />

              {errors.language && (
                <p className="text-sm text-red-500">
                  {errors.language.message}
                </p>
              )}
            </div>

            {/* Status */}

            <div className="space-y-2">
              <label className="text-sm font-medium text-leaf-navy">
                Status
              </label>

              <Select
                value={watch("status")}
                onValueChange={(value) => {
                  if (!value) return;

                  setValue(
                    "status",
                    value as CourseFormValues["status"],
                    {
                      shouldValidate: true,
                    },
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="draft">
                    Draft
                  </SelectItem>

                  <SelectItem value="published">
                    Published
                  </SelectItem>

                  <SelectItem value="archived">
                    Archived
                  </SelectItem>
                </SelectContent>
              </Select>

              {errors.status && (
                <p className="text-sm text-red-500">
                  {errors.status.message}
                </p>
              )}
            </div>
          </div>

          {/* Thumbnail */}

          <div className="space-y-2">
            <label className="text-sm font-medium text-leaf-navy">
              Course Thumbnail
            </label>

            <Input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
            />

            {thumbnail && (
              <div className="relative mt-3 h-52 w-full overflow-hidden rounded-lg border border-leaf-border">
                <Image
                  src={thumbnail}
                  alt="Course thumbnail preview"
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* Featured / Popular */}

          <div className="flex flex-col gap-4 rounded-lg border border-leaf-border p-4 sm:flex-row sm:gap-8">
            <label className="flex items-center gap-2 text-sm text-leaf-navy">
              <input
                type="checkbox"
                {...register("featured")}
              />

              Featured Course
            </label>

            <label className="flex items-center gap-2 text-sm text-leaf-navy">
              <input
                type="checkbox"
                {...register("popular")}
              />

              Popular Course
            </label>
          </div>

          {/* Submit */}

          <Button
            type="submit"
            disabled={isSaving}
            className="bg-leaf-green-dark text-white hover:bg-leaf-green-dark/80 hover:text-white px-4 py-2 rounded"
          >
            {isSaving
              ? "Saving..."
              : courseId
                ? "Update Course"
                : "Create Course"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}