import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const courseId = formData.get("courseId") as string | null;

    if (!file || !courseId) {
      return NextResponse.json(
        { error: "File and courseId are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Ensure bucket 'course-materials' exists and is public
    const bucketName = "course-materials";
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === bucketName);
      if (!exists) {
        await supabase.storage.createBucket(bucketName, { public: true });
      }
    } catch (bErr) {
      console.warn("Bucket check/creation notice:", bErr);
    }

    const fileBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `syllabus-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const filePath = `syllabi/${fileName}`;

    // Upload using service role key (bypasses RLS)
    let uploadRes = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    let targetBucket = bucketName;

    // Fallback to testimonial-images bucket if needed
    if (uploadRes.error) {
      console.warn(`Upload to ${bucketName} failed, trying testimonial-images:`, uploadRes.error);
      targetBucket = "testimonial-images";
      uploadRes = await supabase.storage
        .from(targetBucket)
        .upload(filePath, fileBuffer, {
          contentType: file.type || "application/pdf",
          upsert: true,
        });
    }

    if (uploadRes.error) {
      console.error("Storage upload error:", uploadRes.error);
      return NextResponse.json(
        { error: uploadRes.error.message || "Failed to upload file to storage." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(filePath);

    const pdfUrl = urlData?.publicUrl;

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Failed to generate public URL for uploaded PDF." },
        { status: 500 }
      );
    }

    // Try updating course row in DB directly using the actual DB column name
    let dbUpdate = await (supabase.from("courses") as any)
      .update({ curriculum_pdf_url: pdfUrl })  // DB column: curriculum_pdf_url
      .eq("id", courseId)
      .select()
      .single();


    if (dbUpdate.error) {
      console.error("Failed to update course PDF URL in database:", dbUpdate.error);
      return NextResponse.json(
        { error: dbUpdate.error.message || "PDF uploaded, but failed to update course record in database." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url: pdfUrl });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("PDF Upload endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Server error uploading PDF." },
      { status: 500 }
    );
  }
}
