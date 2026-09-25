import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/types/course";
import type { Category } from "@/types/category";
import type { FAQ } from "@/types/faq";
import type { Testimonial } from "@/types/testimonial";
import type { SiteSettings } from "@/types/site-settings";
import { getSiteSettings } from "./site-settings";
import { createAdminClient } from "@/lib/supabase/admin";
export { getSiteSettings };

export interface AdminStats {
  totalCourses: number;
  publishedCourses: number;
  instructorsCount: number;
  newMessagesCount: number;
  recentMessages: Array<{
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    created_at: string;
  }>;
  recentCourses: Array<{
    id: string;
    title: string;
    price: number;
    status: string;
    created_at: string;
  }>;
}

export interface AdminCourseItem extends Course {
  category_name?: string;
}

/**
 * Fetch stats summary for Admin Dashboard
 */
export async function getAdminDashboardStats(): Promise<AdminStats> {
  const supabase = createClient();

  try {
    const [
      coursesRes,
      publishedRes,
      instructorsRes,
      messagesCountRes,
      recentMsgRes,
      recentCoursesRes,
    ] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase.from("instructors").select("id", { count: "exact", head: true }),
      supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("contact_messages")
        .select("id, name, email, subject, message, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("courses")
        .select("id, title, price, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      totalCourses: coursesRes.count || 0,
      publishedCourses: publishedRes.count || 0,
      instructorsCount: instructorsRes.count || 0,
      newMessagesCount: messagesCountRes.count || 0,
      recentMessages: recentMsgRes.data || [],
      recentCourses: (recentCoursesRes.data as any) || [],
    };
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    return {
      totalCourses: 0,
      publishedCourses: 0,
      instructorsCount: 0,
      newMessagesCount: 0,
      recentMessages: [],
      recentCourses: [],
    };
  }
}

/** Maps actual DB column names → UI field names used by the admin form. */
function normalizeDbCourse(item: any): any {
  if (!item) return item;
  return {
    ...item,
    // DB column "name" → form field "title"
    title: item.title ?? item.name ?? "",
    // DB column "actual_price" → form field "price"
    price: item.price ?? item.actual_price ?? 0,
    // DB column "is_featured" → form field "featured"
    featured: item.featured ?? item.is_featured ?? false,
    // DB column "curriculum_pdf_url" → form field "syllabus_pdf_url"
    syllabus_pdf_url: item.syllabus_pdf_url ?? item.curriculum_pdf_url ?? null,
  };
}

/**
 * Fetch all courses for Admin Table
 */
export async function getAdminCourses(): Promise<AdminCourseItem[]> {
  const supabase = createClient();
  try {
    const { data: courses, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !courses) {
      console.error("Error fetching admin courses:", error);
      return [];
    }

    const { data: categories } = await supabase
      .from("course_categories")
      .select("id, name");

    const categoryMap = new Map<string, string>();
    if (categories) {
      categories.forEach((cat: any) => categoryMap.set(cat.id, cat.name));
    }

    return courses.map((item: any) => ({
      ...normalizeDbCourse(item),
      category_name: item.category_id ? (categoryMap.get(item.category_id) || "Uncategorized") : "Uncategorized",
    }));
  } catch (err) {
    console.error("Error fetching admin courses:", err);
    return [];
  }
}

/**
 * Fetch single course by ID with Category details
 */
export async function getCourseById(courseId: string): Promise<AdminCourseItem | null> {
  let courseObj: any = null;
  try {
    const res = await fetch(`/api/admin/courses?id=${encodeURIComponent(courseId)}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.course) {
        courseObj = json.course;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch course via admin API, trying client fallback:", err);
  }

  if (!courseObj) {
    const supabase = createClient();
    try {
      const { data: course, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (error || !course) {
        console.error("Error fetching course by ID:", error);
        return null;
      }
      courseObj = course;
    } catch (err) {
      console.error("Error fetching course by ID:", err);
      return null;
    }
  }
  return normalizeDbCourse(courseObj) as AdminCourseItem;
}

/**
 * Delete a course
 */
export async function deleteCourse(courseId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/admin/courses?id=${encodeURIComponent(courseId)}`, {
      method: "DELETE",
    });
    const json = await response.json();
    return response.ok && !json.error;
  } catch (err) {
    console.error("Error deleting course:", err);
    return false;
  }
}

/**
 * Insert or update a course via server API (bypasses RLS using the service role key)
 */
export async function saveCourse(
  payload: Partial<Course> & { title: string }
): Promise<{ data: Course | null; error: string | null }> {
  try {
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok || json.error || !json.data) {
      return { data: null, error: json.error || "Failed to save course." };
    }

    return { data: json.data as Course, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save course. Please try again.";
    return { data: null, error: message };
  }
}


// ============================================================
// CATEGORIES
// ============================================================

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  try {
    const { data: categories, error } = await supabase
      .from("course_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (error || !categories) {
      console.error("Error fetching categories:", error);
      return [];
    }

    const { data: courses } = await supabase
      .from("courses")
      .select("category_id");

    const countMap = new Map<string, number>();
    if (courses) {
      courses.forEach((c: any) => {
        if (c.category_id) {
          countMap.set(c.category_id, (countMap.get(c.category_id) || 0) + 1);
        }
      });
    }

    return categories.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      image: item.image || "",
      is_active: item.is_active ?? true,
      display_order: item.display_order ?? 1,
      course_count: countMap.get(item.id) || 0,
    }));
  } catch (err) {
    console.error("Error fetching categories:", err);
    return [];
  }
}

