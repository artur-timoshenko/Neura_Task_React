import { supabase } from "@/integrations/supabase/client";

export type TaskFileCategory = "attachment" | "submission";

async function functionErrorMessage(error: unknown, fallback: string) {
  let message = error instanceof Error ? error.message : fallback;
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      // Keep the SDK error when the backend did not return JSON.
    }
  }
  return message;
}

export async function uploadTaskFile(options: {
  taskId: string;
  file: File;
  category: TaskFileCategory;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const contentType = options.file.type || "application/octet-stream";
  const { data, error } = await supabase.functions.invoke("create-task-upload", {
    body: {
      taskId: options.taskId,
      fileName: options.file.name,
      fileSize: options.file.size,
      contentType,
      category: options.category,
    },
  });
  if (error || !data?.uploadUrl || !data?.path || !data?.fields) {
    throw new Error(data?.error || await functionErrorMessage(error, "Не удалось подготовить загрузку"));
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", data.uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText || `Railway Bucket HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Сетевая ошибка при отправке файла в Railway Bucket"));
    const form = new FormData();
    Object.entries(data.fields as Record<string, string>).forEach(([key, value]) => form.append(key, value));
    form.append("file", options.file);
    xhr.send(form);
  });
  return data.path;
}

export async function deleteTaskFile(filePath: string, taskId: string) {
  if (!filePath.startsWith("railway/")) {
    const { error } = await supabase.storage.from("task-files").remove([filePath]);
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.functions.invoke("delete-task-file", {
    body: { filePath, taskId },
  });
  if (error || !data?.success) {
    throw new Error(data?.error || await functionErrorMessage(error, "Не удалось удалить файл"));
  }
}
