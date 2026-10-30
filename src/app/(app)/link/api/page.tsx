"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { api, ApiError, post } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useOrigin } from "@/hooks/use-origin";
import { formatDateTime } from "@/lib/format";

type Key = { apiKey: string | null; prefix: string; createdAt: string };

const ERRORS: [number, string, string][] = [
  [401, "chua_xac_thuc", "API token sai hoặc đã bị thay bằng token mới"],
  [400, "url_khong_hop_le", "Link đích không phải địa chỉ http(s) đầy đủ, hoặc trỏ vào mạng nội bộ"],
  [400, "ten_mien_bi_chan", "Tên miền của link đích nằm trong danh sách chặn"],
  [409, "alias_da_ton_tai", "Alias đã có người dùng"],
  [429, "qua_nhieu_yeu_cau", "Gọi quá nhanh — chờ theo header Retry-After"],
];

function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-12 text-xs leading-relaxed">{children}</pre>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton value={children} size="xs" />
      </div>
    </div>
  );
}

export default function ApiKeyPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["api-key"],
    queryFn: async () => {
      try {
        return await api<Key>("/links/api-key");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
  const [fresh, setFresh] = useState<string | null>(null);
  const k = fresh ?? "YOUR_API_TOKEN";
  const endpoint = `${API_URL}/links/api-shorten`;
  const origin = useOrigin();

  return (
    <>
      <PageHeader
        title="API rút gọn link"
        description="Rút gọn link từ script, plugin hay website của bạn mà không cần đăng nhập. Lượt vượt link tạo bằng API vẫn tính tiền vào ví của bạn."
      />
      <div className="max-w-3xl space-y-6">
        {fresh && (
          <Alert>
            <KeyRound />
            <AlertTitle>Lưu lại token này — sẽ không hiện lần nữa</AlertTitle>
            <AlertDescription>
              <div className="my-2 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm break-all">{fresh}</code>
                <CopyButton value={fresh} />
              </div>
              Hệ thống chỉ lưu bản băm của token. Quên token thì tạo token mới (token cũ hết hiệu lực ngay).
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>API token của bạn</CardTitle>
            <CardDescription>
              {q.data ? `Đang dùng token ${q.data.prefix}… (tạo ${formatDateTime(q.data.createdAt)})` : "Chưa có token — tạo một token để dùng API."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionDialog
              trigger={<Button><KeyRound /> {q.data ? "Tạo token mới" : "Tạo token"}</Button>}
              title={q.data ? "Tạo token mới?" : "Tạo API token"}
              description={q.data ? "Token cũ hết hiệu lực ngay: script nào đang dùng token cũ sẽ bị từ chối." : undefined}
              onConfirm={async () => {
                const r = await post<Key>("/links/api-key");
                setFresh(r.apiKey);
                await qc.invalidateQueries({ queryKey: ["api-key"] });
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rút gọn link</CardTitle>
            <CardDescription>Gửi một request GET kèm API token và link đích, nhận về JSON.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Code>{`${endpoint}?api=${k}&url=yourdestinationlink.com`}</Code>
            <div className="space-y-1.5">
              <p>Tham số:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li><code className="text-foreground">api</code> — API token (bắt buộc). Có thể gửi qua header <code className="text-foreground">X-Api-Key</code> thay cho query.</li>
                <li><code className="text-foreground">url</code> — link đích, nhớ <code className="text-foreground">urlencode</code> (bắt buộc).</li>
                <li><code className="text-foreground">alias</code> — mã rút gọn tự chọn (không bắt buộc).</li>
              </ul>
            </div>
            <p>Thành công:</p>
            <Code>{`{"status":"success","shortenedUrl":"${origin}/g/xxxxxx"}`}</Code>
            <p>Lỗi (kèm mã HTTP tương ứng):</p>
            <Code>{`{"status":"error","code":"url_khong_hop_le","message":"Link dich phai la dia chi http(s) day du."}`}</Code>
            <p className="text-muted-foreground">
              Link mới ở trạng thái chờ quét an toàn vài giây rồi mới hoạt động. Link đích độc hại hoặc vi phạm sẽ bị chặn và doanh thu đang treo bị giữ lại.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ví dụ</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="php">
              <TabsList>
                <TabsTrigger value="php">PHP</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="js">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="php" className="mt-3">
                <Code>{`$long_url = urlencode('yourdestinationlink.com');
$api_token = '${k}';
$api_url = "${endpoint}?api={$api_token}&url={$long_url}";
$result = @json_decode(file_get_contents($api_url), TRUE);
if ($result["status"] !== 'success') {
    echo $result["message"];
} else {
    echo $result["shortenedUrl"];
}`}</Code>
                <p className="mt-2 text-xs text-muted-foreground">
                  Với mã lỗi HTTP, <code>file_get_contents</code> cần <code>stream_context_create([&apos;http&apos; =&gt; [&apos;ignore_errors&apos; =&gt; true]])</code> để đọc được JSON lỗi.
                </p>
              </TabsContent>
              <TabsContent value="curl" className="mt-3">
                <Code>{`curl -G "${endpoint}" \\
  --data-urlencode "api=${k}" \\
  --data-urlencode "url=https://example.com/bai-viet"`}</Code>
              </TabsContent>
              <TabsContent value="js" className="mt-3">
                <Code>{`const qs = new URLSearchParams({ api: "${k}", url: "https://example.com/bai-viet" });
const r = await fetch("${endpoint}?" + qs).then((x) => x.json());
console.log(r.status === "success" ? r.shortenedUrl : r.message);`}</Code>
              </TabsContent>
              <TabsContent value="python" className="mt-3">
                <Code>{`import requests

r = requests.get("${endpoint}", params={"api": "${k}", "url": "https://example.com/bai-viet"}).json()
print(r["shortenedUrl"] if r["status"] == "success" else r["message"])`}</Code>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mã lỗi</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HTTP</TableHead>
                  <TableHead>code</TableHead>
                  <TableHead>Ý nghĩa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ERRORS.map(([s, c, m]) => (
                  <TableRow key={c}>
                    <TableCell>{s}</TableCell>
                    <TableCell><code className="text-xs">{c}</code></TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{m}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cách khác</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Quick Link — dán vào thanh địa chỉ trình duyệt, trả về link rút gọn dạng chữ thuần:</p>
            <Code>{`${API_URL}/links/quick?api=${k}&url=https://example.com/bai-viet`}</Code>
            <p>Tạo link đầy đủ tuỳ chọn (mật khẩu, hạn dùng, chiến dịch) bằng POST:</p>
            <Code>{`curl -X POST ${API_URL}/links \\
  -H "X-Api-Key: ${k}" -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/bai-viet","password":"1234","expiresAt":"2026-12-31T00:00:00Z"}'`}</Code>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
