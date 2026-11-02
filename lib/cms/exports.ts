import { post, downloadResponse } from "@/lib/cms/api";
import type { Period } from "@/lib/cms/types";

export async function download(path: string, fallback = "export.csv") {
  const response = await downloadResponse(path);
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    response.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] ||
    fallback;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportData(
  dataset: string,
  period: Period,
  filters: Record<string, string> = {},
) {
  const job = await post<{ download_url: string; record_count: number }>(
    "/admin/data/exports",
    {
      dataset,
      format: "csv",
      from_date: period.from,
      to_date: period.to,
      filters,
    },
    true,
  );
  await download(job.download_url.replace("/api/v1", ""));
  return job.record_count;
}
