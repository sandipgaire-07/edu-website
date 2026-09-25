import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const supabase = createAdminClient();

    if (id) {
      const { data, error } = await (supabase.from("courses") as any)
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ course: data });
    }

    const { data, error } = await (supabase.from("courses") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ courses: data });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!payload?.id && !payload?.title) {
      return NextResponse.json({ error: "Course title is required for creation." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Partial update mode (e.g. updating syllabus_pdf_url or thumbnail)
    if (payload.id) {
      const updateData: Record<string, any> = {};

      if (payload.title) {
        updateData.name = payload.title;  // DB column: name
        updateData.slug = slugify(payload.slug || payload.title);
      }
      if (payload.short_description !== undefined) updateData.short_description = payload.short_description;
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.category_id !== undefined) updateData.category_id = payload.category_id;
      if (payload.preview_video_url !== undefined) updateData.preview_video_url = payload.preview_video_url;
      // Map syllabus_pdf_url / pdf_url → curriculum_pdf_url (DB column name)
      if (payload.syllabus_pdf_url !== undefined) updateData.curriculum_pdf_url = payload.syllabus_pdf_url;
      if (payload.pdf_url !== undefined) updateData.curriculum_pdf_url = payload.pdf_url;
      if (payload.price !== undefined) updateData.actual_price = payload.price;  // DB column: actual_price
      if (payload.discount_price !== undefined) updateData.discount_price = payload.discount_price;
      if (payload.level !== undefined) updateData.level = payload.level;
      if (payload.duration !== undefined) updateData.duration = payload.duration;
      if (payload.language !== undefined) updateData.language = payload.language;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.featured !== undefined) updateData.is_featured = payload.featured;  // DB column: is_featured
      if (payload.popular !== undefined) updateData.popular = payload.popular;
      if (payload.thumbnail) updateData.thumbnail = payload.thumbnail;

      let { data, error } = await (supabase.from("courses") as any)
        .update(updateData)
        .eq("id", payload.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating course:", error.message, error.code, error.details);
        return NextResponse.json(
          { error: error.message || "Failed to update course." },
          { status: 500 }
        );
      }

      return NextResponse.json({ data });
    }

    // Full creation mode — maps UI field names to actual DB column names
    const slug = slugify(payload.slug || payload.title);
    const pdfUrl = payload.syllabus_pdf_url || payload.pdf_url || null;

    const courseData: Record<string, any> = {
      name: payload.title,                          // DB column: name
      slug,
      short_description: payload.short_description || "",
      description: payload.description || "",
      category_id: payload.category_id || null,
      preview_video_url: payload.preview_video_url || null,
      actual_price: payload.price || 0,             // DB column: actual_price
      discount_price: payload.discount_price || null,
      level: payload.level || "beginner",
      duration: payload.duration || "1 Month",
      language: payload.language || "English",
      status: payload.status || "draft",
      is_featured: payload.featured ?? false,        // DB column: is_featured
      popular: payload.popular ?? false,
      ...(payload.thumbnail ? { thumbnail: payload.thumbnail } : {}),
      ...(pdfUrl ? { curriculum_pdf_url: pdfUrl } : {}),  // DB column: curriculum_pdf_url
    };

    const { data, error } = await (supabase.from("courses") as any)
      .insert(courseData)
      .select()
      .single();

    if (error) {
      console.error("Error creating course:", error.message, error.code, error.details);
      return NextResponse.json(
        { error: error.message || "Failed to create course." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Course admin API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save course." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Course id is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("courses").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