export async function saveCategory(payload: Partial<Category> & { name: string }): Promise<Category | null> {
  const supabase = createClient();
  try {
    const slug = (payload.slug || payload.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const categoryData = {
      name: payload.name,
      slug,
      description: payload.description || null,
      image: payload.image || null,
      is_active: payload.is_active ?? true,
      display_order: payload.display_order ?? 1,
    };

    if (payload.id) {
      const { data, error } = await supabase
        .from("course_categories")
        .update(categoryData)
        .eq("id", payload.id)
        .select()
        .single();

      if (error || !data) return null;
      return { ...data, course_count: (payload as any).course_count || 0 } as Category;
    } else {
      const { data, error } = await supabase
        .from("course_categories")
        .insert(categoryData)
        .select()
        .single();

      if (error || !data) return null;
      return { ...data, course_count: 0 } as Category;
    }
  } catch (err) {
    console.error("Error saving category:", err);
    return null;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase.from("course_categories").delete().eq("id", id);
    return !error;
  } catch (err) {
    console.error("Error deleting category:", err);
    return false;
  }
}

// ============================================================
// ============================================================
// SITE SETTINGS
// ============================================================

export async function saveSiteSettings(payload: Partial<SiteSettings>): Promise<boolean> {
  const supabase = createClient();
  try {
    const existing = await getSiteSettings();

    if (existing?.id) {
      const { error } = await supabase
        .from("site_settings")
        .update({
          company_name: payload.company_name !== undefined ? payload.company_name : existing.company_name,
          logo: payload.logo !== undefined ? payload.logo : existing.logo,
          favicon: payload.favicon !== undefined ? payload.favicon : existing.favicon,
          email: payload.email !== undefined ? payload.email : existing.email,
          phone: payload.phone !== undefined ? payload.phone : existing.phone,
          whatsapp: payload.whatsapp !== undefined ? payload.whatsapp : existing.whatsapp,
          address: payload.address !== undefined ? payload.address : existing.address,
          social_media_links: payload.social_media_links !== undefined ? payload.social_media_links : existing.social_media_links,
          google_maps_url: payload.google_maps_url !== undefined ? payload.google_maps_url : existing.google_maps_url,
          office_hours: payload.office_hours !== undefined ? payload.office_hours : existing.office_hours,
          footer_description: payload.footer_description !== undefined ? payload.footer_description : existing.footer_description,
          copyright_text: payload.copyright_text !== undefined ? payload.copyright_text : existing.copyright_text,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        console.error("Error updating site settings:", error);
        return false;
      }
      return true;
    } else {
      const { error } = await supabase.from("site_settings").insert({
        company_name: payload.company_name || "Leafclutch Technologies",
        logo: payload.logo || null,
        favicon: payload.favicon || null,
        email: payload.email || null,
        phone: payload.phone || null,
        whatsapp: payload.whatsapp || null,
        address: payload.address || null,
        social_media_links: payload.social_media_links || {},
        google_maps_url: payload.google_maps_url || null,
        office_hours: payload.office_hours || null,
        footer_description: payload.footer_description || null,
        copyright_text: payload.copyright_text || null,
      });

      if (error) {
        console.error("Error inserting site settings:", error);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error("Error saving site settings:", err);
    return false;
  }
}

// ============================================================
// COURSE SUB-DETAILS
// ============================================================

export async function getCourseOutcomes(courseId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("course_outcomes")
    .select("id, outcome, display_order")
    .eq("course_id", courseId)
    .order("display_order", { ascending: true });
  return data || [];
}

export async function saveCourseOutcome(courseId: string, item: { id?: string; outcome: string }) {
  const supabase = createClient();
  if (item.id) {
    const { error } = await supabase
      .from("course_outcomes")
      .update({ outcome: item.outcome })
      .eq("id", item.id);
    return !error;
  } else {
    const { error } = await supabase
      .from("course_outcomes")
      .insert({ course_id: courseId, outcome: item.outcome });
    return !error;
  }
}

export async function deleteCourseOutcome(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("course_outcomes").delete().eq("id", id);
  return !error;
}

export async function getCourseRequirements(courseId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("course_requirements")
    .select("id, requirement, display_order")
    .eq("course_id", courseId)
    .order("display_order", { ascending: true });
  return data || [];
}

export async function saveCourseRequirement(courseId: string, item: { id?: string; requirement: string }) {
  const supabase = createClient();
  if (item.id) {
    const { error } = await supabase
      .from("course_requirements")
      .update({ requirement: item.requirement })
      .eq("id", item.id);
    return !error;
  } else {
    const { error } = await supabase
      .from("course_requirements")
      .insert({ course_id: courseId, requirement: item.requirement });
    return !error;
  }
}

export async function deleteCourseRequirement(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("course_requirements").delete().eq("id", id);
  return !error;
}

export async function getCourseAudience(courseId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("course_target_audience")
    .select("id, description, display_order")
    .eq("course_id", courseId)
    .order("display_order", { ascending: true });
  return data || [];
}
export const getCourseTargetAudience = getCourseAudience;

export async function saveCourseAudience(courseId: string, item: { id?: string; description: string }) {
  const supabase = createClient();
  if (item.id) {
    const { error } = await supabase
      .from("course_target_audience")
      .update({ description: item.description })
      .eq("id", item.id);
    return !error;
  } else {
    const { error } = await supabase
      .from("course_target_audience")
      .insert({ course_id: courseId, description: item.description });
    return !error;
  }
}
export const saveCourseTargetAudience = saveCourseAudience;

export async function deleteCourseAudience(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("course_target_audience").delete().eq("id", id);
  return !error;
}
export const deleteCourseTargetAudience = deleteCourseAudience;

export async function getCourseProjects(courseId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("course_projects")
    .select("*")
    .eq("course_id", courseId)
    .order("display_order", { ascending: true });
  return data || [];
}

export async function saveCourseProject(courseId: string, project: any) {
  const supabase = createClient();
  const projectData = {
    course_id: courseId,
    title: project.title,
    description: project.description || null,
    thumbnail: project.thumbnail || null,
    technologies: project.technologies || [],
    github_url: project.github_url || null,
    live_demo_url: project.live_demo_url || null,
    difficulty: project.difficulty || "Beginner",
  };

  if (project.id) {
    const { error } = await supabase
      .from("course_projects")
      .update(projectData)
      .eq("id", project.id);
    return !error;
  } else {
    const { error } = await supabase.from("course_projects").insert(projectData);
    return !error;
  }
}

export async function deleteCourseProject(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("course_projects").delete().eq("id", id);
  return !error;
}

export async function getCourseCurriculum(courseId: string) {
  const supabase = createClient();
  const { data: sections } = await supabase
    .from("course_sections")
    .select("*, course_lessons(*)")
    .eq("course_id", courseId)
    .order("display_order", { ascending: true });

  return (sections || []).map((sec: any) => ({
    ...sec,
    lessons: (sec.course_lessons || []).sort((a: any, b: any) => a.display_order - b.display_order),
  }));
}
export const getCourseCurriculumData = getCourseCurriculum;

export async function saveCourseSection(courseId: string, section: { id?: string; title: string; description?: string }) {
  try {
    const res = await fetch("/api/admin/curriculum/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        id: section.id,
        title: section.title,
        description: section.description,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Section save error:", json.error);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error("Failed to save section:", err);
    return null;
  }
}

export async function deleteCourseSection(sectionId: string) {
  try {
    const res = await fetch(`/api/admin/curriculum/sections?id=${sectionId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Section delete error:", json.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to delete section:", err);
    return false;
  }
}

export async function saveCourseLesson(
  sectionId: string,
  lesson: {
    id?: string;
    title: string;
    description?: string;
    duration?: string;
    is_preview?: boolean;
  }
) {
  try {
    const res = await fetch("/api/admin/curriculum/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId,
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        duration: lesson.duration,
        is_preview: lesson.is_preview,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Lesson save error:", json.error);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error("Failed to save lesson:", err);
    return null;
  }
}

/**
 * Upload lesson PDF document to Supabase storage bucket
 */
export async function uploadLessonPdf(file: File): Promise<string | null> {
  const supabase = createClient();
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("testimonial-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from("testimonial-images").getPublicUrl(filePath);
    return data?.publicUrl || null;
  } catch (err) {
    console.error("Failed to upload PDF:", err);
    return null;
  }
}

/**
 * Upload 1 PDF file for a course to Supabase Storage and update the course's syllabus_pdf_url
 */
export async function uploadCoursePdf(courseId: string, file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    const res = await fetch("/api/admin/upload-pdf", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.url) {
      console.error("Course PDF upload API error:", json.error || "Unknown error");
      return null;
    }

    return json.url;
  } catch (err) {
    console.error("Failed to upload course PDF:", err);
    return null;
  }
}

export async function deleteCourseLesson(lessonId: string) {
  try {
    const res = await fetch(`/api/admin/curriculum/lessons?id=${lessonId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Lesson delete error:", json.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to delete lesson:", err);
    return false;
  }
}

export async function getCourseOptions(): Promise<{ id: string; title: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .order("title", { ascending: true });

  if (error || !data) {
    console.error("Error fetching course options:", error);
    return [];
  }

  return data as { id: string; title: string }[];
}

export {
  getAdminFAQs,
  getFAQById,
  saveFAQ,
  deleteFAQ,
  type SaveFAQInput,
} from "./faqs";

export {
  getAdminTestimonials,
  getTestimonialById,
  saveTestimonial,
  deleteTestimonial,
  uploadTestimonialImage,
  type SaveTestimonialInput,
} from "./testimonials";


export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: "new" | "read" | "replied" | "closed";
  created_at: string;
  updated_at: string;
}

export async function getContactMessages(): Promise<ContactMessageItem[]> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contact messages:", error);
      return [];
    }

    return data as ContactMessageItem[];
  } catch (err) {
    console.error("Error fetching contact messages:", err);
    return [];
  }
}

export async function getContactMessageById(
  id: string
): Promise<ContactMessageItem | null> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching contact message:", error);
      return null;
    }

    return data as ContactMessageItem;
  } catch (err) {
    console.error("Error fetching contact message:", err);
    return null;
  }
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageItem["status"]
): Promise<boolean> {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    return !error;
  } catch (err) {
    console.error("Error updating contact message:", err);
    return false;
  }
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    return !error;
  } catch (err) {
    console.error("Error deleting contact message:", err);
    return false;
  }
}

/**
 * Universal image uploader for admin (thumbnails, site logos, favicons, etc.)
 */
export async function uploadImage(file: File, folder: string = "images"): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.url) {
      console.error("Image upload API error:", json.error || "Unknown error");
      return null;
    }

    return json.url;
  } catch (err) {
    console.error("Failed to upload image:", err);
    return null;
  }
}
